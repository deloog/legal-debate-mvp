# =============================================================================
# 会员系统 API 测试运行脚本 (PowerShell)
# =============================================================================

param(
    [string]$Url = $env:API_BASE_URL,
    [string]$Email = $env:TEST_USER_EMAIL,
    [string]$Password = $env:TEST_USER_PASSWORD,
    [string]$EnvFile,
    [switch]$Help
)

$BASE_URL = if ($Url) { $Url } else { "http://localhost:3000" }
$TEST_EMAIL = if ($Email) { $Email } else { "test@example.com" }
$TEST_PASSWORD = if ($Password) { $Password } else { "test123456" }

$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Cyan = "`e[36m"
$NC = "`e[0m"

if ($Help) {
    Write-Host "${Blue}会员系统 API 测试脚本${NC}"
    Write-Host ""
    Write-Host "用法: .\run-membership-test.ps1 [选项]"
    Write-Host "  -Url URL       API 基础 URL"
    Write-Host "  -Email EMAIL   测试用户邮箱"
    Write-Host "  -Password      测试用户密码"
    Write-Host "  -EnvFile FILE  环境变量文件"
    exit 0
}

Write-Host ""
Write-Host "${Cyan}╔══════════════════════════════════════════════════════════════╗${NC}"
Write-Host "${Cyan}║            👑 会员系统业务场景 API 测试                      ║${NC}"
Write-Host "${Cyan}╚══════════════════════════════════════════════════════════════╝${NC}"
Write-Host ""

$env:API_BASE_URL = $BASE_URL
$env:TEST_USER_EMAIL = $TEST_EMAIL
$env:TEST_USER_PASSWORD = $TEST_PASSWORD

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

Write-Host "${Blue}⚙️  配置:${NC}"
Write-Host "  API: $BASE_URL"
Write-Host "  用户: $TEST_EMAIL"
Write-Host ""

try {
    npx ts-node --project tsconfig.json scripts/api-test/membership-workflow-test.ts
    exit $LASTEXITCODE
} catch {
    Write-Host "${Red}✗ 测试失败: $_${NC}"
    exit 1
}
