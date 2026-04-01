# 业务场景 API 测试套件

基于 REST API 的完整业务流程自动化测试方案，用于验证单元测试、集成测试、E2E 测试无法覆盖的长程业务逻辑。

## 📦 包含的测试套件（5大业务场景）

| 测试套件                                        | 测试数量 | 业务覆盖                            | 运行命令                         |
| ----------------------------------------------- | -------- | ----------------------------------- | -------------------------------- |
| [辩论业务场景](./README-debate.md)              | 34个     | 案件→辩论→轮次→论点→状态流转        | `.\run-debate-test.ps1`          |
| [合同管理业务场景](./README-contract.md)        | 26个     | 合同→审批→签署→付款→法条 (需LAWYER) | `.\run-contract-test.ps1`        |
| [会员系统业务场景](./README-membership.md)      | 20个     | 会员等级→订阅→使用统计→历史         | `.\run-membership-test.ps1`      |
| [知识图谱业务场景](./README-knowledge-graph.md) | 22个     | 法条查询→关系分析→路径推荐          | `.\run-knowledge-graph-test.ps1` |
| [咨询业务场景](./README-consultation.md)        | 24个     | 咨询记录→评估→跟进→转案件           | `.\run-consultation-test.ps1`    |

**总计: 126个 API 测试用例**

## 🚀 快速开始

### 运行所有测试

```powershell
cd scripts/api-test
.\run-all-tests.ps1
```

### 仅运行特定测试

```powershell
# 仅辩论测试
.\run-all-tests.ps1 -DebateOnly

# 仅合同测试（需要 LAWYER 角色）
.\run-all-tests.ps1 -ContractOnly

# 仅会员系统测试
.\run-all-tests.ps1 -MembershipOnly

# 仅知识图谱测试
.\run-all-tests.ps1 -KnowledgeGraphOnly

# 仅咨询业务测试
.\run-all-tests.ps1 -ConsultationOnly
```

### 带参数运行

```powershell
.\run-all-tests.ps1 -Url http://localhost:3001 -Email test@example.com -Password test123
```

## 📊 测试覆盖总览

```
┌─────────────────────────────────────────────────────────────┐
│                    API 测试套件 (api-test)                   │
├─────────────────────────────────────────────────────────────┤
│  测试框架层                                                  │
│  ├── TestRunner        # 测试执行引擎                        │
│  ├── ApiClient         # HTTP 请求封装                       │
│  └── Assert Utils      # 断言辅助函数                        │
├─────────────────────────────────────────────────────────────┤
│  业务测试层 (126 tests)                                      │
│  ├── debate-workflow-test.ts       辩论业务 (34 tests)       │
│  ├── contract-workflow-test.ts     合同管理 (26 tests)       │
│  ├── membership-workflow-test.ts   会员系统 (20 tests)       │
│  ├── knowledge-graph-workflow.ts   知识图谱 (22 tests)       │
│  └── consultation-workflow-test.ts 咨询业务 (24 tests)       │
├─────────────────────────────────────────────────────────────┤
│  运行脚本层                                                  │
│  ├── run-all-tests.ps1             统一入口                  │
│  ├── run-debate-test.ps1           辩论测试入口              │
│  ├── run-contract-test.ps1         合同测试入口              │
│  ├── run-membership-test.ps1       会员测试入口              │
│  ├── run-knowledge-graph-test.ps1  图谱测试入口              │
│  ├── run-consultation-test.ps1     咨询测试入口              │
│  └── run-debate-test.sh            Linux/macOS 入口          │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 环境配置

```powershell
# API 配置
$env:API_BASE_URL = "http://localhost:3000"

# 通用测试用户
$env:TEST_USER_EMAIL = "test@example.com"
$env:TEST_USER_PASSWORD = "test123456"

# 合同测试专用用户 (必须为 LAWYER)
$env:TEST_USER_EMAIL = "lawyer@example.com"
$env:TEST_USER_PASSWORD = "lawyer123"
```

## 🐛 故障排查

### 连接问题

```
⚠️  无法连接到服务器: http://localhost:3000
```

**解决**: 确保 `npm run dev` 正在运行

### 合同测试 403 Forbidden

**原因**: 用户角色不是 LAWYER 或 SUPER_ADMIN
**解决**: 在数据库中修改用户角色

### 合同测试 403 QUALIFICATION_REQUIRED

**原因**: 律师资质未通过审核
**解决**: 在数据库中设置资质状态为 APPROVED

## 💡 设计理念

### 为什么需要 API 业务测试？

| 对比维度     | 单元测试 | 集成测试 | E2E     | **API 业务测试** |
| ------------ | -------- | -------- | ------- | ---------------- |
| 覆盖范围     | 函数级   | 模块间   | UI 交互 | **完整业务流程** |
| 执行速度     | 快       | 中       | 慢      | **中等**         |
| 稳定性       | 高       | 中       | 低      | **高**           |
| AI 可理解性  | 低       | 低       | 中      | **高**           |
| 长程逻辑验证 | 难       | 难       | 难      | **天然适合**     |

API 业务测试填补了传统测试的空白，特别适合验证：

- 跨多个 API 的完整业务流程
- 状态机转换和业务规则
- 数据一致性和关联性
- 权限控制和访问限制

---

**更多信息**: [查看详细文档索引](./INDEX.md)
