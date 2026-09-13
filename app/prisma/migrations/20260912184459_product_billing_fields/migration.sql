-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('PCS', 'SET', 'BOOK', 'YEAR', 'SESSION');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "discountAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "gstRate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hsnCode" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "minPrice" INTEGER,
ADD COLUMN     "purchasePrice" INTEGER,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "unit" "ProductUnit" NOT NULL DEFAULT 'PCS';

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
