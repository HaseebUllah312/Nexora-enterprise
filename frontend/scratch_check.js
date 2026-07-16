const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.xyxbsebdovvmcmzingmh:Factory%40123232@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    }
  }
});

async function main() {
  const count = await prisma.syncLog.count();
  console.log('Total SyncLog records on Cloud:', count);
  
  if (count > 0) {
    const latest = await prisma.syncLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    console.log('Latest Cloud logs:', JSON.stringify(latest, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
