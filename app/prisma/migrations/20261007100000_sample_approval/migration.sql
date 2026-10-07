-- CreateEnum
CREATE TYPE "SampleApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "SampleIssue" ADD COLUMN     "approvalStatus" "SampleApproval" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "rejectedReason" TEXT;

-- CreateIndex
CREATE INDEX "SampleIssue_approvalStatus_idx" ON "SampleIssue"("approvalStatus");

