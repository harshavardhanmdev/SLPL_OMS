-- CreateTable
CREATE TABLE "StaffPasskey" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "deviceName" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPasskey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffPasskey_credentialId_key" ON "StaffPasskey"("credentialId");

-- CreateIndex
CREATE INDEX "StaffPasskey_adminUserId_idx" ON "StaffPasskey"("adminUserId");

-- AddForeignKey
ALTER TABLE "StaffPasskey" ADD CONSTRAINT "StaffPasskey_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

