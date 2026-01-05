# 律伴助手 - 法律诉讼智能分析系统

基于AI大模型的法律诉讼智能分析系统，支持文档智能解析、法条智能检索、辩论论点生成和多轮辩论。

## 📋 项目概述

### 核心功能

- **文档智能解析**：五层架构（AI识别+算法兜底+AI审查），当前准确率88分，目标95分+
- **法条智能检索**：本地200-500条法条库+外部API混合检索，支持相关性评分
- **辩论论点生成**：基于Manus架构的6个核心Agent，正反方平衡生成
- **多轮辩论支持**：三层记忆架构（Working/Hot/Cold），上下文继承和记忆压缩
- **流式输出**：SSE（Server-Sent Events）实时传输，支持断线重连

### 技术栈

- **前端**：Next.js 15 + React + TypeScript + Tailwind CSS
- **后端**：Next.js API Routes + Prisma ORM
- **数据库**：PostgreSQL（本地开发） + Vercel Postgres（生产环境）
- **AI服务**：DeepSeek（主要） + 智谱清言（备用）
- **测试**：Jest（单元测试） + Playwright（E2E测试）
- **部署**：Vercel（前端） + Docker（容器化）

### 项目状态

- **当前阶段**：Sprint 6 - Manus架构增强（36个任务，35个已完成，97.2%）
- **准确率目标**：88分 → 95分+（当前93.4分）
- **核心架构**：6个Agent系统（整合自原10个Agent）
- **测试通过率**：API 99.6%（497/499），E2E 44.4%（16/36）
- **下一步重点**：提升文档解析准确率、修复E2E测试

## 🏗️ 技术架构

### Manus架构理念

基于Manus智能体论文的核心理念，采用以下设计：

- **PEV三层架构**：Planning（规划层）→ Execution（执行层）→ Verification（验证层）
- **三层记忆管理**：Working Memory（1小时TTL）→ Hot Memory（7天TTL）→ Cold Memory（永久）
- **统一验证层**：事实准确性 + 逻辑一致性 + 任务完成度，三重验证
- **错误学习机制**：保留错误记录，AI分析根本原因，自动生成预防措施
- **分层行动空间**：<20个核心原子函数，通过组合实现所有功能

### 6个核心Agent

```
1. PlanningAgent    - 任务分解、策略规划、工作流编排
2. AnalysisAgent    - 文档解析、证据分析、时间线提取
3. LegalAgent       - 法律检索、法条适用性分析、论点生成
4. GenerationAgent  - 文书生成、辩论内容生成、流式输出
5. VerificationAgent - 事实准确性验证、逻辑一致性验证、任务完成度验证
6. MemoryAgent     - 三层记忆管理、记忆压缩、错误学习
```

详细设计：[docs/task-tracking/MANUS_INTEGRATION_GUIDE.md](docs/task-tracking/MANUS_INTEGRATION_GUIDE.md)

## 📁 项目目录结构

```
legal_debate_mvp/
├── src/
│   ├── lib/              # 核心业务逻辑
│   │   ├── agent/        # 6个核心Agent
│   │   ├── ai/          # AI服务封装（DeepSeek、智谱）
│   │   ├── debate/       # 辩论系统（生成器、轮次管理）
│   │   └── middleware/  # 中间件（错误处理、缓存）
│   ├── app/             # Next.js应用
│   │   ├── api/v1/     # API路由
│   │   ├── cases/       # 案件管理页面
│   │   ├── debates/     # 辩论界面
│   │   └── documents/  # 文档上传管理
│   └── __tests__/      # 测试文件
├── prisma/            # 数据库Schema和迁移
├── docs/              # 完整文档（58个文档）
├── scripts/           # 实用脚本（数据导入、测试等）
├── public/            # 静态资源
├── config/            # 配置文件（.prettierrc、jest.config等）
└── .clinerules        # AI开发规范（重要！）
```

## 🚀 快速开始

### 前置要求

- Node.js 18+
- PostgreSQL 14+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 环境配置

复制 `.env.example` 到 `.env` 并配置：

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/legal_debate_dev"
DEEPSEEK_API_KEY="your_deepseek_key"
ZHIPU_API_KEY="your_zhipu_key"
```

### 数据库初始化

```bash
# 生成Prisma客户端
npx prisma generate

# 应用数据库迁移
npx prisma migrate dev

# 导入法条数据
npx ts-node prisma/seed.ts
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 查看应用

### 运行测试

```bash
# 单元测试
npm test

# 测试覆盖率
npm run test:coverage

# E2E测试
npx playwright test
```

## 📚 文档导航

### AI助手必读文档

1. **[docs/task-tracking/AI_TASK_TRACKING.md](docs/task-tracking/AI_TASK_TRACKING.md)** - 任务进度追踪（了解当前进度）
2. **[docs/task-tracking/MANUS_INTEGRATION_GUIDE.md](docs/task-tracking/MANUS_INTEGRATION_GUIDE.md)** - Manus架构理念（核心技术架构）
3. **[.clinerules](.clinerules)** - AI开发规范（必须遵守的规则）
4. **[docs/task-tracking/AGENT_ARCHITECTURE_V2.md](docs/task-tracking/AGENT_ARCHITECTURE_V2.md)** - 6个核心Agent详细设计

### 完整文档索引

所有文档已按类别组织，详见 [docs/README.md](docs/README.md)

## 🔧 关键配置

### 代码规范

- **文件行数限制**：单个文件最多500行
- **禁止创建重复文件**：所有改进必须在原文件上进行
- **命名规范**：使用命名导出，避免默认导出
- **类型安全**：生产代码禁止使用`any`类型

完整规范：[docs/guides/CODE_STYLE.md](docs/guides/CODE_STYLE.md)

### 环境变量

| 变量名             | 说明                        | 必需        |
| ------------------ | --------------------------- | ----------- |
| `DATABASE_URL`     | PostgreSQL连接字符串        | ✅          |
| `DEEPSEEK_API_KEY` | DeepSeek API密钥            | ✅          |
| `ZHIPU_API_KEY`    | 智谱API密钥                 | ⚠️ （备用） |
| `REDIS_HOST`       | Redis主机（可选，用于缓存） | ❌          |

## 📊 项目统计

- **代码量**：~15,000行 TypeScript
- **文档量**：58个Markdown文档
- **测试用例**：500+ 单元测试，36 E2E测试
- **数据库表**：20+ 个业务表
- **Agent数量**：6个核心Agent
- **法条数据**：42条导入法条

## 🎯 下一步计划

1. **完成Sprint 6**：Manus架构增强（剩余1个任务）
2. **提升准确率**：文档解析88分→95分+（优化提示词和验证算法）
3. **修复E2E测试**：通过率44.4%→90%+（修复Mock配置和API响应）
4. **性能优化**：API响应时间<2秒，缓存命中率60%+

## 📞 技术支持

- **问题反馈**：查看 [docs/archive/problems-and-solutions.md](docs/archive/problems-and-solutions.md)
- **架构疑问**：参考 [docs/architecture/](docs/architecture/)
- **代码规范**：参考 [docs/guides/CODE_STYLE.md](docs/guides/CODE_STYLE.md)
- **部署指南**：参考 [docs/guides/MIGRATION_GUIDE.md](docs/guides/MIGRATION_GUIDE.md)

## 📝 许可证

本项目为法律诉讼智能分析系统，仅供学习和研究使用。

---

_文档版本: v1.0_  
_最后更新: 2026-01-04_  
_维护者: 开发团队_
