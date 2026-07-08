import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const maxDuration = 60;
export const preferredRegion = 'sin1';

const globalForSync = global as unknown as { syncPrisma: PrismaClient };

let prisma: PrismaClient;

if (globalForSync.syncPrisma) {
  prisma = globalForSync.syncPrisma;
} else {
  const databaseUrl = process.env.DATABASE_URL;
  let finalUrl = databaseUrl;
  
  if (databaseUrl) {
    // Keep the pooler host as it supports IPv4 (required by Vercel Lambda egress)
    // We clean up pgbouncer transaction mode and set a moderate connection limit
    finalUrl = databaseUrl.replace('pgbouncer=true', 'pgbouncer=false');
    
    if (!finalUrl.includes('connection_limit')) {
      const separator = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${separator}connection_limit=3&pool_timeout=15`;
    }
  }

  if (finalUrl) {
    console.log('[Prisma Init] Resolved DATABASE_URL: ', finalUrl.replace(/:[^:@]+@/, ':****@'));
  }

  prisma = new PrismaClient({
    datasources: {
      db: {
        url: finalUrl,
      },
    },
  });
  globalForSync.syncPrisma = prisma;
}

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
    try {
      await prisma.syncLog.create({
        data: {
          modelName: 'DebugLog',
          recordId: 'vercel-sync',
          action: msg.substring(0, 190), // Clamp length to fit standard DB limits
          synced: true
        }
      });
    } catch (e) {
      // Ignore
    }
  };

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

      // Compact logs: keep only the latest log entry for each recordId
      const compactedMap = new Map<string, any>();
      for (const log of logs) {
        compactedMap.set(log.recordId, log);
      }
      const compactedLogs = Array.from(compactedMap.values());
      await logDebug(`[Vercel Sync] Compacted to ${compactedLogs.length} unique records.`);

      // Sort logs by priority so that base dependencies are created before child transactions
      const sortedLogs = [...compactedLogs].sort((a, b) => getModelPriority(a.modelName) - getModelPriority(b.modelName));

      const operations: any[] = [];
      const deleteLogs: any[] = [];

      for (const log of sortedLogs) {
        const camelCaseModel = log.modelName.charAt(0).toLowerCase() + log.modelName.slice(1);

        if (log.action === 'DELETE') {
          deleteLogs.push(log);
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
          operations.push(
            (prisma as any)[camelCaseModel].upsert({
              where: { id: log.recordId },
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
          } catch (e) {
            // Ignore if already deleted
          }
        }
      }

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
