-- DropForeignKey
ALTER TABLE "SampleIssue" DROP CONSTRAINT "SampleIssue_organizationId_fkey";

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "shipToAddress" TEXT,
ADD COLUMN     "shipToName" TEXT;

-- AlterTable
ALTER TABLE "QuotationItem" ADD COLUMN     "discountAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SampleIssue" ADD COLUMN     "givenOn" TIMESTAMP(3),
ALTER COLUMN "organizationId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'IN_HAND';

-- CreateTable
CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hsnCode" TEXT DEFAULT '4901',
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "mrp" INTEGER,
    "rate" INTEGER NOT NULL,
    "gstRate" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceListItem_group_sortOrder_idx" ON "PriceListItem"("group", "sortOrder");

-- CreateIndex
CREATE INDEX "SampleIssue_issuedById_status_idx" ON "SampleIssue"("issuedById", "status");

-- AddForeignKey
ALTER TABLE "SampleIssue" ADD CONSTRAINT "SampleIssue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

