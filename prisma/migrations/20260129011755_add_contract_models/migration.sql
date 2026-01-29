-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('FIXED', 'RISK', 'HOURLY', 'MIXED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING', 'SIGNED', 'EXECUTING', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ContractPaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "caseId" TEXT,
    "consultationId" TEXT,
    "clientType" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientIdNumber" TEXT,
    "clientAddress" TEXT,
    "clientContact" TEXT,
    "lawFirmName" TEXT NOT NULL,
    "lawyerName" TEXT NOT NULL,
    "lawyerId" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "caseSummary" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "feeType" "FeeType" NOT NULL,
    "totalFee" DECIMAL(65,30) NOT NULL,
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "feeDetails" JSONB,
    "terms" JSONB,
    "specialTerms" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "signedAt" TIMESTAMP(3),
    "signatureData" JSONB,
    "filePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_payments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentType" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "status" "ContractPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "receiptNumber" TEXT,
    "invoiceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contractNumber_key" ON "contracts"("contractNumber");

-- CreateIndex
CREATE INDEX "contracts_caseId_idx" ON "contracts"("caseId");

-- CreateIndex
CREATE INDEX "contracts_clientName_idx" ON "contracts"("clientName");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_lawyerId_idx" ON "contracts"("lawyerId");

-- CreateIndex
CREATE INDEX "contracts_createdAt_idx" ON "contracts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "contract_payments_paymentNumber_key" ON "contract_payments"("paymentNumber");

-- CreateIndex
CREATE INDEX "contract_payments_contractId_idx" ON "contract_payments"("contractId");

-- CreateIndex
CREATE INDEX "contract_payments_status_idx" ON "contract_payments"("status");

-- CreateIndex
CREATE INDEX "contract_payments_paidAt_idx" ON "contract_payments"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "contract_templates_code_key" ON "contract_templates"("code");

-- CreateIndex
CREATE INDEX "contract_templates_category_idx" ON "contract_templates"("category");

-- CreateIndex
CREATE INDEX "contract_templates_isActive_idx" ON "contract_templates"("isActive");

-- CreateIndex
CREATE INDEX "contract_templates_isDefault_idx" ON "contract_templates"("isDefault");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_payments" ADD CONSTRAINT "contract_payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
