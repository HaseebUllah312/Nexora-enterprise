import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

const createPrismaClient = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
  if (process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('.db') || process.env.DATABASE_URL.startsWith('file:'))) {
    client.$connect().then(async () => {
      try {
        await client.$executeRawUnsafe(`PRAGMA journal_mode=WAL;`);
        await client.$executeRawUnsafe(`PRAGMA busy_timeout=10000;`);
      } catch (err) {}
    }).catch(() => {});
  }

  // Intercept mutations on the web to log them for offline sync
  client.$use(async (params, next) => {
    const result = await next(params);
    const writeActions = ['create', 'update', 'upsert', 'delete'];
    if (
      params.model &&
      (params.model as string) !== 'SyncLog' &&
      writeActions.includes(params.action) &&
      !(global as any).isSyncingRemote
    ) {
      const modelName = params.model;
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
              const exists = await (client as any)[camelCaseModel].findUnique({
                where: { id: recordId },
                select: { id: true },
              });
              if (!exists) return;
            }
            await (client as any).syncLog.create({
              data: {
                modelName: modelName,
                recordId,
                action: params.action.toUpperCase(),
              },
            });
          }
        } catch (err) {
          console.error('[Web Sync Middleware] Failed to write sync log:', err);
        }
      }, 100);
    }
    return result;
  });

  return client;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
