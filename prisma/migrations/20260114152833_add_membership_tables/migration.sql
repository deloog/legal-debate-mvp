-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('HTML', 'PDF', 'JSON');

-- CreateEnum
CREATE TYPE "ConfigType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'ARRAY', 'OBJECT');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('LOG', 'EMAIL', 'WEBHOOK', 'SMS');

-- CreateEnum
CREATE TYPE "MembershipTierType" AS ENUM ('FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME');

-- CreateEnum
CREATE TYPE "UsageType" AS ENUM ('CASE_CREATED', 'DEBATE_GENERATED', 'DOCUMENT_ANALYZED', 'LAW_ARTICLE_SEARCHED', 'AI_TOKEN_USED', 'STORAGE_USED');

-- CreateEnum
CREATE TYPE "LimitType" AS ENUM ('MAX_CASES', 'MAX_DEBATES', 'MAX_DOCUMENTS', 'MAX_AI_TOKENS_MONTHLY', 'MAX_STORAGE_MB', 'MAX_LAW_ARTICLE_SEARCHES', 'MAX_CONCURRENT_REQUESTS');

-- CreateEnum
CREATE TYPE "MembershipChangeType" AS ENUM ('UPGRADE', 'DOWNGRADE', 'CANCEL', 'RENEW', 'PAUSE', 'RESUME', 'EXPIRE');

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "type" "ConfigType" NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" JSONB,
    "validationRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "filePath" TEXT,
    "fileSize" INTEGER,
    "format" "ReportFormat" NOT NULL DEFAULT 'HTML',
    "generatedBy" TEXT,
    "generatedAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "content" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "alertId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'TRIGGERED',
    "errorLogId" TEXT NOT NULL,
    "errorType" "ErrorType" NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "notificationHistory" JSONB NOT NULL,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("alertId")
);

-- CreateTable
CREATE TABLE "membership_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tier" "MembershipTierType" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "billingCycle" "BillingCycle" NOT NULL,
    "features" TEXT[],
    "permissions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "pausedAt" TIMESTAMP(3),
    "pausedReason" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "usageType" "UsageType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "resourceId" TEXT,
    "resourceType" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tier_limits" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "limitType" "LimitType" NOT NULL,
    "limitValue" INTEGER,
    "period" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tier_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "changeType" "MembershipChangeType" NOT NULL,
    "fromTier" "MembershipTierType",
    "toTier" "MembershipTierType",
    "fromStatus" "MembershipStatus" NOT NULL,
    "toStatus" "MembershipStatus" NOT NULL,
    "reason" TEXT,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "system_configs_category_idx" ON "system_configs"("category");

-- CreateIndex
CREATE INDEX "system_configs_type_idx" ON "system_configs"("type");

-- CreateIndex
CREATE INDEX "system_configs_isPublic_idx" ON "system_configs"("isPublic");

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "reports"("type");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_periodStart_idx" ON "reports"("periodStart");

-- CreateIndex
CREATE INDEX "reports_periodEnd_idx" ON "reports"("periodEnd");

-- CreateIndex
CREATE INDEX "reports_generatedBy_idx" ON "reports"("generatedBy");

-- CreateIndex
CREATE INDEX "reports_createdAt_idx" ON "reports"("createdAt");

-- CreateIndex
CREATE INDEX "alerts_ruleId_idx" ON "alerts"("ruleId");

-- CreateIndex
CREATE INDEX "alerts_severity_idx" ON "alerts"("severity");

-- CreateIndex
CREATE INDEX "alerts_status_idx" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "alerts_errorLogId_idx" ON "alerts"("errorLogId");

-- CreateIndex
CREATE INDEX "alerts_errorType_idx" ON "alerts"("errorType");

-- CreateIndex
CREATE INDEX "alerts_triggeredAt_idx" ON "alerts"("triggeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "membership_tiers_name_key" ON "membership_tiers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "membership_tiers_tier_key" ON "membership_tiers"("tier");

-- CreateIndex
CREATE INDEX "membership_tiers_tier_idx" ON "membership_tiers"("tier");

-- CreateIndex
CREATE INDEX "membership_tiers_isActive_idx" ON "membership_tiers"("isActive");

-- CreateIndex
CREATE INDEX "membership_tiers_sortOrder_idx" ON "membership_tiers"("sortOrder");

-- CreateIndex
CREATE INDEX "user_memberships_userId_idx" ON "user_memberships"("userId");

-- CreateIndex
CREATE INDEX "user_memberships_tierId_idx" ON "user_memberships"("tierId");

-- CreateIndex
CREATE INDEX "user_memberships_status_idx" ON "user_memberships"("status");

-- CreateIndex
CREATE INDEX "user_memberships_startDate_idx" ON "user_memberships"("startDate");

-- CreateIndex
CREATE INDEX "user_memberships_endDate_idx" ON "user_memberships"("endDate");

-- CreateIndex
CREATE INDEX "user_memberships_userId_status_endDate_idx" ON "user_memberships"("userId", "status", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "user_memberships_userId_tierId_startDate_key" ON "user_memberships"("userId", "tierId", "startDate");

-- CreateIndex
CREATE INDEX "usage_records_userId_idx" ON "usage_records"("userId");

-- CreateIndex
CREATE INDEX "usage_records_membershipId_idx" ON "usage_records"("membershipId");

-- CreateIndex
CREATE INDEX "usage_records_usageType_idx" ON "usage_records"("usageType");

-- CreateIndex
CREATE INDEX "usage_records_periodStart_idx" ON "usage_records"("periodStart");

-- CreateIndex
CREATE INDEX "usage_records_periodEnd_idx" ON "usage_records"("periodEnd");

-- CreateIndex
CREATE INDEX "usage_records_userId_usageType_periodStart_periodEnd_idx" ON "usage_records"("userId", "usageType", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "tier_limits_tierId_idx" ON "tier_limits"("tierId");

-- CreateIndex
CREATE INDEX "tier_limits_limitType_idx" ON "tier_limits"("limitType");

-- CreateIndex
CREATE UNIQUE INDEX "tier_limits_tierId_limitType_key" ON "tier_limits"("tierId", "limitType");

-- CreateIndex
CREATE INDEX "membership_history_userId_idx" ON "membership_history"("userId");

-- CreateIndex
CREATE INDEX "membership_history_membershipId_idx" ON "membership_history"("membershipId");

-- CreateIndex
CREATE INDEX "membership_history_changeType_idx" ON "membership_history"("changeType");

-- CreateIndex
CREATE INDEX "membership_history_createdAt_idx" ON "membership_history"("createdAt");

-- CreateIndex
CREATE INDEX "cases_userId_status_createdAt_idx" ON "cases"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "cases_userId_type_createdAt_idx" ON "cases"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "cases_status_createdAt_idx" ON "cases"("status", "createdAt");

-- CreateIndex
CREATE INDEX "cases_deletedAt_idx" ON "cases"("deletedAt");

-- CreateIndex
CREATE INDEX "debates_userId_status_createdAt_idx" ON "debates"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "debates_caseId_status_createdAt_idx" ON "debates"("caseId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "debates_deletedAt_idx" ON "debates"("deletedAt");

-- CreateIndex
CREATE INDEX "documents_caseId_analysisStatus_createdAt_idx" ON "documents"("caseId", "analysisStatus", "createdAt");

-- CreateIndex
CREATE INDEX "documents_userId_analysisStatus_createdAt_idx" ON "documents"("userId", "analysisStatus", "createdAt");

-- CreateIndex
CREATE INDEX "documents_deletedAt_idx" ON "documents"("deletedAt");

-- AddForeignKey
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "membership_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "user_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tier_limits" ADD CONSTRAINT "tier_limits_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "membership_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_history" ADD CONSTRAINT "membership_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_history" ADD CONSTRAINT "membership_history_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "user_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
