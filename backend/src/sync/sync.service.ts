import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private lastSyncError: string | null = null;

  constructor(private prisma: PrismaService) {}

  getLastError(): string | null {
    return this.lastSyncError;
  }

  onModuleInit() {
    const syncTarget = process.env.SYNC_TARGET_URL;
    const syncSecret = process.env.SYNC_SECRET;

    if (syncTarget && syncSecret) {
      console.log(`[Sync Service] Initialized. Target: ${syncTarget}`);
      // Run sync every 30 seconds
      this.syncInterval = setInterval(() => this.runSync(), 30000);
      // Run an initial sync after a short delay
      setTimeout(() => this.runSync(), 5000);
    } else {
      console.log('[Sync Service] Disabled. SYNC_TARGET_URL or SYNC_SECRET not set.');
    }
  }

  onModuleDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }

  getSyncStatePath(): string {
    const dir = process.env.USER_DATA_PATH || process.cwd();
    return path.join(dir, 'sync-state.json');
  }

  private loadLastPulledAt(): string {
    try {
      const p = this.getSyncStatePath();
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (data.lastPulledAt) {
          return data.lastPulledAt;
        }
      }
    } catch (e) {
      console.error('[Sync Service] Failed to load lastPulledAt:', e);
    }
    return new Date(0).toISOString();
  }

  private saveLastPulledAt(isoString: string) {
    try {
      const p = this.getSyncStatePath();
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(p, JSON.stringify({ lastPulledAt: isoString }), 'utf8');
    } catch (e) {
      console.error('[Sync Service] Failed to save lastPulledAt:', e);
    }
  }

  async runSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const unsyncedLogs = await (this.prisma as any).syncLog.findMany({
        where: { synced: false },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });

      const batch: any[] = [];
      for (const log of unsyncedLogs) {
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
            recordData = await (this.prisma[camelCaseModel] as any).findUnique({
              where: { id: log.recordId },
              ...(Object.keys(include).length > 0 ? { include } : {}),
            });
          } catch (e) {
            console.error(`[Sync Service] Failed to fetch local record for model ${log.modelName} (ID: ${log.recordId}):`, e);
          }
        }

        batch.push({
          logId: log.id,
          modelName: log.modelName,
          recordId: log.recordId,
          action: log.action,
          data: recordData,
        });
      }

      const syncTarget = process.env.SYNC_TARGET_URL!;
      const syncSecret = process.env.SYNC_SECRET!;
      const lastPulledAt = this.loadLastPulledAt();

      console.log(`[Sync Service] Pushing batch of ${batch.length} to remote, pulling changes since ${lastPulledAt}...`);
      
      const response = await fetch(syncTarget, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-secret': syncSecret,
        },
        body: JSON.stringify({ logs: batch, lastPulledAt }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sync target responded with status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log(`[Sync Service] Sync batch successful. remote response received.`);

      // 1. Mark successfully synced local logs as synced
      if (unsyncedLogs.length > 0) {
        const successfullySyncedLogIds = unsyncedLogs.map(l => l.id);
        await (this.prisma as any).syncLog.updateMany({
          where: { id: { in: successfullySyncedLogIds } },
          data: { synced: true },
        });
        console.log(`[Sync Service] Marked ${successfullySyncedLogIds.length} changes as synced locally.`);
      }

      // 2. Apply remote changes locally
      if (result.success && Array.isArray(result.changes) && result.changes.length > 0) {
        console.log(`[Sync Service] Applying ${result.changes.length} remote changes locally...`);
        (global as any).isSyncingRemote = true;
        try {
          await this.prisma.$transaction(async (tx) => {
            for (const change of result.changes) {
              const camelCaseModel = change.modelName.charAt(0).toLowerCase() + change.modelName.slice(1);

              if (change.action === 'DELETE') {
                try {
                  await (tx[camelCaseModel] as any).delete({
                    where: { id: change.recordId },
                  });
                  console.log(`[Sync Service] Deleted local ${change.modelName} (ID: ${change.recordId})`);
                } catch (e) {
                  // Ignore if already deleted locally
                }
                continue;
              }

              if (!change.data) continue;

              if (change.modelName === 'SalesOrder') {
                const { items, ...orderData } = change.data;
                await tx.salesOrder.upsert({
                  where: { id: change.recordId },
                  create: orderData,
                  update: orderData,
                });
                await tx.salesOrderItem.deleteMany({ where: { salesOrderId: change.recordId } });
                if (Array.isArray(items) && items.length > 0) {
                  const cleanItems = items.map(({ product, ...item }: any) => item);
                  await tx.salesOrderItem.createMany({ data: cleanItems });
                }
              } else if (change.modelName === 'PurchaseOrder') {
                const { items, ...poData } = change.data;
                await tx.purchaseOrder.upsert({
                  where: { id: change.recordId },
                  create: poData,
                  update: poData,
                });
                await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: change.recordId } });
                if (Array.isArray(items) && items.length > 0) {
                  const cleanItems = items.map(({ product, ...item }: any) => item);
                  await tx.purchaseOrderItem.createMany({ data: cleanItems });
                }
              } else if (change.modelName === 'Bom') {
                const { components, ...bomData } = change.data;
                await tx.bom.upsert({
                  where: { id: change.recordId },
                  create: bomData,
                  update: bomData,
                });
                await tx.bomComponent.deleteMany({ where: { bomId: change.recordId } });
                if (Array.isArray(components) && components.length > 0) {
                  const cleanComponents = components.map(({ product, ...comp }: any) => comp);
                  await tx.bomComponent.createMany({ data: cleanComponents });
                }
              } else {
                await (tx[camelCaseModel] as any).upsert({
                  where: { id: change.recordId },
                  create: change.data,
                  update: change.data,
                });
              }
              console.log(`[Sync Service] Upserted local ${change.modelName} (ID: ${change.recordId})`);
            }
          }, { timeout: 30000 });
          console.log(`[Sync Service] Remote changes applied successfully.`);
        } catch (err: any) {
          console.error(`[Sync Service] Failed to apply remote changes:`, err.message || err);
        } finally {
          (global as any).isSyncingRemote = false;
        }
      }

      // 3. Update the last pulled timestamp
      if (result.success && result.timestamp) {
        this.saveLastPulledAt(result.timestamp);
      }

      this.lastSyncError = null; // Clear error on success
    } catch (err: any) {
      console.error('[Sync Service] Error during synchronization:', err.message || err);
      this.lastSyncError = err.message || String(err); // Capture error on failure
    } finally {
      this.isSyncing = false;
    }
  }
}
