# 文档重组脚本
# 用途：自动化文档目录整理
# 使用方法：.\scripts\reorganize-docs.ps1 [-DryRun] [-Backup]

param(
    [switch]$DryRun = $false,    # 仅预览，不实际移动
    [switch]$Backup = $true      # 是否备份
)

$ErrorActionPreference = "Stop"

Write-Host "📚 文档重组脚本" -ForegroundColor Cyan
Write-Host "==================`n" -ForegroundColor Cyan

# 1. 备份
if ($Backup -and -not $DryRun) {
    $backupDir = "docs-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Host "📦 创建备份: $backupDir" -ForegroundColor Yellow
    Copy-Item -Path "docs" -Destination $backupDir -Recurse
    Write-Host "✅ 备份完成`n" -ForegroundColor Green
}

# 2. 创建新目录结构
$newDirs = @(
    "docs/guides/development",
    "docs/guides/deployment",
    "docs/guides/operations",
    "docs/guides/user",
    "docs/features/docanalyzer",
    "docs/features/knowledge-graph",
    "docs/features/debate",
    "docs/features/auth",
    "docs/development/setup",
    "docs/development/api",
    "docs/development/testing",
    "docs/development/tools",
    "docs/operations/deployment",
    "docs/operations/monitoring",
    "docs/operations/troubleshooting",
    "docs/reports/2026-01/week1",
    "docs/reports/2026-01/week2",
    "docs/reports/2026-01/week3",
    "docs/reports/2026-01/week4",
    "docs/reports/2026-02/week1",
    "docs/reports/2026-02/week2",
    "docs/archive/2025/sprints",
    "docs/archive/2025/optimization",
    "docs/archive/2025/migration",
    "docs/archive/2025/stages",
    "docs/archive/deprecated",
    "docs/project-management/sprints/sprint-11",
    "docs/project-management/sprints/sprint-12",
    "docs/project-management/sprints/current",
    "docs/project-management/roadmap",
    "docs/project-management/business"
)

Write-Host "📁 创建目录结构..." -ForegroundColor Yellow
foreach ($dir in $newDirs) {
    if (-not (Test-Path $dir)) {
        if ($DryRun) {
            Write-Host "  [DRY-RUN] 将创建: $dir" -ForegroundColor Gray
        } else {
            New-Item -Path $dir -ItemType Directory -Force | Out-Null
            Write-Host "  ✓ 创建: $dir" -ForegroundColor Green
        }
    }
}
Write-Host ""

# 3. 文件迁移映射
$migrations = @(
    # Guides
    @{From="docs/AI_ASSISTANT_QUICK_START.md"; To="docs/guides/development/ai-assistant-guide.md"},
    @{From="docs/API_DEVELOPMENT_GUIDE.md"; To="docs/guides/development/api-development.md"},
    @{From="docs/TESTING_GUIDE.md"; To="docs/guides/development/testing-guide.md"},
    @{From="docs/DATA_IMPORT_USER_GUIDE.md"; To="docs/guides/user/data-import.md"},
    @{From="docs/VERSION_MANAGEMENT_QUICK_GUIDE.md"; To="docs/guides/user/version-management.md"},
    @{From="docs/SERVER_DEPLOYMENT_QUICK_GUIDE.md"; To="docs/guides/deployment/server-deployment.md"},
    @{From="docs/DATABASE_OPTIMIZATION_GUIDE.md"; To="docs/guides/operations/database-optimization.md"},
    @{From="docs/DATA_MIGRATION_DEPLOYMENT_GUIDE.md"; To="docs/guides/deployment/data-migration.md"},

    # Development
    @{From="docs/ENVIRONMENT_VARIABLES.md"; To="docs/development/setup/environment-variables.md"},
    @{From="docs/API_PATHS_MIGRATION.md"; To="docs/development/api/api-migration.md"},
    @{From="docs/AI_BEHAVIOR_RULES_GUIDE.md"; To="docs/development/tools/ai-behavior-rules.md"},
    @{From="docs/AI_TYPE_SAFETY_GUIDE.md"; To="docs/development/tools/ai-type-safety.md"},
    @{From="docs/TEST_DATA_FACTORY_GUIDE.md"; To="docs/development/testing/test-data-factory.md"},
    @{From="docs/E2E_AI_CONFIG_GUIDE.md"; To="docs/development/testing/e2e-ai-config.md"},

    # Features - Knowledge Graph
    @{From="docs/KNOWLEDGE_GRAPH_APPLICATION_GUIDE.md"; To="docs/features/knowledge-graph/application-guide.md"},
    @{From="docs/KNOWLEDGE_GRAPH_IMPLEMENTATION_ROADMAP.md"; To="docs/features/knowledge-graph/implementation-roadmap.md"},
    @{From="docs/CONTRACT_LAW_ARTICLE_ASSOCIATION_USAGE.md"; To="docs/features/knowledge-graph/contract-law-usage.md"},

    # Features - Debate
    @{From="docs/DEBATE_RECOMMENDATION_IMPLEMENTATION.md"; To="docs/features/debate/recommendation-implementation.md"},

    # Operations
    @{From="docs/deployment/DEPLOYMENT_CHECKLIST.md"; To="docs/operations/deployment/deployment-checklist.md"},
    @{From="docs/deployment/docker-compose.md"; To="docs/operations/deployment/docker-compose.md"},
    @{From="docs/deployment/PRODUCTION_CONFIG_GUIDE.md"; To="docs/operations/deployment/production-config.md"},
    @{From="docs/monitoring/SYSTEM_MONITORING_IMPLEMENTATION.md"; To="docs/operations/monitoring/system-monitoring.md"},

    # Reports - 2026-02 (最近的)
    @{From="docs/COMPLETE_WORK_SUMMARY.md"; To="docs/reports/2026-02/week1/complete-work-summary.md"},
    @{From="docs/FINAL_SUMMARY.md"; To="docs/reports/2026-02/week1/final-summary.md"},
    @{From="docs/WORK_SUMMARY.md"; To="docs/reports/2026-02/week1/work-summary.md"},
    @{From="docs/FINAL_COMPLETION_REPORT.md"; To="docs/reports/2026-02/week1/final-completion-report.md"},
    @{From="docs/FINAL_SUMMARY_REPORT.md"; To="docs/reports/2026-02/week1/final-summary-report.md"},
    @{From="docs/COMPLETE_IMPLEMENTATION_SUMMARY.md"; To="docs/reports/2026-02/week1/complete-implementation-summary.md"},
    @{From="docs/COMPLETE_MIGRATION_SUMMARY.md"; To="docs/reports/2026-02/week1/complete-migration-summary.md"},
    @{From="docs/USER_FEEDBACK_INTEGRATION_COMPLETION_REPORT.md"; To="docs/reports/2026-02/week1/user-feedback-integration.md"},

    # Reports - 2026-01 (上月的)
    @{From="docs/CODE_QUALITY_FIX_FINAL_REPORT.md"; To="docs/reports/2026-01/week4/code-quality-fix-final.md"},
    @{From="docs/CODE_QUALITY_FIX_REPORT.md"; To="docs/reports/2026-01/week4/code-quality-fix.md"},
    @{From="docs/CODE_QUALITY_FIX_REPORT_PHASE2.md"; To="docs/reports/2026-01/week4/code-quality-fix-phase2.md"},
    @{From="docs/CRITICAL_FIXES_COMPLETION_REPORT.md"; To="docs/reports/2026-01/week4/critical-fixes-completion.md"},
    @{From="docs/TYPE_CONSISTENCY_FIX_DESIGN.md"; To="docs/reports/2026-01/week3/type-consistency-fix-design.md"},
    @{From="docs/TYPE_ERRORS_FIX_SUMMARY.md"; To="docs/reports/2026-01/week3/type-errors-fix-summary.md"},
    @{From="docs/COMPREHENSIVE_TYPE_CONSISTENCY_FIX_SUMMARY.md"; To="docs/reports/2026-01/week3/type-consistency-fix-comprehensive.md"},

    # Archive - 2025 Stages
    @{From="docs/stage1-completion-report.md"; To="docs/archive/2025/stages/stage1-completion-report.md"},
    @{From="docs/stage1-2-completion-report.md"; To="docs/archive/2025/stages/stage1-2-completion-report.md"},
    @{From="docs/STAGE2_COMPLETION_SUMMARY.md"; To="docs/archive/2025/stages/stage2-completion-summary.md"},
    @{From="docs/STAGE3_COMPLETION_SUMMARY.md"; To="docs/archive/2025/stages/stage3-completion-summary.md"},
    @{From="docs/stage3-completion-report.md"; To="docs/archive/2025/stages/stage3-completion-report.md"},
    @{From="docs/STAGE2_STAGE3_FINAL_SUMMARY.md"; To="docs/archive/2025/stages/stage2-3-final-summary.md"},

    # Archive - Optimization
    @{From="docs/OPTIMIZATION_PLAN.md"; To="docs/archive/2025/optimization/optimization-plan.md"},
    @{From="docs/OPTIMIZATION_PROGRESS.md"; To="docs/archive/2025/optimization/optimization-progress.md"},
    @{From="docs/FINAL_OPTIMIZATION_REPORT.md"; To="docs/archive/2025/optimization/final-optimization-report.md"},
    @{From="docs/FOLLOW_UP_OPTIMIZATION_REPORT.md"; To="docs/archive/2025/optimization/follow-up-optimization-report.md"},

    # Business
    @{From="docs/business/BUSINESS_REQUIREMENTS.md"; To="docs/project-management/business/business-requirements.md"}
)

# 4. 执行迁移
Write-Host "🚚 开始文件迁移..." -ForegroundColor Yellow
$movedCount = 0
$skippedCount = 0

foreach ($migration in $migrations) {
    if (Test-Path $migration.From) {
        if ($DryRun) {
            Write-Host "  [DRY-RUN] $($migration.From) → $($migration.To)" -ForegroundColor Gray
        } else {
            try {
                Move-Item -Path $migration.From -Destination $migration.To -Force
                Write-Host "  ✓ $($migration.From) → $($migration.To)" -ForegroundColor Green
                $movedCount++
            } catch {
                Write-Host "  ✗ 失败: $($migration.From) - $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  ⊘ 跳过(不存在): $($migration.From)" -ForegroundColor DarkGray
        $skippedCount++
    }
}

Write-Host ""
Write-Host "📊 迁移统计" -ForegroundColor Cyan
Write-Host "  已迁移: $movedCount 个文件" -ForegroundColor Green
Write-Host "  已跳过: $skippedCount 个文件" -ForegroundColor Yellow

# 5. 移动整个目录
Write-Host "`n📦 移动目录..." -ForegroundColor Yellow

$dirMigrations = @(
    @{From="docs/docanalyzer"; To="docs/features/docanalyzer-old"},
    @{From="docs/task-tracking"; To="docs/project-management/sprints/sprint-11"}
)

foreach ($dirMigration in $dirMigrations) {
    if (Test-Path $dirMigration.From) {
        if ($DryRun) {
            Write-Host "  [DRY-RUN] $($dirMigration.From) → $($dirMigration.To)" -ForegroundColor Gray
        } else {
            Move-Item -Path $dirMigration.From -Destination $dirMigration.To -Force
            Write-Host "  ✓ $($dirMigration.From) → $($dirMigration.To)" -ForegroundColor Green
        }
    }
}

# 6. 创建 README 文件
Write-Host "`n📝 创建 README 文件..." -ForegroundColor Yellow

$readmes = @(
    @{Path="docs/reports/README.md"; Content="# 报告存档`n`n按时间组织的项目报告。`n"},
    @{Path="docs/archive/README.md"; Content="# 文档归档`n`n历史和已废弃的文档。`n"},
    @{Path="docs/features/README.md"; Content="# 功能专题`n`n各功能模块的详细文档。`n"}
)

foreach ($readme in $readmes) {
    if (-not (Test-Path $readme.Path)) {
        if ($DryRun) {
            Write-Host "  [DRY-RUN] 创建: $($readme.Path)" -ForegroundColor Gray
        } else {
            Set-Content -Path $readme.Path -Value $readme.Content -Encoding UTF8
            Write-Host "  ✓ 创建: $($readme.Path)" -ForegroundColor Green
        }
    }
}

# 7. 完成
Write-Host "`n✅ 文档重组完成！" -ForegroundColor Green

if ($DryRun) {
    Write-Host "`n💡 这是预览模式。要实际执行，请运行: .\scripts\reorganize-docs.ps1" -ForegroundColor Yellow
} else {
    Write-Host "`n📌 后续步骤:" -ForegroundColor Cyan
    Write-Host "  1. 检查迁移结果" -ForegroundColor White
    Write-Host "  2. 更新文档内部链接" -ForegroundColor White
    Write-Host "  3. 更新 docs/README.md" -ForegroundColor White
    Write-Host "  4. 提交更改到 git" -ForegroundColor White
}
