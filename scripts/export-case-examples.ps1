# 导出案例库数据为 SQL 文件（Windows PowerShell）
# 用法：在项目根目录运行 .\scripts\export-case-examples.ps1

# 从 .env.development 读取数据库连接
$envFile = Join-Path $PSScriptRoot "..\\.env.development"
$envContent = Get-Content $envFile -ErrorAction SilentlyContinue

$dbUrl = ($envContent | Where-Object { $_ -match "^DATABASE_URL=" }) -replace 'DATABASE_URL="?', '' -replace '"$', ''

if (-not $dbUrl) {
    Write-Host "错误: 无法从 .env.development 读取 DATABASE_URL" -ForegroundColor Red
    exit 1
}

# 解析连接字符串 postgresql://user:pass@host:port/dbname
if ($dbUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)") {
    $DB_USER = $matches[1]
    $DB_PASS = $matches[2]
    $DB_HOST = $matches[3]
    $DB_PORT = $matches[4]
    $DB_NAME = $matches[5]
} else {
    Write-Host "错误: DATABASE_URL 格式无法解析" -ForegroundColor Red
    Write-Host "格式应为: postgresql://user:password@host:port/dbname" -ForegroundColor Yellow
    exit 1
}

$outputFile = Join-Path $PSScriptRoot "..\case_examples.sql"

Write-Host "正在导出案例库数据..." -ForegroundColor Cyan
Write-Host "数据库: $DB_NAME @ $DB_HOST`:$DB_PORT" -ForegroundColor Gray
Write-Host "输出文件: $outputFile" -ForegroundColor Gray

$env:PGPASSWORD = $DB_PASS

# 导出 case_examples 表（含数据，不含 CREATE TABLE，因为迁移会建表）
$args = @(
    "-h", $DB_HOST,
    "-p", $DB_PORT,
    "-U", $DB_USER,
    "-d", $DB_NAME,
    "--table=case_examples",
    "--data-only",
    "--no-owner",
    "--no-acl",
    "--inserts",
    "--file=$outputFile"
)

pg_dump @args

if ($LASTEXITCODE -eq 0) {
    $size = [math]::Round((Get-Item $outputFile).Length / 1MB, 1)
    Write-Host ""
    Write-Host "✓ 导出成功！文件大小：$size MB" -ForegroundColor Green
    Write-Host "文件位置：$outputFile" -ForegroundColor Green
} else {
    Write-Host "✗ 导出失败，请检查 pg_dump 是否已安装（PostgreSQL 客户端工具）" -ForegroundColor Red
    exit 1
}
