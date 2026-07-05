import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    const { logs } = body;

    if (!Array.isArray(logs)) {
      return NextResponse.json({ message: 'Invalid payload: logs must be an array' }, { status: 400 });
    }

    console.log(`[Vercel Sync] Received sync request with ${logs.length} entries.`);

    // Process logs sequentially in a database transaction to ensure transactional integrity
    await prisma.$transaction(async (tx) => {
      for (const log of logs) {
        const camelCaseModel = log.modelName.charAt(0).toLowerCase() + log.modelName.slice(1);

        if (log.action === 'DELETE') {
          try {
            await (tx[camelCaseModel] as any).delete({
              where: { id: log.recordId },
            });
          } catch (e) {
            // If already deleted, ignore the error
            console.log(`[Vercel Sync] Record ${log.recordId} for model ${log.modelName} already deleted or not found.`);
          }
          continue;
        }

        // Action is CREATE or UPDATE
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
          // Delete old items and insert fresh ones
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
          // Delete old items and insert fresh ones
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
          // Delete old components and insert fresh ones
          await tx.bomComponent.deleteMany({ where: { bomId: log.recordId } });
          if (Array.isArray(components) && components.length > 0) {
            const cleanComponents = components.map(({ product, ...comp }: any) => comp);
            await tx.bomComponent.createMany({ data: cleanComponents });
          }
        } else {
          // Standard upsert for other models
          await (tx[camelCaseModel] as any).upsert({
            where: { id: log.recordId },
            create: log.data,
            update: log.data,
          });
        }
      }
    }, { timeout: 30000 });

    console.log(`[Vercel Sync] Successfully processed ${logs.length} changes.`);
    return NextResponse.json({ success: true, processedCount: logs.length });

  } catch (err: any) {
    console.error('[Vercel Sync] Error processing sync:', err);
    return NextResponse.json({ message: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
