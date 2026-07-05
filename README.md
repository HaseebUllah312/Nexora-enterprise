# FactoryERP Pro

Complete Cloud ERP for PVC, PPRC & Sanitary manufacturing — multi-branch, role-based, real-time, AI-powered. Built like a real billing/ERP system (Hitech BillSoft-class), not a demo.

---

## What's inside (23 backend modules, 40+ frontend pages)

### Sales & Billing
- Quotation → Sales Order → Invoice → Payment workflow
- **Cash Memo** — fast POS-style sale for walk-in customers, auto-prints 80mm thermal receipt
- Sequential invoice numbering (`INV-2024-00001`, configurable prefix per branch)
- Tax/GST calculation, applied automatically from Company Settings
- Credit limit enforcement on credit sales
- Full A4 printable invoice with company letterhead, bank details, terms & conditions, signatures
- **Sale Returns (Credit Notes)** — restores stock, reduces invoice
- **Delivery Challans** — printable dispatch documents with driver/vehicle assignment
- **Customer Statement** — full transaction history with running balance, printable
- **Receivables Aging Report** — 0-30/31-60/61-90/91-120/120+ day buckets

### Purchases
- Requisition → PO → GRN (Goods Receiving) → Invoice → Supplier Payment
- Quick Receive toggle — adds stock to warehouse immediately on save
- **Purchase Returns (Debit Notes)** — deducts stock, reduces invoice
- Printable Purchase Order with company letterhead

### Inventory
- Stock In / Out / Adjustment (all transaction-safe)
- Branch-to-branch stock transfers with full state machine (Requested→Approved→Dispatched→Received)
- Low stock alerts across the system
- Searchable product picker used in every form (live search, shows price/unit)

### Manufacturing
- Bill of Materials (BOM) builder
- Production Orders: Start (consumes raw materials) → Complete (produces finished goods + tracks wastage)

### Accounting
- Chart of Accounts, Journal Entries with live balance preview
- Trial Balance, Profit & Loss, Balance Sheet, Cash Book
- **Expenses** tracking by category (Rent, Utilities, Salary, Transport...) with monthly summary

### Admin & Security
- 4 working accounts out of the box: Developer (SUPER_ADMIN), Owner, Lahore Branch Manager, Gujranwala Branch Manager
- **Branch data isolation enforced server-side** — branch managers cannot see other branches' data even by manipulating URLs
- SUPER_ADMIN can reset any user's password without knowing the old one
- Self-service password change for every user
- **Company Settings** per branch — name, address, NTN/STRN, tax rate, bank details, invoice numbering, terms & conditions

### Reports & Analytics
- Daily/Monthly/Branch Sales, Stock, Purchases, Production, Employee reports — all exportable as CSV
- AI Analytics — ask questions in plain English (powered by Claude), top products, slow-moving inventory
- Owner Dashboard — consolidated KPIs across all branches with live charts
- Real-time WebSocket notifications

---

## Login Credentials (after seeding)

| Role | Email | Password | Sees |
|---|---|---|---|
| Developer / Super Admin | haseebsaleem312@gmail.com | HaseebDev@2024 | Everything |
| Owner | owner@factoryerp.pk | Owner@2024 | All branches |
| Lahore Branch Manager | lahore@factoryerp.pk | Lahore@2024 | Lahore only |
| Gujranwala Branch Manager | gujranwala@factoryerp.pk | Gujranwala@2024 | Gujranwala only |

See `ACCOUNTS.md` for full details on access control.

---

## Quick Start

```bash
# 1. Database
docker compose up -d postgres

# 2. Backend
cd backend
cp .env.example .env          # generate secrets: openssl rand -hex 32
npm install
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts    # creates all accounts, branches, company settings (17% GST)
npm run start:dev             # → http://localhost:4000/api/v1

# 3. Frontend (new terminal)
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                   # → http://localhost:3000
```

---

## Full Docker Deployment

```bash
docker compose up -d --build
docker compose exec backend sh -c "npx prisma migrate deploy && npx ts-node prisma/seed.ts"
```

App at `http://localhost` (Nginx → frontend `/`, backend `/api`).
See `DEPLOYMENT.md` for full VPS guide (SSL, backups, zero-downtime updates).

---

## Project Structure

```
factory-erp-pro/
├── backend/src/
│   ├── auth/ users/ branches/ roles/                  ← identity & access
│   ├── warehouses/ categories/ products/ inventory/   ← stock
│   ├── customers/ suppliers/                          ← parties
│   ├── sales/ purchases/ returns/                      ← transactions
│   ├── manufacturing/ accounting/ expenses/             ← operations & finance
│   ├── employees/ vehicles/                             ← HR & fleet
│   ├── notifications/ realtime/ dashboard/              ← live features
│   ├── reports/ ai-analytics/                           ← insights
│   └── company-settings/                                ← invoice config
├── frontend/
│   ├── app/dashboard/      ← 20+ pages, one per module
│   ├── components/forms/   ← 15+ modal forms wired to live API
│   ├── components/ui/      ← Modal, ProductSearch, Pagination, InvoicePrint, etc.
│   └── lib/                ← API client (auto token refresh), auth helpers
├── docker-compose.yml
├── ACCOUNTS.md              ← credentials & access control explained
└── DEPLOYMENT.md            ← production deployment guide
```

---

## What makes this "real" software, not a demo

- Stock movements are **transactional** — a sale that fails partway never leaves stock and accounting out of sync
- Invoice numbers are **sequential per branch**, not random — required for real bookkeeping/tax compliance
- Branch isolation is **enforced in the backend**, not just hidden in the UI — a branch manager literally cannot fetch another branch's data
- Every print document (Invoice, PO, Challan, Statement, Aging Report) uses **real company letterhead** pulled from Company Settings, not placeholder text
- Credit limits are **checked at the database level** before a credit sale is allowed to complete
- Returns properly **reverse stock and invoice amounts** — they're not just a log entry
