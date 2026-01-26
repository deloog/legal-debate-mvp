-- CreateEnum
CREATE TYPE "FeeConfigType" AS ENUM ('LAWYER_FEE', 'LITIGATION_FEE', 'TRAVEL_EXPENSE', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "CaseResult" AS ENUM ('WIN', 'LOSE', 'PARTIAL', 'WITHDRAW');

-- CreateEnum
CREATE TYPE "WitnessStatus" AS ENUM ('NEED_CONTACT', 'CONTACTED', 'CONFIRMED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "fee_rate_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "configType" "FeeConfigType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rateData" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_rate_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_examples" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "court" TEXT NOT NULL,
    "type" "CaseType" NOT NULL,
    "cause" TEXT,
    "facts" TEXT NOT NULL,
    "judgment" TEXT NOT NULL,
    "result" "CaseResult" NOT NULL DEFAULT 'WIN',
    "judgmentDate" TIMESTAMP(3) NOT NULL,
    "embedding" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "witnesses" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "relationship" TEXT,
    "testimony" TEXT,
    "courtScheduleId" TEXT,
    "status" "WitnessStatus" NOT NULL DEFAULT 'NEED_CONTACT',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "witnesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_rate_configs_userId_idx" ON "fee_rate_configs"("userId");

-- CreateIndex
CREATE INDEX "fee_rate_configs_configType_idx" ON "fee_rate_configs"("configType");

-- CreateIndex
CREATE INDEX "fee_rate_configs_isDefault_idx" ON "fee_rate_configs"("isDefault");

-- CreateIndex
CREATE INDEX "fee_rate_configs_isActive_idx" ON "fee_rate_configs"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "fee_rate_configs_userId_configType_name_key" ON "fee_rate_configs"("userId", "configType", "name");

-- CreateIndex
CREATE INDEX "case_examples_type_idx" ON "case_examples"("type");

-- CreateIndex
CREATE INDEX "case_examples_cause_idx" ON "case_examples"("cause");

-- CreateIndex
CREATE INDEX "case_examples_result_idx" ON "case_examples"("result");

-- CreateIndex
CREATE INDEX "case_examples_judgmentDate_idx" ON "case_examples"("judgmentDate");

-- CreateIndex
CREATE INDEX "witnesses_caseId_idx" ON "witnesses"("caseId");

-- CreateIndex
CREATE INDEX "witnesses_status_idx" ON "witnesses"("status");

-- CreateIndex
CREATE INDEX "witnesses_courtScheduleId_idx" ON "witnesses"("courtScheduleId");

-- AddForeignKey
ALTER TABLE "fee_rate_configs" ADD CONSTRAINT "fee_rate_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "witnesses" ADD CONSTRAINT "witnesses_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "witnesses" ADD CONSTRAINT "witnesses_courtScheduleId_fkey" FOREIGN KEY ("courtScheduleId") REFERENCES "court_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
