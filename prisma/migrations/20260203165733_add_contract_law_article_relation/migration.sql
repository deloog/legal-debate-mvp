-- CreateTable
CREATE TABLE "contract_law_articles" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "lawArticleId" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "relevanceScore" DOUBLE PRECISION,

    CONSTRAINT "contract_law_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_law_articles_contractId_idx" ON "contract_law_articles"("contractId");

-- CreateIndex
CREATE INDEX "contract_law_articles_lawArticleId_idx" ON "contract_law_articles"("lawArticleId");

-- CreateIndex
CREATE INDEX "contract_law_articles_addedAt_idx" ON "contract_law_articles"("addedAt");

-- CreateIndex
CREATE UNIQUE INDEX "contract_law_articles_contractId_lawArticleId_key" ON "contract_law_articles"("contractId", "lawArticleId");

-- AddForeignKey
ALTER TABLE "contract_law_articles" ADD CONSTRAINT "contract_law_articles_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_law_articles" ADD CONSTRAINT "contract_law_articles_lawArticleId_fkey" FOREIGN KEY ("lawArticleId") REFERENCES "law_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
