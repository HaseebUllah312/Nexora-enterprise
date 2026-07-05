import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();

    if (process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('.db') || process.env.DATABASE_URL.startsWith('file:'))) {
      try {
        await this.$executeRawUnsafe(`PRAGMA journal_mode=WAL;`);
        await this.$executeRawUnsafe(`PRAGMA busy_timeout=10000;`);
        console.log('[Prisma] Configured SQLite with WAL mode and busy_timeout=10s.');
      } catch (err) {
        console.error('[Prisma] Failed to apply SQLite pragmas:', err);
      }
    }

    // Only log mutations if we are in local sync mode (i.e., we have a remote database to sync to)
    if (process.env.SUPABASE_DATABASE_URL && process.env.SYNC_TARGET_URL && process.env.SYNC_SECRET) {
      this.$use(async (params, next) => {
        const result = await next(params);

        const writeActions = ['create', 'update', 'upsert', 'delete'];
        if (
          params.model &&
          (params.model as string) !== 'SyncLog' &&
          writeActions.includes(params.action)
        ) {
          const modelName = params.model;
          // Defer writing to prevent deadlocking SQLite transactions
          setTimeout(async () => {
            try {
              let recordId = '';
              if (params.action === 'delete') {
                recordId = params.args?.where?.id || result?.id;
              } else if (result) {
                recordId = result.id;
              }

              if (recordId) {
                if (params.action !== 'delete') {
                  const camelCaseModel = modelName.charAt(0).toLowerCase() + modelName.slice(1);
                  const exists = await (this[camelCaseModel] as any).findUnique({
                    where: { id: recordId },
                    select: { id: true },
                  });
                  if (!exists) return; // Rolled back transaction
                }

                await (this as any).syncLog.create({
                  data: {
                    modelName: modelName,
                    recordId,
                    action: params.action.toUpperCase(),
                  },
                });
              }
            } catch (err) {
              console.error('[Sync Middleware] Failed to write sync log:', err);
            }
          }, 100);
        }

        return result;
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
