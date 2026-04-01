# =============================================================================
# All Business Scenario API Tests Runner (PowerShell)
# =============================================================================

param(
    [string]$Url = $env:API_BASE_URL,
    [string]$Email = $env:TEST_USER_EMAIL,
    [string]$Password = $env:TEST_USER_PASSWORD,
    [switch]$DebateOnly,
    [switch]$ContractOnly,
    [switch]$MembershipOnly,
    [switch]$KnowledgeGraphOnly,
    [switch]$ConsultationOnly,
    [switch]$Help
)

# Default config
$BASE_URL = if ($Url) { $Url } else { "http://localhost:3000" }
$TEST_EMAIL = if ($Email) { $Email } else { "" }
$TEST_PASSWORD = if ($Password) { $Password } else { "TestPass123" }

# Colors
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Cyan = "`e[36m"
$Magenta = "`e[35m"
$NC = "`e[0m"

# Help
if ($Help) {
    Write-Host "${Blue}Business Scenario API Test Suite${NC}"
    Write-Host ""
    Write-Host "Usage: .\run-all-tests.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Help                    Show help"
    Write-Host "  -Url URL                 API base URL (default: http://localhost:3000)"
    Write-Host "  -Email EMAIL             Test user email"
    Write-Host "  -Password PASS           Test user password"
    Write-Host "  -DebateOnly              Run debate tests only"
    Write-Host "  -ContractOnly            Run contract tests only"
    Write-Host "  -MembershipOnly          Run membership tests only"
    Write-Host "  -KnowledgeGraphOnly      Run knowledge graph tests only"
    Write-Host "  -ConsultationOnly        Run consultation tests only"
    Write-Host ""
    exit 0
}

# Title
Write-Host ""
Write-Host "${Cyan}================================================================${NC}"
Write-Host "${Cyan}              API Test Suite Runner                             ${NC}"
Write-Host "${Cyan}================================================================${NC}"
Write-Host ""

# Environment variables
$env:API_BASE_URL = $BASE_URL
$env:TEST_USER_EMAIL = $TEST_EMAIL
$env:TEST_USER_PASSWORD = $TEST_PASSWORD

# Calculate project root (go up two levels from scripts/api-test/)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptPath)
Set-Location $projectRoot

# Test suites
$testSuites = @()
$runAll = -not ($DebateOnly -or $ContractOnly -or $MembershipOnly -or $KnowledgeGraphOnly -or $ConsultationOnly)

if ($runAll -or $DebateOnly) {
    $testSuites += @{
        Name = "Debate Workflow"
        File = "scripts/api-test/debate-workflow-test.ts"
        User = $TEST_EMAIL
        Desc = "Cases, Debates, Rounds, Arguments, Status Flow"
    }
}

if ($runAll -or $ContractOnly) {
    $testSuites += @{
        Name = "Contract Workflow"
        File = "scripts/api-test/contract-workflow-test.ts"
        User = if ($TEST_EMAIL) { $TEST_EMAIL } else { "lawyer@example.com" }
        Desc = "Contracts, Approval, Signing, Payments, Legal Articles"
    }
}

if ($runAll -or $MembershipOnly) {
    $testSuites += @{
        Name = "Membership Workflow"
        File = "scripts/api-test/membership-workflow-test.ts"
        User = $TEST_EMAIL
        Desc = "Membership Levels, Subscriptions, Usage Stats"
    }
}

if ($runAll -or $KnowledgeGraphOnly) {
    $testSuites += @{
        Name = "Knowledge Graph Workflow"
        File = "scripts/api-test/knowledge-graph-workflow-test.ts"
        User = $TEST_EMAIL
        Desc = "Legal Articles, Relationship Analysis, Path Recommendations"
    }
}

if ($runAll -or $ConsultationOnly) {
    $testSuites += @{
        Name = "Consultation Workflow"
        File = "scripts/api-test/consultation-workflow-test.ts"
        User = $TEST_EMAIL
        Desc = "Consultation Records, Evaluation, Follow-ups"
    }
}

Write-Host "${Blue}Test suites to run:${NC}"
Write-Host ""
foreach ($suite in $testSuites) {
    Write-Host "  ${Cyan}*${NC} $($suite.Name)"
    Write-Host "     File: $($suite.File)"
    Write-Host "     User: $($suite.User)"
    Write-Host ""
}

Write-Host "${Blue}Server config:${NC}"
Write-Host "  API URL: $BASE_URL"
Write-Host ""

# Check server
Write-Host "${Blue}Checking server...${NC}"
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "${Green}OK - Server is running${NC}"
} catch {
    Write-Host "${Yellow}Warning: Cannot connect to server: $BASE_URL${NC}"
    Write-Host "  Make sure server is running: npm run dev"
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -notmatch '^[Yy]$') {
        exit 1
    }
}

Write-Host ""
Write-Host "${Blue}Starting tests...${NC}"
Write-Host "================================================================"
Write-Host ""

$overallResults = @{
    Passed = 0
    Failed = 0
    Total = 0
}

foreach ($suite in $testSuites) {
    Write-Host ""
    Write-Host "${Cyan}----------------------------------------------------------------${NC}"
    Write-Host "${Cyan}  Running: $($suite.Name)${NC}"
    Write-Host "${Cyan}----------------------------------------------------------------${NC}"
    Write-Host ""

    # Set specific user for each test
    $env:TEST_USER_EMAIL = $suite.User

    try {
        npx ts-node --project tsconfig.api-test.json $suite.File
        $exitCode = $LASTEXITCODE
        
        if ($exitCode -eq 0) {
            $overallResults.Passed++
        } else {
            $overallResults.Failed++
        }
        $overallResults.Total++
    } catch {
        Write-Host "${Red}Test suite failed: $_${NC}"
        $overallResults.Failed++
        $overallResults.Total++
    }

    Write-Host ""
    Write-Host "${Cyan}----------------------------------------------------------------${NC}"
}

# Summary
Write-Host ""
Write-Host "================================================================"
Write-Host ""
Write-Host "${Cyan}======================== Test Summary ==========================${NC}"

foreach ($suite in $testSuites) {
    $status = if ($overallResults.Passed -gt 0) { "${Green}PASS${NC}" } else { "${Red}FAIL${NC}" }
    Write-Host "  $status - $($suite.Name)"
}

Write-Host "${Cyan}----------------------------------------------------------------${NC}"
Write-Host "  Total: $($overallResults.Total) suites"
Write-Host "  Passed: ${Green}$($overallResults.Passed)${NC}"
Write-Host "  Failed: ${Red}$($overallResults.Failed)${NC}"
Write-Host "${Cyan}================================================================${NC}"
Write-Host ""

if ($overallResults.Failed -eq 0) {
    Write-Host "${Green}All test suites passed!${NC}"
    exit 0
} else {
    Write-Host "${Red}Some test suites failed. See logs above.${NC}"
    exit 1
}
