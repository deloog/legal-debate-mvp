#!/bin/bash
# 环境检查脚本
# 检查部署环境的各项配置和资源

set -euo pipefail

# 加载公共函数
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

# ==================== 环境变量检查 ====================

check_environment_variables() {
    log_info "检查环境变量..."

    local required_vars=(
        "DATABASE_URL"
        "REDIS_HOST"
        "JWT_SECRET"
    )

    local missing_vars=0

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "缺少必需的环境变量: $var"
            ((missing_vars++))
        else
            log_debug "环境变量 $var 已设置"
        fi
    done

    # 生产环境额外检查
    if [[ "$DEPLOY_ENV" == "production" ]]; then
        local prod_vars=(
            "ZHIPU_API_KEY"
            "DEEPSEEK_API_KEY"
            "POSTGRES_PASSWORD"
            "REDIS_PASSWORD"
        )

        for var in "${prod_vars[@]}"; do
            if [[ -z "${!var:-}" ]]; then
                log_error "生产环境缺少必需的环境变量: $var"
                ((missing_vars++))
            fi
        done
    fi

    if ((missing_vars > 0)); then
        log_error "共缺少 $missing_vars 个必需的环境变量"
        return 1
    fi

    log_info "环境变量检查通过"
    return 0
}

# ==================== 依赖服务检查 ====================

check_dependencies() {
    log_info "检查依赖服务..."

    local errors=0

    # 检查Docker
    if ! check_docker; then
        ((errors++))
    fi

    # 检查Docker Compose
    if ! check_docker_compose; then
        ((errors++))
    fi

    # 检查必需命令
    local required_commands=(
        "node"
        "npm"
        "psql"
        "redis-cli"
    )

    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "缺少必需的命令: $cmd"
            ((errors++))
        else
            log_debug "命令 $cmd 已安装"
        fi
    done

    if ((errors > 0)); then
        log_error "依赖服务检查失败，共 $errors 个错误"
        return 1
    fi

    log_info "依赖服务检查通过"
    return 0
}

# ==================== 系统资源检查 ====================

check_system_resources() {
    log_info "检查系统资源..."

    local errors=0

    # 检查磁盘空间
    if ! check_disk_space "$PROJECT_ROOT" "$MIN_DISK_SPACE_MB"; then
        ((errors++))
    fi

    # 检查内存
    if ! check_memory "$MIN_MEMORY_MB"; then
        ((errors++))
    fi

    # 检查CPU核心数
    local cpu_cores=$(nproc)
    log_info "CPU核心数: $cpu_cores"

    if ((cpu_cores < 2)); then
        log_warn "CPU核心数较少，建议至少2个核心"
    fi

    if ((errors > 0)); then
        log_error "系统资源检查失败，共 $errors 个错误"
        return 1
    fi

    log_info "系统资源检查通过"
    return 0
}

# ==================== 网络检查 ====================

check_network_connectivity() {
    log_info "检查网络连接..."

    local errors=0

    # 检查端口占用
    local ports=(
        "$APP_PORT:应用"
        "$DB_PORT:数据库"
        "$REDIS_PORT:Redis"
    )

    for port_info in "${ports[@]}"; do
        local port="${port_info%%:*}"
        local name="${port_info##*:}"

        if ! check_port "$port" "$name"; then
            ((errors++))
        fi
    done

    # 检查外部网络连接
    if ! check_network "www.google.com" 80 5; then
        log_warn "无法连接到外部网络（可能需要互联网）"
    fi

    if ((errors > 0)); then
        log_error "网络检查失败，共 $errors 个错误"
        return 1
    fi

    log_info "网络检查通过"
    return 0
}

# ==================== 服务状态检查 ====================

check_services_status() {
    log_info "检查服务状态..."

    local errors=0

    # 检查数据库连接
    if ! check_database_connection; then
        log_warn "数据库未运行或无法连接（将在部署时启动）"
    fi

    # 检查Redis连接
    if ! check_redis_connection; then
        log_warn "Redis未运行或无法连接（将在部署时启动）"
    fi

    log_info "服务状态检查完成"
    return 0
}

# ==================== 配置文件检查 ====================

check_config_files() {
    log_info "检查配置文件..."

    local errors=0

    # 检查必需的配置文件
    local required_files=(
        "$DOCKERFILE"
        "$DOCKER_COMPOSE_FILE"
        ".env.production"
    )

    for file in "${required_files[@]}"; do
        if [[ ! -f "$PROJECT_ROOT/$file" ]]; then
            log_error "缺少配置文件: $file"
            ((errors++))
        else
            log_debug "配置文件 $file 存在"
        fi
    done

    if ((errors > 0)); then
        log_error "配置文件检查失败，共 $errors 个错误"
        return 1
    fi

    log_info "配置文件检查通过"
    return 0
}

# ==================== 生成检查报告 ====================

generate_report() {
    log_info "生成环境检查报告..."

    local report_file="${LOG_DIR}/environment-check-report.txt"

    {
        echo "===== 环境检查报告 ====="
        echo "检查时间: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "部署环境: $DEPLOY_ENV"
        echo "项目根目录: $PROJECT_ROOT"
        echo ""
        echo "===== 系统信息 ====="
        echo "操作系统: $(uname -s)"
        echo "内核版本: $(uname -r)"
        echo "CPU核心数: $(nproc)"
        echo "总内存: $(free -h | awk 'NR==2 {print $2}')"
        echo "可用内存: $(free -h | awk 'NR==2 {print $7}')"
        echo "磁盘空间:"
        df -h "$PROJECT_ROOT" | awk 'NR==2 {print "  总容量: "$2", 已用: "$3", 可用: "$4", 使用率: "$5}'
        echo ""
        echo "===== Docker信息 ====="
        docker --version 2>/dev/null || echo "Docker未安装"
        $(docker_compose_cmd) --version 2>/dev/null || echo "Docker Compose未安装"
        echo ""
        echo "===== 网络信息 ====="
        ip addr show 2>/dev/null | grep 'inet ' | head -3 | awk '{print "  " $2}'
        echo ""
        echo "===== 检查完成 ====="
    } > "$report_file"

    log_info "检查报告已生成: $report_file"
}

# ==================== 主函数 ====================

main() {
    echo -e "${COLOR_BLUE}"
    echo "========================================"
    echo "   环境检查脚本"
    echo "========================================"
    echo -e "${COLOR_RESET}"

    # 显示配置
    show_config

    local total_checks=6
    local passed_checks=0

    # 执行检查
    if check_config_files; then
        ((passed_checks++))
    fi

    show_progress $passed_checks $total_checks

    if check_environment_variables; then
        ((passed_checks++))
    fi

    show_progress $passed_checks $total_checks

    if check_dependencies; then
        ((passed_checks++))
    fi

    show_progress $passed_checks $total_checks

    if check_system_resources; then
        ((passed_checks++))
    fi

    show_progress $passed_checks $total_checks

    if check_network_connectivity; then
        ((passed_checks++))
    fi

    show_progress $passed_checks $total_checks

    if check_services_status; then
        ((passed_checks++))
    fi

    complete_progress

    # 生成报告
    generate_report

    # 输出结果
    echo ""
    echo -e "${COLOR_BLUE}===== 检查结果 =====${COLOR_RESET}"
    echo -e "通过: ${COLOR_GREEN}${passed_checks}/${total_checks}${COLOR_RESET}"

    if ((passed_checks == total_checks)); then
        echo -e "${COLOR_GREEN}所有检查通过，可以部署！${COLOR_RESET}"
        return 0
    else
        echo -e "${COLOR_RED}有 $((total_checks - passed_checks)) 个检查未通过，请修复后再部署${COLOR_RESET}"
        return 1
    fi
}

# 执行主函数
main "$@"
