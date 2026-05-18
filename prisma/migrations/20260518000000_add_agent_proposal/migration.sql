-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'EXECUTING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'REJECTED', 'REVERTED');

-- CreateEnum
CREATE TYPE "ProposalActionStatus" AS ENUM ('PENDING', 'SKIPPED', 'EXECUTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RevertStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'COMPLETED', 'FAILED');

-- AlterTable: Message add proposalId
ALTER TABLE "messages" ADD COLUMN "proposalId" TEXT;
ALTER TABLE "messages" ADD CONSTRAINT "messages_proposalId_key" UNIQUE ("proposalId");

-- CreateTable: AgentProposal
CREATE TABLE "agent_proposals" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "triggerMsgId" TEXT,
    "userId" TEXT NOT NULL,
    "caseId" TEXT,
    "confirmedById" TEXT,
    "extractedData" JSONB NOT NULL,
    "confirmedData" JSONB,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "revertedAt" TIMESTAMP(3),
    "revertReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProposalAction
CREATE TABLE "proposal_actions" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dependsOnId" TEXT,
    "actionType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "idempotencyKey" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "status" "ProposalActionStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "revertStatus" "RevertStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "revertedAt" TIMESTAMP(3),
    "revertError" TEXT,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "proposal_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_proposals_conversationId_idx" ON "agent_proposals"("conversationId");
CREATE INDEX "agent_proposals_userId_idx" ON "agent_proposals"("userId");
CREATE INDEX "agent_proposals_caseId_idx" ON "agent_proposals"("caseId");
CREATE INDEX "agent_proposals_status_idx" ON "agent_proposals"("status");
CREATE INDEX "agent_proposals_createdAt_idx" ON "agent_proposals"("createdAt");

CREATE UNIQUE INDEX "proposal_actions_idempotencyKey_key" ON "proposal_actions"("idempotencyKey");
CREATE UNIQUE INDEX "proposal_actions_proposalId_sequence_key" ON "proposal_actions"("proposalId", "sequence");
CREATE INDEX "proposal_actions_proposalId_idx" ON "proposal_actions"("proposalId");
CREATE INDEX "proposal_actions_idempotencyKey_idx" ON "proposal_actions"("idempotencyKey");
CREATE INDEX "proposal_actions_resourceType_resourceId_idx" ON "proposal_actions"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "agent_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_confirmedById_fkey"
    FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_triggerMsgId_fkey"
    FOREIGN KEY ("triggerMsgId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "proposal_actions" ADD CONSTRAINT "proposal_actions_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "agent_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "proposal_actions" ADD CONSTRAINT "proposal_actions_dependsOnId_fkey"
    FOREIGN KEY ("dependsOnId") REFERENCES "proposal_actions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
