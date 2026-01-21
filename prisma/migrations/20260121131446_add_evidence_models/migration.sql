-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('COURT_SCHEDULE', 'DEADLINE', 'FOLLOW_UP', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'READ', 'DISMISSED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('DOCUMENT', 'PHYSICAL', 'WITNESS', 'EXPERT_OPINION', 'AUDIO_VIDEO', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'QUESTIONED');

-- CreateEnum
CREATE TYPE "EvidenceRelationType" AS ENUM ('LEGAL_REFERENCE', 'ARGUMENT', 'FACT', 'OTHER');

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL DEFAULT 'DOCUMENT',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "submitter" TEXT,
    "source" TEXT,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING',
    "relevanceScore" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_relations" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "relationType" "EvidenceRelationType" NOT NULL,
    "relatedId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "reminderTime" TIMESTAMP(3) NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "relatedType" TEXT,
    "relatedId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidence_caseId_idx" ON "evidence"("caseId");

-- CreateIndex
CREATE INDEX "evidence_type_idx" ON "evidence"("type");

-- CreateIndex
CREATE INDEX "evidence_status_idx" ON "evidence"("status");

-- CreateIndex
CREATE INDEX "evidence_relevanceScore_idx" ON "evidence"("relevanceScore");

-- CreateIndex
CREATE INDEX "evidence_deletedAt_idx" ON "evidence"("deletedAt");

-- CreateIndex
CREATE INDEX "evidence_relations_evidenceId_idx" ON "evidence_relations"("evidenceId");

-- CreateIndex
CREATE INDEX "evidence_relations_relationType_idx" ON "evidence_relations"("relationType");

-- CreateIndex
CREATE INDEX "evidence_relations_relatedId_idx" ON "evidence_relations"("relatedId");

-- CreateIndex
CREATE INDEX "reminders_userId_idx" ON "reminders"("userId");

-- CreateIndex
CREATE INDEX "reminders_type_idx" ON "reminders"("type");

-- CreateIndex
CREATE INDEX "reminders_reminderTime_idx" ON "reminders"("reminderTime");

-- CreateIndex
CREATE INDEX "reminders_status_idx" ON "reminders"("status");

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_relations" ADD CONSTRAINT "evidence_relations_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
