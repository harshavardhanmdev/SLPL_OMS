-- CreateTable
CREATE TABLE "OrganizationRemark" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "byId" TEXT,
    "byEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationRemark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationRemark_organizationId_createdAt_idx" ON "OrganizationRemark"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrganizationRemark" ADD CONSTRAINT "OrganizationRemark_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationRemark" ADD CONSTRAINT "OrganizationRemark_byId_fkey" FOREIGN KEY ("byId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
