-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "showSignatures" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "sales_invoices" ADD COLUMN     "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "_sync_logs" (
    "id" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" TEXT,
    "synced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "_sync_logs_pkey" PRIMARY KEY ("id")
);
