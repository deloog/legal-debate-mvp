#!/bin/bash

# =============================================================================
# 辩论业务场景 API 测试运行脚本
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
BASE_URL="${API_BASE_URL:-http://localhost:3000}"
TEST_EMAIL="${TEST_USER_EMAIL:-}"
TEST_PASSWORD="${TEST_USER_PASSWORD:-TestPass123}"

# 帮助信息
show_help() {
    echo -e "${BLUE}辩论业务场景 API 测试脚本${NC}"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help           显示帮助信息"
    echo "  -u, --url URL        设置 API 基础 URL (默认: http://localhost:3000)"
    echo "  -e, --email EMAIL    设置测试用户邮箱"
    echo "  -p, --password PASS  设置测试用户密码"
    echo "  --env FILE           指定环境变量文件"
    echo ""
    echo "环境变量:"
    echo "  API_BASE_URL         API 基础 URL"
    echo "  TEST_USER_EMAIL      测试用户邮箱"
    echo "  TEST_USER_PASSWORD   测试用户密码"
    echo ""
    echo "示例:"
    echo "  $0                                    # 使用默认配置运行"
    echo "  $0 -u http://localhost:3001           # 指定不同的端口"
    echo "  $0 -e admin@example.com -p admin123   # 指定测试用户"
}

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        -e|--email)
            TEST_EMAIL="$2"
            shift 2
            ;;
        -p|--password)
            TEST_PASSWORD="$2"
            shift 2
            ;;
        --env)
            if [[ -f "$2" ]]; then
                source "$2"
                echo -e "${GREEN}✓ 已加载环境变量文件: $2${NC}"
            else
                echo -e "${RED}✗ 环境变量文件不存在: $2${NC}"
                exit 1
            fi
            shift 2
            ;;
        *)
            echo -e "${RED}未知选项: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# 检查 Node.js
echo -e "${BLUE}🔍 检查环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js 未安装${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js: $NODE_VERSION${NC}"

# 检查 ts-node
if ! npx ts-node --version &> /dev/null; then
    echo -e "${YELLOW}⚠️  ts-node 未安装，尝试安装...${NC}"
    npm install -g ts-node typescript
fi
echo -e "${GREEN}✓ ts-node 已就绪${NC}"

# 显示配置
echo ""
echo -e "${BLUE}⚙️  测试配置:${NC}"
echo "  API 基础 URL: $BASE_URL"
echo "  测试用户: $TEST_EMAIL"
echo ""

# 检查服务器是否可连接
echo -e "${BLUE}🔌 检查服务器连接...${NC}"
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  无法连接到服务器: $BASE_URL${NC}"
    echo "  请确保服务器正在运行:"
    echo "    npm run dev"
    echo ""
    read -p "是否继续尝试? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ 服务器连接正常${NC}"
fi

# 运行测试
echo ""
echo -e "${BLUE}🚀 开始运行辩论业务场景 API 测试...${NC}"
echo "================================================================"
echo ""

export API_BASE_URL="$BASE_URL"
export TEST_USER_EMAIL="$TEST_EMAIL"
export TEST_USER_PASSWORD="$TEST_PASSWORD"
export NODE_ENV="test"

cd "$(dirname "$0")/../.."
npx ts-node --project tsconfig.api-test.json scripts/api-test/debate-workflow-test.ts

TEST_EXIT_CODE=$?

echo ""
echo "================================================================"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过!${NC}"
else
    echo -e "${RED}❌ 测试失败，请查看上方错误信息${NC}"
fi

exit $TEST_EXIT_CODE
