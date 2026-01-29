-- CreateIndex
CREATE INDEX "contracts_status_createdAt_idx" ON "contracts"("status", "createdAt");

-- CreateIndex
CREATE INDEX "contracts_clientName_status_idx" ON "contracts"("clientName", "status");

-- CreateIndex
CREATE INDEX "contracts_lawyerId_status_idx" ON "contracts"("lawyerId", "status");

-- CreateIndex
CREATE INDEX "contracts_status_signedAt_idx" ON "contracts"("status", "signedAt");
