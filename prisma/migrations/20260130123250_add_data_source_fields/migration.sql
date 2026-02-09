-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SYNCED', 'PENDING', 'FAILED', 'NEED_UPDATE');

-- AlterTable
ALTER TABLE "case_examples" ADD COLUMN     "dataSource" TEXT NOT NULL DEFAULT 'cail',
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "sourceId" TEXT;

-- AlterTable
ALTER TABLE "law_articles" ADD COLUMN     "dataSource" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED';

-- CreateTable
CREATE TABLE "external_cache" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "resultType" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP(3),

    CONSTRAINT "external_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_cache_queryHash_key" ON "external_cache"("queryHash");

-- CreateIndex
CREATE INDEX "external_cache_source_idx" ON "external_cache"("source");

-- CreateIndex
CREATE INDEX "external_cache_queryHash_idx" ON "external_cache"("queryHash");

-- CreateIndex
CREATE INDEX "external_cache_expiresAt_idx" ON "external_cache"("expiresAt");

-- CreateIndex
CREATE INDEX "external_cache_hitCount_idx" ON "external_cache"("hitCount");

-- CreateIndex
CREATE INDEX "case_examples_dataSource_idx" ON "case_examples"("dataSource");

-- CreateIndex
CREATE INDEX "law_articles_dataSource_idx" ON "law_articles"("dataSource");

-- CreateIndex
CREATE INDEX "law_articles_lastSyncedAt_idx" ON "law_articles"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "law_articles_syncStatus_idx" ON "law_articles"("syncStatus");
