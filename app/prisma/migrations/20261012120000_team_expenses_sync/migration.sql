-- AlterEnum
ALTER TYPE "ClaimStatus" ADD VALUE 'PAID';

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "expensesAppName" TEXT;

-- AlterTable
ALTER TABLE "ExpenseClaim" ADD COLUMN     "appCategory" TEXT,
ADD COLUMN     "appData" JSONB,
ADD COLUMN     "appUpdatedAt" BIGINT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMode" TEXT,
ADD COLUMN     "syncPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tripName" TEXT;

-- CreateTable
CREATE TABLE "TeamExpenseDeletion" (
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamExpenseDeletion_pkey" PRIMARY KEY ("externalId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_expensesAppName_key" ON "AdminUser"("expensesAppName");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseClaim_externalId_key" ON "ExpenseClaim"("externalId");
