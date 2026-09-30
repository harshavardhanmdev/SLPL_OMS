-- AlterEnum
ALTER TYPE "ProductKind" ADD VALUE 'DIGITAL';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "editionKey" TEXT,
ADD COLUMN     "pageCount" INTEGER;

-- CreateTable
CREATE TABLE "DigitalEntitlement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DigitalEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalViewLog" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalViewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DigitalEntitlement_code_key" ON "DigitalEntitlement"("code");

-- CreateIndex
CREATE INDEX "DigitalEntitlement_productId_revokedAt_idx" ON "DigitalEntitlement"("productId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalEntitlement_userId_productId_key" ON "DigitalEntitlement"("userId", "productId");

-- CreateIndex
CREATE INDEX "DigitalViewLog_entitlementId_at_idx" ON "DigitalViewLog"("entitlementId", "at");

-- AddForeignKey
ALTER TABLE "DigitalEntitlement" ADD CONSTRAINT "DigitalEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalEntitlement" ADD CONSTRAINT "DigitalEntitlement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalEntitlement" ADD CONSTRAINT "DigitalEntitlement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalViewLog" ADD CONSTRAINT "DigitalViewLog_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "DigitalEntitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

