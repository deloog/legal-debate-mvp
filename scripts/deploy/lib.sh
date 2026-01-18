#!/bin/bash
# 部署脚本公共函数库
# 包含所有共享的辅助函数

set -euo pipefail

# 加载配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

# ==================== 日志函数 ====================

# 日志函数
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # 输出到控制台
    case "$level" in
        "INFO")
            echo -e "${COLOR_GREEN}[INFO]${COLOR_RESET} $timestamp - $message"
            ;;
        "WARN")
            echo -e "${COLOR_YELLOW}[WARN]${COLOR_RESET} $timestamp - $message"
            ;;
        "ERROR")
            echo -e "${COLOR_RED}[ERROR]${COLOR_RESET} $timestamp - $message" >&2
            ;;
        "DEBUG")
            if [[ "$DEBUG" == "true" ]]; then
                echo -e "${COLOR_BLUE}[DEBUG]${COLOR_RESET} $timestamp - $message"
            fi
            ;;
        *)
            echo "[INFO] $timestamp - $message"
            ;;
    esac

    # 输出到日志文件
    if [[ -n "$DEPLOY_LOG" ]]; then
        echo "[$level] $timestamp - $message" >> "$DEPLOY_LOG"
    fi
}

log_info() {
    log "INFO" "$@"
}

log_warn() {
    log "WARN" "$@"
}

log_error() {
    log "ERROR" "$@"
}

log_debug() {
    log "DEBUG" "$@"
}

# ==================== 命令执行函数 ====================

# 执行命令并处理错误
run_command() {
    local cmd="$*"
    log_debug "执行命令: $cmd"

    if eval "$cmd"; then
        return 0
    else
        local exit_code=$?
        log_error "命令执行失败 (退出码: $exit_code): $cmd"
        return $exit_code
    fi
}

# 静默执行命令
run_command_silent() {
    local cmd="$*"
    log_debug "静默执行命令: $cmd"

    if eval "$cmd" > /dev/null 2>&1; then
        return 0
    else
        local exit_code=$?
        log_debug "命令执行失败 (退出码: $exit_code): $cmd"
        return $exit_code
    fi
}

# ==================== Docker相关函数 ====================

# 检查Docker是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装"
        return 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker未运行"
        return 1
    fi

    log_info "Docker已安装并运行"
    return 0
}

# 检查Docker Compose是否安装
check_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        log_info "Docker Compose已安装 (独立版本)"
        return 0
    elif docker compose version &> /dev/null; then
        log_info "Docker Compose已安装 (Docker插件版本)"
        return 0
    else
        log_error "Docker Compose未安装"
        return 1
    fi
}

# 获取Docker Compose命令
docker_compose_cmd() {
    if command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    else
        echo "docker compose"
    fi
}

# 检查容器是否存在
container_exists() {
    local container_name="$1"
    docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"
}

# 检查容器是否运行
container_running() {
    local container_name="$1"
    docker ps --format '{{.Names}}' | grep -q "^${container_name}$"
}

# 等待容器健康
wait_for_container_health() {
    local container_name="$1"
    local max_retries="${2:-$HEALTH_CHECK_RETRIES}"
    local interval="${3:-$HEALTH_CHECK_INTERVAL}"

    log_info "等待容器 $container_name 变为健康状态..."

    for ((i=0; i<max_retries; i++)); do
        local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "none")

        case "$health_status" in
            "healthy")
                log_info "容器 $container_name 已健康"
                return 0
                ;;
            "unhealthy")
                log_error "容器 $container_name 不健康"
                return 1
                ;;
            *)
                log_debug "容器状态: $health_status (${i}/${max_retries})"
                ;;
        esac

        sleep "$interval"
    done

    log_error "等待容器健康超时: $container_name"
    return 1
}

# ==================== 网络相关函数 ====================

# 检查端口是否被占用
check_port() {
    local port="$1"
    local service_name="${2:-服务}"

    if lsof -Pi :"$port" -sTCP:LISTEN -t &> /dev/null; then
        log_error "端口 $port 已被占用 (${service_name})"
        return 1
    fi

    log_info "端口 $port 可用"
    return 0
}

# 检查网络连接
check_network() {
    local host="$1"
    local port="${2:-80}"
    local timeout="${3:-5}"

    log_debug "检查网络连接: $host:$port"

    if timeout "$timeout" bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null; then
        log_info "网络连接正常: $host:$port"
        return 0
    else
        log_error "网络连接失败: $host:$port"
        return 1
    fi
}

# ==================== 系统资源函数 ====================

# 检查磁盘空间
check_disk_space() {
    local path="${1:-$PROJECT_ROOT}"
    local min_mb="${2:-$MIN_DISK_SPACE_MB}"

    local available_mb=$(df -m "$path" | awk 'NR==2 {print $4}')

    if ((available_mb < min_mb)); then
        log_error "磁盘空间不足: ${available_mb}MB < ${min_mb}MB"
        return 1
    fi

    log_info "磁盘空间充足: ${available_mb}MB"
    return 0
}

# 检查内存
check_memory() {
    local min_mb="${1:-$MIN_MEMORY_MB}"

    local total_mb=$(free -m | awk 'NR==2 {print $2}')
    local available_mb=$(free -m | awk 'NR==2 {print $7}')

    if ((available_mb < min_mb)); then
        log_error "内存不足: ${available_mb}MB < ${min_mb}MB"
        return 1
    fi

    log_info "内存充足: 总计 ${total_mb}MB, 可用 ${available_mb}MB"
    return 0
}

# ==================== 数据库相关函数 ====================

# 检查数据库连接
check_database_connection() {
    local host="${1:-$DB_HOST}"
    local port="${2:-$DB_PORT}"
    local user="${3:-$DB_USER}"
    local db="${4:-$DB_NAME}"

    log_debug "检查数据库连接: $user@$host:$port/$db"

    if PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "$host" -p "$port" -U "$user" -d "$db" -c 'SELECT 1' &> /dev/null; then
        log_info "数据库连接正常"
        return 0
    else
        log_error "数据库连接失败"
        return 1
    fi
}

# ==================== Redis相关函数 ====================

# 检查Redis连接
check_redis_connection() {
    local host="${1:-$REDIS_HOST}"
    local port="${2:-$REDIS_PORT}"

    log_debug "检查Redis连接: $host:$port"

    if redis-cli -h "$host" -p "$port" -a "${REDIS_PASSWORD:-}" ping &> /dev/null; then
        log_info "Redis连接正常"
        return 0
    else
        log_error "Redis连接失败"
        return 1
    fi
}

# ==================== HTTP相关函数 ====================

# HTTP健康检查
http_health_check() {
    local url="$1"
    local max_retries="${2:-$HEALTH_CHECK_RETRIES}"
    local interval="${3:-$HEALTH_CHECK_INTERVAL}"

    log_info "执行HTTP健康检查: $url"

    for ((i=0; i<max_retries; i++)); do
        local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

        if [[ "$response" == "200" ]]; then
            log_info "HTTP健康检查通过"
            return 0
        else
            log_debug "HTTP状态码: $response (${i}/${max_retries})"
        fi

        sleep "$interval"
    done

    log_error "HTTP健康检查失败: $url"
    return 1
}

# ==================== 备份相关函数 ====================

# 创建备份目录
ensure_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        log_info "创建备份目录: $BACKUP_DIR"
    fi
}

# 生成备份文件名
generate_backup_filename() {
    local type="$1"
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    echo "${APP_NAME}_${type}_backup_${timestamp}.sql"
}

# 清理旧备份
cleanup_old_backups() {
    local days="${1:-$BACKUP_RETENTION_DAYS}"
    local count=0

    log_info "清理 ${days} 天前的旧备份..."

    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((count++))
    done < <(find "$BACKUP_DIR" -name "*.sql" -type f -mtime +"$days" -print0)

    log_info "清理了 $count 个旧备份文件"
}

# ==================== 错误处理函数 ====================

# 错误处理函数
error_handler() {
    local line_number=$1
    local error_code=$2

    log_error "脚本在第 $line_number 行出错 (退出码: $error_code)"
    log_error "部署失败，请查看日志: $DEPLOY_LOG"

    exit "$error_code"
}

# 设置错误处理
trap 'error_handler ${LINENO} $?' ERR

# ==================== 进度显示函数 ====================

# 显示进度条
show_progress() {
    local current="$1"
    local total="$2"
    local width=50
    local percent=$((current * 100 / total))
    local filled=$((width * percent / 100))
    local empty=$((width - filled))

    printf "\r["
    printf "%${filled}s" | tr ' ' '='
    printf "%${empty}s"
    printf "] %d%% (%d/%d)" "$percent" "$current" "$total"
}

# 完成进度条
complete_progress() {
    echo ""
}
