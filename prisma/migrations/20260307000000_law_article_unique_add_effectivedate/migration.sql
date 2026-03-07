-- 修改 law_articles 唯一约束
-- 旧约束：(lawName, articleNumber) — 同名法律不同版本互相覆盖
-- 新约束：(lawName, articleNumber, effectiveDate) — 允许同一法律的不同时间版本共存

-- 删除旧唯一约束
DROP INDEX IF EXISTS "law_articles_lawName_articleNumber_key";

-- 添加新唯一约束（包含 effectiveDate）
ALTER TABLE "law_articles"
  ADD CONSTRAINT "law_articles_lawName_articleNumber_effectiveDate_key"
  UNIQUE ("lawName", "articleNumber", "effectiveDate");
