import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const maxDuration = 60;
export const preferredRegion = 'sin1';

const globalForSync = global as unknown as { syncPrisma: PrismaClient | undefined };

const getPrisma = () => {
  if (globalForSync.syncPrisma) return globalForSync.syncPrisma;

  if (!process.env.DATABASE_URL) {
    return undefined;
  }

  const databaseUrl = process.env.DATABASE_URL;
  let finalUrl = databaseUrl;

  if (!finalUrl.includes('connection_limit')) {
    const separator = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${separator}connection_limit=3&pool_timeout=15&statement_cache_size=0`;
  } else if (!finalUrl.includes('statement_cache_size')) {
    finalUrl = `${finalUrl}&statement_cache_size=0`;
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: finalUrl,
      },
    },
  });
  globalForSync.syncPrisma = prisma;
  return prisma;
};

const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

const getUpsertWhere = (modelName: string, data: any, recordId: string) => {
  switch (modelName) {
    case 'Branch':
      return { code: data?.code || recordId };
    case 'Role':
      return { name: data?.name || recordId };
    case 'User':
      return { email: data?.email || recordId };
    default:
      return { id: recordId };
  }
};

const getIncludeForModel = (modelName: string) => {
  const include: any = {};
  if (modelName === 'SalesOrder' || modelName === 'PurchaseOrder') {
    include.items = true;
  } else if (modelName === 'Bom') {
    include.components = true;
  }
  return Object.keys(include).length > 0 ? include : undefined;
};

const fetchDependencyRecord = async (prismaClient: PrismaClient, modelName: string, recordId: string) => {
  const camelCaseModel = lowerFirst(modelName);
  try {
    const include = getIncludeForModel(modelName);
    return await (prismaClient as any)[camelCaseModel].findUnique({
      where: { id: recordId },
      ...(include ? { include } : {}),
    });
  } catch (e) {
    console.error(`[Vercel Sync] Failed to fetch dependency ${modelName}(${recordId})`, e);
    return null;
  }
};

const ensureDependency = async (
  prismaClient: PrismaClient,
  logsByKey: Map<string, any>,
  modelName: string,
  recordId: string,
) => {
  const key = `${modelName}:${recordId}`;
  if (!recordId || logsByKey.has(key)) return;

  const recordData = await fetchDependencyRecord(prismaClient, modelName, recordId);
  if (!recordData) return;

  const dependencyLog = {
    logId: '',
    modelName,
    recordId,
    action: 'CREATE',
    data: recordData,
  };

  logsByKey.set(key, dependencyLog);
  await resolveDependenciesFromRecord(prismaClient, recordData, modelName, logsByKey);
};

const resolveDependenciesFromRecord = async (
  prismaClient: PrismaClient,
  record: any,
  modelName: string,
  logsByKey: Map<string, any>,
) => {
  if (!record || typeof record !== 'object') return;

  const add = async (depModel: string, depId?: string | null) => {
    if (!depId) return;
    await ensureDependency(prismaClient, logsByKey, depModel, depId);
  };

  switch (modelName) {
    case 'Product':
      await add('Category', record.categoryId);
      break;
    case 'Category':
      await add('Category', record.parentId);
      break;
    case 'SalesOrder':
      await add('User', record.createdById);
      await add('Customer', record.customerId);
      await add('Branch', record.branchId);
      if (Array.isArray(record.items)) {
        for (const item of record.items) {
          await add('Product', item.productId);
        }
      }
      break;
    case 'PurchaseOrder':
      await add('User', record.createdById);
      await add('Supplier', record.supplierId);
      await add('Branch', record.branchId);
      if (Array.isArray(record.items)) {
        for (const item of record.items) {
          await add('Product', item.productId);
        }
      }
      break;
    case 'Bom':
      await add('Product', record.finishedProductId);
      if (Array.isArray(record.components)) {
        for (const component of record.components) {
          await add('Product', component.productId);
        }
      }
      break;
    case 'ProductionOrder':
      await add('Bom', record.bomId);
      await add('Branch', record.branchId);
      break;
    case 'Stock':
      await add('Product', record.productId);
      await add('Branch', record.branchId);
      await add('Warehouse', record.warehouseId);
      break;
    case 'StockMovement':
      await add('Product', record.productId);
      break;
    case 'SalesInvoice':
      await add('SalesOrder', record.salesOrderId);
      break;
    case 'PurchaseInvoice':
      await add('PurchaseOrder', record.purchaseOrderId);
      break;
    default:
      await add('Product', record.productId);
      await add('Category', record.categoryId);
      await add('Branch', record.branchId);
      await add('User', record.createdById);
      await add('Customer', record.customerId);
      await add('Supplier', record.supplierId);
      await add('Warehouse', record.warehouseId);
      break;
  }
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-sync-secret',
    },
  });
}

export async function POST(req: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const headerSecret = req.headers.get('x-sync-secret');

  if (!syncSecret || headerSecret !== syncSecret) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const logDebug = async (msg: string) => {
    console.log(msg);
  };

  const processedLogIds: string[] = [];

  try {
    const body = await req.json();
    const { logs, lastPulledAt } = body;

    // 1. Process incoming logs from client
    if (Array.isArray(logs) && logs.length > 0) {
      await logDebug(`[Vercel Sync] Start processing ${logs.length} entries.`);

      const getModelPriority = (modelName: string): number => {
        if (['Role', 'Branch', 'Category'].includes(modelName)) return 1;
        if (['User', 'Warehouse', 'Customer', 'Supplier', 'Product'].includes(modelName)) return 2;
        return 3;
      };

      // Compact logs: keep only the latest log entry for each record+id pair
      const compactedMap = new Map<string, any>();
      for (const log of logs) {
        const compactedKey = `${log.modelName}:${log.recordId}`;
        compactedMap.set(compactedKey, log);
      }
      const compactedLogs = Array.from(compactedMap.values());
      await logDebug(`[Vercel Sync] Compacted to ${compactedLogs.length} unique records.`);

      // Sort logs by priority so that base dependencies are created before child transactions
      const sortedLogs = [...compactedLogs].sort((a, b) => getModelPriority(a.modelName) - getModelPriority(b.modelName));

      const expandedLogsByKey = new Map<string, any>();
      for (const log of sortedLogs) {
        const key = `${log.modelName}:${log.recordId}`;
        if (!expandedLogsByKey.has(key)) {
          expandedLogsByKey.set(key, {
            ...log,
            data: log.data,
          });
        }

        if ((log.action === 'CREATE' || log.action === 'UPDATE') && log.data) {
          await resolveDependenciesFromRecord(prisma, log.data, log.modelName, expandedLogsByKey);
        }
      }

      const expandedLogs = Array.from(expandedLogsByKey.values()).sort((a, b) => getModelPriority(a.modelName) - getModelPriority(b.modelName));

      const operations: any[] = [];
      const deleteLogs: any[] = [];

      for (const log of expandedLogs) {
        const camelCaseModel = log.modelName.charAt(0).toLowerCase() + log.modelName.slice(1);

        if (log.action === 'DELETE') {
          deleteLogs.push(log);
          processedLogIds.push(log.logId || log.id);
          continue;
        }

        if (!log.data) continue;

        if (log.modelName === 'SalesOrder') {
          const { items, ...orderData } = log.data;
          operations.push(
            prisma.salesOrder.upsert({
              where: { id: log.recordId },
              create: { ...orderData, id: log.recordId },
              update: orderData,
            })
          );
          operations.push(
            prisma.salesOrderItem.deleteMany({ where: { salesOrderId: log.recordId } })
          );
          if (Array.isArray(items) && items.length > 0) {
            const cleanItems = items.map(({ product, ...item }: any) => item);
            operations.push(
              prisma.salesOrderItem.createMany({ data: cleanItems })
            );
          }
        } else if (log.modelName === 'PurchaseOrder') {
          const { items, ...poData } = log.data;
          operations.push(
            prisma.purchaseOrder.upsert({
              where: { id: log.recordId },
              create: { ...poData, id: log.recordId },
              update: poData,
            })
          );
          operations.push(
            prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: log.recordId } })
          );
          if (Array.isArray(items) && items.length > 0) {
            const cleanItems = items.map(({ product, ...item }: any) => item);
            operations.push(
              prisma.purchaseOrderItem.createMany({ data: cleanItems })
            );
          }
        } else if (log.modelName === 'Bom') {
          const { components, ...bomData } = log.data;
          operations.push(
            prisma.bom.upsert({
              where: { id: log.recordId },
              create: { ...bomData, id: log.recordId },
              update: bomData,
            })
          );
          operations.push(
            prisma.bomComponent.deleteMany({ where: { bomId: log.recordId } })
          );
          if (Array.isArray(components) && components.length > 0) {
            const cleanComponents = components.map(({ product, ...comp }: any) => comp);
            operations.push(
              prisma.bomComponent.createMany({ data: cleanComponents })
            );
          }
        } else {
          const upsertWhere = getUpsertWhere(log.modelName, log.data, log.recordId);
          operations.push(
            (prisma as any)[camelCaseModel].upsert({
              where: upsertWhere,
              create: { ...log.data, id: log.recordId },
              update: log.data,
            })
          );
        }
      }

      // Execute deletes first (outside transaction, safely caught)
      if (deleteLogs.length > 0) {
        await logDebug(`[Vercel Sync] Executing ${deleteLogs.length} deletes...`);
        for (const log of deleteLogs) {
          const camelCaseModel = log.modelName.charAt(0).toLowerCase() + log.modelName.slice(1);
          try {
            await (prisma as any)[camelCaseModel].delete({
              where: { id: log.recordId },
            });
            // Write delete sync log to cloud
            await prisma.syncLog.create({
              data: {
                modelName: log.modelName,
                recordId: log.recordId,
                action: 'DELETE',
              }
            });
            processedLogIds.push(log.logId || log.id);
          } catch (e) {
            // Ignore if already deleted
          }
        }
      }

      // Log all incoming mutations to the cloud's SyncLog so other clients can pull them
      const cloudLogsToCreate = sortedLogs.map(log => 
        prisma.syncLog.create({
          data: {
            modelName: log.modelName,
            recordId: log.recordId,
            action: log.action,
          }
        })
      );
      operations.push(...cloudLogsToCreate);

      // Execute all upserts and nested item operations in a single atomic transaction
      if (operations.length > 0) {
        await logDebug(`[Vercel Sync] Executing transaction with ${operations.length} database operations...`);
        await prisma.$transaction(operations);
        await logDebug(`[Vercel Sync] Transaction completed successfully.`);
      }

      await logDebug(`[Vercel Sync] Successfully processed ${logs.length} changes.`);
    }

    // 2. Fetch new changes on the cloud since lastPulledAt for the client to download
    const cloudChanges: any[] = [];
    let serverTimestamp = new Date().toISOString();

    if (lastPulledAt) {
      const lastPulled = new Date(lastPulledAt);
      const isInitialPull = lastPulled.getFullYear() < 2024;

      if (isInitialPull) {
        await logDebug(`[Vercel Sync] Initial pull detected (lastPulledAt: ${lastPulledAt}). Sending bootstrap dataset...`);
        
        // 1. Roles
        const roles = await prisma.role.findMany();
        for (const r of roles) cloudChanges.push({ modelName: 'Role', recordId: r.id, action: 'CREATE', data: r });

        // 2. Branches
        const branches = await prisma.branch.findMany();
        for (const b of branches) cloudChanges.push({ modelName: 'Branch', recordId: b.id, action: 'CREATE', data: b });

        // 3. Warehouses
        const warehouses = await prisma.warehouse.findMany();
        for (const w of warehouses) cloudChanges.push({ modelName: 'Warehouse', recordId: w.id, action: 'CREATE', data: w });

        // 4. Users
        const users = await prisma.user.findMany();
        for (const u of users) cloudChanges.push({ modelName: 'User', recordId: u.id, action: 'CREATE', data: u });

        // 5. Categories
        const categories = await prisma.category.findMany();
        for (const c of categories) cloudChanges.push({ modelName: 'Category', recordId: c.id, action: 'CREATE', data: c });

        // 6. Products
        const products = await prisma.product.findMany();
        for (const p of products) cloudChanges.push({ modelName: 'Product', recordId: p.id, action: 'CREATE', data: p });

        // 7. Customers
        const customers = await prisma.customer.findMany();
        for (const c of customers) cloudChanges.push({ modelName: 'Customer', recordId: c.id, action: 'CREATE', data: c });

        // 8. Suppliers
        const suppliers = await prisma.supplier.findMany();
        for (const s of suppliers) cloudChanges.push({ modelName: 'Supplier', recordId: s.id, action: 'CREATE', data: s });

        // 9. SalesOrders (with items)
        const salesOrders = await prisma.salesOrder.findMany({ include: { items: true } });
        for (const s of salesOrders) cloudChanges.push({ modelName: 'SalesOrder', recordId: s.id, action: 'CREATE', data: s });

        // 10. PurchaseOrders (with items)
        const purchaseOrders = await prisma.purchaseOrder.findMany({ include: { items: true } });
        for (const p of purchaseOrders) cloudChanges.push({ modelName: 'PurchaseOrder', recordId: p.id, action: 'CREATE', data: p });

        // 11. Boms (with components)
        const boms = await prisma.bom.findMany({ include: { components: true } });
        for (const b of boms) cloudChanges.push({ modelName: 'Bom', recordId: b.id, action: 'CREATE', data: b });

        // 12. Stock
        const stocks = await prisma.stock.findMany();
        for (const s of stocks) cloudChanges.push({ modelName: 'Stock', recordId: s.id, action: 'CREATE', data: s });

        // 13. StockMovement
        const movements = await prisma.stockMovement.findMany();
        for (const m of movements) cloudChanges.push({ modelName: 'StockMovement', recordId: m.id, action: 'CREATE', data: m });

        // 14. CompanySettings
        const settings = await prisma.companySettings.findMany();
        for (const s of settings) cloudChanges.push({ modelName: 'CompanySettings', recordId: s.branchId, action: 'CREATE', data: s });

        // 15. Accounts
        const accounts = await prisma.account.findMany();
        for (const a of accounts) cloudChanges.push({ modelName: 'Account', recordId: a.id, action: 'CREATE', data: a });

        // 16. Employees
        const employees = await prisma.employee.findMany();
        for (const e of employees) cloudChanges.push({ modelName: 'Employee', recordId: e.id, action: 'CREATE', data: e });

        // 17. Vehicles
        const vehicles = await prisma.vehicle.findMany();
        for (const v of vehicles) cloudChanges.push({ modelName: 'Vehicle', recordId: v.id, action: 'CREATE', data: v });

        // 18. Expenses
        const expenses = await prisma.expense.findMany();
        for (const ex of expenses) cloudChanges.push({ modelName: 'Expense', recordId: ex.id, action: 'CREATE', data: ex });
      } else {
        const newCloudLogs = await prisma.syncLog.findMany({
          where: {
            createdAt: { gt: lastPulled },
          },
          orderBy: { createdAt: 'asc' },
        });

      if (newCloudLogs.length > 0) {
        // Group log entries by modelName to batch fetch records
        const logsByModel: { [modelName: string]: any[] } = {};
        for (const log of newCloudLogs) {
          if (log.action === 'CREATE' || log.action === 'UPDATE') {
            if (!logsByModel[log.modelName]) {
              logsByModel[log.modelName] = [];
            }
            logsByModel[log.modelName].push(log);
          }
        }

        // Batch fetch records for each model
        const fetchedDataByModelAndId: { [modelName: string]: { [id: string]: any } } = {};
        const fetchPromises = Object.keys(logsByModel).map(async (modelName) => {
          const modelLogs = logsByModel[modelName];
          const recordIds = Array.from(new Set(modelLogs.map(l => l.recordId)));
          const camelCaseModel = modelName.charAt(0).toLowerCase() + modelName.slice(1);
          
          const include: any = {};
          if (modelName === 'SalesOrder') {
            include.items = true;
          } else if (modelName === 'PurchaseOrder') {
            include.items = true;
          } else if (modelName === 'Bom') {
            include.components = true;
          }

          try {
            const records = await (prisma as any)[camelCaseModel].findMany({
              where: { id: { in: recordIds } },
              ...(Object.keys(include).length > 0 ? { include } : {}),
            });
            
            if (!fetchedDataByModelAndId[modelName]) {
              fetchedDataByModelAndId[modelName] = {};
            }
            for (const r of records) {
              fetchedDataByModelAndId[modelName][r.id] = r;
            }
          } catch (e) {
            console.error(`[Vercel Sync] Failed to batch fetch cloud records for model ${modelName}:`, e);
          }
        });

        // Wait for all batch fetches to complete in parallel
        await Promise.all(fetchPromises);

        // Build the cloudChanges response in correct temporal order
        for (const log of newCloudLogs) {
          let recordData = null;
          if (log.action === 'CREATE' || log.action === 'UPDATE') {
            recordData = fetchedDataByModelAndId[log.modelName]?.[log.recordId] || null;
          }
          cloudChanges.push({
            modelName: log.modelName,
            recordId: log.recordId,
            action: log.action,
            data: recordData,
          });
        }
      }
    }
  }

  return NextResponse.json({
      success: true,
      processedCount: Array.isArray(logs) ? logs.length : 0,
      syncedLogIds: processedLogIds,
      changes: cloudChanges,
      timestamp: serverTimestamp,
    });

  } catch (err: any) {
    console.error('[Vercel Sync] Error processing sync:', err);
    return NextResponse.json({ message: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
