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
    // Programmatically bypass pgBouncer connection pooler on Vercel by rewriting to the direct database IPv6 host
    finalUrl = databaseUrl.replace(
      'aws-1-ap-southeast-1.pooler.supabase.com',
      'db.xyxbsebdovvmcmzingmh.supabase.co'
    );
    
    // Set a larger connection limit since we are not using the pooler
    if (!finalUrl.includes('connection_limit')) {
      const separator = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${separator}connection_limit=10`;
    }
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

      const group1 = compactedLogs.filter(log => getModelPriority(log.modelName) === 1);
      const group2 = compactedLogs.filter(log => getModelPriority(log.modelName) === 2);
      const group3 = compactedLogs.filter(log => getModelPriority(log.modelName) === 3);

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
        await logDebug(`[Vercel Sync] Processing Group 1 (${group1.length} records)...`);
        await Promise.all(group1.map(log => processLog(log)));
        await logDebug(`[Vercel Sync] Group 1 finished.`);
      }

      // 2. Group 2 (Related entities) in parallel
      if (group2.length > 0) {
        await logDebug(`[Vercel Sync] Processing Group 2 (${group2.length} records)...`);
        await Promise.all(group2.map(log => processLog(log)));
        await logDebug(`[Vercel Sync] Group 2 finished.`);
      }

      // 3. Group 3 (Transactions/Movements) in parallel
      if (group3.length > 0) {
        await logDebug(`[Vercel Sync] Processing Group 3 (${group3.length} records)...`);
        await Promise.all(group3.map(log => processLog(log)));
        await logDebug(`[Vercel Sync] Group 3 finished.`);
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
