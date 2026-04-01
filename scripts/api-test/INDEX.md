# 业务场景 API 测试套件

基于 REST API 的完整业务流程自动化测试方案，用于验证单元测试、集成测试、E2E 测试无法覆盖的长程业务逻辑。

## 📦 包含的测试套件

| 测试套件                                 | 测试数量 | 业务覆盖                     | 状态      |
| ---------------------------------------- | -------- | ---------------------------- | --------- |
| [辩论业务场景](./README-debate.md)       | 34个     | 案件→辩论→轮次→论点→状态流转 | ✅ 已完成 |
| [合同管理业务场景](./README-contract.md) | 26个     | 合同→审批→签署→付款→法条     | ✅ 已完成 |

## 🚀 快速开始

### 方式 1: 运行所有测试

```powershell
cd scripts/api-test
.\run-all-tests.ps1
```

### 方式 2: 仅运行特定测试

```powershell
# 仅运行辩论测试
.\run-all-tests.ps1 -DebateOnly

# 仅运行合同测试
.\run-all-tests.ps1 -ContractOnly
```

### 方式 3: 独立运行单个测试

```powershell
# 辩论测试
.\run-debate-test.ps1

# 合同测试（需要 LAWYER 角色）
.\run-contract-test.ps1 -Email lawyer@example.com -Password lawyer123
```

## 📊 测试架构

```
┌─────────────────────────────────────────────────────────────┐
│                    API 测试套件 (api-test)                   │
├─────────────────────────────────────────────────────────────┤
│  测试框架层                                                  │
│  ├── TestRunner        # 测试执行引擎                        │
│  ├── ApiClient         # HTTP 请求封装                       │
│  └── Assert Utils      # 断言辅助函数                        │
├─────────────────────────────────────────────────────────────┤
│  业务测试层                                                  │
│  ├── debate-workflow-test.ts    # 辩论业务 (34 tests)        │
│  └── contract-workflow-test.ts  # 合同业务 (26 tests)        │
├─────────────────────────────────────────────────────────────┤
│  运行脚本层                                                  │
│  ├── run-all-tests.ps1          # 统一入口                   │
│  ├── run-debate-test.ps1        # 辩论测试入口               │
│  └── run-contract-test.ps1      # 合同测试入口               │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 环境配置

### 环境变量

```powershell
# API 基础配置
$env:API_BASE_URL = "http://localhost:3000"

# 通用测试用户 (用于辩论测试)
$env:TEST_USER_EMAIL = "test@example.com"
$env:TEST_USER_PASSWORD = "test123456"

# 合同测试专用用户 (必须为 LAWYER 或 SUPER_ADMIN)
$env:CONTRACT_TEST_EMAIL = "lawyer@example.com"
$env:CONTRACT_TEST_PASSWORD = "lawyer123"
```

### 配置文件方式

创建 `.env.test` 文件:

```env
API_BASE_URL=http://localhost:3000
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=test123456
```

然后运行:

```powershell
.\run-all-tests.ps1 -EnvFile .env.test
```

## 📋 测试执行流程

### 辩论业务场景

```
1. 认证 → 获取 JWT Token
2. 创建案件 → 获取 caseId
3. 创建辩论 → 草稿状态
4. 更新辩论 → 修改配置
5. 状态流转 → DRAFT → IN_PROGRESS
6. 创建轮次 → 多轮次生成
7. 获取论点 → 验证数据结构
8. 法条推荐 → 验证接口
9. 状态归档 → COMPLETED → ARCHIVED
10. 清理数据 → 软删除
```

### 合同管理业务场景

```
1. 认证 → 验证 LAWYER 角色
2. 创建案件 → 合同关联所需
3. 创建合同 → DRAFT 状态，自动编号
4. 更新合同 → 修改金额和条款
5. 启动审批 → DRAFT → PENDING
6. 律师签署 → 验证签名
7. 客户签署 → 双方签署完成
8. 状态验证 → SIGNED
9. 付款记录 → 创建并验证金额更新
10. 法条关联 → 推荐和关联
11. 版本管理 → 获取历史版本
12. PDF导出 → 验证导出接口
13. 清理数据 → 软删除
```

## 🎯 核心验证点

### 业务逻辑验证

- ✅ 状态机转换的正确性
- ✅ 业务规则的限制（如重复签署阻止）
- ✅ 关联数据的完整性
- ✅ 金额计算的正确性
- ✅ 权限控制的有效性

### API 接口验证

- ✅ 接口响应格式一致性
- ✅ HTTP 状态码正确性
- ✅ 错误处理机制
- ✅ 数据验证规则
- ✅ 并发安全性

### 数据流验证

- ✅ 跨接口数据一致性
- ✅ 数据库状态变更
- ✅ 关联表数据同步
- ✅ 软删除机制

## 🐛 故障排查

### 连接问题

```
⚠️  无法连接到服务器: http://localhost:3000
```

**解决**: 确保 `npm run dev` 正在运行

### 权限问题

```
403 Forbidden: 只有已认证律师才能创建合同
```

**解决**: 确认测试用户角色为 LAWYER 且有通过的资质审核

### 环境问题

```
Error: Cannot find module 'ts-node'
```

**解决**: `npm install -g ts-node typescript`

## 📁 文件结构

```
scripts/api-test/
├── README.md                      # 本文档
├── README-debate.md               # 辩论测试详细文档
├── README-contract.md             # 合同测试详细文档
├── debate-workflow-test.ts        # 辩论测试主文件
├── contract-workflow-test.ts      # 合同测试主文件
├── run-all-tests.ps1              # 统一入口脚本
├── run-debate-test.ps1            # 辩论测试脚本
└── run-contract-test.ps1          # 合同测试脚本
```

## 🔄 CI/CD 集成

### GitHub Actions 示例

```yaml
name: API Integration Tests

on: [push, pull_request]

jobs:
  api-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Setup database
        run: npx prisma migrate dev

      - name: Seed test data
        run: npx ts-node prisma/seed-test.ts

      - name: Start server
        run: npm run dev &

      - name: Wait for server
        run: npx wait-on http://localhost:3000/api/health

      - name: Run API tests
        run: |
          cd scripts/api-test
          ./run-all-tests.sh
```

## 📝 添加新的业务测试

### 1. 创建测试文件

```typescript
// scripts/api-test/new-business-test.ts

const CONFIG = {
  BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  // ...
};

async function main() {
  const runner = new TestRunner();
  const client = new ApiClient(CONFIG.BASE_URL);

  // 添加测试用例
  runner.test('1.1 测试描述', async () => {
    // 测试逻辑
  });

  await runner.run();
}

main();
```

### 2. 创建运行脚本

```powershell
# scripts/api-test/run-new-test.ps1
# 参考现有脚本模板
```

### 3. 更新统一入口

在 `run-all-tests.ps1` 中添加新测试套件。

## 🔗 相关文档

- [项目 API 文档](../../docs/API.md)
- [测试策略](../../docs/guides/TESTING.md)
- [辩论系统架构](../../docs/task-tracking/MANUS_INTEGRATION_GUIDE.md)
- [合同系统架构](../../docs/architecture/CONTRACT_SYSTEM.md)

## 💡 设计理念

### 为什么需要 API 业务测试？

1. **长程业务逻辑** - 单元测试只能覆盖单个函数，无法验证完整业务流程
2. **真实环境验证** - 在真实 HTTP 层验证，而非 Mock 环境
3. **AI 可理解性** - HTTP/JSON 接口比代码更容易被 AI 理解和操作
4. **跨系统验证** - 验证数据库、缓存、消息队列等组件的协同工作

### 与现有测试的关系

```
┌─────────────────────────────────────────────────────────┐
│                    测试金字塔                             │
├─────────────────────────────────────────────────────────┤
│  E2E (Playwright)     ← 用户交互验证                      │
├─────────────────────────────────────────────────────────┤
│  API 业务测试         ← 本项目 (长程业务逻辑验证)           │
├─────────────────────────────────────────────────────────┤
│  集成测试             ← 模块间交互验证                      │
├─────────────────────────────────────────────────────────┤
│  单元测试             ← 函数级别验证                       │
└─────────────────────────────────────────────────────────┘
```
