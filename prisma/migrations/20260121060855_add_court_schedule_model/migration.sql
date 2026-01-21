-- CreateEnum
CREATE TYPE "CourtScheduleType" AS ENUM ('TRIAL', 'MEDIATION', 'ARBITRATION', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "CourtScheduleStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- CreateTable
CREATE TABLE "court_schedules" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CourtScheduleType" NOT NULL DEFAULT 'TRIAL',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "judge" TEXT,
    "notes" TEXT,
    "status" "CourtScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "court_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "court_schedules_caseId_idx" ON "court_schedules"("caseId");

-- CreateIndex
CREATE INDEX "court_schedules_type_idx" ON "court_schedules"("type");

-- CreateIndex
CREATE INDEX "court_schedules_startTime_idx" ON "court_schedules"("startTime");

-- CreateIndex
CREATE INDEX "court_schedules_status_idx" ON "court_schedules"("status");

-- CreateIndex
CREATE UNIQUE INDEX "court_schedules_caseId_startTime_key" ON "court_schedules"("caseId", "startTime");

-- AddForeignKey
ALTER TABLE "court_schedules" ADD CONSTRAINT "court_schedules_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
