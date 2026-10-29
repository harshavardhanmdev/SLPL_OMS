-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customerCode" TEXT;

-- CreateTable
CREATE TABLE "ParcelLabel" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "orderId" TEXT,
    "subscriptionId" TEXT,
    "issueLabel" TEXT,
    "createdEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParcelLabel_number_key" ON "ParcelLabel"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelLabel_orderId_key" ON "ParcelLabel"("orderId");

-- CreateIndex
CREATE INDEX "ParcelLabel_createdAt_idx" ON "ParcelLabel"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelLabel_subscriptionId_issueLabel_key" ON "ParcelLabel"("subscriptionId", "issueLabel");

-- CreateIndex
CREATE UNIQUE INDEX "User_customerCode_key" ON "User"("customerCode");

-- AddForeignKey
ALTER TABLE "ParcelLabel" ADD CONSTRAINT "ParcelLabel_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelLabel" ADD CONSTRAINT "ParcelLabel_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

