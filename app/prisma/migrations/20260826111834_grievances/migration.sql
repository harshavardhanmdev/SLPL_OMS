-- CreateEnum
CREATE TYPE "GrievanceStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'AWAITING_CUSTOMER', 'RESOLVED', 'CLOSED', 'ESCALATED');
CREATE TYPE "GrievanceCategory" AS ENUM ('PAYMENT_DEBITED_NO_ORDER', 'REFUND_NOT_RECEIVED', 'DOUBLE_CHARGED', 'ORDER_NOT_DELIVERED', 'DAMAGED_OR_WRONG_ITEM', 'CANCELLATION_ISSUE', 'DATA_PRIVACY', 'OTHER');
CREATE TYPE "GrievancePriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "Grievance" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "userId" TEXT,
    "orderId" TEXT,
    "orderRef" TEXT,
    "category" "GrievanceCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "paymentRef" TEXT,
    "amountClaimed" INTEGER,
    "status" "GrievanceStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "GrievancePriority" NOT NULL DEFAULT 'NORMAL',
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "ackDueAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grievance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GrievanceEvent" (
    "id" TEXT NOT NULL,
    "grievanceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "byAdmin" BOOLEAN NOT NULL DEFAULT false,
    "visibleToCustomer" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrievanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Grievance_ticketNumber_key" ON "Grievance"("ticketNumber");
CREATE UNIQUE INDEX "Grievance_accessToken_key" ON "Grievance"("accessToken");
CREATE INDEX "Grievance_status_createdAt_idx" ON "Grievance"("status", "createdAt");
CREATE INDEX "Grievance_userId_idx" ON "Grievance"("userId");
CREATE INDEX "Grievance_contactEmail_idx" ON "Grievance"("contactEmail");
CREATE INDEX "GrievanceEvent_grievanceId_idx" ON "GrievanceEvent"("grievanceId");

-- AddForeignKey
ALTER TABLE "Grievance" ADD CONSTRAINT "Grievance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Grievance" ADD CONSTRAINT "Grievance_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GrievanceEvent" ADD CONSTRAINT "GrievanceEvent_grievanceId_fkey" FOREIGN KEY ("grievanceId") REFERENCES "Grievance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
