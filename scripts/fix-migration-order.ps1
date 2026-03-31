$files = Get-ChildItem -Path prisma/migrations/*/migration.sql | Select-Object -ExpandProperty FullName | Sort-Object

$header = @"
-- ============================================================
-- 律伴助手 - 完整数据库表结构（修正版）
-- 生成时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- 注意: 已修复迁移顺序问题
-- ============================================================
"@

$header | Out-File -FilePath exports/schema_fixed.sql -Encoding UTF8

$delayedMigration = $null
$counter = 1

foreach ($file in $files) {
    $migrationName = Split-Path (Split-Path $file -Parent) -Leaf
    
    # 延迟处理 knowledge_graph_quality_score 迁移（依赖 law_article_relations）
    if ($migrationName -eq '20240224_add_knowledge_graph_quality_score') {
        $delayedMigration = $file
        Write-Host "  延迟处理: $migrationName"
        continue
    }
    
    # 提前处理 law_article_relations 迁移
    if ($migrationName -eq '20260131144309_add_law_article_relations') {
        "`n-- ============================================================`n-- 迁移 #$counter`: $migrationName (提前执行，修复依赖)`n-- ============================================================`n" | Out-File -FilePath exports/schema_fixed.sql -Encoding UTF8 -Append
        Get-Content $file | Out-File -FilePath exports/schema_fixed.sql -Encoding UTF8 -Append
        $counter++
        continue
    }
    
    "`n-- ============================================================`n-- 迁移 #$counter`: $migrationName`n-- ============================================================`n" | Out-File -FilePath exports/schema_fixed.sql -Encoding UTF8 -Append
    Get-Content $file | Out-File -FilePath exports/schema_fixed.sql -Encoding UTF8 -Append
    $counter++
}

# 最后执行被延迟的迁移
if ($delayedMigration) {
    $migrationName = Split-Path (Split-Path $delayedMigration -Parent) -Leaf
    "`n-- ============================================================`n-- 迁移 #$counter`: $migrationName (延后执行，等待依赖表创建)`n-- ============================================================`n" | Out-File -FilePath exports/schema_fixed.sql -Encoding UTF8 -Append
    Get-Content $delayedMigration | Out-File -FilePath exports/schema_fixed.sql -Encoding UTF8 -Append
}

Write-Host "`n✅ 已生成修正版 SQL: exports/schema_fixed.sql"
