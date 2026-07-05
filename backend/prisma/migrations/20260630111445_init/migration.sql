-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT', 'SALE', 'PURCHASE');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('QUOTATION', 'CONFIRMED', 'DELIVERED', 'INVOICED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK', 'CREDIT');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('REQUISITION', 'ORDERED', 'RECEIVED', 'INVOICED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'BANK', 'RECEIVABLE', 'PAYABLE', 'EXPENSE', 'INCOME', 'EQUITY');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_STOCK', 'NEW_ORDER', 'PAYMENT_RECEIVED', 'PRODUCTION_COMPLETED', 'SYSTEM');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "roleId" TEXT NOT NULL,
    "branchId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "isMainBranch" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "isGodown" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "barcode" TEXT,
    "qrCode" TEXT,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "brand" TEXT,
    "size" TEXT,
    "unit" TEXT NOT NULL,
    "purchasePrice" DECIMAL(14,2) NOT NULL,
    "salePrice" DECIMAL(14,2) NOT NULL,
    "openingStock" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "minimumStock" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isRawMaterial" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "serialNumber" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "transferNo" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'REQUESTED',
    "items" JSONB NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "taxNumber" TEXT,
    "creditLimit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "taxNumber" TEXT,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'QUOTATION',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'REQUISITION',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "unitCost" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boms" (
    "id" TEXT NOT NULL,
    "finishedProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_components" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "bom_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "quantityPlanned" DECIMAL(14,2) NOT NULL,
    "quantityProduced" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "wastage" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'PLANNED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "branchId" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "branchId" TEXT NOT NULL,
    "salary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "joinDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "userId" TEXT,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "model" TEXT,
    "branchId" TEXT NOT NULL,
    "driverName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "route" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'FactoryERP Pro',
    "tagline" TEXT,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "website" TEXT,
    "ntn" TEXT,
    "strn" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bankIBAN" TEXT,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "invoiceCounter" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "termsAndConditions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_returns" (
    "id" TEXT NOT NULL,
    "returnNo" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" TEXT NOT NULL,
    "returnNo" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "expenseNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidFrom" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "description" TEXT,
    "receiptUrl" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_challans" (
    "id" TEXT NOT NULL,
    "challanNo" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverName" TEXT,
    "deliveredTo" TEXT,
    "items" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "delivery_challans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_logs" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "odometer" INTEGER,
    "description" TEXT,
    "logDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_slips" (
    "id" TEXT NOT NULL,
    "slipNo" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "basicSalary" DECIMAL(14,2) NOT NULL,
    "bonus" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(14,2) NOT NULL,
    "paidOn" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_slips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_branchId_idx" ON "users"("branchId");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_branchId_idx" ON "warehouses"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_productCode_key" ON "products"("productCode");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "products_qrCode_key" ON "products"("qrCode");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "stock_branchId_idx" ON "stock"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_productId_warehouseId_batchNumber_key" ON "stock"("productId", "warehouseId", "batchNumber");

-- CreateIndex
CREATE INDEX "stock_movements_productId_idx" ON "stock_movements"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_transferNo_key" ON "stock_transfers"("transferNo");

-- CreateIndex
CREATE INDEX "customers_branchId_idx" ON "customers"("branchId");

-- CreateIndex
CREATE INDEX "suppliers_branchId_idx" ON "suppliers"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_orderNo_key" ON "sales_orders"("orderNo");

-- CreateIndex
CREATE INDEX "sales_orders_branchId_idx" ON "sales_orders"("branchId");

-- CreateIndex
CREATE INDEX "sales_orders_customerId_idx" ON "sales_orders"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_invoiceNo_key" ON "sales_invoices"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_salesOrderId_key" ON "sales_invoices"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_orderNo_key" ON "purchase_orders"("orderNo");

-- CreateIndex
CREATE INDEX "purchase_orders_branchId_idx" ON "purchase_orders"("branchId");

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_invoiceNo_key" ON "purchase_invoices"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_purchaseOrderId_key" ON "purchase_invoices"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_orderNo_key" ON "production_orders"("orderNo");

-- CreateIndex
CREATE INDEX "production_orders_branchId_idx" ON "production_orders"("branchId");

-- CreateIndex
CREATE INDEX "accounts_branchId_idx" ON "accounts"("branchId");

-- CreateIndex
CREATE INDEX "transactions_accountId_idx" ON "transactions"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_branchId_idx" ON "employees"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_employeeId_date_key" ON "attendance"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plateNumber_key" ON "vehicles"("plateNumber");

-- CreateIndex
CREATE INDEX "vehicles_branchId_idx" ON "vehicles"("branchId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_branchId_key" ON "company_settings"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_returns_returnNo_key" ON "sale_returns"("returnNo");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_returns_returnNo_key" ON "purchase_returns"("returnNo");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_expenseNo_key" ON "expenses"("expenseNo");

-- CreateIndex
CREATE INDEX "expenses_branchId_idx" ON "expenses"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_challans_challanNo_key" ON "delivery_challans"("challanNo");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_challans_salesOrderId_key" ON "delivery_challans"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "salary_slips_slipNo_key" ON "salary_slips"("slipNo");

-- CreateIndex
CREATE UNIQUE INDEX "salary_slips_employeeId_month_year_key" ON "salary_slips"("employeeId", "month", "year");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_finishedProductId_fkey" FOREIGN KEY ("finishedProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_components" ADD CONSTRAINT "bom_components_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_components" ADD CONSTRAINT "bom_components_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "purchase_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_logs" ADD CONSTRAINT "vehicle_logs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
