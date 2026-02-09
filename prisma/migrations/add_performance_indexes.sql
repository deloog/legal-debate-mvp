-- 数据库性能优化索引
-- 执行时间：2026-02-08
-- 目标：优化查询性能，将查询时间从<100ms优化到<50ms

-- ============================================================================
-- 1. LawArticle 表索引优化
-- ============================================================================

-- 法条名称索引（用于按法律名称查询）
CREATE INDEX IF NOT EXISTS idx_law_article_law_name
ON "LawArticle"("lawName");

-- 数据源索引（用于按数据源筛选）
CREATE INDEX IF NOT EXISTS idx_law_article_data_source
ON "LawArticle"("dataSource");

-- 法律类型索引（用于按类型筛选）
CREATE INDEX IF NOT EXISTS idx_law_article_law_type
ON "LawArticle"("lawType");

-- 法律分类索引（用于按分类筛选）
CREATE INDEX IF NOT EXISTS idx_law_article_category
ON "LawArticle"("category");

-- 生效日期索引（用于按时间范围查询）
CREATE INDEX IF NOT EXISTS idx_law_article_effective_date
ON "LawArticle"("effectiveDate");

-- 状态索引（用于筛选有效/无效法条）
CREATE INDEX IF NOT EXISTS idx_law_article_status
ON "LawArticle"("status");

-- 组合索引：法律名称 + 条文号（用于精确查询）
CREATE INDEX IF NOT EXISTS idx_law_article_name_number
ON "LawArticle"("lawName", "articleNumber");

-- 组合索引：数据源 + 法律类型（用于筛选查询）
CREATE INDEX IF NOT EXISTS idx_law_article_source_type
ON "LawArticle"("dataSource", "lawType");

-- 组合索引：分类 + 状态（用于筛选有效法条）
CREATE INDEX IF NOT EXISTS idx_law_article_category_status
ON "LawArticle"("category", "status");

-- 全文搜索索引（PostgreSQL GIN索引，用于中文全文搜索）
CREATE INDEX IF NOT EXISTS idx_law_article_searchable_text
ON "LawArticle" USING gin(to_tsvector('chinese', "searchableText"));

-- 全文搜索索引（法条内容）
CREATE INDEX IF NOT EXISTS idx_law_article_full_text
ON "LawArticle" USING gin(to_tsvector('chinese', "fullText"));

-- ============================================================================
-- 2. LawArticleRelation 表索引优化
-- ============================================================================

-- 源法条ID索引
CREATE INDEX IF NOT EXISTS idx_law_article_relation_source
ON "LawArticleRelation"("sourceArticleId");

-- 目标法条ID索引
CREATE INDEX IF NOT EXISTS idx_law_article_relation_target
ON "LawArticleRelation"("targetArticleId");

-- 关系类型索引
CREATE INDEX IF NOT EXISTS idx_law_article_relation_type
ON "LawArticleRelation"("relationType");

-- 验证状态索引
CREATE INDEX IF NOT EXISTS idx_law_article_relation_verified
ON "LawArticleRelation"("isVerified");

-- 组合索引：源法条 + 关系类型（用于查询特定类型的关系）
CREATE INDEX IF NOT EXISTS idx_law_article_relation_source_type
ON "LawArticleRelation"("sourceArticleId", "relationType");

-- 组合索引：目标法条 + 关系类型（用于反向查询）
CREATE INDEX IF NOT EXISTS idx_law_article_relation_target_type
ON "LawArticleRelation"("targetArticleId", "relationType");

-- 组合索引：源法条 + 目标法条（用于检查关系是否存在）
CREATE INDEX IF NOT EXISTS idx_law_article_relation_source_target
ON "LawArticleRelation"("sourceArticleId", "targetArticleId");

-- ============================================================================
-- 3. Case 表索引优化
-- ============================================================================

-- 用户ID索引（用于查询用户的案件）
CREATE INDEX IF NOT EXISTS idx_case_user_id
ON "Case"("userId");

-- 案件状态索引
CREATE INDEX IF NOT EXISTS idx_case_status
ON "Case"("status");

-- 案件类型索引
CREATE INDEX IF NOT EXISTS idx_case_type
ON "Case"("caseType");

-- 创建时间索引（用于按时间排序）
CREATE INDEX IF NOT EXISTS idx_case_created_at
ON "Case"("createdAt" DESC);

-- 更新时间索引
CREATE INDEX IF NOT EXISTS idx_case_updated_at
ON "Case"("updatedAt" DESC);

-- 组合索引：用户 + 状态（用于查询用户的特定状态案件）
CREATE INDEX IF NOT EXISTS idx_case_user_status
ON "Case"("userId", "status");

-- 组合索引：用户 + 类型（用于查询用户的特定类型案件）
CREATE INDEX IF NOT EXISTS idx_case_user_type
ON "Case"("userId", "caseType");

-- 全文搜索索引（案件标题）
CREATE INDEX IF NOT EXISTS idx_case_title
ON "Case" USING gin(to_tsvector('chinese', "title"));

-- ============================================================================
-- 4. Contract 表索引优化
-- ============================================================================

-- 用户ID索引
CREATE INDEX IF NOT EXISTS idx_contract_user_id
ON "Contract"("userId");

-- 合同状态索引
CREATE INDEX IF NOT EXISTS idx_contract_status
ON "Contract"("status");

-- 合同类型索引
CREATE INDEX IF NOT EXISTS idx_contract_type
ON "Contract"("contractType");

-- 创建时间索引
CREATE INDEX IF NOT EXISTS idx_contract_created_at
ON "Contract"("createdAt" DESC);

-- 组合索引：用户 + 状态
CREATE INDEX IF NOT EXISTS idx_contract_user_status
ON "Contract"("userId", "status");

-- 全文搜索索引（合同标题）
CREATE INDEX IF NOT EXISTS idx_contract_title
ON "Contract" USING gin(to_tsvector('chinese', "title"));

-- ============================================================================
-- 5. Debate 表索引优化
-- ============================================================================

-- 用户ID索引
CREATE INDEX IF NOT EXISTS idx_debate_user_id
ON "Debate"("userId");

-- 案件ID索引
CREATE INDEX IF NOT EXISTS idx_debate_case_id
ON "Debate"("caseId");

-- 状态索引
CREATE INDEX IF NOT EXISTS idx_debate_status
ON "Debate"("status");

-- 创建时间索引
CREATE INDEX IF NOT EXISTS idx_debate_created_at
ON "Debate"("createdAt" DESC);

-- 组合索引：案件 + 状态
CREATE INDEX IF NOT EXISTS idx_debate_case_status
ON "Debate"("caseId", "status");

-- ============================================================================
-- 6. User 表索引优化
-- ============================================================================

-- 邮箱索引（已有唯一索引，无需额外创建）
-- 用户名索引（已有唯一索引，无需额外创建）

-- 角色索引
CREATE INDEX IF NOT EXISTS idx_user_role
ON "User"("role");

-- 状态索引
CREATE INDEX IF NOT EXISTS idx_user_status
ON "User"("status");

-- 创建时间索引
CREATE INDEX IF NOT EXISTS idx_user_created_at
ON "User"("createdAt" DESC);

-- 组合索引：角色 + 状态
CREATE INDEX IF NOT EXISTS idx_user_role_status
ON "User"("role", "status");

-- ============================================================================
-- 7. Recommendation 表索引优化
-- ============================================================================

-- 法条ID索引
CREATE INDEX IF NOT EXISTS idx_recommendation_article_id
ON "Recommendation"("lawArticleId");

-- 合同ID索引
CREATE INDEX IF NOT EXISTS idx_recommendation_contract_id
ON "Recommendation"("contractId");

-- 辩论ID索引
CREATE INDEX IF NOT EXISTS idx_recommendation_debate_id
ON "Recommendation"("debateId");

-- 推荐类型索引
CREATE INDEX IF NOT EXISTS idx_recommendation_type
ON "Recommendation"("recommendationType");

-- 创建时间索引
CREATE INDEX IF NOT EXISTS idx_recommendation_created_at
ON "Recommendation"("createdAt" DESC);

-- 组合索引：合同 + 法条（用于查询合同的推荐法条）
CREATE INDEX IF NOT EXISTS idx_recommendation_contract_article
ON "Recommendation"("contractId", "lawArticleId");

-- 组合索引：辩论 + 法条（用于查询辩论的推荐法条）
CREATE INDEX IF NOT EXISTS idx_recommendation_debate_article
ON "Recommendation"("debateId", "lawArticleId");

-- ============================================================================
-- 8. Feedback 表索引优化
-- ============================================================================

-- 用户ID索引
CREATE INDEX IF NOT EXISTS idx_feedback_user_id
ON "Feedback"("userId");

-- 推荐ID索引
CREATE INDEX IF NOT EXISTS idx_feedback_recommendation_id
ON "Feedback"("recommendationId");

-- 关系ID索引
CREATE INDEX IF NOT EXISTS idx_feedback_relation_id
ON "Feedback"("relationId");

-- 反馈类型索引
CREATE INDEX IF NOT EXISTS idx_feedback_type
ON "Feedback"("feedbackType");

-- 创建时间索引
CREATE INDEX IF NOT EXISTS idx_feedback_created_at
ON "Feedback"("createdAt" DESC);

-- 组合索引：推荐 + 用户（用于查询用户对推荐的反馈）
CREATE INDEX IF NOT EXISTS idx_feedback_recommendation_user
ON "Feedback"("recommendationId", "userId");

-- ============================================================================
-- 9. AIInteraction 表索引优化（监控和统计）
-- ============================================================================

-- 用户ID索引
CREATE INDEX IF NOT EXISTS idx_ai_interaction_user_id
ON "AIInteraction"("userId");

-- 提供商索引
CREATE INDEX IF NOT EXISTS idx_ai_interaction_provider
ON "AIInteraction"("provider");

-- 模型索引
CREATE INDEX IF NOT EXISTS idx_ai_interaction_model
ON "AIInteraction"("model");

-- 操作类型索引
CREATE INDEX IF NOT EXISTS idx_ai_interaction_operation
ON "AIInteraction"("operation");

-- 成功状态索引
CREATE INDEX IF NOT EXISTS idx_ai_interaction_success
ON "AIInteraction"("success");

-- 创建时间索引（用于统计和清理）
CREATE INDEX IF NOT EXISTS idx_ai_interaction_created_at
ON "AIInteraction"("createdAt" DESC);

-- 组合索引：提供商 + 模型（用于统计）
CREATE INDEX IF NOT EXISTS idx_ai_interaction_provider_model
ON "AIInteraction"("provider", "model");

-- 组合索引：操作 + 成功状态（用于统计成功率）
CREATE INDEX IF NOT EXISTS idx_ai_interaction_operation_success
ON "AIInteraction"("operation", "success");

-- ============================================================================
-- 10. 性能统计和分析
-- ============================================================================

-- 查看索引使用情况
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- 查看表大小
-- SELECT
--   schemaname,
--   tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 查看未使用的索引
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public' AND idx_scan = 0
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- 完成
-- ============================================================================

-- 刷新统计信息
ANALYZE;

-- 输出完成信息
DO $$
BEGIN
  RAISE NOTICE '✅ 数据库索引优化完成！';
  RAISE NOTICE '📊 已创建/更新 60+ 个索引';
  RAISE NOTICE '🚀 预期查询性能提升 50-80%%';
  RAISE NOTICE '⏱️  查询时间目标：< 50ms';
END $$;
