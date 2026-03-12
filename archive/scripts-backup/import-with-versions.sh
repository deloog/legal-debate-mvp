#!/bin/bash

# 从 SQLite 导入包含历史版本的法律数据
#
# 使用方法：
#   bash scripts/import-with-versions.sh [mode]
#
# mode 参数：
#   - important: 只导入重要法律的历史版本（推荐）
#   - all: 导入所有法律的历史版本
#   - current: 只导入现行版本（默认，当前方案）

set -e

MODE="${1:-current}"

echo "🚀 开始导入法律数据（模式: $MODE）"
echo ""

case $MODE in
  "important")
    echo "📋 模式：重要法律保留历史版本"
    echo "   - 重要法律（约100部）：完整历史版本"
    echo "   - 其他法律：仅现行版本"
    echo "   - 预计增加数据量：5-10%"
    echo ""
    npx tsx scripts/import-data/import-npc-laws-important-versions.ts
    ;;

  "all")
    echo "📋 模式：所有法律保留历史版本"
    echo "   - 所有法律：完整历史版本"
    echo "   - 预计数据量：976,731 条（+43%）"
    echo ""
    read -p "⚠️  这将导入大量数据，是否继续？(y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "已取消"
      exit 0
    fi
    npx tsx scripts/import-data/import-npc-laws-all-versions.ts
    ;;

  "current")
    echo "📋 模式：仅现行版本（当前方案）"
    echo "   - 所有法律：仅现行版本"
    echo "   - 预计数据量：681,722 条"
    echo ""
    npx tsx scripts/import-data/import-npc-laws.ts
    ;;

  *)
    echo "❌ 错误：未知模式 '$MODE'"
    echo ""
    echo "使用方法："
    echo "  bash scripts/import-with-versions.sh [mode]"
    echo ""
    echo "可用模式："
    echo "  important - 重要法律保留历史版本（推荐）"
    echo "  all       - 所有法律保留历史版本"
    echo "  current   - 仅现行版本（默认）"
    exit 1
    ;;
esac

echo ""
echo "✅ 导入完成！"
