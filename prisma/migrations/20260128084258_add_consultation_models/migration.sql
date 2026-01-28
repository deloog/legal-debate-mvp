-- CreateEnum
CREATE TYPE "ConsultationType" AS ENUM ('PHONE', 'VISIT', 'ONLINE', 'REFERRAL');

-- CreateEnum
CREATE TYPE "ConsultStatus" AS ENUM ('PENDING', 'FOLLOWING', 'CONVERTED', 'CLOSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "consultNumber" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "clientCompany" TEXT,
    "consultType" "ConsultationType" NOT NULL,
    "consultTime" TIMESTAMP(3) NOT NULL,
    "caseType" TEXT,
    "caseSummary" TEXT NOT NULL,
    "clientDemand" TEXT,
    "aiAssessment" JSONB,
    "winRate" DOUBLE PRECISION,
    "difficulty" TEXT,
    "riskLevel" TEXT,
    "suggestedFee" DECIMAL(10,2),
    "status" "ConsultStatus" NOT NULL DEFAULT 'PENDING',
    "followUpDate" TIMESTAMP(3),
    "followUpNotes" TEXT,
    "convertedToCaseId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_follow_ups" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "followUpTime" TIMESTAMP(3) NOT NULL,
    "followUpType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "result" TEXT,
    "nextFollowUp" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consultations_consultNumber_key" ON "consultations"("consultNumber");

-- CreateIndex
CREATE INDEX "consultations_userId_idx" ON "consultations"("userId");

-- CreateIndex
CREATE INDEX "consultations_status_idx" ON "consultations"("status");

-- CreateIndex
CREATE INDEX "consultations_consultTime_idx" ON "consultations"("consultTime");

-- CreateIndex
CREATE INDEX "consultations_clientPhone_idx" ON "consultations"("clientPhone");

-- CreateIndex
CREATE INDEX "consultations_convertedToCaseId_idx" ON "consultations"("convertedToCaseId");

-- CreateIndex
CREATE INDEX "consultation_follow_ups_consultationId_idx" ON "consultation_follow_ups"("consultationId");

-- CreateIndex
CREATE INDEX "consultation_follow_ups_followUpTime_idx" ON "consultation_follow_ups"("followUpTime");

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_follow_ups" ADD CONSTRAINT "consultation_follow_ups_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
