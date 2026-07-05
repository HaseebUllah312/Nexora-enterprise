import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

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
  return client;
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
