-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('WORKING', 'HOT', 'COLD');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('FACTUAL', 'LOGICAL', 'COMPLETENESS', 'COMPREHENSIVE');

-- CreateEnum
CREATE TYPE "ErrorType" AS ENUM ('AI_SERVICE_ERROR', 'PARSING_ERROR', 'VALIDATION_ERROR', 'LOGIC_ERROR', 'DATA_INCONSISTENCY', 'TIMEOUT_ERROR', 'NETWORK_ERROR', 'UNKNOWN_ERROR');

-- CreateEnum
CREATE TYPE "ErrorSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('ANALYZE', 'RETRIEVE', 'GENERATE', 'VERIFY', 'TRANSFORM', 'COMMUNICATE');

-- CreateEnum
CREATE TYPE "ActionLayer" AS ENUM ('CORE', 'UTILITY', 'SCRIPT');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED');

-- CreateTable
CREATE TABLE "agent_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT,
    "debateId" TEXT,
    "memoryType" "MemoryType" NOT NULL,
    "agentName" TEXT NOT NULL,
    "memoryKey" TEXT NOT NULL,
    "memoryValue" JSONB NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "compressed" BOOLEAN NOT NULL DEFAULT false,
    "compressionRatio" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_results" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "verificationType" "VerificationType" NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "factualAccuracy" DOUBLE PRECISION,
    "logicalConsistency" DOUBLE PRECISION,
    "taskCompleteness" DOUBLE PRECISION,
    "passed" BOOLEAN NOT NULL,
    "issues" JSONB,
    "suggestions" JSONB,
    "verifiedBy" TEXT NOT NULL,
    "verificationTime" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "caseId" TEXT,
    "errorType" "ErrorType" NOT NULL,
    "errorCode" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "stackTrace" TEXT,
    "context" JSONB NOT NULL,
    "attemptedAction" JSONB,
    "recoveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "recoveryMethod" TEXT,
    "recoveryTime" INTEGER,
    "learned" BOOLEAN NOT NULL DEFAULT false,
    "learningNotes" TEXT,
    "severity" "ErrorSeverity" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "caseId" TEXT,
    "debateId" TEXT,
    "agentName" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "actionName" TEXT NOT NULL,
    "actionLayer" "ActionLayer" NOT NULL,
    "parameters" JSONB NOT NULL,
    "result" JSONB,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "executionTime" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "parentActionId" TEXT,
    "childActions" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_memories_userId_idx" ON "agent_memories"("userId");

-- CreateIndex
CREATE INDEX "agent_memories_caseId_idx" ON "agent_memories"("caseId");

-- CreateIndex
CREATE INDEX "agent_memories_debateId_idx" ON "agent_memories"("debateId");

-- CreateIndex
CREATE INDEX "agent_memories_memoryType_idx" ON "agent_memories"("memoryType");

-- CreateIndex
CREATE INDEX "agent_memories_agentName_idx" ON "agent_memories"("agentName");

-- CreateIndex
CREATE INDEX "agent_memories_memoryKey_idx" ON "agent_memories"("memoryKey");

-- CreateIndex
CREATE INDEX "agent_memories_importance_idx" ON "agent_memories"("importance");

-- CreateIndex
CREATE INDEX "agent_memories_accessCount_idx" ON "agent_memories"("accessCount");

-- CreateIndex
CREATE INDEX "agent_memories_lastAccessedAt_idx" ON "agent_memories"("lastAccessedAt");

-- CreateIndex
CREATE INDEX "agent_memories_expiresAt_idx" ON "agent_memories"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_memories_agentName_memoryKey_key" ON "agent_memories"("agentName", "memoryKey");

-- CreateIndex
CREATE INDEX "verification_results_entityType_idx" ON "verification_results"("entityType");

-- CreateIndex
CREATE INDEX "verification_results_entityId_idx" ON "verification_results"("entityId");

-- CreateIndex
CREATE INDEX "verification_results_verificationType_idx" ON "verification_results"("verificationType");

-- CreateIndex
CREATE INDEX "verification_results_overallScore_idx" ON "verification_results"("overallScore");

-- CreateIndex
CREATE INDEX "verification_results_passed_idx" ON "verification_results"("passed");

-- CreateIndex
CREATE INDEX "verification_results_createdAt_idx" ON "verification_results"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "verification_results_entityType_entityId_key" ON "verification_results"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "error_logs_userId_idx" ON "error_logs"("userId");

-- CreateIndex
CREATE INDEX "error_logs_caseId_idx" ON "error_logs"("caseId");

-- CreateIndex
CREATE INDEX "error_logs_errorType_idx" ON "error_logs"("errorType");

-- CreateIndex
CREATE INDEX "error_logs_errorCode_idx" ON "error_logs"("errorCode");

-- CreateIndex
CREATE INDEX "error_logs_recovered_idx" ON "error_logs"("recovered");

-- CreateIndex
CREATE INDEX "error_logs_learned_idx" ON "error_logs"("learned");

-- CreateIndex
CREATE INDEX "error_logs_severity_idx" ON "error_logs"("severity");

-- CreateIndex
CREATE INDEX "error_logs_createdAt_idx" ON "error_logs"("createdAt");

-- CreateIndex
CREATE INDEX "agent_actions_userId_idx" ON "agent_actions"("userId");

-- CreateIndex
CREATE INDEX "agent_actions_caseId_idx" ON "agent_actions"("caseId");

-- CreateIndex
CREATE INDEX "agent_actions_debateId_idx" ON "agent_actions"("debateId");

-- CreateIndex
CREATE INDEX "agent_actions_agentName_idx" ON "agent_actions"("agentName");

-- CreateIndex
CREATE INDEX "agent_actions_actionType_idx" ON "agent_actions"("actionType");

-- CreateIndex
CREATE INDEX "agent_actions_actionName_idx" ON "agent_actions"("actionName");

-- CreateIndex
CREATE INDEX "agent_actions_actionLayer_idx" ON "agent_actions"("actionLayer");

-- CreateIndex
CREATE INDEX "agent_actions_status_idx" ON "agent_actions"("status");

-- CreateIndex
CREATE INDEX "agent_actions_parentActionId_idx" ON "agent_actions"("parentActionId");

-- CreateIndex
CREATE INDEX "agent_actions_createdAt_idx" ON "agent_actions"("createdAt");
