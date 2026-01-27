-- AlterTable
ALTER TABLE "ai_interactions" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "ai_interactions_userId_idx" ON "ai_interactions"("userId");

-- CreateIndex
CREATE INDEX "ai_interactions_userId_success_createdAt_idx" ON "ai_interactions"("userId", "success", "createdAt");
