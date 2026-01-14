-- CreateEnum
CREATE TYPE "ActionLogType" AS ENUM ('LOGIN', 'LOGOUT', 'REGISTER', 'UPDATE_PROFILE', 'CHANGE_PASSWORD', 'CREATE_CASE', 'UPDATE_CASE', 'DELETE_CASE', 'VIEW_CASE', 'UPLOAD_DOCUMENT', 'DELETE_DOCUMENT', 'ANALYZE_DOCUMENT', 'CREATE_DEBATE', 'UPDATE_DEBATE', 'DELETE_DEBATE', 'GENERATE_ARGUMENT', 'APPROVE_QUALIFICATION', 'REJECT_QUALIFICATION', 'UPDATE_USER_ROLE', 'BAN_USER', 'UNBAN_USER', 'EXPORT_DATA', 'IMPORT_DATA', 'SYSTEM_CONFIG_UPDATE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ActionLogCategory" AS ENUM ('AUTH', 'USER', 'CASE', 'DOCUMENT', 'DEBATE', 'ADMIN', 'SYSTEM', 'OTHER');

-- CreateEnum
CREATE TYPE "EnterpriseStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "EnterpriseReviewAction" AS ENUM ('APPROVE', 'REJECT', 'SUSPEND', 'REACTIVATE');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ENTERPRISE';

-- CreateTable
CREATE TABLE "action_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" "ActionLogType" NOT NULL,
    "actionCategory" "ActionLogCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestMethod" TEXT,
    "requestPath" TEXT,
    "requestParams" JSONB,
    "responseStatus" INTEGER,
    "executionTime" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprise_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enterpriseName" TEXT NOT NULL,
    "creditCode" TEXT NOT NULL,
    "legalPerson" TEXT NOT NULL,
    "industryType" TEXT NOT NULL,
    "businessLicense" TEXT,
    "status" "EnterpriseStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "verificationData" JSONB,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "enterprise_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprise_reviews" (
    "id" TEXT NOT NULL,
    "enterpriseId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewAction" "EnterpriseReviewAction" NOT NULL,
    "reviewNotes" TEXT,
    "reviewData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enterprise_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_logs_userId_idx" ON "action_logs"("userId");

-- CreateIndex
CREATE INDEX "action_logs_actionType_idx" ON "action_logs"("actionType");

-- CreateIndex
CREATE INDEX "action_logs_actionCategory_idx" ON "action_logs"("actionCategory");

-- CreateIndex
CREATE INDEX "action_logs_resourceType_idx" ON "action_logs"("resourceType");

-- CreateIndex
CREATE INDEX "action_logs_createdAt_idx" ON "action_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "enterprise_accounts_userId_key" ON "enterprise_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "enterprise_accounts_creditCode_key" ON "enterprise_accounts"("creditCode");

-- CreateIndex
CREATE INDEX "enterprise_accounts_userId_idx" ON "enterprise_accounts"("userId");

-- CreateIndex
CREATE INDEX "enterprise_accounts_status_idx" ON "enterprise_accounts"("status");

-- CreateIndex
CREATE INDEX "enterprise_accounts_submittedAt_idx" ON "enterprise_accounts"("submittedAt");

-- CreateIndex
CREATE INDEX "enterprise_reviews_enterpriseId_idx" ON "enterprise_reviews"("enterpriseId");

-- CreateIndex
CREATE INDEX "enterprise_reviews_reviewerId_idx" ON "enterprise_reviews"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "permissions_resource_action_idx" ON "permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- AddForeignKey
ALTER TABLE "enterprise_accounts" ADD CONSTRAINT "enterprise_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enterprise_reviews" ADD CONSTRAINT "enterprise_reviews_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "enterprise_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enterprise_reviews" ADD CONSTRAINT "enterprise_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
