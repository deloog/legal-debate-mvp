-- 为法条检索启用 pg_trgm 扩展并创建 GIN 三元组索引
-- 解决问题：LIKE '%keyword%' 无法利用 B-Tree 索引，1M+ 条目全表扫描极慢
-- 效果：检索速度从秒级降到毫秒级，同时支持模糊匹配

-- 启用 pg_trgm 扩展（已存在则跳过）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- searchableText：法条正文内容检索（最高频查询路径）
CREATE INDEX IF NOT EXISTS "LawArticle_searchableText_trgm_idx"
  ON "law_articles" USING GIN ("searchableText" gin_trgm_ops);

-- lawName：法律名称检索（命中「最高人民法院关于…」等长名称）
CREATE INDEX IF NOT EXISTS "LawArticle_lawName_trgm_idx"
  ON "law_articles" USING GIN ("lawName" gin_trgm_ops);
