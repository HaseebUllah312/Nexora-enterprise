import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  // ── SALES ORDERS ──────────────────────────────────────────────────────────
  async createOrder(dto: CreateSalesOrderDto, userId: string) {
    const year = new Date().getFullYear();
    
    // Get branch code to prevent unique constraint collisions between branches
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
    const branchCode = branch?.code ?? 'SO';

    // Atomic sequential order number per branch
    const count = await this.prisma.salesOrder.count({ where: { branchId: dto.branchId } });
    const orderNo = `SO-${branchCode}-${year}-${String(count + 1).padStart(5, '0')}`;

    return this.prisma.salesOrder.create({
      data: {
        orderNo, customerId: dto.customerId,
        branchId: dto.branchId, createdById: userId, status: 'QUOTATION',
        items: { create: dto.items.map(i => ({
          productId: i.productId, quantity: i.quantity,
          unitPrice: i.unitPrice, discount: i.discount ?? 0,
        }))},
      },
      include: { items: { include: { product: true } }, customer: true, branch: true },
    });
  }

  findOrders(branchId?: string, customerId?: string, status?: string) {
    return this.prisma.salesOrder.findMany({
      where: {
        ...(branchId   ? { branchId }   : {}),
        ...(customerId ? { customerId } : {}),
        ...(status     ? { status: status as any } : {}),
      },
      include: { customer: true, invoice: true, items: { include: { product: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneOrder(id: string) {
    const o = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        customer: true, branch: true, invoice: true,
        challan: true,
      },
    });
    if (!o) throw new NotFoundException('Sales order not found');
    return o;
  }

  async confirmOrder(id: string) {
    const order = await this.findOneOrder(id);
    if (order.status !== 'QUOTATION') throw new BadRequestException('Only QUOTATION orders can be confirmed');
    return this.prisma.salesOrder.update({ where: { id }, data: { status: 'CONFIRMED' } });
  }

  async cancelOrder(id: string) {
    const order = await this.findOneOrder(id);
    if (['INVOICED','CANCELLED'].includes(order.status)) {
      throw new BadRequestException(`Cannot cancel a ${order.status} order`);
    }
    return this.prisma.salesOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  // ── INVOICING ─────────────────────────────────────────────────────────────
  async createInvoice(dto: CreateInvoiceDto) {
    const order = await this.findOneOrder(dto.salesOrderId);
    if (order.invoice) throw new BadRequestException('Invoice already exists for this order');
    if (order.status === 'CANCELLED') throw new BadRequestException('Cannot invoice a cancelled order');

    // Check customer credit limit for credit sales
    if (dto.paymentMethod === 'CREDIT') {
      const customer = await this.prisma.customer.findUnique({ where: { id: order.customerId } });
      if (customer && Number(customer.creditLimit) > 0) {
        const outstanding = await this.getCustomerOutstanding(order.customerId);
        const orderTotal = order.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice) - Number(i.discount), 0);
        if (outstanding + orderTotal > Number(customer.creditLimit)) {
          throw new BadRequestException(
            `Credit limit exceeded. Limit: PKR ${Number(customer.creditLimit).toLocaleString()}, ` +
            `Current outstanding: PKR ${outstanding.toLocaleString()}`
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch or create company settings inside the transaction
      let settings = await tx.companySettings.findUnique({ where: { branchId: order.branchId } });
      const branch = await tx.branch.findUnique({ where: { id: order.branchId } });
      const branchCode = branch?.code ?? 'BR';

      if (!settings) {
        settings = await tx.companySettings.create({
          data: {
            branchId: order.branchId,
            companyName: branch?.name ?? 'My Company',
            city: branch?.city ?? '',
            phone: branch?.phone ?? '',
            address: branch?.address ?? '',
          },
        });
      }

      // 2. Generate sequential invoice number (include branchCode to prevent cross-branch conflicts)
      const year = new Date().getFullYear();
      const prefix = settings.invoicePrefix || 'INV';
      const count = settings.invoiceCounter;
      const invoiceNo = `${prefix}-${branchCode}-${year}-${String(count).padStart(5, '0')}`;

      // 3. Increment company settings counter
      await tx.companySettings.update({
        where: { branchId: order.branchId },
        data: { invoiceCounter: { increment: 1 } },
      });

      // 4. Calculate tax and total amounts
      const defaultTaxRate = settings.taxRate ?? 0;
      const taxRate = dto.taxRate !== undefined ? dto.taxRate : defaultTaxRate;
      const subtotal = order.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice) - Number(i.discount), 0);
      const taxAmount = Math.round((subtotal * taxRate / 100) * 100) / 100;
      const total = subtotal + taxAmount;

      const invoice = await tx.salesInvoice.create({
        data: {
          invoiceNo, salesOrderId: dto.salesOrderId,
          totalAmount: total, paidAmount: dto.paymentMethod === 'CASH' ? total : 0,
          paymentMethod: dto.paymentMethod as any,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          taxRate,
          taxAmount,
        },
      });

      await tx.salesOrder.update({ where: { id: dto.salesOrderId }, data: { status: 'INVOICED' } });

      // Update customer balance for credit sales
      if (dto.paymentMethod === 'CREDIT') {
        await tx.customer.update({
          where: { id: order.customerId },
          data: { balance: { increment: total } },
        });
      }

      // Automatically post accounting entries
      const getBranchAccount = async (name: string, type: 'CASH' | 'BANK' | 'RECEIVABLE' | 'PAYABLE' | 'INCOME' | 'EXPENSE') => {
        let acc = await tx.account.findFirst({
          where: { branchId: order.branchId, type },
        });
        if (!acc) {
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

      const revenueAcc = await getBranchAccount('Sales Revenue', 'INCOME');
      
      // Credit: Income / Sales Revenue (increases revenue)
      await tx.transaction.create({
        data: {
          accountId: revenueAcc.id,
          type: 'CREDIT',
          amount: total,
          description: `Sales Invoice #${invoiceNo} for Order #${order.orderNo}`,
          referenceType: 'SalesInvoice',
          referenceId: invoice.id,
        },
      });
      await tx.account.update({
        where: { id: revenueAcc.id },
        data: { balance: { increment: -total } },
      });

      if (dto.paymentMethod === 'CASH') {
        // Debit Cash
        const cashAcc = await getBranchAccount('Cash in Hand', 'CASH');
        await tx.transaction.create({
          data: {
            accountId: cashAcc.id,
            type: 'DEBIT',
            amount: total,
            description: `Cash received for Invoice #${invoiceNo}`,
            referenceType: 'SalesInvoice',
            referenceId: invoice.id,
          },
        });
        await tx.account.update({
          where: { id: cashAcc.id },
          data: { balance: { increment: total } },
        });
      } else {
        // Debit Receivables
        const recvAcc = await getBranchAccount('Accounts Receivable', 'RECEIVABLE');
        await tx.transaction.create({
          data: {
            accountId: recvAcc.id,
            type: 'DEBIT',
            amount: total,
            description: `Accounts Receivable created for Invoice #${invoiceNo}`,
            referenceType: 'SalesInvoice',
            referenceId: invoice.id,
          },
        });
        await tx.account.update({
          where: { id: recvAcc.id },
          data: { balance: { increment: total } },
        });
      }

      // Deduct stock
      for (const item of order.items) {
        const stock = await tx.stock.findFirst({
          where: { productId: item.productId, branchId: order.branchId },
          orderBy: { quantity: 'desc' },
        });
        if (stock && Number(stock.quantity) >= Number(item.quantity)) {
          await tx.stock.update({ where: { id: stock.id }, data: { quantity: { decrement: Number(item.quantity) } } });
        }
        await tx.stockMovement.create({
          data: {
            productId: item.productId, type: 'SALE',
            quantity: -Number(item.quantity),
            referenceType: 'SalesInvoice', referenceId: invoice.id,
            notes: `Sold ${item.quantity} units via Invoice #${invoiceNo} to ${order.customer?.name || 'Walk-in Customer'}`,
          },
        });

        // Check if stock fell below minimum
        const product = item.product;
        if (product && Number(product.minimumStock) > 0) {
          const branchStock = await tx.stock.aggregate({
            where: { productId: item.productId, branchId: order.branchId },
            _sum: { quantity: true },
          });
          const currentBranchQty = branchStock._sum.quantity ? Number(branchStock._sum.quantity) : 0;
          if (currentBranchQty < Number(product.minimumStock)) {
            await tx.notification.create({
              data: {
                userId: null,
                type: 'LOW_STOCK',
                title: 'Low Stock Alert',
                message: `Product "${product.name}" in branch "${branch?.name ?? 'Branch'}" is low on stock. Current: ${currentBranchQty}, Minimum: ${product.minimumStock}`,
              },
            });
          }
        }
      }

      return { ...invoice, taxAmount, subtotal };
    }, { timeout: 30000 });
  }

  async recordPayment(dto: RecordPaymentDto) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id: dto.invoiceId },
      include: { salesOrder: { include: { customer: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const outstanding = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (dto.amount > outstanding) throw new BadRequestException(`Payment PKR ${dto.amount} exceeds outstanding PKR ${outstanding}`);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.salesInvoice.update({
        where: { id: dto.invoiceId },
        data: { paidAmount: { increment: dto.amount } },
      });
      // Reduce customer balance
      await tx.customer.update({
        where: { id: invoice.salesOrder.customerId },
        data: { balance: { decrement: dto.amount } },
      });

      // Automatically post payment to accounting
      const getBranchAccount = async (name: string, type: 'CASH' | 'BANK' | 'RECEIVABLE' | 'PAYABLE' | 'INCOME' | 'EXPENSE') => {
        let acc = await tx.account.findFirst({
          where: { branchId: invoice.salesOrder.branchId, type },
        });
        if (!acc) {
          const branch = await tx.branch.findUnique({ where: { id: invoice.salesOrder.branchId } });
          acc = await tx.account.create({
            data: {
              name: `${branch?.name || 'Branch'} ${name}`,
              type,
              branchId: invoice.salesOrder.branchId,
              balance: 0,
            },
          });
        }
        return acc;
      };

      const cashAcc = await getBranchAccount('Cash in Hand', 'CASH');
      const recvAcc = await getBranchAccount('Accounts Receivable', 'RECEIVABLE');

      // Debit Cash
      await tx.transaction.create({
        data: {
          accountId: cashAcc.id,
          type: 'DEBIT',
          amount: dto.amount,
          description: `Payment received for Invoice #${invoice.invoiceNo}`,
          referenceType: 'SalesInvoicePayment',
          referenceId: invoice.id,
        },
      });
      await tx.account.update({
        where: { id: cashAcc.id },
        data: { balance: { increment: dto.amount } },
      });

      // Credit Receivables
      await tx.transaction.create({
        data: {
          accountId: recvAcc.id,
          type: 'CREDIT',
          amount: dto.amount,
          description: `Payment credit for Invoice #${invoice.invoiceNo}`,
          referenceType: 'SalesInvoicePayment',
          referenceId: invoice.id,
        },
      });
      await tx.account.update({
        where: { id: recvAcc.id },
        data: { balance: { increment: -dto.amount } },
      });

      return updated;
    }, { timeout: 30000 });
  }

  private async getCustomerOutstanding(customerId: string): Promise<number> {
    const invoices = await this.prisma.salesInvoice.findMany({
      where: { salesOrder: { customerId } },
    });
    return invoices.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0);
  }

  async salesSummary(branchId?: string) {
    const today = new Date(); today.setHours(0,0,0,0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [todayInv, monthInv, outstanding] = await Promise.all([
      this.prisma.salesInvoice.findMany({ where: { createdAt: { gte: today }, salesOrder: { ...(branchId?{branchId}:{}) } } }),
      this.prisma.salesInvoice.findMany({ where: { createdAt: { gte: monthStart }, salesOrder: { ...(branchId?{branchId}:{}) } } }),
      this.prisma.salesInvoice.findMany({ where: { salesOrder: { ...(branchId?{branchId}:{}) } } }),
    ]);
    return {
      todaySales:       todayInv.reduce((s, i) => s + Number(i.totalAmount), 0),
      monthlySales:     monthInv.reduce((s, i) => s + Number(i.totalAmount), 0),
      totalReceivables: outstanding.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0),
      invoiceCount:     monthInv.length,
    };
  }

  async customerStatement(customerId: string, from?: string, to?: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, include: { branch: true } });
    if (!customer) throw new NotFoundException('Customer not found');

    const orders = await this.prisma.salesOrder.findMany({
      where: {
        customerId,
        invoice: { isNot: null },
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to)   } : {}),
        },
      },
      include: { invoice: true },
      orderBy: { createdAt: 'asc' },
    });

    let balance = 0;
    const entries = orders.map(o => {
      const inv = o.invoice!;
      const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
      balance += outstanding;
      return {
        date:         o.createdAt,
        invoiceNo:    inv.invoiceNo,
        orderNo:      o.orderNo,
        totalAmount:  Number(inv.totalAmount),
        paidAmount:   Number(inv.paidAmount),
        outstanding,
        runningBalance: balance,
      };
    });

    return { customer, entries, totalOutstanding: balance };
  }

  async agingReport(branchId?: string) {
    const now = new Date();
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        salesOrder: { ...(branchId ? { branchId } : {}) },
        paidAmount: { lt: this.prisma.salesInvoice.fields.totalAmount },
      },
      include: { salesOrder: { include: { customer: true } } },
    });

    const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    const rows = invoices
      .map(inv => {
        const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
        if (outstanding <= 0) return null;
        const daysOld = Math.floor((now.getTime() - inv.createdAt.getTime()) / 86400000);
        if (daysOld <= 30)       buckets.current += outstanding;
        else if (daysOld <= 60)  buckets.days30  += outstanding;
        else if (daysOld <= 90)  buckets.days60  += outstanding;
        else if (daysOld <= 120) buckets.days90  += outstanding;
        else                     buckets.over90  += outstanding;
        return {
          customer:    inv.salesOrder.customer.name,
          invoiceNo:   inv.invoiceNo,
          invoiceDate: inv.createdAt,
          daysOld,
          outstanding,
          bucket: daysOld <= 30 ? 'Current' : daysOld <= 60 ? '31-60' : daysOld <= 90 ? '61-90' : daysOld <= 120 ? '91-120' : '120+',
        };
      })
      .filter(Boolean);

    return { rows, buckets, total: Object.values(buckets).reduce((a, b) => a + b, 0) };
  }
}
