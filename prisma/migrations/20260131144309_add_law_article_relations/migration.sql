-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('CITES', 'CITED_BY', 'CONFLICTS', 'COMPLETES', 'COMPLETED_BY', 'SUPERSEDES', 'SUPERSEDED_BY', 'IMPLEMENTS', 'IMPLEMENTED_BY', 'RELATED');

-- CreateEnum
CREATE TYPE "DiscoveryMethod" AS ENUM ('MANUAL', 'RULE_BASED', 'AI_DETECTED', 'CASE_DERIVED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "law_article_relations" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relationType" "RelationType" NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "description" TEXT,
    "evidence" JSONB,
    "discoveryMethod" "DiscoveryMethod" NOT NULL DEFAULT 'MANUAL',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "law_article_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "law_article_relations_sourceId_targetId_relationType_idx" ON "law_article_relations"("sourceId", "targetId", "relationType");

-- CreateIndex
CREATE INDEX "law_article_relations_sourceId_idx" ON "law_article_relations"("sourceId");

-- CreateIndex
CREATE INDEX "law_article_relations_targetId_idx" ON "law_article_relations"("targetId");

-- CreateIndex
CREATE INDEX "law_article_relations_relationType_idx" ON "law_article_relations"("relationType");

-- CreateIndex
CREATE INDEX "law_article_relations_strength_idx" ON "law_article_relations"("strength");

-- CreateIndex
CREATE INDEX "law_article_relations_verificationStatus_idx" ON "law_article_relations"("verificationStatus");

-- CreateIndex
CREATE INDEX "law_article_relations_discoveryMethod_idx" ON "law_article_relations"("discoveryMethod");

-- AddForeignKey
ALTER TABLE "law_article_relations" ADD CONSTRAINT "law_article_relations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "law_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "law_article_relations" ADD CONSTRAINT "law_article_relations_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "law_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
