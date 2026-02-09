#!/bin/bash

# 国家法律法规库数据导出脚本
# 用于将本地数据导出，以便在服务器上快速恢复

set -e  # 遇到错误立即退出

echo "🚀 开始导出国家法律法规库数据..."
echo ""

# 配置
DB_NAME="legal_debate_mvp"
DB_USER="postgres"
OUTPUT_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="${OUTPUT_DIR}/law_articles_npc_${TIMESTAMP}.sql"

# 创建备份目录
mkdir -p "$OUTPUT_DIR"

echo "📊 数据库信息："
echo "   数据库名: $DB_NAME"
echo "   用户名: $DB_USER"
echo "   输出文件: $OUTPUT_FILE"
echo ""

# 方案1：导出 LawArticle 表（仅 NPC 数据）
echo "📦 方案1：导出 LawArticle 表（推荐）..."
echo "   正在导出..."

pg_dump -U "$DB_USER" -d "$DB_NAME" \
  -t "LawArticle" \
  --data-only \
  --column-inserts \
  -f "$OUTPUT_FILE" \
  2>&1 | grep -v "NOTICE" || true

if [ -f "$OUTPUT_FILE" ]; then
  FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
  echo "   ✅ 导出成功！文件大小: $FILE_SIZE"
  echo ""

  # 压缩文件
  echo "🗜️  压缩文件..."
  gzip -f "$OUTPUT_FILE"
  COMPRESSED_SIZE=$(du -h "${OUTPUT_FILE}.gz" | cut -f1)
  echo "   ✅ 压缩完成！压缩后大小: $COMPRESSED_SIZE"
  echo ""

  echo "📁 导出文件："
  echo "   ${OUTPUT_FILE}.gz"
  echo ""
else
  echo "   ❌ 导出失败！"
  exit 1
fi

# 方案2：导出为 CSV（可选，更快）
CSV_FILE="${OUTPUT_DIR}/law_articles_npc_${TIMESTAMP}.csv"
echo "📦 方案2：导出为 CSV（可选）..."
echo "   正在导出..."

psql -U "$DB_USER" -d "$DB_NAME" -c "\COPY (SELECT * FROM \"LawArticle\" WHERE \"dataSource\" = 'npc') TO '$CSV_FILE' WITH CSV HEADER" 2>&1 | grep -v "COPY" || true

if [ -f "$CSV_FILE" ]; then
  CSV_SIZE=$(du -h "$CSV_FILE" | cut -f1)
  echo "   ✅ CSV 导出成功！文件大小: $CSV_SIZE"

  # 压缩 CSV
  gzip -f "$CSV_FILE"
  CSV_COMPRESSED_SIZE=$(du -h "${CSV_FILE}.gz" | cut -f1)
  echo "   ✅ CSV 压缩完成！压缩后大小: $CSV_COMPRESSED_SIZE"
  echo ""

  echo "📁 CSV 文件："
  echo "   ${CSV_FILE}.gz"
  echo ""
fi

# 生成导入脚本
IMPORT_SCRIPT="${OUTPUT_DIR}/import_on_server.sh"
cat > "$IMPORT_SCRIPT" << 'EOF'
#!/bin/bash

# 服务器端导入脚本
# 使用方法：
#   1. 上传此脚本和 .sql.gz 文件到服务器
#   2. chmod +x import_on_server.sh
#   3. ./import_on_server.sh law_articles_npc_YYYYMMDD_HHMMSS.sql.gz

set -e

if [ -z "$1" ]; then
  echo "❌ 错误：请提供 SQL 文件路径"
  echo "使用方法: $0 <sql_file.gz>"
  exit 1
fi

SQL_FILE="$1"
DB_NAME="${DB_NAME:-legal_debate_mvp}"
DB_USER="${DB_USER:-postgres}"

echo "🚀 开始导入数据到服务器..."
echo ""
echo "📊 配置信息："
echo "   数据库名: $DB_NAME"
echo "   用户名: $DB_USER"
echo "   SQL 文件: $SQL_FILE"
echo ""

# 解压文件
if [[ "$SQL_FILE" == *.gz ]]; then
  echo "🗜️  解压文件..."
  gunzip -k "$SQL_FILE"
  SQL_FILE="${SQL_FILE%.gz}"
  echo "   ✅ 解压完成"
  echo ""
fi

# 导入数据
echo "📥 导入数据..."
echo "   这可能需要几分钟..."
echo ""

psql -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"

echo ""
echo "✅ 导入完成！"
echo ""

# 创建索引
echo "🔧 创建索引..."
psql -U "$DB_USER" -d "$DB_NAME" << 'EOSQL'
-- 创建索引以提高查询性能
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_law_article_data_source
  ON "LawArticle"("dataSource");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_law_article_law_name
  ON "LawArticle"("lawName");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_law_article_law_type
  ON "LawArticle"("lawType");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_law_article_category
  ON "LawArticle"("category");

-- 全文搜索索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_law_article_searchable_text
  ON "LawArticle" USING gin(to_tsvector('chinese', "searchableText"));

-- 分析表以更新统计信息
ANALYZE "LawArticle";
EOSQL

echo "   ✅ 索引创建完成"
echo ""

# 验证数据
echo "🔍 验证数据..."
psql -U "$DB_USER" -d "$DB_NAME" << 'EOSQL'
SELECT
  'NPC 数据总数' as metric,
  COUNT(*) as value
FROM "LawArticle"
WHERE "dataSource" = 'npc'
UNION ALL
SELECT
  '法律总数' as metric,
  COUNT(DISTINCT "lawName") as value
FROM "LawArticle"
WHERE "dataSource" = 'npc';
EOSQL

echo ""
echo "✨ 全部完成！"
EOF

chmod +x "$IMPORT_SCRIPT"

echo "📝 已生成服务器导入脚本："
echo "   $IMPORT_SCRIPT"
echo ""

# 显示使用说明
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📖 使用说明"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  上传文件到服务器："
echo "   scp ${OUTPUT_FILE}.gz user@server:/path/to/backup/"
echo "   scp $IMPORT_SCRIPT user@server:/path/to/backup/"
echo ""
echo "2️⃣  在服务器上执行导入："
echo "   ssh user@server"
echo "   cd /path/to/backup"
echo "   chmod +x import_on_server.sh"
echo "   ./import_on_server.sh law_articles_npc_${TIMESTAMP}.sql.gz"
echo ""
echo "3️⃣  验证数据："
echo "   cd /path/to/app"
echo "   npx tsx scripts/import-data/verify-npc-import.ts"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ 导出完成！"
