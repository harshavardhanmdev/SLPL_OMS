-- AlterEnum
ALTER TYPE "ExpenseCategory" ADD VALUE 'PAPER';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "vendorId" TEXT;

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'MISC',
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "payTo" TEXT,
    "notes" TEXT,
    "recurringDay" INTEGER,
    "recurringAmount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendor_isActive_name_idx" ON "Vendor"("isActive", "name");

-- CreateIndex
CREATE INDEX "Expense_vendorId_spentAt_idx" ON "Expense"("vendorId", "spentAt");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

