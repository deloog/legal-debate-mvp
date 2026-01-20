-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('INDIVIDUAL', 'ENTERPRISE', 'POTENTIAL');

-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('REFERRAL', 'ONLINE', 'EVENT', 'ADVERTISING', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOST', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('PHONE', 'EMAIL', 'MEETING', 'WECHAT', 'OTHER');

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientType" "ClientType" NOT NULL DEFAULT 'INDIVIDUAL',
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "age" INTEGER,
    "profession" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "idCardNumber" TEXT,
    "company" TEXT,
    "creditCode" TEXT,
    "legalRep" TEXT,
    "source" "ClientSource",
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_records" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CommunicationType" NOT NULL DEFAULT 'PHONE',
    "summary" TEXT NOT NULL,
    "content" TEXT,
    "nextFollowUpDate" TIMESTAMP(3),
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clients_userId_idx" ON "clients"("userId");

-- CreateIndex
CREATE INDEX "clients_clientType_idx" ON "clients"("clientType");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE INDEX "clients_source_idx" ON "clients"("source");

-- CreateIndex
CREATE INDEX "communication_records_clientId_idx" ON "communication_records"("clientId");

-- CreateIndex
CREATE INDEX "communication_records_userId_idx" ON "communication_records"("userId");

-- CreateIndex
CREATE INDEX "communication_records_type_idx" ON "communication_records"("type");

-- CreateIndex
CREATE INDEX "communication_records_nextFollowUpDate_idx" ON "communication_records"("nextFollowUpDate");

-- CreateIndex
CREATE INDEX "communication_records_createdAt_idx" ON "communication_records"("createdAt");

-- CreateIndex
CREATE INDEX "cases_clientId_idx" ON "cases"("clientId");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_records" ADD CONSTRAINT "communication_records_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_records" ADD CONSTRAINT "communication_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
