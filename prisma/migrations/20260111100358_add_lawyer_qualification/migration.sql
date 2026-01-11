/*
  Warnings:

  - The values [PARSING_ERROR,LOGIC_ERROR,DATA_INCONSISTENCY,TIMEOUT_ERROR] on the enum `ErrorType` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- AlterEnum
BEGIN;
CREATE TYPE "ErrorType_new" AS ENUM ('AI_SERVICE_ERROR', 'AI_TIMEOUT', 'AI_RATE_LIMIT', 'AI_QUOTA_EXCEEDED', 'DATABASE_ERROR', 'DATABASE_CONNECTION_ERROR', 'DATABASE_QUERY_ERROR', 'DATABASE_CONSTRAINT_ERROR', 'VALIDATION_ERROR', 'VALIDATION_REQUIRED_FIELD', 'VALIDATION_FORMAT_ERROR', 'VALIDATION_BUSINESS_RULE', 'NETWORK_ERROR', 'NETWORK_TIMEOUT', 'NETWORK_CONNECTION_ERROR', 'FILE_ERROR', 'FILE_NOT_FOUND', 'FILE_READ_ERROR', 'FILE_WRITE_ERROR', 'AGENT_ERROR', 'AGENT_TIMEOUT', 'AGENT_NOT_FOUND', 'MEMORY_ERROR', 'MEMORY_NOT_FOUND', 'MEMORY_EXPIRED', 'UNKNOWN_ERROR');
ALTER TABLE "error_logs" ALTER COLUMN "errorType" TYPE "ErrorType_new" USING ("errorType"::text::"ErrorType_new");
ALTER TYPE "ErrorType" RENAME TO "ErrorType_old";
ALTER TYPE "ErrorType_new" RENAME TO "ErrorType";
DROP TYPE "ErrorType_old";
COMMIT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password" TEXT;

-- CreateTable
CREATE TABLE "lawyer_qualifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "idCardNumber" TEXT NOT NULL,
    "lawFirm" TEXT NOT NULL,
    "licensePhoto" TEXT,
    "status" "QualificationStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "verificationData" JSONB,
    "metadata" JSONB,

    CONSTRAINT "lawyer_qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lawyer_qualifications_userId_idx" ON "lawyer_qualifications"("userId");

-- CreateIndex
CREATE INDEX "lawyer_qualifications_status_idx" ON "lawyer_qualifications"("status");

-- CreateIndex
CREATE INDEX "lawyer_qualifications_submittedAt_idx" ON "lawyer_qualifications"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "lawyer_qualifications_licenseNumber_key" ON "lawyer_qualifications"("licenseNumber");

-- AddForeignKey
ALTER TABLE "lawyer_qualifications" ADD CONSTRAINT "lawyer_qualifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_qualifications" ADD CONSTRAINT "lawyer_qualifications_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
