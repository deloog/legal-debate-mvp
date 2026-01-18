#!/bin/bash
# 部署脚本测试运行器
# 运行所有部署脚本测试

set -euo pipefail

# 颜色定义
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_RESET='\033[0m'

# 测试统计
TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0

# ==================== 测试运行器 ====================

run_test() {
    local test_name="$1"
    local test_script="$2"

    echo -e "${COLOR_BLUE}"
    echo "========================================"
    echo "   $test_name"
    echo "========================================"
    echo -e "${COLOR_RESET}"

    # 运行测试
    if bash "$test_script"; then
        return 0
    else
        return 1
    fi
}

# ==================== 主函数 ====================

main() {
    echo -e "${COLOR_BLUE}"
    echo "========================================"
    echo "   部署脚本测试套件"
    echo "========================================"
    echo -e "${COLOR_RESET}"

    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # 测试列表
    local tests=(
        "公共函数库测试:${script_dir}/test-lib.sh"
    )

    local test_count=${#tests[@]}
    local passed_count=0
    local failed_count=0

    # 运行所有测试
    for test_info in "${tests[@]}"; do
        local test_name="${test_info%%:*}"
        local test_script="${test_info##*:}"

        if [[ ! -f "$test_script" ]]; then
            echo -e "${COLOR_YELLOW}[SKIP]${COLOR_RESET} $test_name (文件不存在)"
            continue
        fi

        if run_test "$test_name" "$test_script"; then
            ((passed_count++))
        else
            ((failed_count++))
        fi

        echo ""
    done

    # 输出汇总结果
    echo -e "${COLOR_BLUE}"
    echo "========================================"
    echo "   测试汇总"
    echo "========================================"
    echo -e "${COLOR_RESET}"
    echo -e "总计: $test_count"
    echo -e "通过: ${COLOR_GREEN}${passed_count}${COLOR_RESET}"
    echo -e "失败: ${COLOR_RED}${failed_count}${COLOR_RESET}"

    if ((failed_count == 0)); then
        echo ""
        echo -e "${COLOR_GREEN}所有测试通过！${COLOR_RESET}"
        return 0
    else
        echo ""
        echo -e "${COLOR_RED}有 $failed_count 个测试失败！${COLOR_RESET}"
        return 1
    fi
}

# 执行主函数
main "$@"
