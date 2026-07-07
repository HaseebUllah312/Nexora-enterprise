import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { GoodsReceivingDto } from './dto/goods-receiving.dto';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { RecordSupplierPaymentDto } from './dto/record-supplier-payment.dto';

@Injectable()
export class PurchasesService {
  constructor(private prisma: PrismaService) {}

  // Workflow: REQUISITION → ORDERED → RECEIVED → INVOICED
  async createOrder(dto: CreatePurchaseOrderDto, userId: string) {
    const orderNo = `PO-${Date.now()}`;
    return this.prisma.purchaseOrder.create({
      data: {
        orderNo,
        supplierId: dto.supplierId,
        branchId: dto.branchId,
        createdById: userId,
        status: 'REQUISITION',
        items: { create: dto.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })) },
      },
      include: { items: { include: { product: true } }, supplier: true },
    });
  }

  findOrders(branchId?: string, supplierId?: string, status?: string) {
    return this.prisma.purchaseOrder.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(supplierId ? { supplierId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: { supplier: true, invoice: true, items: { include: { product: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneOrder(id: string) {
    const o = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, supplier: true, branch: true, invoice: true },
    });
    if (!o) throw new NotFoundException('Purchase order not found');
    return o;
  }

  async approveOrder(id: string) {
    const order = await this.findOneOrder(id);
    if (order.status !== 'REQUISITION') throw new BadRequestException('Only REQUISITION orders can be approved');
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'ORDERED' } });
  }

  // GRN: goods physically received at warehouse → increment stock
  async goodsReceiving(dto: GoodsReceivingDto) {
    const order = await this.findOneOrder(dto.purchaseOrderId);
    if (order.status !== 'ORDERED') throw new BadRequestException('Order must be in ORDERED status before receiving goods');

    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    return this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.stock.upsert({
          where: {
            productId_warehouseId_batchNumber: {
              productId: item.productId,
              warehouseId: dto.warehouseId,
              batchNumber: '',
            },
          },
          update: { quantity: { increment: Number(item.quantity) } },
          create: { productId: item.productId, warehouseId: dto.warehouseId, branchId: warehouse.branchId, quantity: Number(item.quantity) },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'PURCHASE',
            quantity: Number(item.quantity),
            referenceType: 'PurchaseOrder',
            referenceId: order.id,
          },
        });
      }
      return tx.purchaseOrder.update({ where: { id: dto.purchaseOrderId }, data: { status: 'RECEIVED' } });
    }, { timeout: 30000 });
  }

  async createInvoice(dto: CreatePurchaseInvoiceDto) {
    const order = await this.findOneOrder(dto.purchaseOrderId);
    if (order.invoice) throw new BadRequestException('Invoice already exists for this order');
    if (order.status !== 'RECEIVED') throw new BadRequestException('Cannot invoice before goods are received');

    const total = order.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitCost), 0);
    const invoiceNo = `PINV-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.create({
        data: { invoiceNo, purchaseOrderId: dto.purchaseOrderId, totalAmount: total, paidAmount: 0 },
      });
      await tx.purchaseOrder.update({ where: { id: dto.purchaseOrderId }, data: { status: 'INVOICED' } });

      // Automatically post purchase invoice to accounting
      const getBranchAccount = async (name: string, type: 'CASH' | 'BANK' | 'RECEIVABLE' | 'PAYABLE' | 'INCOME' | 'EXPENSE') => {
        let acc = await tx.account.findFirst({
          where: { branchId: order.branchId, type },
        });
        if (!acc) {
          const branch = await tx.branch.findUnique({ where: { id: order.branchId } });
          acc = await tx.account.create({
            data: {
              name: `${branch?.name || 'Branch'} ${name}`,
              type,
              branchId: order.branchId,
              balance: 0,
            },
          });
        }
        return acc;
      };

      const payAcc = await getBranchAccount('Accounts Payable', 'PAYABLE');
      const expAcc = await getBranchAccount('Operating Expenses', 'EXPENSE');

      // Debit Expense
      await tx.transaction.create({
        data: {
          accountId: expAcc.id,
          type: 'DEBIT',
          amount: total,
          description: `Inventory Purchase Invoice #${invoiceNo} for PO #${order.orderNo}`,
          referenceType: 'PurchaseInvoice',
          referenceId: invoice.id,
        },
      });
      await tx.account.update({
        where: { id: expAcc.id },
        data: { balance: { increment: total } },
      });

      // Credit Payables
      await tx.transaction.create({
        data: {
          accountId: payAcc.id,
          type: 'CREDIT',
          amount: total,
          description: `Accounts Payable recorded for Invoice #${invoiceNo}`,
          referenceType: 'PurchaseInvoice',
          referenceId: invoice.id,
        },
      });
      await tx.account.update({
        where: { id: payAcc.id },
        data: { balance: { increment: -total } },
      });

      return invoice;
    }, { timeout: 30000 });
  }

  async recordPayment(dto: RecordSupplierPaymentDto) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({ 
      where: { id: dto.invoiceId },
      include: { purchaseOrder: true }
    });
    if (!invoice) throw new NotFoundException('Purchase invoice not found');
    const outstanding = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (dto.amount > outstanding) throw new BadRequestException(`Payment exceeds outstanding balance of ${outstanding}`);
    
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseInvoice.update({ 
        where: { id: dto.invoiceId }, 
        data: { paidAmount: { increment: dto.amount } } 
      });

      // Helper function to find or create standard accounts for a branch
      const getBranchAccount = async (name: string, type: 'CASH' | 'BANK' | 'RECEIVABLE' | 'PAYABLE' | 'INCOME' | 'EXPENSE') => {
        let acc = await tx.account.findFirst({
          where: { branchId: invoice.purchaseOrder.branchId, type },
        });
        if (!acc) {
          const branch = await tx.branch.findUnique({ where: { id: invoice.purchaseOrder.branchId } });
          acc = await tx.account.create({
            data: {
              name: `${branch?.name || 'Branch'} ${name}`,
              type,
              branchId: invoice.purchaseOrder.branchId,
              balance: 0,
            },
          });
        }
        return acc;
      };

      const payAcc = await getBranchAccount('Accounts Payable', 'PAYABLE');
      const cashAcc = await getBranchAccount('Cash in Hand', 'CASH');

      // Debit Payables
      await tx.transaction.create({
        data: {
          accountId: payAcc.id,
          type: 'DEBIT',
          amount: dto.amount,
          description: `Supplier payment for Purchase Invoice #${invoice.invoiceNo}`,
          referenceType: 'SupplierPayment',
          referenceId: invoice.id,
        },
      });
      await tx.account.update({
        where: { id: payAcc.id },
        data: { balance: { increment: dto.amount } },
      });

      // Credit Cash
      await tx.transaction.create({
        data: {
          accountId: cashAcc.id,
          type: 'CREDIT',
          amount: dto.amount,
          description: `Cash paid for Purchase Invoice #${invoice.invoiceNo}`,
          referenceType: 'SupplierPayment',
          referenceId: invoice.id,
        },
      });
      await tx.account.update({
        where: { id: cashAcc.id },
        data: { balance: { increment: -dto.amount } },
      });

      return updated;
    }, { timeout: 30000 });
  }

  async purchaseSummary(branchId?: string) {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: { purchaseOrder: { ...(branchId ? { branchId } : {}) } },
    });
    const monthInvoices = invoices.filter((i) => i.createdAt >= monthStart);
    return {
      totalPurchases: invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      monthlyPurchases: monthInvoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      totalPayables: invoices.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0),
    };
  }
}
