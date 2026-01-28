-- CreateTable
CREATE TABLE "case_type_configs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "baseFee" DECIMAL(10,2) NOT NULL,
    "riskFeeRate" DOUBLE PRECISION,
    "hourlyRate" DECIMAL(10,2),
    "requiredDocs" JSONB NOT NULL,
    "optionalDocs" JSONB,
    "avgDuration" INTEGER,
    "complexityLevel" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_type_configs_code_key" ON "case_type_configs"("code");

-- CreateIndex
CREATE INDEX "case_type_configs_category_idx" ON "case_type_configs"("category");

-- CreateIndex
CREATE INDEX "case_type_configs_isActive_idx" ON "case_type_configs"("isActive");

-- CreateIndex
CREATE INDEX "case_type_configs_code_idx" ON "case_type_configs"("code");
