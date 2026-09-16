-- CreateEnum
CREATE TYPE "StockUnit" AS ENUM ('SET', 'COPY');

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "series" TEXT,
    "sku" TEXT,
    "unit" "StockUnit" NOT NULL DEFAULT 'SET',
    "inward" INTEGER NOT NULL,
    "outward" INTEGER NOT NULL,
    "inventory" INTEGER NOT NULL,
    "inwardTelugu" INTEGER,
    "inwardHindi" INTEGER,
    "outwardTelugu" INTEGER,
    "outwardHindi" INTEGER,
    "inventoryTelugu" INTEGER,
    "inventoryHindi" INTEGER,
    "carriedForward" INTEGER,
    "extra" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockCount_asOf_idx" ON "StockCount"("asOf");

-- CreateIndex
CREATE UNIQUE INDEX "StockCount_asOf_label_key" ON "StockCount"("asOf", "label");
