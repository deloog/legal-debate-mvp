#!/bin/bash
# 数据库迁移脚本
# 执行数据库迁移和初始化

set -euo pipefail

# 加载公共函数
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

# ==================== 备份数据库 ====================

backup_database() {
    log_info "开始数据库备份..."

    ensure_backup_dir

    local backup_file
    backup_file=$(generate_backup_filename "pre-migrate")
    local backup_path="${BACKUP_DIR}/${backup_file}"

    log_info "备份文件: $backup_file"

    # 使用pg_dump创建备份
    local pgpass_path="${PROJECT_ROOT}/config/.pgpass"

    if [[ -f "$pgpass_path" ]]; then
        export PGPASSFILE="$pgpass_path"
    fi

    if PGPASSWORD="${POSTGRES_PASSWORD:-}" \
        pg_dump "$DATABASE_URL" \
        --no-password \
        --verbose \
        --format=custom \
        --file="$backup_path" \
        --compress=9; then

        local size=$(du -h "$backup_path" | awk '{print $1}')
        log_info "数据库备份成功: ${size}"
        echo "$backup_path"
        return 0
    else
        log_error "数据库备份失败"
        return 1
    fi
}

# ==================== 执行Prisma迁移 ====================

run_migrations() {
    log_info "执行数据库迁移..."

    cd "$PROJECT_ROOT"

    # 生成Prisma客户端
    log_info "生成Prisma客户端..."
    if ! npx prisma generate; then
        log_error "Prisma客户端生成失败"
        return 1
    fi

    # 执行迁移
    log_info "应用数据库迁移..."
    if ! npx prisma migrate deploy; then
        log_error "数据库迁移失败"
        return 1
    fi

    log_info "数据库迁移成功"
    return 0
}

# ==================== 初始化种子数据 ====================

seed_database() {
    log_info "初始化种子数据..."

    cd "$PROJECT_ROOT"

    # 运行seed脚本
    if ! npm run db:seed; then
        log_warn "种子数据初始化失败，可能已存在"
    else
        log_info "种子数据初始化成功"
    fi

    return 0
}

# ==================== 验证迁移 ====================

verify_migration() {
    log_info "验证迁移结果..."

    cd "$PROJECT_ROOT"

    # 检查Prisma客户端状态
    if ! npx prisma db pull --skip-generate; then
        log_error "无法同步数据库模式"
        return 1
    fi

    # 检查数据库连接
    if ! check_database_connection; then
        log_error "数据库连接失败"
        return 1
    fi

    log_info "迁移验证成功"
    return 0
}

# ==================== 回滚迁移 ====================

rollback_migration() {
    local backup_file="${1:-}"

    if [[ -z "$backup_file" ]] || [[ ! -f "$backup_file" ]]; then
        log_error "备份文件不存在: $backup_file"
        return 1
    fi

    log_warn "开始回滚迁移..."

    local pgpass_path="${PROJECT_ROOT}/config/.pgpass"

    if [[ -f "$pgpass_path" ]]; then
        export PGPASSFILE="$pgpass_path"
    fi

    # 停止应用服务
    log_info "停止应用服务..."
    cd "$PROJECT_ROOT"
    $(docker_compose_cmd) $(get_docker_compose_files) stop app || true

    # 恢复数据库
    if PGPASSWORD="${POSTGRES_PASSWORD:-}" \
        pg_restore \
        --no-password \
        --verbose \
        --clean \
        --if-exists \
        --dbname="$DATABASE_URL" \
        "$backup_file"; then
        log_info "数据库回滚成功"
        return 0
    else
        log_error "数据库回滚失败"
        return 1
    fi
}

# ==================== 清理旧备份 ====================

cleanup_migrations() {
    log_info "清理旧备份..."

    local days="${1:-$BACKUP_RETENTION_DAYS}"
    cleanup_old_backups "$days"

    return 0
}

# ==================== 主函数 ====================

main() {
    local auto_rollback="${1:-true}"
    local backup_file=""

    echo -e "${COLOR_BLUE}"
    echo "========================================"
    echo "   数据库迁移脚本"
    echo "========================================"
    echo -e "${COLOR_RESET}"

    # 显示配置
    show_config

    # 验证环境
    if ! validate_config; then
        log_error "配置验证失败"
        exit 1
    fi

    # 备份数据库
    if ! backup_file=$(backup_database); then
        log_error "数据库备份失败，中止迁移"
        exit 1
    fi

    # 执行迁移
    if ! run_migrations; then
        log_error "迁移执行失败"
        if [[ "$auto_rollback" == "true" ]]; then
            log_warn "自动回滚中..."
            rollback_migration "$backup_file" || {
                log_error "自动回滚失败，请手动回滚: $backup_file"
                exit 1
            }
        fi
        exit 1
    fi

    # 初始化种子数据
    if ! seed_database; then
        log_warn "种子数据初始化失败，但不影响迁移"
    fi

    # 验证迁移
    if ! verify_migration; then
        log_error "迁移验证失败"
        if [[ "$auto_rollback" == "true" ]]; then
            log_warn "自动回滚中..."
            rollback_migration "$backup_file" || {
                log_error "自动回滚失败，请手动回滚: $backup_file"
                exit 1
            }
        fi
        exit 1
    fi

    # 清理旧备份
    cleanup_migrations

    echo ""
    echo -e "${COLOR_GREEN}===== 迁移成功 =====${COLOR_RESET}"
    echo "备份文件: $backup_file"
    echo "数据库: $DB_NAME"
    echo -e "${COLOR_GREEN}====================${COLOR_RESET}"
}

# 执行主函数
main "$@"
