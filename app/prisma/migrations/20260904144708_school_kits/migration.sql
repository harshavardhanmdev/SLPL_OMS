-- CreateEnum
CREATE TYPE "Fulfilment" AS ENUM ('SHIP', 'COLLECT_AT_SCHOOL');

-- CreateEnum
CREATE TYPE "KitPurchaseStatus" AS ENUM ('PENDING', 'PAID', 'READY', 'COLLECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fulfilment" "Fulfilment" NOT NULL DEFAULT 'SHIP';

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'Telangana',
    "udiseCode" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "verifyPin" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolKit" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "classLabel" TEXT NOT NULL,
    "collectionNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "classLabel" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'A',
    "rollNumber" TEXT NOT NULL,
    "guardianPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitPurchase" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "schoolKitId" TEXT NOT NULL,
    "studentId" TEXT,
    "studentName" TEXT NOT NULL,
    "classLabel" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "rollNumber" TEXT,
    "schoolName" TEXT NOT NULL,
    "kitTitle" TEXT NOT NULL,
    "amountPaid" INTEGER NOT NULL,
    "status" "KitPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "collectedAt" TIMESTAMP(3),
    "collectedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitCollectionEvent" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "bySchoolStaff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitCollectionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- CreateIndex
CREATE UNIQUE INDEX "School_udiseCode_key" ON "School"("udiseCode");

-- CreateIndex
CREATE INDEX "School_isActive_idx" ON "School"("isActive");

-- CreateIndex
CREATE INDEX "SchoolKit_schoolId_isActive_idx" ON "SchoolKit"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolKit_schoolId_academicYear_classLabel_key" ON "SchoolKit"("schoolId", "academicYear", "classLabel");

-- CreateIndex
CREATE INDEX "Student_schoolId_classLabel_idx" ON "Student"("schoolId", "classLabel");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_classLabel_section_rollNumber_key" ON "Student"("schoolId", "classLabel", "section", "rollNumber");

-- CreateIndex
CREATE UNIQUE INDEX "KitPurchase_receiptNumber_key" ON "KitPurchase"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "KitPurchase_accessToken_key" ON "KitPurchase"("accessToken");

-- CreateIndex
CREATE INDEX "KitPurchase_schoolKitId_status_idx" ON "KitPurchase"("schoolKitId", "status");

-- CreateIndex
CREATE INDEX "KitPurchase_studentId_idx" ON "KitPurchase"("studentId");

-- CreateIndex
CREATE INDEX "KitPurchase_orderId_idx" ON "KitPurchase"("orderId");

-- CreateIndex
CREATE INDEX "KitCollectionEvent_purchaseId_idx" ON "KitCollectionEvent"("purchaseId");

-- AddForeignKey
ALTER TABLE "SchoolKit" ADD CONSTRAINT "SchoolKit_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolKit" ADD CONSTRAINT "SchoolKit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitPurchase" ADD CONSTRAINT "KitPurchase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitPurchase" ADD CONSTRAINT "KitPurchase_schoolKitId_fkey" FOREIGN KEY ("schoolKitId") REFERENCES "SchoolKit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitPurchase" ADD CONSTRAINT "KitPurchase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitCollectionEvent" ADD CONSTRAINT "KitCollectionEvent_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "KitPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
