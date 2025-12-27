-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "amount" DECIMAL(65,30),
ADD COLUMN     "caseNumber" TEXT,
ADD COLUMN     "cause" TEXT,
ADD COLUMN     "court" TEXT,
ADD COLUMN     "defendantName" TEXT,
ADD COLUMN     "plaintiffName" TEXT;

-- CreateIndex
CREATE INDEX "cases_plaintiffName_idx" ON "cases"("plaintiffName");

-- CreateIndex
CREATE INDEX "cases_defendantName_idx" ON "cases"("defendantName");

-- CreateIndex
CREATE INDEX "cases_cause_idx" ON "cases"("cause");
