import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const maxDuration = 60;
export const preferredRegion = 'sin1';

const globalForSync = global as unknown as { syncPrisma: PrismaClient };
const prisma = globalForSync.syncPrisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForSync.syncPrisma = prisma;

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

  try {
    const body = await req.json();
    const { logs, lastPulledAt } = body;

    // 1. Process incoming logs from client
    if (Array.isArray(logs) && logs.length > 0) {
      console.log(`[Vercel Sync] Received sync request with ${logs.length} entries.`);

      const getModelPriority = (modelName: string): number => {
        if (['Role', 'Branch', 'Category'].includes(modelName)) return 1;
        if (['User', 'Warehouse', 'Customer', 'Supplier', 'Product'].includes(modelName)) return 2;
        return 3;
      };

      const group1 = logs.filter(log => getModelPriority(log.modelName) === 1);
      const group2 = logs.filter(log => getModelPriority(log.modelName) === 2);
      const group3 = logs.filter(log => getModelPriority(log.modelName) === 3);

      const processLog = async (log: any) => {
        try {
          const camelCaseModel = log.modelName.charAt(0).toLowerCase() + log.modelName.slice(1);

          if (log.action === 'DELETE') {
            try {
              await (prisma as any)[camelCaseModel].delete({
                where: { id: log.recordId },
              });
            } catch (e) {
              console.log(`[Vercel Sync] Record ${log.recordId} for model ${log.modelName} already deleted or not found.`);
            }
            return;
          }

          if (!log.data) {
            console.warn(`[Vercel Sync] Log ${log.logId} has action ${log.action} but data is null.`);
            return;
          }

          if (log.modelName === 'SalesOrder') {
            const { items, ...orderData } = log.data;
            try {
              await prisma.salesOrder.create({ data: { ...orderData, id: log.recordId } });
            } catch (e) {
              await prisma.salesOrder.update({
                where: { id: log.recordId },
                data: orderData,
              });
            }
            await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: log.recordId } });
            if (Array.isArray(items) && items.length > 0) {
              const cleanItems = items.map(({ product, ...item }: any) => item);
              await prisma.salesOrderItem.createMany({ data: cleanItems });
            }
          } else if (log.modelName === 'PurchaseOrder') {
            const { items, ...poData } = log.data;
            try {
              await prisma.purchaseOrder.create({ data: { ...poData, id: log.recordId } });
            } catch (e) {
              await prisma.purchaseOrder.update({
                where: { id: log.recordId },
                data: poData,
              });
            }
            await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: log.recordId } });
            if (Array.isArray(items) && items.length > 0) {
              const cleanItems = items.map(({ product, ...item }: any) => item);
              await prisma.purchaseOrderItem.createMany({ data: cleanItems });
            }
          } else if (log.modelName === 'Bom') {
            const { components, ...bomData } = log.data;
            try {
              await prisma.bom.create({ data: { ...bomData, id: log.recordId } });
            } catch (e) {
              await prisma.bom.update({
                where: { id: log.recordId },
                data: bomData,
              });
            }
            await prisma.bomComponent.deleteMany({ where: { bomId: log.recordId } });
            if (Array.isArray(components) && components.length > 0) {
              const cleanComponents = components.map(({ product, ...comp }: any) => comp);
              await prisma.bomComponent.createMany({ data: cleanComponents });
            }
          } else {
            try {
              await (prisma as any)[camelCaseModel].create({ data: { ...log.data, id: log.recordId } });
            } catch (e) {
              await (prisma as any)[camelCaseModel].update({
                where: { id: log.recordId },
                data: log.data,
              });
            }
          }
        } catch (itemErr: any) {
          console.error(`[Vercel Sync] Error processing sync log ${log.logId} for model ${log.modelName}:`, itemErr.message || itemErr);
        }
      };

      // 1. Group 1 (Base entities) in parallel
      if (group1.length > 0) {
        await Promise.all(group1.map(log => processLog(log)));
      }

      // 2. Group 2 (Related entities) in parallel
      if (group2.length > 0) {
        await Promise.all(group2.map(log => processLog(log)));
      }

      // 3. Group 3 (Transactions/Movements) in parallel
      if (group3.length > 0) {
        await Promise.all(group3.map(log => processLog(log)));
      }

      console.log(`[Vercel Sync] Successfully processed ${logs.length} changes.`);
    }

    // 2. Fetch new changes on the cloud since lastPulledAt for the client to download
    const cloudChanges: any[] = [];
    let serverTimestamp = new Date().toISOString();

    if (lastPulledAt) {
      const lastPulled = new Date(lastPulledAt);
      const newCloudLogs = await prisma.syncLog.findMany({
        where: {
          createdAt: { gt: lastPulled },
        },
        orderBy: { createdAt: 'asc' },
      });

      for (const log of newCloudLogs) {
        let recordData = null;
        if (log.action === 'CREATE' || log.action === 'UPDATE') {
          const camelCaseModel = log.modelName.charAt(0).toLowerCase() + log.modelName.slice(1);
          const include: any = {};
          if (log.modelName === 'SalesOrder') {
            include.items = true;
          } else if (log.modelName === 'PurchaseOrder') {
            include.items = true;
          } else if (log.modelName === 'Bom') {
            include.components = true;
          }

          try {
            recordData = await (prisma as any)[camelCaseModel].findUnique({
              where: { id: log.recordId },
              ...(Object.keys(include).length > 0 ? { include } : {}),
            });
          } catch (e) {
            console.error(`[Vercel Sync] Failed to fetch cloud record for model ${log.modelName} (ID: ${log.recordId}):`, e);
          }
        }

        cloudChanges.push({
          modelName: log.modelName,
          recordId: log.recordId,
          action: log.action,
          data: recordData,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: Array.isArray(logs) ? logs.length : 0,
      changes: cloudChanges,
      timestamp: serverTimestamp,
    });

  } catch (err: any) {
    console.error('[Vercel Sync] Error processing sync:', err);
    return NextResponse.json({ message: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
