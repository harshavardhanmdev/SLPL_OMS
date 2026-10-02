-- CreateEnum
CREATE TYPE "StockMoveKind" AS ENUM ('INWARD', 'OUTWARD', 'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "movedAt" TIMESTAMP(3) NOT NULL,
    "kind" "StockMoveKind" NOT NULL,
    "label" TEXT NOT NULL,
    "series" TEXT,
    "unit" "StockUnit" NOT NULL DEFAULT 'SET',
    "quantity" INTEGER NOT NULL,
    "quantityTelugu" INTEGER,
    "quantityHindi" INTEGER,
    "party" TEXT,
    "document" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "recordedEmail" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_ref_key" ON "StockMovement"("ref");

-- CreateIndex
CREATE INDEX "StockMovement_movedAt_idx" ON "StockMovement"("movedAt");

-- CreateIndex
CREATE INDEX "StockMovement_label_movedAt_idx" ON "StockMovement"("label", "movedAt");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

