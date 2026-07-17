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

  private lowerFirst(value: string) {
    return value.charAt(0).toLowerCase() + value.slice(1);
  }

  private getIncludeForModel(modelName: string) {
    const include: any = {};
    if (modelName === 'SalesOrder' || modelName === 'PurchaseOrder') {
      include.items = true;
    } else if (modelName === 'Bom') {
      include.components = true;
    }
    return Object.keys(include).length > 0 ? include : undefined;
  }

  private async fetchRecord(modelName: string, recordId: string) {
    const camelCaseModel = this.lowerFirst(modelName);
    try {
      const include = this.getIncludeForModel(modelName);
      return await (this.prisma as any)[camelCaseModel].findUnique({
        where: { id: recordId },
        ...(include ? { include } : {}),
      });
    } catch (e) {
      console.error(`[Sync Service] Failed to fetch dependency record ${modelName}(${recordId}):`, e);
      return null;
    }
  }

  private async ensureDependency(logsByKey: Map<string, any>, modelName: string, recordId: string, extraLogs: any[]) {
    const key = `${modelName}:${recordId}`;
    if (logsByKey.has(key)) return;

    const recordData = await this.fetchRecord(modelName, recordId);
    if (!recordData) return;

    const dependencyLog = {
      logId: '',
      modelName,
      recordId,
      action: 'CREATE',
      data: recordData,
    };

    logsByKey.set(key, dependencyLog);
    extraLogs.push(dependencyLog);
    await this.resolveDependenciesFromRecord(recordData, modelName, logsByKey, extraLogs);
  }

  private async resolveDependenciesFromRecord(record: any, modelName: string, logsByKey: Map<string, any>, extraLogs: any[]) {
    if (!record || typeof record !== 'object') return;

    const add = async (depModel: string, depId?: string | null) => {
      if (!depId) return;
      await this.ensureDependency(logsByKey, depModel, depId, extraLogs);
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
      case 'SalesOrderItem':
      case 'PurchaseOrderItem':
      case 'BomComponent':
        await add('Product', record.productId);
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
        // Generic fields for any model
        await add('Product', record.productId);
        await add('Category', record.categoryId);
        await add('Branch', record.branchId);
        await add('User', record.createdById);
        await add('Customer', record.customerId);
        await add('Supplier', record.supplierId);
        await add('Warehouse', record.warehouseId);
        break;
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

      const logsByKey = new Map<string, any>();
      const originalLogKeys: string[] = [];

      const getKey = (modelName: string, recordId: string) => `${modelName}:${recordId}`;

      const modelPriority = (modelName: string) => {
        if (['Role', 'Branch', 'Category', 'Warehouse', 'User'].includes(modelName)) return 1;
        if (['Customer', 'Supplier', 'Product', 'Stock', 'StockMovement', 'Bom', 'ProductionOrder'].includes(modelName)) return 2;
        if (['SalesOrder', 'PurchaseOrder', 'SalesInvoice', 'PurchaseInvoice'].includes(modelName)) return 3;
        return 4;
      };

      for (const log of unsyncedLogs) {
        const key = getKey(log.modelName, log.recordId);
        originalLogKeys.push(key);

        let recordData = null;
        if (log.action === 'CREATE' || log.action === 'UPDATE') {
          recordData = await this.fetchRecord(log.modelName, log.recordId);
        }

        logsByKey.set(key, {
          logId: log.id,
          modelName: log.modelName,
          recordId: log.recordId,
          action: log.action,
          data: recordData,
        });

        if (recordData && (log.action === 'CREATE' || log.action === 'UPDATE')) {
          await this.resolveDependenciesFromRecord(recordData, log.modelName, logsByKey, []);
        }
      }

      const batch = Array.from(logsByKey.values()).sort((a, b) => {
        const priorityDiff = modelPriority(a.modelName) - modelPriority(b.modelName);
        if (priorityDiff !== 0) return priorityDiff;
        if (a.modelName !== b.modelName) return a.modelName.localeCompare(b.modelName);
        return a.recordId.localeCompare(b.recordId);
      });

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

      let remoteApplySucceeded = true;

      // 1. Apply remote changes locally before marking local logs as synced
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
                const whereClause = change.modelName === 'Branch'
                  ? { code: change.data?.code || change.recordId }
                  : change.modelName === 'Role'
                    ? { name: change.data?.name || change.recordId }
                    : change.modelName === 'User'
                      ? { email: change.data?.email || change.recordId }
                      : { id: change.recordId };

                await (tx[camelCaseModel] as any).upsert({
                  where: whereClause,
                  create: { ...change.data, id: change.recordId },
                  update: change.data,
                });
              }
              console.log(`[Sync Service] Upserted local ${change.modelName} (ID: ${change.recordId})`);
            }
          }, { timeout: 30000 });
          console.log(`[Sync Service] Remote changes applied successfully.`);
        } catch (err: any) {
          remoteApplySucceeded = false;
          console.error(`[Sync Service] Failed to apply remote changes:`, err.message || err);
        } finally {
          (global as any).isSyncingRemote = false;
        }
      }

      // 2. Mark local logs as synced only after the pull step succeeded
      if (result.success && remoteApplySucceeded && unsyncedLogs.length > 0) {
        const successfullySyncedLogIds = Array.isArray(result.syncedLogIds) && result.syncedLogIds.length > 0
          ? result.syncedLogIds
          : unsyncedLogs.map((l: any) => l.id);

        await (this.prisma as any).syncLog.updateMany({
          where: { id: { in: successfullySyncedLogIds } },
          data: { synced: true },
        });
        console.log(`[Sync Service] Marked ${successfullySyncedLogIds.length} changes as synced locally.`);
      }

      // 3. Update the last pulled timestamp only after the pull step succeeded
      if (result.success && remoteApplySucceeded && result.timestamp) {
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
