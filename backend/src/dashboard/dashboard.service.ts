import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // Single endpoint that returns all KPIs in one call — so the frontend
  // dashboard doesn't need 8 separate round trips on load.
  async ownerSummary() {
    const today = new Date(); today.setHours(0,0,0,0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todayInvoices,
      monthInvoices,
      purchaseInvoices,
      productionOrders,
      branches,
      accounts,
      lowStockProducts,
      pendingTransfers,
    ] = await Promise.all([
      this.prisma.salesInvoice.findMany({ where: { createdAt: { gte: today } } }),
      this.prisma.salesInvoice.findMany({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.purchaseInvoice.findMany(),
      this.prisma.productionOrder.findMany({ where: { status: 'COMPLETED', completedAt: { gte: monthStart } } }),
      this.prisma.branch.findMany({ where: { isActive: true } }),
      this.prisma.account.findMany(),
      this.prisma.product.findMany({ where: { isActive: true }, include: { stock: true } }),
      this.prisma.stockTransfer.findMany({ where: { status: { in: ['REQUESTED', 'APPROVED', 'IN_TRANSIT'] } } }),
    ]);

    const cashBalance = accounts.filter((a) => a.type === 'CASH').reduce((s, a) => s + Number(a.balance), 0);
    const bankBalance = accounts.filter((a) => a.type === 'BANK').reduce((s, a) => s + Number(a.balance), 0);

    const low = lowStockProducts.filter((p) => {
      const total = p.stock.reduce((s, s2) => s + Number(s2.quantity), 0);
      return total <= Number(p.minimumStock);
    });

    // Per-branch sales for the branch performance chart
    const branchSales = await Promise.all(
      branches.map(async (b) => {
        const invoices = await this.prisma.salesInvoice.findMany({
          where: { salesOrder: { branchId: b.id }, createdAt: { gte: monthStart } },
        });
        return { branch: b.name, monthlySales: invoices.reduce((s, i) => s + Number(i.totalAmount), 0) };
      }),
    );

    return {
      todaySales: todayInvoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      monthlySales: monthInvoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      totalPurchases: purchaseInvoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      totalProduction: productionOrders.reduce((s, o) => s + Number(o.quantityProduced), 0),
      totalReceivables: monthInvoices.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0),
      totalPayables: purchaseInvoices.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0),
      cashBalance,
      bankBalance,
      branchSales,
      lowStockCount: low.length,
      lowStockItems: low.slice(0, 10).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        totalStock: p.stock.reduce((s, s2) => s + Number(s2.quantity), 0),
        minimumStock: Number(p.minimumStock),
      })),
      pendingTransfers: pendingTransfers.length,
    };
  }

  // 6-month sales trend for the chart
  async salesTrend(branchId?: string) {
    const months: { year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }

    const results = await Promise.all(
      months.map(async ({ year, month }) => {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        const invoices = await this.prisma.salesInvoice.findMany({
          where: {
            createdAt: { gte: start, lte: end },
            ...(branchId ? { salesOrder: { branchId } } : {}),
          },
        });
        return {
          month: start.toLocaleString('default', { month: 'short' }),
          sales: invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
        };
      }),
    );
    return results;
  }
}
