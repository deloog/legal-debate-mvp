#!/bin/bash
# 应用部署脚本
# 构建和部署应用到生产环境

set -euo pipefail

# 加载公共函数
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

# ==================== 构建应用 ====================

build_application() {
    log_info "开始构建应用..."

    cd "$PROJECT_ROOT"

    # 清理旧构建
    log_debug "清理旧构建..."
    rm -rf .next || true

    # 安装依赖
    log_info "安装依赖..."
    if ! npm ci --only=production; then
        log_error "依赖安装失败"
        return 1
    fi

    # 构建Next.js应用
    log_info "构建Next.js应用..."
    if ! npm run build; then
        log_error "应用构建失败"
        return 1
    fi

    log_info "应用构建成功"
    return 0
}

# ==================== 构建Docker镜像 ====================

build_docker_image() {
    log_info "构建Docker镜像..."

    cd "$PROJECT_ROOT"

    local docker_cmd=$(docker_compose_cmd)

    # 使用docker-compose构建
    if ! $docker_cmd $(get_docker_compose_files) build app; then
        log_error "Docker镜像构建失败"
        return 1
    fi

    log_info "Docker镜像构建成功"
    return 0
}

# ==================== 停止旧容器 ====================

stop_old_containers() {
    log_info "停止旧容器..."

    cd "$PROJECT_ROOT"
    local docker_cmd=$(docker_compose_cmd)

    # 停止应用容器
    $docker_cmd $(get_docker_compose_files) stop app || true

    log_info "旧容器已停止"
    return 0
}

# ==================== 启动新容器 ====================

start_new_containers() {
    log_info "启动新容器..."

    cd "$PROJECT_ROOT"
    local docker_cmd=$(docker_compose_cmd)

    # 启动服务
    if ! $docker_cmd $(get_docker_compose_files) up -d; then
        log_error "容器启动失败"
        return 1
    fi

    log_info "容器启动成功"
    return 0
}

# ==================== 健康检查 ====================

health_check() {
    log_info "执行健康检查..."

    local health_url="http://localhost:${APP_PORT}/api/health"

    # 等待应用容器健康
    if container_exists "$APP_CONTAINER_NAME"; then
        if ! wait_for_container_health "$APP_CONTAINER_NAME"; then
            log_warn "容器健康检查超时"
        fi
    fi

    # HTTP健康检查
    if ! http_health_check "$health_url"; then
        log_error "HTTP健康检查失败"
        return 1
    fi

    log_info "健康检查通过"
    return 0
}

# ==================== 清理资源 ====================

cleanup_resources() {
    log_info "清理Docker资源..."

    # 清理未使用的镜像
    docker image prune -f &> /dev/null || true

    # 清理未使用的容器
    docker container prune -f &> /dev/null || true

    # 清理未使用的网络
    docker network prune -f &> /dev/null || true

    log_info "Docker资源清理完成"
    return 0
}

# ==================== 回滚部署 ====================

rollback_deployment() {
    log_warn "开始回滚部署..."

    cd "$PROJECT_ROOT"
    local docker_cmd=$(docker_compose_cmd)

    # 停止当前容器
    $docker_cmd $(get_docker_compose_files) down || true

    # 重启到上一个版本
    log_info "重启到上一个版本..."
    if [[ -f "$PROJECT_ROOT/.previous-version" ]]; then
        export APP_VERSION=$(cat "$PROJECT_ROOT/.previous-version")
        $docker_cmd $(get_docker_compose_files) up -d

        log_info "部署已回滚"
        return 0
    else
        log_error "找不到上一个版本信息"
        return 1
    fi
}

# ==================== 验证部署 ====================

verify_deployment() {
    log_info "验证部署..."

    # 检查容器状态
    if ! container_running "$APP_CONTAINER_NAME"; then
        log_error "应用容器未运行"
        return 1
    fi

    # 检查数据库连接
    if ! check_database_connection; then
        log_error "无法连接到数据库"
        return 1
    fi

    # 检查Redis连接
    if ! check_redis_connection; then
        log_error "无法连接到Redis"
        return 1
    fi

    # 检查应用健康
    if ! health_check; then
        log_error "应用健康检查失败"
        return 1
    fi

    log_info "部署验证成功"
    return 0
}

# ==================== 主函数 ====================

main() {
    local auto_rollback="${1:-true}"

    echo -e "${COLOR_BLUE}"
    echo "========================================"
    echo "   应用部署脚本"
    echo "========================================"
    echo -e "${COLOR_RESET}"

    # 显示配置
    show_config

    # 验证环境
    if ! validate_config; then
        log_error "配置验证失败"
        exit 1
    fi

    # 保存当前版本
    if [[ -f "$PROJECT_ROOT/.current-version" ]]; then
        cp "$PROJECT_ROOT/.current-version" "$PROJECT_ROOT/.previous-version"
        log_debug "当前版本已保存为上一个版本"
    fi

    # 保存新版本
    echo "$APP_VERSION" > "$PROJECT_ROOT/.current-version"

    # 构建应用
    if ! build_application; then
        log_error "应用构建失败，中止部署"
        exit 1
    fi

    # 构建Docker镜像
    if ! build_docker_image; then
        log_error "Docker镜像构建失败，中止部署"
        exit 1
    fi

    # 停止旧容器
    stop_old_containers

    # 启动新容器
    if ! start_new_containers; then
        log_error "容器启动失败"
        if [[ "$auto_rollback" == "true" ]]; then
            log_warn "自动回滚中..."
            rollback_deployment || exit 1
        fi
        exit 1
    fi

    # 健康检查
    if ! health_check; then
        log_error "健康检查失败"
        if [[ "$auto_rollback" == "true" ]]; then
            log_warn "自动回滚中..."
            rollback_deployment || exit 1
        fi
        exit 1
    fi

    # 验证部署
    if ! verify_deployment; then
        log_error "部署验证失败"
        if [[ "$auto_rollback" == "true" ]]; then
            log_warn "自动回滚中..."
            rollback_deployment || exit 1
        fi
        exit 1
    fi

    # 清理资源
    cleanup_resources

    echo ""
    echo -e "${COLOR_GREEN}===== 部署成功 =====${COLOR_RESET}"
    echo "应用: $APP_NAME"
    echo "版本: $APP_VERSION"
    echo "环境: $DEPLOY_ENV"
    echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo -e "${COLOR_GREEN}====================${COLOR_RESET}"
}

# 执行主函数
main "$@"
