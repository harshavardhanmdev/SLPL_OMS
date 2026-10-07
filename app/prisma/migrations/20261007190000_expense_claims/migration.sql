-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "claimedById" TEXT NOT NULL,
    "spentOn" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "note" TEXT NOT NULL,
    "billImage" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseClaim_status_idx" ON "ExpenseClaim"("status");

-- CreateIndex
CREATE INDEX "ExpenseClaim_claimedById_spentOn_idx" ON "ExpenseClaim"("claimedById", "spentOn");

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

