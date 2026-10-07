-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "copies" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "invoiceId" TEXT;

-- CreateIndex
CREATE INDEX "Subscription_invoiceId_idx" ON "Subscription"("invoiceId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

