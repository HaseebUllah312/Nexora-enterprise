import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hash(pw: string) { return bcrypt.hash(pw, 12); }

async function main() {
  console.log('━━━ Seeding FactoryERP Pro ━━━\n');

  // ── 1. ROLES ──────────────────────────────────────────────────────────────
  const ROLE_NAMES = ['SUPER_ADMIN','OWNER','FACTORY_MANAGER','BRANCH_MANAGER',
    'WAREHOUSE_MANAGER','SALES_MANAGER','SALES_STAFF','ACCOUNTANT',
    'PRODUCTION_MANAGER','DRIVER','EMPLOYEE'];

  const roles: Record<string, string> = {};
  for (const name of ROLE_NAMES) {
    const r = await prisma.role.upsert({ where:{name}, update:{}, create:{name,isSystem:true} });
    roles[name] = r.id;
  }
  console.log('✓ Roles seeded');

  // ── 2. BRANCHES ────────────────────────────────────────────────────────────
  const mainBranch = await prisma.branch.upsert({
    where:{code:'MAIN'}, update:{},
    create:{ name:'Main Factory', code:'MAIN', city:'Gujranwala',
      address:'Industrial Estate, Gujranwala', phone:'055-1234567', isMainBranch:true },
  });
  const lahoreBranch = await prisma.branch.upsert({
    where:{code:'LHR'}, update:{},
    create:{ name:'Lahore Branch', code:'LHR', city:'Lahore',
      address:'Shah Alam Market, Lahore', phone:'042-7654321' },
  });
  const gujBranch = await prisma.branch.upsert({
    where:{code:'GUJ'}, update:{},
    create:{ name:'Gujranwala Branch', code:'GUJ', city:'Gujranwala',
      address:'GT Road, Gujranwala', phone:'055-9876543' },
  });
  console.log('✓ Branches seeded (Main Factory, Lahore, Gujranwala)');

  // ── 3. WAREHOUSES ──────────────────────────────────────────────────────────
  for (const [code, name, branchId] of [
    ['MAIN-WH1','Main Warehouse',    mainBranch.id],
    ['LHR-WH1', 'Lahore Store',      lahoreBranch.id],
    ['GUJ-WH1', 'Gujranwala Store',  gujBranch.id],
  ] as [string,string,string][]) {
    await prisma.warehouse.upsert({ where:{code}, update:{}, create:{name,code,branchId} });
  }
  console.log('✓ Warehouses seeded');

  // ── 4. USERS ───────────────────────────────────────────────────────────────
  const users = [
    { email:'haseebsaleem312@gmail.com', password:'HaseebDev@2024',  firstName:'Haseeb',      lastName:'Saleem',  roleName:'SUPER_ADMIN',   branchId:null,            note:'Developer — FULL ACCESS' },
    { email:'owner@factoryerp.pk',       password:'Owner@2024',       firstName:'Factory',     lastName:'Owner',   roleName:'OWNER',         branchId:null,            note:'Owner — All branches consolidated' },
    { email:'lahore@factoryerp.pk',      password:'Lahore@2024',      firstName:'Lahore',      lastName:'Manager', roleName:'BRANCH_MANAGER',branchId:lahoreBranch.id, note:'Lahore Branch only' },
    { email:'gujranwala@factoryerp.pk',  password:'Gujranwala@2024',  firstName:'Gujranwala',  lastName:'Manager', roleName:'BRANCH_MANAGER',branchId:gujBranch.id,   note:'Gujranwala Branch only' },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where:{email:u.email} });
    if (existing) {
      await prisma.user.update({ where:{email:u.email}, data:{
        passwordHash: await hash(u.password), firstName:u.firstName, lastName:u.lastName,
        roleId:roles[u.roleName], branchId:u.branchId, status:'ACTIVE',
      }});
    } else {
      await prisma.user.create({ data:{
        email:u.email, passwordHash:await hash(u.password),
        firstName:u.firstName, lastName:u.lastName,
        roleId:roles[u.roleName], branchId:u.branchId, status:'ACTIVE',
      }});
    }
    console.log(`  ✓ ${u.email} (${u.roleName}) — ${u.note}`);
  }

  // ── 5. COMPANY SETTINGS ────────────────────────────────────────────────────
  const branches = [
    { branch:mainBranch,   companyName:'National Chattan (Main)',        prefix:'MINV' },
    { branch:lahoreBranch, companyName:'National Chattan (Lahore)',       prefix:'LINV' },
    { branch:gujBranch,    companyName:'National Chattan (Gujranwala)',   prefix:'GINV' },
  ];

  for (const { branch, companyName, prefix } of branches) {
    await prisma.companySettings.upsert({
      where:  { branchId:branch.id },
      update: {},
      create: {
        branchId:    branch.id,
        companyName,
        address:     branch.address ?? '',
        city:        branch.city ?? '',
        phone:       branch.phone ?? '',
        ntn:         '1234567-8',
        invoicePrefix: prefix,
        invoiceCounter: 1,
        taxRate:     17,
        currency:    'PKR',
        termsAndConditions: 'Goods once sold will not be returned without prior approval. Payment within 30 days.',
      },
    });
  }
  console.log('✓ Company settings seeded (17% GST configured)');

  // ── 6. PRODUCT CATEGORIES ─────────────────────────────────────────────────
  const catNames = ['PVC Pipes','PPRC Pipes','Sanitary Fittings','Elbows & Tees','Valves','Raw Materials','Accessories'];
  const existingCats = await prisma.category.findMany({ where:{ name:{ in:catNames } } });
  const existingNames = existingCats.map(c=>c.name);
  for (const name of catNames) {
    if (!existingNames.includes(name)) await prisma.category.create({ data:{ name } });
  }
  console.log('✓ Product categories seeded');

  // ── 7. DEFAULT ACCOUNTING ACCOUNTS ────────────────────────────────────────
  const accountDefs = [
    { name:'Cash in Hand',   type:'CASH'       },
    { name:'Bank Account',   type:'BANK'       },
    { name:'Sales Revenue',  type:'INCOME'     },
    { name:'Cost of Goods',  type:'EXPENSE'    },
    { name:'Receivables',    type:'RECEIVABLE' },
    { name:'Payables',       type:'PAYABLE'    },
    { name:'Owner Equity',   type:'EQUITY'     },
  ];

  for (const branch of [mainBranch, lahoreBranch, gujBranch]) {
    for (const acc of accountDefs) {
      const exists = await prisma.account.findFirst({ where:{ name:acc.name, branchId:branch.id } });
      if (!exists) await prisma.account.create({ data:{ name:acc.name, type:acc.type as any, branchId:branch.id } });
    }
  }
  console.log('✓ Default accounts seeded for all branches');

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n━━━ Seed Complete ━━━\n');
  console.log('LOGIN CREDENTIALS');
  console.log('────────────────────────────────────────────────────────────────');
  console.log('  haseebsaleem312@gmail.com  │  HaseebDev@2024   │  SUPER_ADMIN');
  console.log('  owner@factoryerp.pk        │  Owner@2024        │  OWNER');
  console.log('  lahore@factoryerp.pk       │  Lahore@2024       │  BRANCH_MANAGER (Lahore)');
  console.log('  gujranwala@factoryerp.pk   │  Gujranwala@2024   │  BRANCH_MANAGER (Gujranwala)');
  console.log('────────────────────────────────────────────────────────────────');
  console.log('⚠  Change all passwords immediately in production!\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
