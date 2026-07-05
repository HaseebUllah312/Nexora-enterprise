import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Reporting service — generates structured data payloads for every report type.
 * Actual file generation (PDF / Excel) happens in the controller using
 * lightweight libraries (pdfkit + exceljs) so this service stays testable
 * and framework-independent.
 */
@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ── SALES REPORTS ─────────────────────────────────────────────────────

  async dailySalesReport(date: string, branchId?: string) {
    const start = new Date(date);
    const end   = new Date(date); end.setDate(end.getDate() + 1);

    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        salesOrder: { ...(branchId ? { branchId } : {}) },
      },
      include: {
        salesOrder: {
          include: {
            customer: true,
            branch: true,
            items: { include: { product: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      reportType: 'DAILY_SALES',
      date,
      branchId,
      totalInvoices: invoices.length,
      totalAmount: invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      totalPaid:   invoices.reduce((s, i) => s + Number(i.paidAmount), 0),
      totalOutstanding: invoices.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0),
      invoices,
    };
  }

  async monthlySalesReport(year: number, month: number, branchId?: string) {
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 1);

    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        salesOrder: { ...(branchId ? { branchId } : {}) },
      },
      include: { salesOrder: { include: { customer: true, branch: true } } },
    });

    // Group by day for trend line
    const byDay = new Map<string, number>();
    for (const inv of invoices) {
      const d = inv.createdAt.toISOString().slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + Number(inv.totalAmount));
    }

    return {
      reportType: 'MONTHLY_SALES',
      year, month, branchId,
      totalAmount: invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      totalInvoices: invoices.length,
      dailyBreakdown: [...byDay.entries()].map(([date, amount]) => ({ date, amount })),
      invoices,
    };
  }

  async branchSalesReport(branchId: string, from: string, to: string) {
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        salesOrder: { branchId },
        createdAt: { gte: new Date(from), lte: new Date(to) },
      },
      include: { salesOrder: { include: { customer: true, items: { include: { product: true } } } } },
    });

    // Product-level breakdown
    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const inv of invoices) {
      for (const item of inv.salesOrder.items) {
        const key = item.productId;
        if (!productMap.has(key)) productMap.set(key, { name: item.product.name, qty: 0, revenue: 0 });
        const p = productMap.get(key)!;
        p.qty     += Number(item.quantity);
        p.revenue += Number(item.quantity) * Number(item.unitPrice) - Number(item.discount);
      }
    }

    return {
      reportType: 'BRANCH_SALES',
      branchId, from, to,
      totalAmount: invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      totalInvoices: invoices.length,
      productBreakdown: [...productMap.values()].sort((a, b) => b.revenue - a.revenue),
      invoices,
    };
  }

  // ── INVENTORY REPORTS ─────────────────────────────────────────────────

  async stockReport(branchId?: string) {
    const stock = await this.prisma.stock.findMany({
      where: branchId ? { branchId } : undefined,
      include: { product: true, warehouse: true, branch: true },
      orderBy: { product: { name: 'asc' } },
    });

    const lowStock = stock.filter(
      (s) => Number(s.quantity) <= Number(s.product.minimumStock),
    );

    return {
      reportType: 'STOCK',
      branchId,
      totalLines: stock.length,
      lowStockCount: lowStock.length,
      stock,
      lowStock,
    };
  }

  // ── PURCHASE REPORTS ──────────────────────────────────────────────────

  async purchaseReport(from: string, to: string, branchId?: string) {
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: {
        createdAt: { gte: new Date(from), lte: new Date(to) },
        purchaseOrder: { ...(branchId ? { branchId } : {}) },
      },
      include: { purchaseOrder: { include: { supplier: true, branch: true, items: { include: { product: true } } } } },
    });

    return {
      reportType: 'PURCHASES',
      from, to, branchId,
      totalAmount: invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      totalPaid:   invoices.reduce((s, i) => s + Number(i.paidAmount), 0),
      totalPayable: invoices.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0),
      invoices,
    };
  }

  // ── PRODUCTION REPORTS ────────────────────────────────────────────────

  async productionReport(from: string, to: string, branchId?: string) {
    const orders = await this.prisma.productionOrder.findMany({
      where: {
        createdAt: { gte: new Date(from), lte: new Date(to) },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        bom: { include: { finishedProduct: true, components: { include: { product: true } } } },
        branch: true,
      },
    });

    const completed = orders.filter((o) => o.status === 'COMPLETED');
    return {
      reportType: 'PRODUCTION',
      from, to, branchId,
      totalOrders: orders.length,
      completedOrders: completed.length,
      totalProduced: completed.reduce((s, o) => s + Number(o.quantityProduced), 0),
      totalWastage:  completed.reduce((s, o) => s + Number(o.wastage), 0),
      orders,
    };
  }

  // ── EMPLOYEE REPORTS ──────────────────────────────────────────────────

  async employeeReport(branchId?: string) {
    const employees = await this.prisma.employee.findMany({
      where: branchId ? { branchId } : undefined,
      include: { branch: true, attendance: { orderBy: { date: 'desc' }, take: 30 } },
    });

    return {
      reportType: 'EMPLOYEES',
      branchId,
      totalEmployees: employees.length,
      totalPayroll: employees.reduce((s, e) => s + Number(e.salary), 0),
      employees,
    };
  }
}
