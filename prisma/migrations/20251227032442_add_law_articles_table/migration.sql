-- CreateEnum
CREATE TYPE "LawType" AS ENUM ('CONSTITUTION', 'LAW', 'ADMINISTRATIVE_REGULATION', 'LOCAL_REGULATION', 'JUDICIAL_INTERPRETATION', 'DEPARTMENTAL_RULE', 'OTHER');

-- CreateEnum
CREATE TYPE "LawCategory" AS ENUM ('CIVIL', 'CRIMINAL', 'ADMINISTRATIVE', 'COMMERCIAL', 'ECONOMIC', 'LABOR', 'INTELLECTUAL_PROPERTY', 'PROCEDURE', 'OTHER');

-- CreateEnum
CREATE TYPE "LawStatus" AS ENUM ('DRAFT', 'VALID', 'AMENDED', 'REPEALED', 'EXPIRED');

-- CreateTable
CREATE TABLE "law_articles" (
    "id" TEXT NOT NULL,
    "lawName" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "lawType" "LawType" NOT NULL,
    "category" "LawCategory" NOT NULL,
    "subCategory" TEXT,
    "tags" TEXT[],
    "keywords" TEXT[],
    "version" TEXT NOT NULL DEFAULT '1.0',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "status" "LawStatus" NOT NULL DEFAULT 'VALID',
    "amendmentHistory" JSONB,
    "parentId" TEXT,
    "chapterNumber" TEXT,
    "sectionNumber" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "issuingAuthority" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "relatedArticles" TEXT[],
    "legalBasis" TEXT,
    "searchableText" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "referenceCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "law_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "law_articles_lawType_idx" ON "law_articles"("lawType");

-- CreateIndex
CREATE INDEX "law_articles_category_idx" ON "law_articles"("category");

-- CreateIndex
CREATE INDEX "law_articles_status_idx" ON "law_articles"("status");

-- CreateIndex
CREATE INDEX "law_articles_effectiveDate_idx" ON "law_articles"("effectiveDate");

-- CreateIndex
CREATE INDEX "law_articles_lawName_idx" ON "law_articles"("lawName");

-- CreateIndex
CREATE INDEX "law_articles_articleNumber_idx" ON "law_articles"("articleNumber");

-- CreateIndex
CREATE INDEX "law_articles_tags_idx" ON "law_articles"("tags");

-- CreateIndex
CREATE INDEX "law_articles_viewCount_idx" ON "law_articles"("viewCount");

-- CreateIndex
CREATE INDEX "law_articles_referenceCount_idx" ON "law_articles"("referenceCount");

-- AddForeignKey
ALTER TABLE "law_articles" ADD CONSTRAINT "law_articles_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "law_articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
