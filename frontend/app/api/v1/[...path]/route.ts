import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import fs from 'fs';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'replace-with-64-char-random-string';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'replace-with-different-64-char-random-string';

// Helper to hash token
function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Check authorization
async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET) as any;
  } catch (err) {
    return null;
  }
}

// Generate auth response
async function issueTokens(sub: string, email: string, roleId: string, roleName: string, branchId: string | null) {
  const payload = { sub, email, roleId, roleName, branchId };

  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: { userId: sub, tokenHash: hashToken(refreshToken), expiresAt },
  });

  return { accessToken, refreshToken };
}

// Error response utility
function errorResponse(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

// CORS options helper
function corsResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// GET Method Handler
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = resolvedParams.path;
  const user = await getAuthUser(req);
  
  const searchParams = req.nextUrl.searchParams;

  // Paths requiring authentication
  if (!user) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const route = path.join('/');

    // ─── DASHBOARD MODULE ───────────────────────────────────────────────────
    if (route === 'dashboard/summary') {
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
        prisma.salesInvoice.findMany({ where: { createdAt: { gte: today } } }),
        prisma.salesInvoice.findMany({ where: { createdAt: { gte: monthStart } } }),
        prisma.purchaseInvoice.findMany(),
        prisma.productionOrder.findMany({ where: { status: 'COMPLETED', completedAt: { gte: monthStart } } }),
        prisma.branch.findMany({ where: { isActive: true } }),
        prisma.account.findMany(),
        prisma.product.findMany({ where: { isActive: true }, include: { stock: true } }),
        prisma.stockTransfer.findMany({ where: { status: { in: ['REQUESTED', 'APPROVED', 'IN_TRANSIT'] } } }),
      ]);

      const cashBalance = accounts.filter((a) => a.type === 'CASH').reduce((s, a) => s + Number(a.balance), 0);
      const bankBalance = accounts.filter((a) => a.type === 'BANK').reduce((s, a) => s + Number(a.balance), 0);

      const low = lowStockProducts.filter((p) => {
        const total = p.stock.reduce((s, s2) => s + Number(s2.quantity), 0);
        return total <= Number(p.minimumStock);
      });

      const branchSales = await Promise.all(
        branches.map(async (b) => {
          const invoices = await prisma.salesInvoice.findMany({
            where: { salesOrder: { branchId: b.id }, createdAt: { gte: monthStart } },
          });
          return { branch: b.name, monthlySales: invoices.reduce((s, i) => s + Number(i.totalAmount), 0) };
        })
      );

      return corsResponse({
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
      });
    }

    if (route === 'dashboard/sales-trend') {
      const branchId = searchParams.get('branchId') || undefined;
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
          const invoices = await prisma.salesInvoice.findMany({
            where: {
              createdAt: { gte: start, lte: end },
              ...(branchId ? { salesOrder: { branchId } } : {}),
            },
          });
          return {
            month: start.toLocaleString('default', { month: 'short' }),
            sales: invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
          };
        })
      );
      return corsResponse(results);
    }

    // ─── ROLES & USERS MODULE ───────────────────────────────────────────────
    if (route === 'roles') {
      const roles = await prisma.role.findMany();
      return corsResponse(roles);
    }

    if (route === 'users') {
      const branchId = searchParams.get('branchId') || undefined;
      const users = await prisma.user.findMany({
        where: branchId ? { branchId } : {},
        include: { role: true, branch: true },
      });
      const safeUsers = users.map(({ passwordHash, ...u }) => u);
      if (user.roleName !== 'SUPER_ADMIN') {
        return corsResponse(safeUsers.filter(u => u.role.name !== 'SUPER_ADMIN'));
      }
      return corsResponse(safeUsers);
    }

    if (path[0] === 'users' && path.length === 2) {
      const u = await prisma.user.findUnique({
        where: { id: path[1] },
        include: { role: true, branch: true },
      });
      if (!u) return errorResponse('User not found', 404);
      const { passwordHash, ...safeUser } = u;
      return corsResponse(safeUser);
    }

    // ─── BRANCHES MODULE ────────────────────────────────────────────────────
    if (route === 'branches') {
      const branches = await prisma.branch.findMany({
        where: { isActive: true },
        include: { _count: { select: { users: true, warehouses: true } } },
        orderBy: { name: 'asc' },
      });
      return corsResponse(branches);
    }

    if (route === 'branches/consolidated-summary') {
      const branches = await prisma.branch.findMany({ where: { isActive: true } });
      const summary = await Promise.all(
        branches.map(async (b) => {
          const [sales, purchase, stockCount] = await Promise.all([
            prisma.salesInvoice.aggregate({
              _sum: { totalAmount: true },
              where: { salesOrder: { branchId: b.id } },
            }),
            prisma.purchaseInvoice.aggregate({
              _sum: { totalAmount: true },
              where: { purchaseOrder: { branchId: b.id } },
            }),
            prisma.stock.aggregate({
              _sum: { quantity: true },
              where: { branchId: b.id },
            }),
          ]);
          return {
            branchId: b.id,
            branchName: b.name,
            totalSales: Number(sales._sum.totalAmount || 0),
            totalPurchase: Number(purchase._sum.totalAmount || 0),
            stockQuantity: Number(stockCount._sum.quantity || 0),
          };
        })
      );
      return corsResponse(summary);
    }

    if (path[0] === 'branches' && path.length === 2) {
      const b = await prisma.branch.findUnique({ where: { id: path[1] } });
      if (!b) return errorResponse('Branch not found', 404);
      return corsResponse(b);
    }

    // ─── CUSTOMERS & SUPPLIERS MODULE ──────────────────────────────────────
    if (route === 'customers') {
      const branchId = searchParams.get('branchId') || undefined;
      const search = searchParams.get('search') || '';
      const customers = await prisma.customer.findMany({
        where: {
          ...(branchId ? { branchId } : {}),
          OR: search ? [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ] : undefined,
        },
        include: { branch: true },
      });
      return corsResponse(customers);
    }

    if (path[0] === 'customers' && path.length === 2) {
      const c = await prisma.customer.findUnique({ where: { id: path[1] } });
      if (!c) return errorResponse('Customer not found', 404);
      return corsResponse(c);
    }

    if (path[0] === 'customers' && path.length === 3 && path[2] === 'ledger') {
      const invoices = await prisma.salesInvoice.findMany({
        where: { salesOrder: { customerId: path[1] } },
        include: { salesOrder: true },
        orderBy: { createdAt: 'desc' },
      });
      return corsResponse(invoices);
    }

    if (route === 'suppliers') {
      const branchId = searchParams.get('branchId') || undefined;
      const suppliers = await prisma.supplier.findMany({
        where: branchId ? { branchId } : {},
      });
      return corsResponse(suppliers);
    }

    if (path[0] === 'suppliers' && path.length === 2) {
      const s = await prisma.supplier.findUnique({ where: { id: path[1] } });
      if (!s) return errorResponse('Supplier not found', 404);
      return corsResponse(s);
    }

    // ─── PRODUCTS & CATEGORIES MODULE ───────────────────────────────────────
    if (route === 'products') {
      const activeOnly = searchParams.get('isActive') !== 'false';
      const search = searchParams.get('search') || '';
      const products = await prisma.product.findMany({
        where: {
          isActive: activeOnly,
          OR: search ? [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
          ] : undefined,
        },
        include: { category: true, stock: true },
      });
      return corsResponse(products);
    }

    if (route === 'products/low-stock') {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        include: { stock: true },
      });
      const low = products.filter((p) => {
        const total = p.stock.reduce((s, s2) => s + Number(s2.quantity), 0);
        return total <= Number(p.minimumStock);
      });
      return corsResponse(low);
    }

    if (path[0] === 'products' && path.length === 2) {
      const p = await prisma.product.findUnique({
        where: { id: path[1] },
        include: { category: true, stock: { include: { warehouse: true } } },
      });
      if (!p) return errorResponse('Product not found', 404);
      return corsResponse(p);
    }

    if (path[0] === 'products' && path.length === 3 && path[2] === 'stock-ledger') {
      const ledger = await prisma.stockMovement.findMany({
        where: { productId: path[1] },
        orderBy: { createdAt: 'desc' },
      });
      return corsResponse(ledger);
    }

    if (route === 'categories') {
      const categories = await prisma.category.findMany({
        include: { parent: true, _count: { select: { products: true, children: true } } },
        orderBy: { name: 'asc' },
      });
      return corsResponse(categories);
    }

    // ─── SALES MODULE ───────────────────────────────────────────────────────
    if (route === 'sales/orders') {
      const branchId = searchParams.get('branchId') || undefined;
      const customerId = searchParams.get('customerId') || undefined;
      const status = searchParams.get('status') || undefined;

      const orders = await prisma.salesOrder.findMany({
        where: {
          ...(branchId ? { branchId } : {}),
          ...(customerId ? { customerId } : {}),
          ...(status ? { status: status as any } : {}),
        },
        include: { customer: true, invoice: true, items: { include: { product: true } }, _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return corsResponse(orders);
    }

    if (path[0] === 'sales' && path[1] === 'orders' && path.length === 3) {
      const o = await prisma.salesOrder.findUnique({
        where: { id: path[2] },
        include: {
          items: { include: { product: true } },
          customer: true, branch: true, invoice: true,
          challan: true,
        },
      });
      if (!o) return errorResponse('Sales order not found', 404);
      return corsResponse(o);
    }

    if (route === 'sales/summary') {
      const branchId = searchParams.get('branchId') || undefined;
      const today = new Date(); today.setHours(0,0,0,0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const [todayInv, monthInv, outstanding] = await Promise.all([
        prisma.salesInvoice.findMany({ where: { createdAt: { gte: today }, salesOrder: { ...(branchId?{branchId}:{}) } } }),
        prisma.salesInvoice.findMany({ where: { createdAt: { gte: monthStart }, salesOrder: { ...(branchId?{branchId}:{}) } } }),
        prisma.salesInvoice.findMany({ where: { salesOrder: { ...(branchId?{branchId}:{}) } } }),
      ]);
      return corsResponse({
        todaySales: todayInv.reduce((s, i) => s + Number(i.totalAmount), 0),
        monthlySales: monthInv.reduce((s, i) => s + Number(i.totalAmount), 0),
        totalReceivables: outstanding.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0),
        invoiceCount: monthInv.length,
      });
    }

    if (path[0] === 'sales' && path[1] === 'customer-statement' && path.length === 3) {
      const customerId = path[2];
      const from = searchParams.get('from');
      const to = searchParams.get('to');

      const customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { branch: true } });
      if (!customer) return errorResponse('Customer not found', 404);

      const orders = await prisma.salesOrder.findMany({
        where: {
          customerId,
          invoice: { isNot: null },
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
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
          date: o.createdAt,
          invoiceNo: inv.invoiceNo,
          orderNo: o.orderNo,
          totalAmount: Number(inv.totalAmount),
          paidAmount: Number(inv.paidAmount),
          outstanding,
          runningBalance: balance,
        };
      });

      return corsResponse({ customer, entries, totalOutstanding: balance });
    }

    if (route === 'sales/aging') {
      const branchId = searchParams.get('branchId') || undefined;
      const now = new Date();
      const invoices = await prisma.salesInvoice.findMany({
        where: {
          salesOrder: { ...(branchId ? { branchId } : {}) },
          paidAmount: { lt: prisma.salesInvoice.fields.totalAmount },
        },
        include: { salesOrder: { include: { customer: true } } },
      });

      const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
      const rows = invoices
        .map(inv => {
          const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
          if (outstanding <= 0) return null;
          const daysOld = Math.floor((now.getTime() - inv.createdAt.getTime()) / 86400000);
          if (daysOld <= 30) buckets.current += outstanding;
          else if (daysOld <= 60) buckets.days30 += outstanding;
          else if (daysOld <= 90) buckets.days60 += outstanding;
          else if (daysOld <= 120) buckets.days90 += outstanding;
          else buckets.over90 += outstanding;
          return {
            customer: inv.salesOrder.customer.name,
            invoiceNo: inv.invoiceNo,
            invoiceDate: inv.createdAt,
            daysOld,
            outstanding,
            bucket: daysOld <= 30 ? 'Current' : daysOld <= 60 ? '31-60' : daysOld <= 90 ? '61-90' : daysOld <= 120 ? '91-120' : '120+',
          };
        })
        .filter(Boolean);

      return corsResponse({ rows, buckets, total: Object.values(buckets).reduce((a, b) => a + b, 0) });
    }

    if (route === 'sales/challans') {
      const branchId = searchParams.get('branchId') || undefined;
      const challans = await prisma.deliveryChallan.findMany({
        where: branchId ? { branchId } : {},
        include: { salesOrder: { include: { customer: true } }, vehicle: true },
      });
      return corsResponse(challans);
    }

    if (path[0] === 'sales' && path[1] === 'challans' && path.length === 3) {
      const c = await prisma.deliveryChallan.findUnique({
        where: { id: path[2] },
        include: { salesOrder: { include: { customer: true, branch: true } }, vehicle: true },
      });
      if (!c) return errorResponse('Delivery challan not found', 404);
      return corsResponse(c);
    }

    // ─── INVENTORY MODULE ───────────────────────────────────────────────────
    if (route === 'inventory/stock') {
      const branchId = searchParams.get('branchId') || undefined;
      const warehouseId = searchParams.get('warehouseId') || undefined;

      const stocks = await prisma.stock.findMany({
        where: {
          ...(branchId ? { branchId } : {}),
          ...(warehouseId ? { warehouseId } : {}),
        },
        include: { product: true, warehouse: true, branch: true },
      });
      return corsResponse(stocks);
    }

    if (route === 'inventory/movements') {
      const productId = searchParams.get('productId') || undefined;
      const movements = await prisma.stockMovement.findMany({
        where: productId ? { productId } : {},
        include: { product: true },
        orderBy: { createdAt: 'desc' },
      });
      return corsResponse(movements);
    }

    if (route === 'inventory/transfers') {
      const branchId = searchParams.get('branchId') || undefined;
      const transfers = await prisma.stockTransfer.findMany({
        where: branchId ? { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] } : {},
        include: { fromBranch: true, toBranch: true },
        orderBy: { requestedAt: 'desc' },
      });
      return corsResponse(transfers);
    }

    // ─── WAREHOUSES MODULE ────────────────────────────────────────────────────
    if (route === 'warehouses') {
      const warehouses = await prisma.warehouse.findMany({
        include: { branch: true, _count: { select: { stock: true } } },
        orderBy: { name: 'asc' },
      });
      return corsResponse(warehouses);
    }

    // ─── COMPANY SETTINGS ───────────────────────────────────────────────────
    if (route === 'company-settings') {
      const branchId = searchParams.get('branchId') || user.branchId;
      if (!branchId) return errorResponse('branchId required', 400);
      const settings = await prisma.companySettings.findUnique({ where: { branchId } });
      return corsResponse(settings || {});
    }

    if (route === 'company-settings/backup') {
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl && dbUrl.startsWith('file:')) {
        const dbPath = dbUrl.substring(5);
        if (fs.existsSync(dbPath)) {
          const buffer = fs.readFileSync(dbPath);
          return new Response(buffer, {
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Disposition': 'attachment; filename=factory_erp_backup.db',
            },
          });
        }
      }
      return errorResponse('Database file not found', 404);
    }

    // ─── PURCHASES MODULE ───────────────────────────────────────────────────
    if (route === 'purchases/orders') {
      const pos = await prisma.purchaseOrder.findMany({
        include: { supplier: true, invoice: true, items: { include: { product: true } }, _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return corsResponse(pos);
    }

    if (path[0] === 'purchases' && path[1] === 'orders' && path.length === 3) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: path[2] },
        include: { items: { include: { product: true } }, supplier: true, branch: true, invoice: true },
      });
      return corsResponse(po);
    }

    if (route === 'purchases/summary') {
      const branchId = searchParams.get('branchId') || undefined;
      const invoices = await prisma.purchaseInvoice.findMany({
        where: branchId ? { purchaseOrder: { branchId } } : {},
      });
      return corsResponse({
        totalPurchases: invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
        totalPayables: invoices.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0),
        invoiceCount: invoices.length,
      });
    }

    // ─── RETURNS MODULE ─────────────────────────────────────────────────────
    if (route === 'returns/sale') {
      const returns = await prisma.saleReturn.findMany({
        include: { invoice: { include: { salesOrder: { include: { customer: true } } } } },
      });
      return corsResponse(returns);
    }

    if (route === 'returns/purchase') {
      const returns = await prisma.purchaseReturn.findMany({
        include: { invoice: { include: { purchaseOrder: { include: { supplier: true } } } } },
      });
      return corsResponse(returns);
    }

    // ─── EXPENSES MODULE ────────────────────────────────────────────────────
    if (route === 'expenses') {
      const branchId = searchParams.get('branchId') || undefined;
      const category = searchParams.get('category') || undefined;
      const expenses = await prisma.expense.findMany({
        where: {
          ...(branchId ? { branchId } : {}),
          ...(category ? { category } : {}),
        },
        include: { branch: true },
        orderBy: { expenseDate: 'desc' },
      });
      return corsResponse(expenses);
    }

    if (route === 'expenses/summary') {
      const branchId = searchParams.get('branchId') || undefined;
      const today = new Date(); today.setHours(0,0,0,0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const [todayExp, monthExp] = await Promise.all([
        prisma.expense.findMany({ where: { expenseDate: { gte: today }, ...(branchId ? { branchId } : {}) } }),
        prisma.expense.findMany({ where: { expenseDate: { gte: monthStart }, ...(branchId ? { branchId } : {}) } }),
      ]);
      return corsResponse({
        todayExpenses: todayExp.reduce((s, e) => s + Number(e.amount), 0),
        monthlyExpenses: monthExp.reduce((s, e) => s + Number(e.amount), 0),
      });
    }

    // ─── EMPLOYEES MODULE ───────────────────────────────────────────────────
    if (route === 'employees') {
      const employees = await prisma.employee.findMany({ include: { branch: true } });
      return corsResponse(employees);
    }

    // ─── VEHICLES MODULE ────────────────────────────────────────────────────
    if (route === 'vehicles') {
      const vehicles = await prisma.vehicle.findMany({
        include: { branch: true, _count: { select: { deliveries: true } } },
        orderBy: { plateNumber: 'asc' },
      });
      return corsResponse(vehicles);
    }

    if (path[0] === 'vehicles' && path.length === 2) {
      const v = await prisma.vehicle.findUnique({
        where: { id: path[1] },
        include: { branch: true, deliveries: true, logs: true },
      });
      return corsResponse(v);
    }

    // ─── NOTIFICATIONS MODULE ───────────────────────────────────────────────
    if (route === 'notifications') {
      const notifications = await prisma.notification.findMany({
        where: { OR: [{ userId: user.sub }, { userId: null }] },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return corsResponse(notifications);
    }

    // ─── AI ANALYTICS MODULE ────────────────────────────────────────────────
    if (route === 'ai/top-products') {
      const limit = parseInt(searchParams.get('limit') || '5');
      const items = await prisma.salesOrderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: limit,
      });
      const products = await Promise.all(
        items.map(async (item) => {
          const product = await prisma.product.findUnique({ where: { id: item.productId } });
          return { name: product?.name || 'Unknown', totalSold: Number(item._sum.quantity || 0) };
        })
      );
      return corsResponse(products);
    }

    if (route === 'ai/slow-moving') {
      const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
      const activeProducts = await prisma.product.findMany({ where: { isActive: true } });
      const recentSales = await prisma.salesOrderItem.findMany({
        where: { salesOrder: { createdAt: { gte: monthAgo } } },
        select: { productId: true },
      });
      const recentSalesIds = new Set(recentSales.map((s) => s.productId));
      const slow = activeProducts.filter((p) => !recentSalesIds.has(p.id));
      return corsResponse(slow.slice(0, 10));
    }

    // ─── MANUFACTURING (BOM/PRODUCTION) MODULE ──────────────────────────────
    if (route === 'manufacturing/bom') {
      const boms = await prisma.bom.findMany({ include: { finishedProduct: true } });
      return corsResponse(boms);
    }

    if (route === 'manufacturing/orders') {
      const orders = await prisma.productionOrder.findMany({
        include: { bom: { include: { finishedProduct: true } }, branch: true },
      });
      return corsResponse(orders);
    }

    // ─── ACCOUNTING MODULE ──────────────────────────────────────────────────
    if (route === 'accounting/accounts') {
      const accounts = await prisma.account.findMany({ include: { branch: true } });
      return corsResponse(accounts);
    }

    return errorResponse(`Route GET /${route} not found or not mapped`, 404);
  } catch (err: any) {
    console.error('API GET error:', err);
    return errorResponse(err.message || 'Internal Server Error', 500);
  }
}

// POST Method Handler
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = resolvedParams.path;
  const route = path.join('/');

  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {}

  // PUBLIC ROUTES
  if (route === 'auth/login') {
    try {
      const user = await prisma.user.findUnique({
        where: { email: body.email },
        include: { role: true },
      });

      if (!user) return errorResponse('Invalid email or password', 401);
      if (user.status !== 'ACTIVE') return errorResponse('Account is not active', 401);

      const passwordOk = await bcrypt.compare(body.password, user.passwordHash);
      if (!passwordOk) return errorResponse('Invalid email or password', 401);

      const tokens = await issueTokens(user.id, user.email, user.roleId, user.role.name, user.branchId);

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      await prisma.auditLog.create({
        data: { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ipAddress: req.headers.get('x-forwarded-for') || '' },
      });

      const { passwordHash, ...safeUser } = user;
      return corsResponse({ user: safeUser, ...tokens });
    } catch (err: any) {
      console.error('Login error:', err);
      return errorResponse(err.message || 'Internal Server Error', 500);
    }
  }

  if (route === 'auth/refresh') {
    const { refreshToken } = body;
    if (!refreshToken) return errorResponse('Refresh token required', 400);

    try {
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
      const tokenHash = hashToken(refreshToken);
      const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

      if (!stored || stored.revoked || stored.expiresAt < new Date()) {
        return errorResponse('Refresh token is no longer valid', 401);
      }

      await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: { role: true },
      });

      if (!user || user.status !== 'ACTIVE') return errorResponse('User no longer active', 401);

      const tokens = await issueTokens(user.id, user.email, user.roleId, user.role.name, user.branchId);
      return corsResponse(tokens);
    } catch (err) {
      return errorResponse('Invalid or expired refresh token', 401);
    }
  }

  // PROTECTED ROUTES
  const user = await getAuthUser(req);
  if (!user) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    // ─── SALES MODULE ───────────────────────────────────────────────────────
    if (route === 'sales/orders') {
      const year = new Date().getFullYear();
      const branch = await prisma.branch.findUnique({ where: { id: body.branchId } });
      const branchCode = branch?.code ?? 'SO';
      const count = await prisma.salesOrder.count({ where: { branchId: body.branchId } });
      const orderNo = `SO-${branchCode}-${year}-${String(count + 1).padStart(5, '0')}`;

      const order = await prisma.salesOrder.create({
        data: {
          orderNo,
          customerId: body.customerId,
          branchId: body.branchId,
          createdById: user.sub,
          status: 'QUOTATION',
          items: {
            create: body.items.map((i: any) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount ?? 0,
            })),
          },
        },
        include: { items: { include: { product: true } }, customer: true, branch: true },
      });
      return corsResponse(order);
    }

    if (route === 'sales/invoices') {
      const order = await prisma.salesOrder.findUnique({
        where: { id: body.salesOrderId },
        include: { items: { include: { product: true } }, customer: true, branch: true, invoice: true },
      });
      if (!order) return errorResponse('Sales order not found', 404);
      if (order.invoice) return errorResponse('Invoice already exists', 400);

      const invoice = await prisma.$transaction(async (tx) => {
        // 1. Fetch or create company settings inside transaction
        let settings = await tx.companySettings.findUnique({ where: { branchId: order.branchId } });
        const branch = await tx.branch.findUnique({ where: { id: order.branchId } });
        const branchCode = branch?.code ?? 'BR';

        if (!settings) {
          settings = await tx.companySettings.create({
            data: {
              branchId: order.branchId,
              companyName: branch?.name ?? 'My Company',
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
        const taxRate = body.taxRate !== undefined ? body.taxRate : defaultTaxRate;
        const subtotal = order.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice) - Number(i.discount), 0);
        const taxAmount = Math.round((subtotal * taxRate / 100) * 100) / 100;
        const total = subtotal + taxAmount;

        const inv = await tx.salesInvoice.create({
          data: {
            invoiceNo,
            salesOrderId: body.salesOrderId,
            totalAmount: total,
            paidAmount: body.paymentMethod === 'CASH' ? total : 0,
            paymentMethod: body.paymentMethod as any,
            dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
            taxRate,
            taxAmount,
          },
        });

        await tx.salesOrder.update({ where: { id: body.salesOrderId }, data: { status: 'INVOICED' } });

        if (body.paymentMethod === 'CREDIT') {
          await tx.customer.update({
            where: { id: order.customerId },
            data: { balance: { increment: total } },
          });
        }

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
              productId: item.productId,
              type: 'SALE',
              quantity: -Number(item.quantity),
              referenceType: 'SalesInvoice',
              referenceId: inv.id,
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
        return inv;
      }, { timeout: 30000 });
      return corsResponse(invoice);
    }

    if (route === 'sales/invoices/payment') {
      const invoice = await prisma.salesInvoice.findUnique({
        where: { id: body.invoiceId },
        include: { salesOrder: true },
      });
      if (!invoice) return errorResponse('Invoice not found', 404);

      const updated = await prisma.$transaction(async (tx) => {
        const up = await tx.salesInvoice.update({
          where: { id: body.invoiceId },
          data: { paidAmount: { increment: body.amount } },
        });
        await tx.customer.update({
          where: { id: invoice.salesOrder.customerId },
          data: { balance: { decrement: body.amount } },
        });
        return up;
      }, { timeout: 30000 });
      return corsResponse(updated);
    }

    if (route === 'sales/challans') {
      const count = await prisma.deliveryChallan.count();
      const challanNo = `CHLN-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
      const challan = await prisma.deliveryChallan.create({
        data: {
          challanNo,
          salesOrderId: body.salesOrderId,
          vehicleId: body.vehicleId,
          driverName: body.driverName,
          deliveredTo: body.deliveredTo,
          items: body.items,
          status: 'PENDING',
          branchId: body.branchId,
        },
      });
      return corsResponse(challan);
    }

    // ─── PRODUCTS & CUSTOMERS MODULE ────────────────────────────────────────
    if (route === 'products') {
      const count = await prisma.product.count();
      const productCode = `PRD-${String(count + 1).padStart(5, '0')}`;
      const p = await prisma.product.create({
        data: {
          sku: body.sku || productCode,
          productCode,
          name: body.name,
          categoryId: body.categoryId,
          brand: body.brand,
          size: body.size,
          unit: body.unit,
          purchasePrice: body.purchasePrice,
          salePrice: body.salePrice,
          openingStock: body.openingStock || 0,
          minimumStock: body.minimumStock || 0,
          isRawMaterial: body.isRawMaterial || false,
        },
      });
      return corsResponse(p);
    }

    if (route === 'customers') {
      const c = await prisma.customer.create({
        data: {
          name: body.name,
          address: body.address,
          phone: body.phone,
          email: body.email,
          taxNumber: body.taxNumber,
          creditLimit: body.creditLimit || 0,
          branchId: body.branchId,
        },
      });
      return corsResponse(c);
    }

    if (route === 'suppliers') {
      const s = await prisma.supplier.create({
        data: {
          name: body.name,
          address: body.address,
          phone: body.phone,
          email: body.email,
          taxNumber: body.taxNumber,
          branchId: body.branchId,
        },
      });
      return corsResponse(s);
    }

    if (route === 'users') {
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(body.password, salt);
      const u = await prisma.user.create({
        data: {
          email: body.email,
          phone: body.phone,
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName,
          roleId: body.roleId,
          branchId: body.branchId,
        },
      });
      const { passwordHash: _, ...safeUser } = u;
      return corsResponse(safeUser);
    }

    // ─── INVENTORY MODULE ───────────────────────────────────────────────────
    if (route === 'inventory/stock-in') {
      const movement = await prisma.$transaction(async (tx) => {
        // Auto-resolve branchId from warehouse if not provided
        const warehouse = await tx.warehouse.findUnique({ where: { id: body.warehouseId } });
        if (!warehouse) throw new Error('Warehouse not found');
        const branchId = body.branchId || warehouse.branchId;

        const stock = await tx.stock.findUnique({
          where: { productId_warehouseId_batchNumber: { productId: body.productId, warehouseId: body.warehouseId, batchNumber: body.batchNumber || '' } },
        });
        if (stock) {
          await tx.stock.update({ where: { id: stock.id }, data: { quantity: { increment: body.quantity } } });
        } else {
          await tx.stock.create({
            data: { productId: body.productId, warehouseId: body.warehouseId, branchId, quantity: body.quantity, batchNumber: body.batchNumber || '' },
          });
        }
        return tx.stockMovement.create({
          data: { productId: body.productId, type: 'STOCK_IN', quantity: body.quantity, notes: body.notes },
        });
      }, { timeout: 30000 });
      return corsResponse(movement);
    }

    if (route === 'inventory/stock-out') {
      const movement = await prisma.$transaction(async (tx) => {
        const stock = await tx.stock.findUnique({
          where: { productId_warehouseId_batchNumber: { productId: body.productId, warehouseId: body.warehouseId, batchNumber: body.batchNumber || '' } },
        });
        if (!stock || Number(stock.quantity) < body.quantity) {
          throw new Error('Insufficient stock');
        }
        await tx.stock.update({ where: { id: stock.id }, data: { quantity: { decrement: body.quantity } } });
        return tx.stockMovement.create({
          data: { productId: body.productId, type: 'STOCK_OUT', quantity: -body.quantity, notes: body.notes },
        });
      }, { timeout: 30000 });
      return corsResponse(movement);
    }

    if (route === 'inventory/adjustment') {
      const movement = await prisma.$transaction(async (tx) => {
        // Auto-resolve branchId from warehouse if not provided
        const warehouse = await tx.warehouse.findUnique({ where: { id: body.warehouseId } });
        if (!warehouse) throw new Error('Warehouse not found');
        const branchId = body.branchId || warehouse.branchId;

        const stock = await tx.stock.findUnique({
          where: { productId_warehouseId_batchNumber: { productId: body.productId, warehouseId: body.warehouseId, batchNumber: body.batchNumber || '' } },
        });
        if (stock) {
          await tx.stock.update({ where: { id: stock.id }, data: { quantity: body.quantity } });
        } else {
          await tx.stock.create({
            data: { productId: body.productId, warehouseId: body.warehouseId, branchId, quantity: body.quantity, batchNumber: body.batchNumber || '' },
          });
        }
        const diff = body.quantity - Number(stock?.quantity || 0);
        return tx.stockMovement.create({
          data: { productId: body.productId, type: 'ADJUSTMENT', quantity: diff, notes: body.notes },
        });
      }, { timeout: 30000 });
      return corsResponse(movement);
    }

    return errorResponse(`Route POST /${route} not found or not mapped`, 404);
  } catch (err: any) {
    console.error('API POST error:', err);
    return errorResponse(err.message || 'Internal Server Error', 500);
  }
}

// PATCH Method Handler
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = resolvedParams.path;
  const route = path.join('/');

  const user = await getAuthUser(req);
  if (!user) {
    return errorResponse('Unauthorized', 401);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {}

  try {
    // Confirm sales order
    if (path[0] === 'sales' && path[1] === 'orders' && path.length === 4 && path[3] === 'confirm') {
      const updated = await prisma.salesOrder.update({
        where: { id: path[2] },
        data: { status: 'CONFIRMED' },
      });
      return corsResponse(updated);
    }

    // Cancel sales order
    if (path[0] === 'sales' && path[1] === 'orders' && path.length === 4 && path[3] === 'cancel') {
      const updated = await prisma.salesOrder.update({
        where: { id: path[2] },
        data: { status: 'CANCELLED' },
      });
      return corsResponse(updated);
    }

    // Deliver challan
    if (path[0] === 'sales' && path[1] === 'challans' && path.length === 4 && path[3] === 'deliver') {
      const updated = await prisma.deliveryChallan.update({
        where: { id: path[2] },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });
      return corsResponse(updated);
    }

    // Reset password (Admin)
    if (path[0] === 'users' && path.length === 3 && path[2] === 'reset-password') {
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(body.newPassword, salt);
      await prisma.user.update({
        where: { id: path[1] },
        data: { passwordHash },
      });
      return corsResponse({ success: true });
    }

    // Change own password
    if (route === 'users/me/change-password') {
      const dbUser = await prisma.user.findUnique({ where: { id: user.sub } });
      if (!dbUser) return errorResponse('User not found', 404);

      const passOk = await bcrypt.compare(body.currentPassword, dbUser.passwordHash);
      if (!passOk) return errorResponse('Invalid current password', 400);

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(body.newPassword, salt);

      await prisma.user.update({
        where: { id: user.sub },
        data: { passwordHash },
      });
      return corsResponse({ success: true });
    }

    if (route === 'company-settings/restore') {
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl && dbUrl.startsWith('file:')) {
        const dbPath = dbUrl.substring(5);
        if (!body.fileData) return errorResponse('No file data provided', 400);
        
        const buffer = Buffer.from(body.fileData, 'base64');
        const header = buffer.toString('utf8', 0, 15);
        if (header !== 'SQLite format 3') return errorResponse('Invalid database file format', 400);
        
        await prisma.$disconnect();
        try {
          fs.writeFileSync(dbPath, buffer);
        } finally {
          await prisma.$connect();
        }
        return corsResponse({ success: true, message: 'Database restored successfully' });
      }
      return errorResponse('Database restore only supported in SQLite mode', 400);
    }

    // Update settings
    if (route === 'company-settings') {
      const branchId = body.branchId || user.branchId;
      if (!branchId) return errorResponse('branchId required', 400);
      const updated = await prisma.companySettings.upsert({
        where: { branchId },
        update: body,
        create: { ...body, branchId },
      });
      return corsResponse(updated);
    }

    // Update user
    if (path[0] === 'users' && path.length === 2) {
      const updated = await prisma.user.update({
        where: { id: path[1] },
        data: body,
      });
      const { passwordHash: _, ...safeUser } = updated;
      return corsResponse(safeUser);
    }

    // Update customer
    if (path[0] === 'customers' && path.length === 2) {
      const updated = await prisma.customer.update({
        where: { id: path[1] },
        data: body,
      });
      return corsResponse(updated);
    }

    // Update product
    if (path[0] === 'products' && path.length === 2) {
      const updated = await prisma.product.update({
        where: { id: path[1] },
        data: body,
      });
      return corsResponse(updated);
    }

    return errorResponse(`Route PATCH /${route} not found or not mapped`, 404);
  } catch (err: any) {
    console.error('API PATCH error:', err);
    return errorResponse(err.message || 'Internal Server Error', 500);
  }
}

// DELETE Method Handler
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = resolvedParams.path;
  const route = path.join('/');

  const user = await getAuthUser(req);
  if (!user) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    if (path[0] === 'users' && path.length === 2) {
      await prisma.user.delete({ where: { id: path[1] } });
      return corsResponse({ success: true });
    }

    if (path[0] === 'customers' && path.length === 2) {
      await prisma.customer.delete({ where: { id: path[1] } });
      return corsResponse({ success: true });
    }

    if (path[0] === 'products' && path.length === 2) {
      await prisma.product.delete({ where: { id: path[1] } });
      return corsResponse({ success: true });
    }

    return errorResponse(`Route DELETE /${route} not found or not mapped`, 404);
  } catch (err: any) {
    console.error('API DELETE error:', err);
    return errorResponse(err.message || 'Internal Server Error', 500);
  }
}
