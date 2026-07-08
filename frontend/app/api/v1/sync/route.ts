import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const maxDuration = 60;

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

      // Process logs in chunks of 5 to prevent transaction timeouts on serverless functions
      const chunkSize = 5;
      for (let i = 0; i < logs.length; i += chunkSize) {
        const chunk = logs.slice(i, i + chunkSize);

        await prisma.$transaction(async (tx) => {
          for (const log of chunk) {
            const camelCaseModel = log.modelName.charAt(0).toLowerCase() + log.modelName.slice(1);

            if (log.action === 'DELETE') {
              try {
                await (tx[camelCaseModel] as any).delete({
                  where: { id: log.recordId },
                });
              } catch (e) {
                console.log(`[Vercel Sync] Record ${log.recordId} for model ${log.modelName} already deleted or not found.`);
              }
              continue;
            }

            if (!log.data) {
              console.warn(`[Vercel Sync] Log ${log.logId} has action ${log.action} but data is null.`);
              continue;
            }

            if (log.modelName === 'SalesOrder') {
              const { items, ...orderData } = log.data;
              await tx.salesOrder.upsert({
                where: { id: log.recordId },
                create: orderData,
                update: orderData,
              });
              await tx.salesOrderItem.deleteMany({ where: { salesOrderId: log.recordId } });
              if (Array.isArray(items) && items.length > 0) {
                const cleanItems = items.map(({ product, ...item }: any) => item);
                await tx.salesOrderItem.createMany({ data: cleanItems });
              }
            } else if (log.modelName === 'PurchaseOrder') {
              const { items, ...poData } = log.data;
              await tx.purchaseOrder.upsert({
                where: { id: log.recordId },
                create: poData,
                update: poData,
              });
              await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: log.recordId } });
              if (Array.isArray(items) && items.length > 0) {
                const cleanItems = items.map(({ product, ...item }: any) => item);
                await tx.purchaseOrderItem.createMany({ data: cleanItems });
              }
            } else if (log.modelName === 'Bom') {
              const { components, ...bomData } = log.data;
              await tx.bom.upsert({
                where: { id: log.recordId },
                create: bomData,
                update: bomData,
              });
              await tx.bomComponent.deleteMany({ where: { bomId: log.recordId } });
              if (Array.isArray(components) && components.length > 0) {
                const cleanComponents = components.map(({ product, ...comp }: any) => comp);
                await tx.bomComponent.createMany({ data: cleanComponents });
              }
            } else {
              await (tx[camelCaseModel] as any).upsert({
                where: { id: log.recordId },
                create: log.data,
                update: log.data,
              });
            }
          }
        }, { timeout: 15000 });
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
            recordData = await (prisma[camelCaseModel] as any).findUnique({
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
