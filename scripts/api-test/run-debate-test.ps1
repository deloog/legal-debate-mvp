# =============================================================================
# 辩论业务场景 API 测试运行脚本 (PowerShell)
# =============================================================================

param(
    [string]$Url = $env:API_BASE_URL,
    [string]$Email = $env:TEST_USER_EMAIL,
    [string]$Password = $env:TEST_USER_PASSWORD,
    [string]$EnvFile,
    [switch]$Help
)

# 默认配置
$BASE_URL = if ($Url) { $Url } else { "http://localhost:3000" }
$TEST_EMAIL = if ($Email) { $Email } else { "" }
$TEST_PASSWORD = if ($Password) { $Password } else { "TestPass123" }

# 颜色定义
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$NC = "`e[0m"

# 帮助信息
if ($Help) {
    Write-Host "${Blue}辩论业务场景 API 测试脚本 (PowerShell)${NC}"
    Write-Host ""
    Write-Host "用法: .\run-debate-test.ps1 [选项]"
    Write-Host ""
    Write-Host "选项:"
    Write-Host "  -Help                    显示帮助信息"
    Write-Host "  -Url URL                 设置 API 基础 URL (默认: http://localhost:3000)"
    Write-Host "  -Email EMAIL             设置测试用户邮箱"
    Write-Host "  -Password PASS           设置测试用户密码"
    Write-Host "  -EnvFile FILE            指定环境变量文件"
    Write-Host ""
    Write-Host "环境变量:"
    Write-Host "  API_BASE_URL             API 基础 URL"
    Write-Host "  TEST_USER_EMAIL          测试用户邮箱"
    Write-Host "  TEST_USER_PASSWORD       测试用户密码"
    Write-Host ""
    Write-Host "示例:"
    Write-Host "  .\run-debate-test.ps1                                    # 使用默认配置运行"
    Write-Host "  .\run-debate-test.ps1 -Url http://localhost:3001         # 指定不同的端口"
    Write-Host "  .\run-debate-test.ps1 -Email admin@example.com -Password admin123"
    exit 0
}

# 加载环境变量文件
if ($EnvFile) {
    if (Test-Path $EnvFile) {
        Get-Content $EnvFile | ForEach-Object {
            if ($_ -match '^([^#][^=]*)=(.*)$') {
                [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
            }
        }
        Write-Host "${Green}✓ 已加载环境变量文件: $EnvFile${NC}"
    } else {
        Write-Host "${Red}✗ 环境变量文件不存在: $EnvFile${NC}"
        exit 1
    }
}

# 检查 Node.js
Write-Host "${Blue}🔍 检查环境...${NC}"
try {
    $NODE_VERSION = node -v
    Write-Host "${Green}✓ Node.js: $NODE_VERSION${NC}"
} catch {
    Write-Host "${Red}✗ Node.js 未安装${NC}"
    exit 1
}

# 检查 ts-node
try {
    $null = npx ts-node --version 2>$null
    Write-Host "${Green}✓ ts-node 已就绪${NC}"
} catch {
    Write-Host "${Yellow}⚠️  ts-node 未安装，尝试安装...${NC}"
    npm install -g ts-node typescript
}

# 显示配置
Write-Host ""
Write-Host "${Blue}⚙️  测试配置:${NC}"
Write-Host "  API 基础 URL: $BASE_URL"
Write-Host "  测试用户: $TEST_EMAIL"
Write-Host ""

# 检查服务器是否可连接
Write-Host "${Blue}🔌 检查服务器连接...${NC}"
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "${Green}✓ 服务器连接正常${NC}"
} catch {
    Write-Host "${Yellow}⚠️  无法连接到服务器: $BASE_URL${NC}"
    Write-Host "  请确保服务器正在运行:"
    Write-Host "    npm run dev"
    Write-Host ""
    $continue = Read-Host "是否继续尝试? (y/N)"
    if ($continue -notmatch '^[Yy]$') {
        exit 1
    }
}

# 运行测试
Write-Host ""
Write-Host "${Blue}🚀 开始运行辩论业务场景 API 测试...${NC}"
Write-Host "================================================================"
Write-Host ""

$env:API_BASE_URL = $BASE_URL
$env:TEST_USER_EMAIL = $TEST_EMAIL
$env:TEST_USER_PASSWORD = $TEST_PASSWORD
$env:NODE_ENV = 'test'

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptPath)
Set-Location $projectRoot

try {
    npx ts-node --project tsconfig.api-test.json scripts/api-test/debate-workflow-test.ts
    $TEST_EXIT_CODE = $LASTEXITCODE
} catch {
    Write-Host "${Red}✗ 测试执行失败: $_${NC}"
    $TEST_EXIT_CODE = 1
}

Write-Host ""
Write-Host "================================================================"
if ($TEST_EXIT_CODE -eq 0) {
    Write-Host "${Green}✅ 所有测试通过!${NC}"
} else {
    Write-Host "${Red}❌ 测试失败，请查看上方错误信息${NC}"
}

exit $TEST_EXIT_CODE
