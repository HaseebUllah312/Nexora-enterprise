import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReturnsService {
  constructor(private prisma: PrismaService) {}

  // ── SALE RETURNS (customer returns goods, we issue credit note) ───────────
  async createSaleReturn(dto: {
    invoiceId: string; reason: string; branchId: string;
    items: { productId: string; productName: string; quantity: number; unitPrice: number }[];
  }) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id: dto.invoiceId },
      include: { salesOrder: { include: { items: { include: { product: true } } } } },
    });
    if (!invoice) throw new NotFoundException('Sales invoice not found');

    const totalAmount = dto.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const returnNo = `CRN-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      // Add stock back for returned products
      const warehouse = await tx.warehouse.findFirst({ where: { branchId: dto.branchId } });
      if (warehouse) {
        for (const item of dto.items) {
          await tx.stock.upsert({
            where: { productId_warehouseId_batchNumber: { productId: item.productId, warehouseId: warehouse.id, batchNumber: '' } },
            update: { quantity: { increment: item.quantity } },
            create: { productId: item.productId, warehouseId: warehouse.id, branchId: dto.branchId, quantity: item.quantity },
          });
          await tx.stockMovement.create({
            data: { productId: item.productId, type: 'STOCK_IN', quantity: item.quantity,
              referenceType: 'SaleReturn', notes: `Return: ${dto.reason}` },
          });
        }
      }
      // Reduce invoice paid amount (refund effect)
      const refund = Math.min(totalAmount, Number(invoice.paidAmount));
      await tx.salesInvoice.update({ where: { id: dto.invoiceId },
        data: { paidAmount: { decrement: refund }, totalAmount: { decrement: totalAmount } } });

      // Automatically post returns to accounting
      const getBranchAccount = async (name: string, type: 'CASH' | 'BANK' | 'RECEIVABLE' | 'PAYABLE' | 'INCOME' | 'EXPENSE') => {
        let acc = await tx.account.findFirst({
          where: { branchId: dto.branchId, type },
        });
        if (!acc) {
          const branch = await tx.branch.findUnique({ where: { id: dto.branchId } });
          acc = await tx.account.create({
            data: {
              name: `${branch?.name || 'Branch'} ${name}`,
              type,
              branchId: dto.branchId,
              balance: 0,
            },
          });
        }
        return acc;
      };

      const revenueAcc = await getBranchAccount('Sales Revenue', 'INCOME');
      const recvAcc = await getBranchAccount('Accounts Receivable', 'RECEIVABLE');

      // Debit Sales Revenue (reduce income)
      await tx.transaction.create({
        data: {
          accountId: revenueAcc.id,
          type: 'DEBIT',
          amount: totalAmount,
          description: `Sales Return Credit Note #${returnNo}`,
          referenceType: 'SaleReturn',
          referenceId: invoice.id,
        },
      });
      await tx.account.update({
        where: { id: revenueAcc.id },
        data: { balance: { increment: totalAmount } },
      });

      // Credit Receivables (reduce receivables)
      await tx.transaction.create({
        data: {
          accountId: recvAcc.id,
          type: 'CREDIT',
          amount: totalAmount,
          description: `Accounts Receivable credit for Return #${returnNo}`,
          referenceType: 'SaleReturn',
          referenceId: invoice.id,
        },
      });
      await tx.account.update({
        where: { id: recvAcc.id },
        data: { balance: { increment: -totalAmount } },
      });

      return tx.saleReturn.create({
        data: { returnNo, invoiceId: dto.invoiceId, reason: dto.reason,
          items: dto.items as any, totalAmount, branchId: dto.branchId },
      });
    }, { timeout: 30000 });
  }

  getSaleReturns(branchId?: string) {
    return this.prisma.saleReturn.findMany({
      where: branchId ? { branchId } : {},
      include: { invoice: true, branch: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── PURCHASE RETURNS (we return goods to supplier, debit note) ────────────
  async createPurchaseReturn(dto: {
    invoiceId: string; reason: string; branchId: string;
    items: { productId: string; productName: string; quantity: number; unitCost: number }[];
  }) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({ where: { id: dto.invoiceId } });
    if (!invoice) throw new NotFoundException('Purchase invoice not found');

    const totalAmount = dto.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
    const returnNo = `DBN-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      // Deduct stock for returned items
      const warehouse = await tx.warehouse.findFirst({ where: { branchId: dto.branchId } });
      if (warehouse) {
        for (const item of dto.items) {
          const stock = await tx.stock.findFirst({ where: { productId: item.productId, warehouseId: warehouse.id } });
          if (stock && Number(stock.quantity) >= item.quantity) {
            await tx.stock.update({ where: { id: stock.id }, data: { quantity: { decrement: item.quantity } } });
          }
          await tx.stockMovement.create({
            data: { productId: item.productId, type: 'STOCK_OUT', quantity: item.quantity,
              referenceType: 'PurchaseReturn', notes: `Return to supplier: ${dto.reason}` },
          });
        }
      }
      // Reduce invoice amount
      await tx.purchaseInvoice.update({ where: { id: dto.invoiceId },
        data: { totalAmount: { decrement: totalAmount } } });

      // Automatically post returns to accounting
      const getBranchAccount = async (name: string, type: 'CASH' | 'BANK' | 'RECEIVABLE' | 'PAYABLE' | 'INCOME' | 'EXPENSE') => {
        let acc = await tx.account.findFirst({
          where: { branchId: dto.branchId, type },
        });
        if (!acc) {
          const branch = await tx.branch.findUnique({ where: { id: dto.branchId } });
          acc = await tx.account.create({
            data: {
              name: `${branch?.name || 'Branch'} ${name}`,
              type,
              branchId: dto.branchId,
              balance: 0,
            },
          });
        }
        return acc;
      };

      const payAcc = await getBranchAccount('Accounts Payable', 'PAYABLE');
      const expAcc = await getBranchAccount('Operating Expenses', 'EXPENSE');

      // Debit Payables (reduce payables)
      await tx.transaction.create({
        data: {
          accountId: payAcc.id,
          type: 'DEBIT',
          amount: totalAmount,
          description: `Purchase Return Debit Note #${returnNo}`,
          referenceType: 'PurchaseReturn',
          referenceId: invoice.id,
        },
      });
      await tx.account.update({
        where: { id: payAcc.id },
        data: { balance: { increment: totalAmount } },
      });

      // Credit Expense (reduce expense)
      await tx.transaction.create({
        data: {
          accountId: expAcc.id,
          type: 'CREDIT',
          amount: totalAmount,
          description: `Operating Expense credit for Purchase Return #${returnNo}`,
          referenceType: 'PurchaseReturn',
          referenceId: invoice.id,
        },
      });
      await tx.account.update({
        where: { id: expAcc.id },
        data: { balance: { increment: -totalAmount } },
      });

      return tx.purchaseReturn.create({
        data: { returnNo, invoiceId: dto.invoiceId, reason: dto.reason,
          items: dto.items as any, totalAmount, branchId: dto.branchId },
      });
    }, { timeout: 30000 });
  }

  getPurchaseReturns(branchId?: string) {
    return this.prisma.purchaseReturn.findMany({
      where: branchId ? { branchId } : {},
      include: { invoice: true, branch: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
