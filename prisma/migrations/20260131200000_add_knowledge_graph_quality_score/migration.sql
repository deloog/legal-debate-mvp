-- Create KnowledgeGraphQualityScore table
CREATE TABLE "knowledge_graph_quality_scores" (
    "id" TEXT NOT NULL,
    "relation_id" TEXT NOT NULL,
    "ai_confidence" DOUBLE PRECISION,
    "verification_count" INTEGER NOT NULL DEFAULT 0,
    "positive_feedback" INTEGER NOT NULL DEFAULT 0,
    "negative_feedback" INTEGER NOT NULL DEFAULT 0,
    "quality_score" DOUBLE PRECISION NOT NULL,
    "quality_level" TEXT NOT NULL,
    "last_calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_graph_quality_scores_pkey" PRIMARY KEY ("id")
);

-- Create unique index on relation_id
CREATE UNIQUE INDEX "knowledge_graph_quality_scores_relation_id_key" ON "knowledge_graph_quality_scores"("relation_id");

-- Create index on quality_score
CREATE INDEX "knowledge_graph_quality_scores_quality_score_idx" ON "knowledge_graph_quality_scores"("quality_score");

-- Create index on quality_level
CREATE INDEX "knowledge_graph_quality_scores_quality_level_idx" ON "knowledge_graph_quality_scores"("quality_level");

-- Add foreign key constraint
ALTER TABLE "knowledge_graph_quality_scores" 
ADD CONSTRAINT "knowledge_graph_quality_scores_relation_id_fkey" 
FOREIGN KEY ("relation_id") REFERENCES "law_article_relations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
