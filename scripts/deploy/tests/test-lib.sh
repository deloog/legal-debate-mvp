#!/bin/bash
# lib.sh 公共函数库的测试脚本

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "${DEPLOY_DIR}/config.sh"

# 测试计数
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# 测试断言函数
assert_eq() {
    local expected="$1"
    local actual="$2"
    local message="${3:-Assertion failed}"

    ((TESTS_RUN++))

    if [[ "$expected" == "$actual" ]]; then
        echo -e "${COLOR_GREEN}[PASS]${COLOR_RESET} $message"
        ((TESTS_PASSED++))
    else
        echo -e "${COLOR_RED}[FAIL]${COLOR_RESET} $message"
        echo -e "  期望: $expected"
        echo -e "  实际: $actual"
        ((TESTS_FAILED++))
    fi
}

assert_true() {
    local condition="$1"
    local message="${2:-Assertion failed}"

    ((TESTS_RUN++))

    if eval "$condition"; then
        echo -e "${COLOR_GREEN}[PASS]${COLOR_RESET} $message"
        ((TESTS_PASSED++))
    else
        echo -e "${COLOR_RED}[FAIL]${COLOR_RESET} $message"
        ((TESTS_FAILED++))
    fi
}

assert_false() {
    local condition="$1"
    local message="${2:-Assertion failed}"

    ((TESTS_RUN++))

    if ! eval "$condition"; then
        echo -e "${COLOR_GREEN}[PASS]${COLOR_RESET} $message"
        ((TESTS_PASSED++))
    else
        echo -e "${COLOR_RED}[FAIL]${COLOR_RESET} $message"
        ((TESTS_FAILED++))
    fi
}

# ==================== 测试配置函数 ====================

test_validate_config() {
    echo -e "\n${COLOR_BLUE}测试 validate_config 函数...${COLOR_RESET}"

    # 测试有效的DEPLOY_ENV
    export DEPLOY_ENV="production"
    if validate_config &> /dev/null; then
        assert_true "true" "有效的DEPLOY_ENV应该通过验证"
    else
        assert_true "false" "有效的DEPLOY_ENV应该通过验证"
    fi

    # 测试无效的DEPLOY_ENV
    export DEPLOY_ENV="invalid"
    if ! validate_config 2>/dev/null; then
        assert_true "true" "无效的DEPLOY_ENV应该失败验证"
    else
        assert_true "false" "无效的DEPLOY_ENV应该失败验证"
    fi

    # 恢复有效值
    export DEPLOY_ENV="production"
}

test_get_docker_compose_files() {
    echo -e "\n${COLOR_BLUE}测试 get_docker_compose_files 函数...${COLOR_RESET}"

    # 测试生产环境
    export DEPLOY_ENV="production"
    local files=$(get_docker_compose_files)
    assert_true '[[ "$files" == *"docker-compose.prod.yml"* ]' "生产环境应该包含prod配置文件"

    # 测试开发环境
    export DEPLOY_ENV="development"
    files=$(get_docker_compose_files)
    assert_false '[[ "$files" == *"docker-compose.prod.yml"* ]' "开发环境不应包含prod配置文件"

    # 恢复默认值
    export DEPLOY_ENV="production"
}

# ==================== 测试备份函数 ====================

test_generate_backup_filename() {
    echo -e "\n${COLOR_BLUE}测试 generate_backup_filename 函数...${COLOR_RESET}"

    local filename=$(generate_backup_filename "test")
    assert_true '[[ "$filename" =~ ^legal-debate_test_backup_[0-9]{8}\.sql$ ]' \
        "备份文件名格式应该正确"
}

test_cleanup_old_backups() {
    echo -e "\n${COLOR_BLUE}测试 cleanup_old_backups 函数...${COLOR_RESET}"

    # 创建测试备份目录和测试文件
    local test_backup_dir="${DEPLOY_DIR}/test-backups"
    mkdir -p "$test_backup_dir"

    # 创建测试文件
    touch "${test_backup_dir}/old_backup_20230101.sql"
    touch "${test_backup_dir}/new_backup.sql"

    # 测试清理
    export BACKUP_DIR="$test_backup_dir"
    export BACKUP_RETENTION_DAYS=0

    cleanup_old_backups 0

    # 验证结果
    if [[ -f "${test_backup_dir}/new_backup.sql" ]]; then
        assert_true "true" "新备份文件应该保留"
    else
        assert_true "false" "新备份文件应该保留"
    fi

    if [[ -f "${test_backup_dir}/old_backup_20230101.sql" ]]; then
        assert_true "false" "旧备份文件应该被删除"
    else
        assert_true "true" "旧备份文件应该被删除"
    fi

    # 清理
    rm -rf "$test_backup_dir"

    # 恢复默认值
    export BACKUP_DIR="${PROJECT_ROOT}/backups"
    export BACKUP_RETENTION_DAYS=7
}

# ==================== 测试网络函数 ====================

test_check_network() {
    echo -e "\n${COLOR_BLUE}测试 check_network 函数...${COLOR_RESET}"

    # 测试有效网络连接
    if check_network "www.google.com" 80 5; then
        assert_true "true" "有效网络连接应该成功"
    else
        echo -e "${COLOR_YELLOW}[SKIP]${COLOR_RESET} 网络连接测试（需要互联网）"
    fi

    # 测试无效网络连接
    if ! check_network "invalid-host-that-does-not-exist.com" 80 2; then
        assert_true "true" "无效网络连接应该失败"
    else
        assert_true "false" "无效网络连接应该失败"
    fi
}

test_check_disk_space() {
    echo -e "\n${COLOR_BLUE}测试 check_disk_space 函数...${COLOR_RESET}"

    # 测试小空间需求
    if check_disk_space "$PROJECT_ROOT" 1; then
        assert_true "true" "小空间需求应该通过"
    else
        assert_true "false" "小空间需求应该通过"
    fi

    # 测试大空间需求
    if ! check_disk_space "$PROJECT_ROOT" 10000000; then
        assert_true "true" "超大空间需求应该失败"
    else
        assert_true "false" "超大空间需求应该失败"
    fi
}

# ==================== 测试辅助函数 ====================

test_show_config() {
    echo -e "\n${COLOR_BLUE}测试 show_config 函数...${COLOR_RESET}"

    # 捕获输出
    local output
    output=$(show_config 2>&1)

    # 验证输出包含关键信息
    assert_true '[[ "$output" == *"部署环境"* ]' "输出应包含部署环境"
    assert_true '[[ "$output" == *"应用名称"* ]' "输出应包含应用名称"
    assert_true '[[ "$output" == *"项目根目录"* ]' "输出应包含项目根目录"
}

# ==================== 主测试函数 ====================

run_all_tests() {
    echo -e "${COLOR_BLUE}"
    echo "========================================"
    echo "   lib.sh 公共函数库测试"
    echo "========================================"
    echo -e "${COLOR_RESET}"

    # 执行所有测试
    test_validate_config
    test_get_docker_compose_files
    test_generate_backup_filename
    test_cleanup_old_backups
    test_check_network
    test_check_disk_space
    test_show_config

    # 输出测试结果
    echo ""
    echo -e "${COLOR_BLUE}===== 测试结果 =====${COLOR_RESET}"
    echo -e "总计: ${TESTS_RUN}"
    echo -e "通过: ${COLOR_GREEN}${TESTS_PASSED}${COLOR_RESET}"
    echo -e "失败: ${COLOR_RED}${TESTS_FAILED}${COLOR_RESET}"

    local pass_rate=0
    if ((TESTS_RUN > 0)); then
        pass_rate=$((TESTS_PASSED * 100 / TESTS_RUN))
    fi

    echo -e "通过率: ${pass_rate}%"

    if ((TESTS_FAILED == 0)); then
        echo -e "${COLOR_GREEN}所有测试通过！${COLOR_RESET}"
        return 0
    else
        echo -e "${COLOR_RED}有测试失败！${COLOR_RESET}"
        return 1
    fi
}

# 执行主函数
run_all_tests
