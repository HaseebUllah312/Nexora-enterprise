import { Controller, Get, Post, Body, InternalServerErrorException } from '@nestjs/common';
import { SyncService } from './sync.service';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Controller('sync')
export class SyncController {
  constructor(
    private syncService: SyncService,
    private prisma: PrismaService,
  ) {}

  @Get('status')
  async getStatus() {
    try {
      const unsyncedCount = await (this.prisma as any).syncLog.count({
        where: { synced: false },
      });
      const syncedCount = await (this.prisma as any).syncLog.count({
        where: { synced: true },
      });

      return {
        enabled: !!(process.env.SYNC_TARGET_URL && process.env.SYNC_SECRET && (process.env.SUPABASE_DATABASE_URL || (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')))),
        unsyncedCount,
        syncedCount,
        syncTargetUrl: process.env.SYNC_TARGET_URL || '',
        supabaseDbUrl: process.env.SUPABASE_DATABASE_URL || '',
        lastError: this.syncService.getLastError(),
      };
    } catch (err: any) {
      throw new InternalServerErrorException(err.message || 'Failed to get sync status');
    }
  }

  @Post('trigger')
  async triggerSync() {
    try {
      if (!process.env.SYNC_TARGET_URL || !process.env.SYNC_SECRET) {
        return { success: false, message: 'Sync target or secret is not configured' };
      }
      await this.syncService.runSync();
      
      const unsyncedCount = await (this.prisma as any).syncLog.count({
        where: { synced: false },
      });

      return { success: true, unsyncedCount };
    } catch (err: any) {
      throw new InternalServerErrorException(err.message || 'Sync failed');
    }
  }

  @Post('clear-queue')
  async clearQueue() {
    try {
      const result = await (this.prisma as any).syncLog.updateMany({
        where: { synced: false },
        data: { synced: true },
      });
      return { success: true, cleared: result.count };
    } catch (err: any) {
      throw new InternalServerErrorException(err.message || 'Failed to clear sync queue');
    }
  }

  @Post('reset-pointer')
  async resetPointer() {
    try {
      const p = this.syncService.getSyncStatePath();
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
      return { success: true, message: 'Sync pointer reset successfully.' };
    } catch (err: any) {
      throw new InternalServerErrorException(err.message || 'Failed to reset sync pointer');
    }
  }

  @Post('config')
  async updateConfig(@Body() body: { syncTargetUrl: string; syncSecret: string; supabaseDbUrl: string }) {
    try {
      let envFileToUpdate = '';

      if (process.env.USER_DATA_PATH) {
        envFileToUpdate = path.join(process.env.USER_DATA_PATH, '.env');
      } else {
        const paths = [
          path.join(process.cwd(), '.env'),
          path.join(process.cwd(), '..', '.env'),
          path.join(os.homedir(), 'AppData', 'Roaming', 'nexora-enterprise-desktop', '.env'),
          path.join(os.homedir(), 'AppData', 'Roaming', 'factory-erp-desktop', '.env'),
        ];

        for (const p of paths) {
          if (fs.existsSync(p)) {
            envFileToUpdate = p;
            break;
          }
        }

        if (!envFileToUpdate) {
          envFileToUpdate = paths[0]; // fallback
        }
      }

      let content = '';
      if (fs.existsSync(envFileToUpdate)) {
        content = fs.readFileSync(envFileToUpdate, 'utf-8');
      }

      const updates = {
        SYNC_TARGET_URL: (body.syncTargetUrl || '').trim(),
        SYNC_SECRET: (body.syncSecret || '').trim(),
        SUPABASE_DATABASE_URL: (body.supabaseDbUrl || '').trim(),
      };

      let lines = content.split('\n');
      for (const [key, value] of Object.entries(updates)) {
        let found = false;
        lines = lines.map(line => {
          if (line.trim().startsWith(`${key}=`)) {
            found = true;
            return `${key}="${value}"`;
          }
          return line;
        });
        if (!found) {
          lines.push(`${key}="${value}"`);
        }
      }

      // Ensure directory exists if saving to appData path
      const dir = path.dirname(envFileToUpdate);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(envFileToUpdate, lines.join('\n'));

      // Also update current process.env variables so it takes effect instantly
      process.env.SYNC_TARGET_URL = updates.SYNC_TARGET_URL;
      process.env.SYNC_SECRET = updates.SYNC_SECRET;
      process.env.SUPABASE_DATABASE_URL = updates.SUPABASE_DATABASE_URL;

      return { success: true, message: 'Settings saved. Please restart the app for full effect.' };
    } catch (err: any) {
      throw new InternalServerErrorException(err.message || 'Failed to update config');
    }
  }

  @Post('clear-data')
  async clearData(@Body() body: { scope: string }) {
    const { scope } = body;
    const prisma = this.prisma as any;

    try {
      let deleted: Record<string, number> = {};

      if (scope === 'sales' || scope === 'all') {
        deleted['saleReturn']      = (await prisma.saleReturn.deleteMany()).count;
        deleted['salesInvoice']    = (await prisma.salesInvoice.deleteMany()).count;
        deleted['salesOrderItem']  = (await prisma.salesOrderItem.deleteMany()).count;
        deleted['salesOrder']      = (await prisma.salesOrder.deleteMany()).count;
      }

      if (scope === 'purchases' || scope === 'all') {
        deleted['purchaseReturn']     = (await prisma.purchaseReturn.deleteMany()).count;
        deleted['purchaseInvoice']    = (await prisma.purchaseInvoice.deleteMany()).count;
        deleted['purchaseOrderItem']  = (await prisma.purchaseOrderItem.deleteMany()).count;
        deleted['purchaseOrder']      = (await prisma.purchaseOrder.deleteMany()).count;
      }

      if (scope === 'inventory' || scope === 'all') {
        deleted['stockMovement'] = (await prisma.stockMovement.deleteMany()).count;
        deleted['stockTransfer'] = (await prisma.stockTransfer.deleteMany()).count;
        deleted['stock']         = (await prisma.stock.deleteMany()).count;
      }

      if (scope === 'products' || scope === 'all') {
        deleted['bomComponent']    = (await prisma.bomComponent.deleteMany()).count;
        deleted['bom']             = (await prisma.bom.deleteMany()).count;
        deleted['productionOrder'] = (await prisma.productionOrder.deleteMany()).count;
        deleted['product']         = (await prisma.product.deleteMany()).count;
        deleted['category']        = (await prisma.category.deleteMany()).count;
      }

      if (scope === 'customers' || scope === 'all') {
        deleted['customer'] = (await prisma.customer.deleteMany()).count;
      }

      if (scope === 'suppliers' || scope === 'all') {
        deleted['supplier'] = (await prisma.supplier.deleteMany()).count;
      }

      if (scope === 'accounting' || scope === 'all') {
        deleted['transaction'] = (await prisma.transaction.deleteMany()).count;
        deleted['expense']     = (await prisma.expense.deleteMany()).count;
      }

      if (scope === 'all') {
        deleted['syncLog'] = (await prisma.syncLog.deleteMany()).count;
        
        try {
          const dir = process.env.USER_DATA_PATH || process.cwd();
          const syncStateFile = path.join(dir, 'sync-state.json');
          if (fs.existsSync(syncStateFile)) {
            fs.unlinkSync(syncStateFile);
          }
        } catch (e) {
          console.error('Failed to clear sync state file:', e);
        }
      }

      return { success: true, scope, deleted };
    } catch (err: any) {
      throw new InternalServerErrorException(err.message || 'Failed to clear data');
    }
  }
}
