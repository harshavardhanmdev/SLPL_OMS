-- AlterTable
ALTER TABLE "ExpenseClaim" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SampleIssue" ADD COLUMN     "contents" TEXT;

-- CreateTable
CREATE TABLE "ExpenseClaimLine" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExpenseClaimLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseClaimLine_claimId_idx" ON "ExpenseClaimLine"("claimId");

-- AddForeignKey
ALTER TABLE "ExpenseClaimLine" ADD CONSTRAINT "ExpenseClaimLine_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ExpenseClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Older claims carry their one photo in the list too
UPDATE "ExpenseClaim" SET "photos" = ARRAY["billImage"] WHERE "billImage" LIKE '/media/%';
