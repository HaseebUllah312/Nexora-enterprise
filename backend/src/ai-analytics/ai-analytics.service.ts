import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiAnalyticsService {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

  // Gathers a compact ERP context snapshot, then forwards the user's question
  // to the Anthropic Claude API. The snapshot keeps token cost manageable while
  // giving the model enough real data to produce meaningful answers.
  async ask(question: string, branchId?: string) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('AI analytics not configured (missing ANTHROPIC_API_KEY)');

    const context = await this.buildContext(branchId);

    const systemPrompt = `You are FactoryERP Pro's AI Analytics Assistant.
You have access to live ERP data for a PVC, PPRC, and Sanitary manufacturing company.
Answer the owner's question concisely and accurately using ONLY the data provided below.
If a definitive answer isn't possible from the data, say so clearly and suggest what additional data would help.
Always include specific numbers from the context. Respond in plain English, using bullet points for lists.

ERP CONTEXT SNAPSHOT:
${JSON.stringify(context, null, 2)}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new ServiceUnavailableException(`AI API error: ${err}`);
    }

    const data = await response.json() as any;
    return { answer: data.content[0].text, context };
  }

  // Predefined analytical queries that don't need the LLM
  async topProducts(branchId?: string, limit = 10) {
    const items = await this.prisma.salesOrderItem.findMany({
      include: { product: true, salesOrder: true },
    });

    const filtered = branchId ? items.filter((i) => i.salesOrder.branchId === branchId) : items;
    const map = new Map<string, { productId: string; name: string; revenue: number; unitsSold: number }>();

    for (const item of filtered) {
      const key = item.productId;
      if (!map.has(key)) map.set(key, { productId: key, name: item.product.name, revenue: 0, unitsSold: 0 });
      map.get(key)!.revenue += Number(item.quantity) * Number(item.unitPrice) - Number(item.discount);
      map.get(key)!.unitsSold += Number(item.quantity);
    }

    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  }

  async slowMovingInventory(daysSinceLastSale = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysSinceLastSale);

    const activeProducts = await this.prisma.product.findMany({ where: { isActive: true }, include: { stock: true } });
    const result: any[] = [];

    for (const product of activeProducts) {
      const lastSale = await this.prisma.stockMovement.findFirst({
        where: { productId: product.id, type: 'SALE' },
        orderBy: { createdAt: 'desc' },
      });

      if (!lastSale || lastSale.createdAt < cutoff) {
        const totalStock = product.stock.reduce((s, st) => s + Number(st.quantity), 0);
        if (totalStock > 0) {
          result.push({ product: { id: product.id, name: product.name, sku: product.sku }, totalStock, lastSaleDate: lastSale?.createdAt ?? null });
        }
      }
    }
    return result.sort((a, b) => b.totalStock - a.totalStock);
  }

  private async buildContext(branchId?: string) {
    const today = new Date(); today.setHours(0,0,0,0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [salesInvoices, purchaseInvoices, productionOrders, branches, accounts, stockCount, transfers] = await Promise.all([
      this.prisma.salesInvoice.findMany({
        where: { salesOrder: { ...(branchId ? { branchId } : {}) }, createdAt: { gte: monthStart } },
      }),
      this.prisma.purchaseInvoice.findMany({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.productionOrder.findMany({ where: { status: { not: 'CANCELLED' }, createdAt: { gte: monthStart } } }),
      this.prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true } }),
      this.prisma.account.findMany({ select: { name: true, type: true, balance: true } }),
      this.prisma.stock.aggregate({ _sum: { quantity: true }, _count: true }),
      this.prisma.stockTransfer.groupBy({ by: ['status'], _count: true }),
    ]);

    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = new Date(monthStart);

    const prevMonthSales = await this.prisma.salesInvoice.findMany({
      where: { createdAt: { gte: prevMonthStart, lt: prevMonthEnd } },
    });

    return {
      period: { month: monthStart.toLocaleString('default', { month: 'long' }), year: monthStart.getFullYear() },
      branches: branches.map((b) => b.name),
      currentMonthSales: salesInvoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      previousMonthSales: prevMonthSales.reduce((s, i) => s + Number(i.totalAmount), 0),
      monthlyPurchases: purchaseInvoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      totalReceivables: salesInvoices.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0),
      totalPayables: purchaseInvoices.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0),
      productionOrdersThisMonth: productionOrders.length,
      totalUnitsProduced: productionOrders.filter((o) => o.status === 'COMPLETED').reduce((s, o) => s + Number(o.quantityProduced), 0),
      accounts: accounts.map((a) => ({ name: a.name, type: a.type, balance: Number(a.balance) })),
      totalStockItems: stockCount._count,
      transfersByStatus: Object.fromEntries(transfers.map((t) => [t.status, t._count])),
    };
  }
}
