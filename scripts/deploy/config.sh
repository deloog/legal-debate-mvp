#!/bin/bash
# 部署脚本配置文件
# 包含所有部署相关的配置参数

set -euo pipefail

# ==================== 基础配置 ====================
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# 部署环境 (development|staging|production)
export DEPLOY_ENV="${DEPLOY_ENV:-production}"

# 是否启用调试模式
export DEBUG="${DEBUG:-false}"

# ==================== 应用配置 ====================
export APP_NAME="${APP_NAME:-legal-debate}"
export APP_VERSION="${APP_VERSION:-latest}"
export APP_PORT="${APP_PORT:-3000}"
export APP_CONTAINER_NAME="${APP_NAME}-app"

# ==================== Docker配置 ====================
export DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/config/docker-compose.yml"
export DOCKER_COMPOSE_PROD_FILE="${PROJECT_ROOT}/config/docker-compose.prod.yml"
export DOCKERFILE="${PROJECT_ROOT}/Dockerfile"

# ==================== 数据库配置 ====================
export DB_CONTAINER_NAME="${APP_NAME}-postgres"
export DB_PORT="${DB_PORT:-5432}"
export DB_HOST="${DB_HOST:-localhost}"
export DB_NAME="${DB_NAME:-legal_debate_prod}"
export DB_USER="${DB_USER:-postgres}"

# ==================== Redis配置 ====================
export REDIS_CONTAINER_NAME="${APP_NAME}-redis"
export REDIS_PORT="${REDIS_PORT:-6379}"
export REDIS_HOST="${REDIS_HOST:-localhost}"

# ==================== 备份配置 ====================
export BACKUP_DIR="${PROJECT_ROOT}/backups"
export BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

# ==================== 日志配置 ====================
export LOG_DIR="${PROJECT_ROOT}/logs"
export DEPLOY_LOG="${LOG_DIR}/deploy.log"

# ==================== 健康检查配置 ====================
export HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-30}"
export HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-2}"

# ==================== 资源限制配置 ====================
export MIN_DISK_SPACE_MB="${MIN_DISK_SPACE_MB:-1000}"
export MIN_MEMORY_MB="${MIN_MEMORY_MB:-1024}"

# ==================== 颜色输出 ====================
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_RESET='\033[0m'

# ==================== 验证配置 ====================
validate_config() {
    local errors=0

    # 检查必需的环境变量
    if [[ "$DEPLOY_ENV" != "development" ]] && \
       [[ "$DEPLOY_ENV" != "staging" ]] && \
       [[ "$DEPLOY_ENV" != "production" ]]; then
        echo -e "${COLOR_RED}错误: DEPLOY_ENV 必须是 development、staging 或 production${COLOR_RESET}"
        ((errors++))
    fi

    # 检查必要的目录
    local required_dirs=(
        "$BACKUP_DIR"
        "$LOG_DIR"
    )

    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir" || {
                echo -e "${COLOR_RED}错误: 无法创建目录 $dir${COLOR_RESET}"
                ((errors++))
            }
        fi
    done

    # 检查必需的文件
    local required_files=(
        "$DOCKER_COMPOSE_FILE"
        "$DOCKERFILE"
    )

    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            echo -e "${COLOR_RED}错误: 文件不存在 $file${COLOR_RESET}"
            ((errors++))
        fi
    done

    return $errors
}

# ==================== 获取环境特定的配置 ====================
get_docker_compose_files() {
    local files="-f $DOCKER_COMPOSE_FILE"

    if [[ "$DEPLOY_ENV" == "production" ]]; then
        files="$files -f $DOCKER_COMPOSE_PROD_FILE"
    fi

    echo "$files"
}

# ==================== 输出配置信息 ====================
show_config() {
    echo -e "${COLOR_BLUE}===== 部署配置 =====${COLOR_RESET}"
    echo -e "部署环境: ${COLOR_YELLOW}$DEPLOY_ENV${COLOR_RESET}"
    echo -e "应用名称: ${COLOR_YELLOW}$APP_NAME${COLOR_RESET}"
    echo -e "应用版本: ${COLOR_YELLOW}$APP_VERSION${COLOR_RESET}"
    echo -e "项目根目录: ${COLOR_YELLOW}$PROJECT_ROOT${COLOR_RESET}"
    echo -e "备份目录: ${COLOR_YELLOW}$BACKUP_DIR${COLOR_RESET}"
    echo -e "日志目录: ${COLOR_YELLOW}$LOG_DIR${COLOR_RESET}"
    echo -e "${COLOR_BLUE}====================${COLOR_RESET}"
}
