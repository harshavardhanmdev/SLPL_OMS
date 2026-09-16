-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FUEL', 'TRAVEL', 'STATIONERY', 'PRINTING', 'COURIER', 'OFFICE', 'UTILITIES', 'RENT', 'REPAIRS', 'PROFESSIONAL_FEES', 'SALARIES', 'MARKETING', 'MEALS', 'BANK_CHARGES', 'MISC');

-- CreateEnum
CREATE TYPE "PaidFrom" AS ENUM ('CURRENT_ACCOUNT', 'CASH', 'CARD', 'UPI', 'CHEQUE');

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "paidFrom" "PaidFrom" NOT NULL DEFAULT 'CURRENT_ACCOUNT',
    "payee" TEXT,
    "note" TEXT,
    "reference" TEXT,
    "billImage" TEXT,
    "gstAmount" INTEGER,
    "vendorGstin" TEXT,
    "enteredBy" TEXT NOT NULL DEFAULT 'Director',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Expense_voucherNo_key" ON "Expense"("voucherNo");

-- CreateIndex
CREATE INDEX "Expense_spentAt_idx" ON "Expense"("spentAt");

-- CreateIndex
CREATE INDEX "Expense_category_spentAt_idx" ON "Expense"("category", "spentAt");
