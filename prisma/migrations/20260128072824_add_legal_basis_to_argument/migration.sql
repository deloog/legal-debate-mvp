-- AlterTable
ALTER TABLE "arguments" ADD COLUMN     "legalBasis" JSONB,
ADD COLUMN     "legalScore" DOUBLE PRECISION,
ADD COLUMN     "logicScore" DOUBLE PRECISION,
ADD COLUMN     "overallScore" DOUBLE PRECISION,
ADD COLUMN     "reasoning" TEXT;
