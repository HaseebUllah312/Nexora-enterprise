import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor(private prisma: PrismaService) {}

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

  async runSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const unsyncedLogs = await (this.prisma as any).syncLog.findMany({
        where: { synced: false },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      if (unsyncedLogs.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`[Sync Service] Found ${unsyncedLogs.length} unsynced changes. Preparing payload...`);

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

      console.log(`[Sync Service] Pushing batch of ${batch.length} to remote...`);
      
      const response = await fetch(syncTarget, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-secret': syncSecret,
        },
        body: JSON.stringify({ logs: batch }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sync target responded with status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log(`[Sync Service] Sync batch successful. remote response:`, result);

      // Mark successfully synced logs as synced
      const successfullySyncedLogIds = unsyncedLogs.map(l => l.id);
      await (this.prisma as any).syncLog.updateMany({
        where: { id: { in: successfullySyncedLogIds } },
        data: { synced: true },
      });

      console.log(`[Sync Service] Marked ${successfullySyncedLogIds.length} changes as synced locally.`);

    } catch (err: any) {
      console.error('[Sync Service] Error during synchronization:', err.message || err);
    } finally {
      this.isSyncing = false;
    }
  }
}
