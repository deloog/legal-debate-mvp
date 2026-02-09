-- CreateEnum
CREATE TYPE "FeedbackContextType" AS ENUM ('DEBATE', 'CONTRACT', 'GENERAL', 'SEARCH');

-- CreateEnum
CREATE TYPE "RecommendationFeedbackType" AS ENUM ('HELPFUL', 'NOT_HELPFUL', 'IRRELEVANT', 'EXCELLENT');

-- CreateEnum
CREATE TYPE "RelationFeedbackType" AS ENUM ('ACCURATE', 'INACCURATE', 'MISSING', 'SHOULD_REMOVE', 'WRONG_TYPE');

-- CreateTable
CREATE TABLE "recommendation_feedbacks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lawArticleId" TEXT NOT NULL,
    "contextType" "FeedbackContextType" NOT NULL,
    "contextId" TEXT,
    "feedbackType" "RecommendationFeedbackType" NOT NULL,
    "comment" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relation_feedbacks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "feedbackType" "RelationFeedbackType" NOT NULL,
    "suggestedRelationType" "RelationType",
    "comment" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relation_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendation_feedbacks_userId_idx" ON "recommendation_feedbacks"("userId");

-- CreateIndex
CREATE INDEX "recommendation_feedbacks_lawArticleId_idx" ON "recommendation_feedbacks"("lawArticleId");

-- CreateIndex
CREATE INDEX "recommendation_feedbacks_contextType_idx" ON "recommendation_feedbacks"("contextType");

-- CreateIndex
CREATE INDEX "recommendation_feedbacks_feedbackType_idx" ON "recommendation_feedbacks"("feedbackType");

-- CreateIndex
CREATE INDEX "recommendation_feedbacks_createdAt_idx" ON "recommendation_feedbacks"("createdAt");

-- CreateIndex
CREATE INDEX "recommendation_feedbacks_userId_lawArticleId_idx" ON "recommendation_feedbacks"("userId", "lawArticleId");

-- CreateIndex
CREATE INDEX "relation_feedbacks_userId_idx" ON "relation_feedbacks"("userId");

-- CreateIndex
CREATE INDEX "relation_feedbacks_relationId_idx" ON "relation_feedbacks"("relationId");

-- CreateIndex
CREATE INDEX "relation_feedbacks_feedbackType_idx" ON "relation_feedbacks"("feedbackType");

-- CreateIndex
CREATE INDEX "relation_feedbacks_createdAt_idx" ON "relation_feedbacks"("createdAt");

-- CreateIndex
CREATE INDEX "relation_feedbacks_userId_relationId_idx" ON "relation_feedbacks"("userId", "relationId");

-- AddForeignKey
ALTER TABLE "recommendation_feedbacks" ADD CONSTRAINT "recommendation_feedbacks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_feedbacks" ADD CONSTRAINT "recommendation_feedbacks_lawArticleId_fkey" FOREIGN KEY ("lawArticleId") REFERENCES "law_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relation_feedbacks" ADD CONSTRAINT "relation_feedbacks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relation_feedbacks" ADD CONSTRAINT "relation_feedbacks_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "law_article_relations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
