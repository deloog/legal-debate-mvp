-- CreateEnum
CREATE TYPE "CaseTimelineEventType" AS ENUM ('FILING', 'PRETRIAL', 'TRIAL', 'JUDGMENT', 'APPEAL', 'EXECUTION', 'CLOSED', 'CUSTOM');

-- CreateTable
CREATE TABLE "case_timelines" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "eventType" "CaseTimelineEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_timelines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_timelines_caseId_idx" ON "case_timelines"("caseId");

-- CreateIndex
CREATE INDEX "case_timelines_eventType_idx" ON "case_timelines"("eventType");

-- CreateIndex
CREATE INDEX "case_timelines_eventDate_idx" ON "case_timelines"("eventDate");

-- AddForeignKey
ALTER TABLE "case_timelines" ADD CONSTRAINT "case_timelines_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
