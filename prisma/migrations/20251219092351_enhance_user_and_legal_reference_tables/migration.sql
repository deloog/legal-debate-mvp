-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LegalReferenceStatus" AS ENUM ('VALID', 'EXPIRED', 'AMENDED', 'REPEALED', 'DRAFT');

-- AlterTable
ALTER TABLE "legal_references" ADD COLUMN     "amendmentHistory" JSONB,
ADD COLUMN     "analysisResult" JSONB,
ADD COLUMN     "analyzedAt" TIMESTAMP(3),
ADD COLUMN     "analyzedBy" TEXT,
ADD COLUMN     "applicabilityReason" TEXT,
ADD COLUMN     "applicabilityScore" DOUBLE PRECISION,
ADD COLUMN     "cacheExpiry" TIMESTAMP(3),
ADD COLUMN     "cacheSource" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "effectiveDate" TIMESTAMP(3),
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "hitCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAccessed" TIMESTAMP(3),
ADD COLUMN     "status" "LegalReferenceStatus" NOT NULL DEFAULT 'VALID',
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "version" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" TEXT,
ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "loginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordResetExpires" TIMESTAMP(3),
ADD COLUMN     "passwordResetToken" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "preferences" JSONB,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "legal_references_applicabilityScore_idx" ON "legal_references"("applicabilityScore");

-- CreateIndex
CREATE INDEX "legal_references_status_idx" ON "legal_references"("status");

-- CreateIndex
CREATE INDEX "legal_references_cacheExpiry_idx" ON "legal_references"("cacheExpiry");

-- CreateIndex
CREATE INDEX "legal_references_hitCount_idx" ON "legal_references"("hitCount");

-- CreateIndex
CREATE INDEX "legal_references_category_idx" ON "legal_references"("category");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_lastLoginAt_idx" ON "users"("lastLoginAt");
