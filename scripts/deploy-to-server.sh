#!/bin/bash

# 自动化部署脚本
# 一键完成从本地导出到服务器导入的全过程

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置（请根据实际情况修改）
SERVER_USER="${SERVER_USER:-your_username}"
SERVER_HOST="${SERVER_HOST:-your_server_ip}"
SERVER_PATH="${SERVER_PATH:-/tmp}"
APP_PATH="${APP_PATH:-/path/to/app}"
DB_NAME="${DB_NAME:-legal_debate_mvp}"
DB_USER="${DB_USER:-postgres}"

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# 检查配置
check_config() {
    print_header "检查配置"

    if [ "$SERVER_USER" = "your_username" ] || [ "$SERVER_HOST" = "your_server_ip" ]; then
        print_error "请先配置服务器信息！"
        echo ""
        echo "方法1：修改脚本中的默认值"
        echo "方法2：设置环境变量："
        echo "  export SERVER_USER=your_username"
        echo "  export SERVER_HOST=your_server_ip"
        echo "  export SERVER_PATH=/tmp"
        echo "  export APP_PATH=/path/to/app"
        echo ""
        exit 1
    fi

    print_info "服务器配置："
    echo "  用户: $SERVER_USER"
    echo "  主机: $SERVER_HOST"
    echo "  临时目录: $SERVER_PATH"
    echo "  应用目录: $APP_PATH"
    echo "  数据库: $DB_NAME"
    echo ""
}

# 步骤1：本地导出数据
export_data() {
    print_header "步骤 1/5: 本地导出数据"

    if [ ! -f "scripts/export-npc-data.sh" ]; then
        print_error "找不到导出脚本！"
        exit 1
    fi

    print_info "开始导出数据..."
    bash scripts/export-npc-data.sh

    # 查找最新的备份文件
    BACKUP_FILE=$(ls -t backups/law_articles_npc_*.sql.gz 2>/dev/null | head -1)

    if [ -z "$BACKUP_FILE" ]; then
        print_error "导出失败，找不到备份文件！"
        exit 1
    fi

    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    print_success "导出完成！文件: $BACKUP_FILE (大小: $BACKUP_SIZE)"
}

# 步骤2：测试服务器连接
test_connection() {
    print_header "步骤 2/5: 测试服务器连接"

    print_info "测试 SSH 连接..."
    if ssh -o ConnectTimeout=10 "$SERVER_USER@$SERVER_HOST" "echo '连接成功'" >/dev/null 2>&1; then
        print_success "SSH 连接正常"
    else
        print_error "无法连接到服务器！"
        echo ""
        echo "请检查："
        echo "  1. 服务器地址是否正确"
        echo "  2. SSH 密钥是否配置"
        echo "  3. 网络连接是否正常"
        echo ""
        exit 1
    fi
}

# 步骤3：上传文件到服务器
upload_files() {
    print_header "步骤 3/5: 上传文件到服务器"

    print_info "上传备份文件..."
    scp "$BACKUP_FILE" "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/" || {
        print_error "上传备份文件失败！"
        exit 1
    }
    print_success "备份文件上传完成"

    print_info "上传导入脚本..."
    scp backups/import_on_server.sh "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/" || {
        print_error "上传导入脚本失败！"
        exit 1
    }
    print_success "导入脚本上传完成"
}

# 步骤4：在服务器上执行导入
import_on_server() {
    print_header "步骤 4/5: 在服务器上导入数据"

    BACKUP_FILENAME=$(basename "$BACKUP_FILE")

    print_info "在服务器上执行导入..."
    print_warning "这可能需要几分钟，请耐心等待..."
    echo ""

    ssh "$SERVER_USER@$SERVER_HOST" << EOF
        set -e
        cd $SERVER_PATH
        chmod +x import_on_server.sh
        export DB_NAME=$DB_NAME
        export DB_USER=$DB_USER
        ./import_on_server.sh $BACKUP_FILENAME
EOF

    if [ $? -eq 0 ]; then
        print_success "数据导入完成"
    else
        print_error "数据导入失败！"
        exit 1
    fi
}

# 步骤5：验证数据
verify_data() {
    print_header "步骤 5/5: 验证数据"

    print_info "在服务器上验证数据..."

    ssh "$SERVER_USER@$SERVER_HOST" << EOF
        set -e
        cd $APP_PATH

        # 检查是否有验证脚本
        if [ -f "scripts/import-data/verify-npc-import.ts" ]; then
            echo "运行验证脚本..."
            npx tsx scripts/import-data/verify-npc-import.ts
        else
            echo "验证脚本不存在，使用 SQL 查询验证..."
            psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as npc_count FROM \"LawArticle\" WHERE \"dataSource\" = 'npc';"
        fi
EOF

    if [ $? -eq 0 ]; then
        print_success "数据验证通过"
    else
        print_warning "数据验证失败，请手动检查"
    fi
}

# 清理临时文件
cleanup() {
    print_header "清理临时文件"

    print_info "清理服务器上的临时文件..."
    ssh "$SERVER_USER@$SERVER_HOST" << EOF
        rm -f $SERVER_PATH/law_articles_npc_*.sql
        rm -f $SERVER_PATH/law_articles_npc_*.sql.gz
        rm -f $SERVER_PATH/import_on_server.sh
EOF

    print_success "清理完成"
}

# 显示总结
show_summary() {
    print_header "部署完成"

    echo -e "${GREEN}🎉 恭喜！数据已成功部署到服务器${NC}"
    echo ""
    echo "📊 部署信息："
    echo "  服务器: $SERVER_HOST"
    echo "  数据库: $DB_NAME"
    echo "  备份文件: $BACKUP_FILE"
    echo ""
    echo "🔍 下一步："
    echo "  1. 访问应用检查功能是否正常"
    echo "  2. 测试法律条文查询功能"
    echo "  3. 检查搜索性能"
    echo ""
    echo "📖 相关文档："
    echo "  - docs/SERVER_DEPLOYMENT_QUICK_GUIDE.md"
    echo "  - docs/DATA_MIGRATION_DEPLOYMENT_GUIDE.md"
    echo ""
}

# 主函数
main() {
    clear

    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║                                                       ║"
    echo "║     国家法律法规库数据自动化部署脚本                 ║"
    echo "║                                                       ║"
    echo "║     Legal Debate MVP - Automated Deployment          ║"
    echo "║                                                       ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""

    # 检查配置
    check_config

    # 确认执行
    print_warning "即将开始自动化部署流程"
    echo ""
    read -p "是否继续？(y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "已取消部署"
        exit 0
    fi
    echo ""

    # 记录开始时间
    START_TIME=$(date +%s)

    # 执行部署步骤
    export_data
    test_connection
    upload_files
    import_on_server
    verify_data
    cleanup

    # 计算耗时
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    MINUTES=$((DURATION / 60))
    SECONDS=$((DURATION % 60))

    # 显示总结
    show_summary

    echo -e "${GREEN}⏱️  总耗时: ${MINUTES} 分 ${SECONDS} 秒${NC}"
    echo ""
}

# 错误处理
trap 'print_error "部署过程中发生错误！"; exit 1' ERR

# 运行主函数
main "$@"
