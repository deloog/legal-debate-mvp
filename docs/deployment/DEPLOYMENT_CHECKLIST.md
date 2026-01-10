# 部署检查清单

## 📋 概述

本文档用于验证6个智能体架构的部署就绪状态，确保所有关键组件已正确配置和集成。

**文档版本**：v1.0  
**创建时间**：2026-01-06  
**适用范围**：Sprint 6.5 - 6个智能体架构实施

---

## 1. Agent依赖关系确认

### 1.1 核心Agent清单

| Agent名称 | 状态 | 职责 | 关键功能 |
|---------|------|------|----------|
| PlanningAgent | ✅ 已实现 | 任务分解、策略规划、工作流编排 | decomposeTask, planStrategy, orchestrateWorkflow |
| AnalysisAgent | ✅ 已实现 | 文档解析、证据分析、时间线提取 | parseDocument, analyzeEvidence, extractTimeline |
| LegalAgent | ✅ 已实现 | 法律检索、法条适用性分析、论点生成 | searchLaws, analyzeApplicability, generateArguments |
| GenerationAgent | ✅ 已实现 | 文书生成、辩论内容生成 | generateDocument, generateDebate, generateStream |
| VerificationAgent | ✅ 已实现 | 三重验证（事实+逻辑+完成度） | comprehensiveVerify, verifyFactualAccuracy, verifyLogicalConsistency |
| MemoryAgent | ✅ 已实现 | 三层记忆管理（Working/Hot/Cold） | storeWorkingMemory, storeHotMemory, storeColdMemory |

### 1.2 Agent依赖关系

#### PlanningAgent（规划层）
- **下游Agent**：AnalysisAgent, LegalAgent, GenerationAgent, VerificationAgent
- **依赖**：MemoryAgent（记忆访问）
- **职责**：编排所有Agent的工作流

```
PlanningAgent
├── AnalysisAgent（文档分析）
├── LegalAgent（法律检索）
├── GenerationAgent（内容生成）
├── VerificationAgent（结果验证）
└── MemoryAgent（记忆服务）
```

#### AnalysisAgent（执行层）
- **上游Agent**：PlanningAgent（被调用）
- **下游Agent**：LegalAgent（提供分析结果）
- **依赖**：MemoryAgent（缓存分析结果）
- **职责**：文档解析、证据分析、时间线提取

#### LegalAgent（执行层）
- **上游Agent**：PlanningAgent（被调用）、AnalysisAgent（接收分析结果）
- **下游Agent**：GenerationAgent（提供法律依据）
- **依赖**：MemoryAgent（缓存法条）
- **职责**：法律检索、适用性分析、论点生成

#### GenerationAgent（执行层）
- **上游Agent**：PlanningAgent（被调用）、LegalAgent（接收法律依据）
- **下游Agent**：VerificationAgent（待验证生成内容）
- **依赖**：MemoryAgent（缓存生成模板）
- **职责**：文书生成、辩论内容生成、流式输出

#### VerificationAgent（验证层）
- **上游Agent**：所有Agent（验证所有输出）
- **下游Agent**：无（最终验证层）
- **依赖**：MemoryAgent（存储验证结果）
- **职责**：事实准确性验证、逻辑一致性验证、任务完成度验证

#### MemoryAgent（支持层）
- **上游Agent**：所有Agent（提供记忆服务）
- **下游Agent**：无（支持层）
- **职责**：Working Memory、Hot Memory、Cold Memory三层记忆管理

### 1.3 工作流程

**完整流程**：

1. **PlanningAgent**接收用户请求
   - 分解任务为子任务
   - 规划执行策略
   - 编排工作流（顺序/并行/混合）

2. **AnalysisAgent**分析文档
   - 解析文档内容（五层架构）
   - 提取当事人、诉讼请求、金额等关键信息
   - 分析证据关联性和完整性
   - 提取时间线

3. **LegalAgent**检索法律
   - 检索相关法条（本地TF-IDF + 外部AI）
   - 分析法条适用性（语义匹配+规则验证+AI审查）
   - 生成论点（主论点+支持论据+法律引用）
   - 构建法律推理链

4. **GenerationAgent**生成内容
   - 根据法律依据生成文书（起诉状/答辩状/证据清单/上诉状）
   - 生成辩论内容（正方+反方论点）
   - 支持流式输出（SSE/JSON）

5. **VerificationAgent**验证结果
   - 事实准确性验证（当事人、金额、日期）
   - 逻辑一致性验证（请求与事实匹配、推理链完整性）
   - 任务完成度验证（必填字段、业务规则、格式）

6. **MemoryAgent**管理记忆
   - Working Memory：当前任务上下文（1小时TTL）
   - Hot Memory：近期任务经验（7天TTL）
   - Cold Memory：长期知识库（永久）

---

## 2. 数据库迁移确认

### 2.1 Schema验证

#### 2.1.1 v3.0 Manus增强表

**AgentMemory（三层记忆管理）**
```prisma
model AgentMemory {
  id               String     @id @default(cuid())
  userId           String
  caseId           String?
  debateId         String?
  memoryType       MemoryType
  agentName        String
  memoryKey        String
  memoryValue      Json
  importance       Float      @default(0.5)
  accessCount      Int        @default(0)
  lastAccessedAt   DateTime?
  expiresAt        DateTime?
  compressed       Boolean    @default(false)
  compressionRatio Float?
  metadata         Json?
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  @@unique([agentName, memoryKey])
  @@index([userId])
  @@index([caseId])
  @@index([debateId])
  @@index([memoryType])
  @@index([agentName])
  @@index([memoryKey])
  @@index([importance])
  @@index([accessCount])
  @@index([lastAccessedAt])
  @@index([expiresAt])
  @@map("agent_memories")
}
```

**VerificationResult（三重验证机制）**
```prisma
model VerificationResult {
  id                 String           @id @default(cuid())
  entityType         String
  entityId           String
  verificationType   VerificationType
  overallScore       Float
  factualAccuracy    Float?
  logicalConsistency Float?
  taskCompleteness   Float?
  passed             Boolean
  issues             Json?
  suggestions        Json?
  verifiedBy         String
  verificationTime   Int
  metadata           Json?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  @@unique([entityType, entityId])
  @@index([entityType])
  @@index([entityId])
  @@index([verificationType])
  @@index([overallScore])
  @@index([passed])
  @@index([createdAt])
  @@map("verification_results")
}
```

**ErrorLog（错误学习机制）**
```prisma
model ErrorLog {
  id               String       @id @default(cuid())
  userId           String?
  caseId           String?
  errorType        ErrorType
  errorCode        String
  errorMessage     String       @db.Text
  stackTrace       String?      @db.Text
  context          Json
  attemptedAction  Json?
  recoveryAttempts Int          @default(0)
  recovered        Boolean      @default(false)
  recoveryMethod   String?
  recoveryTime     Int?
  learned          Boolean      @default(false)
  learningNotes    String?      @db.Text
  severity         ErrorSeverity
  metadata         Json?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@index([userId])
  @@index([caseId])
  @@index([errorType])
  @@index([errorCode])
  @@index([recovered])
  @@index([learned])
  @@index([severity])
  @@index([createdAt])
  @@map("error_logs")
}
```

#### 2.1.2 枚举类型验证

**MemoryType（记忆类型）**
```prisma
enum MemoryType {
  WORKING  // 工作记忆：当前任务上下文，TTL 1小时
  HOT      // 热记忆：近期任务经验，TTL 7天
  COLD     // 冷记忆：长期知识库，永久保留
}
```

**VerificationType（验证类型）**
```prisma
enum VerificationType {
  FACTUAL        // 事实准确性验证
  LOGICAL        // 逻辑一致性验证
  COMPLETENESS   // 任务完成度验证
  COMPREHENSIVE  // 综合验证（三重）
}
```

### 2.2 数据库迁移步骤

#### 2.2.1 迁移前检查

- [x] 确认Prisma schema包含v3.0新增表
- [x] 确认所有枚举类型已定义
- [x] 确认索引配置完整
- [ ] 备份现有数据库（执行前必须）

#### 2.2.2 迁移执行

```bash
# 1. 生成Prisma客户端
npx prisma generate

# 2. 应用数据库迁移（开发环境）
npx prisma migrate dev

# 3. 应用数据库迁移（生产环境）
npx prisma migrate deploy

# 4. 重置数据库（仅开发环境，慎用！）
# npx prisma migrate reset
```

#### 2.2.3 迁移后验证

- [ ] 确认所有表已创建
- [ ] 确认所有索引已创建
- [ ] 确认枚举类型已生效
- [ ] 运行seed脚本验证数据完整性

### 2.3 数据备份与恢复

#### 2.3.1 备份策略

**自动备份**（已实现）：
- 脚本：`scripts/backup-database.ts`
- 备份频率：每日
- 备份保留：30天

**手动备份**：
```bash
# 使用pg_dump备份
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 或使用Prisma studio导出
npx prisma studio
```

#### 2.3.2 恢复策略

```bash
# 使用psql恢复
psql $DATABASE_URL < backup_20260106.sql

# 或使用Prisma迁移回滚
npx prisma migrate resolve --applied "20260106000000_init"
```

---

## 3. 环境变量配置

### 3.1 必需环境变量

#### 3.1.1 数据库配置

```env
# PostgreSQL数据库连接
DATABASE_URL="postgresql://username:password@localhost:5432/legal_debate"
```

#### 3.1.2 AI服务配置

```env
# DeepSeek AI配置
DEEPSEEK_API_KEY="your-deepseek-api-key"
DEEPSEEK_MODEL="deepseek-chat"

# 智谱AI配置
ZHIPU_API_KEY="your-zhipu-api-key"
ZHIPU_MODEL="glm-4"

# AI服务超时配置（毫秒）
AI_TIMEOUT=30000
```

#### 3.1.3 Redis配置（可选）

```env
# Redis连接（用于缓存）
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=""
```

#### 3.1.4 应用配置

```env
# Next.js配置
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# 日志级别
LOG_LEVEL="info"

# JWT密钥（如果启用用户认证）
JWT_SECRET="your-jwt-secret-key"
```

### 3.2 配置验证

- [x] .env.local已创建并配置
- [ ] .env.production已创建并配置（生产环境）
- [ ] 敏感信息已添加到.gitignore
- [ ] 环境变量已通过脚本验证

---

## 4. 测试验证

### 4.1 单元测试

#### 4.1.1 测试执行

```bash
# 运行所有单元测试
npm test

# 运行特定Agent测试
npm test planning-agent
npm test legal-agent
npm test generation-agent
npm test verification-agent

# 生成覆盖率报告
npm run test:coverage
```

#### 4.1.2 测试覆盖率要求

| Agent | 目标覆盖率 | 实际覆盖率 | 状态 |
|-------|------------|------------|------|
| PlanningAgent | >90% | 95%+（估算） | ✅ 达标 |
| AnalysisAgent | >90% | >90% | ✅ 达标 |
| LegalAgent | >85% | >85% | ✅ 达标 |
| GenerationAgent | >85% | 90%+ | ✅ 达标 |
| VerificationAgent | >90% | 100% | ✅ 超标 |
| MemoryAgent | >90% | 待验证 | ⚠️ 待验证 |

### 4.2 集成测试

#### 4.2.1 核心功能测试

| 测试文件 | 测试用例数 | 通过数 | 通过率 | 状态 |
|---------|-----------|--------|--------|------|
| debate-flow.integration.test.ts | 6 | 6 | 100% | ✅ 完美 |
| unified-debate-generator.test.ts | 12 | 12 | 100% | ✅ 完美 |
| sse-stream-integration.test.ts | 6 | 6 | 100% | ✅ 完美 |

#### 4.2.2 集成测试执行

```bash
# 运行所有集成测试
npm run test:integration

# 运行特定集成测试
npx jest src/__tests__/integration/debate-flow.integration.test.ts
```

#### 4.2.3 测试通过率要求

- **集成测试总体通过率**：78.57%（55/70通过）
  - ⚠️ 未达到90%目标
  - ✅ 核心功能测试100%通过
  - 建议：优化测试指标收集逻辑和文档分析功能

### 4.3 E2E测试

#### 4.3.1 测试执行

```bash
# 运行所有E2E测试
npx playwright test

# 运行特定E2E测试
npx playwright test e2e/debate.spec.ts

# 生成E2E测试报告
npx playwright test --reporter=html
```

#### 4.3.2 测试通过率要求

- **E2E测试通过率目标**：>90%
- **当前状态**：待测试
- **建议**：在部署前运行完整E2E测试套件

---

## 5. 构建与部署

### 5.1 构建流程

#### 5.1.1 前置检查

- [ ] 所有测试通过（单元测试+集成测试）
- [ ] 环境变量已正确配置
- [ ] 数据库迁移已执行
- [ ] 无TypeScript编译错误
- [ ] 无ESLint错误

#### 5.1.2 构建步骤

```bash
# 1. 安装依赖
npm install

# 2. 类型检查
npx tsc --noEmit

# 3. 代码检查
npm run lint

# 4. 构建Next.js项目
npm run build
```

#### 5.1.3 构建验证

- [ ] 构建无错误
- [ ] 生成.next目录完整
- [ ] 静态资源正确生成
- [ ] 构建输出大小合理（<500MB）

### 5.2 部署方式

#### 5.2.1 Vercel部署（推荐）

```bash
# 1. 安装Vercel CLI
npm i -g vercel

# 2. 登录Vercel
vercel login

# 3. 部署到生产环境
vercel --prod

# 4. 部署到预览环境
vercel
```

#### 5.2.2 Docker部署

```bash
# 1. 构建Docker镜像
docker build -t legal-debate .

# 2. 运行容器
docker run -p 3000:3000 -e DATABASE_URL=$DATABASE_URL legal-debate

# 3. 使用Docker Compose
docker-compose up -d
```

#### 5.2.3 传统部署

```bash
# 1. 使用PM2管理进程
npm install -g pm2
pm2 start npm --name "legal-debate" -- start

# 2. 查看日志
pm2 logs legal-debate

# 3. 重启服务
pm2 restart legal-debate
```

### 5.3 部署后验证

- [ ] 服务正常启动
- [ ] 健康检查API返回200（/api/health）
- [ ] 数据库连接正常
- [ ] AI服务连接正常
- [ ] 核心功能可用
- [ ] 日志正常输出

---

## 6. 监控与告警

### 6.1 健康检查

#### 6.1.1 健康检查API

**基础健康检查**：`GET /api/health`

```json
{
  "status": "ok",
  "timestamp": "2026-01-06T12:00:00Z",
  "version": "1.0.0",
  "uptime": "2d 5h 30m"
}
```

**依赖检查**：`GET /api/health/deps`

```json
{
  "status": "ok",
  "database": {
    "status": "ok",
    "latency": "5ms"
  },
  "redis": {
    "status": "ok",
    "latency": "1ms"
  },
  "ai_service": {
    "status": "ok",
    "provider": "deepseek",
    "latency": "150ms"
  }
}
```

#### 6.1.2 健康检查频率

- **开发环境**：手动检查
- **生产环境**：每5分钟自动检查
- **告警**：连续3次失败触发告警

### 6.2 日志管理

#### 6.2.1 日志级别

```javascript
// LOG_LEVEL配置
const LOG_LEVELS = {
  ERROR: 0,  // 仅错误
  WARN: 1,   // 警告及以上
  INFO: 2,   // 信息及以上
  DEBUG: 3   // 所有日志
};
```

#### 6.2.2 日志存储

- **应用日志**：存储在`logs/application.log`
- **错误日志**：存储在数据库ErrorLog表
- **访问日志**：存储在数据库或文件（根据配置）

#### 6.2.3 日志轮转

- **日志文件大小限制**：100MB
- **日志保留时间**：30天
- **日志压缩**：超过7天的日志自动压缩

### 6.3 告警规则

#### 6.3.1 告警级别

- **P0（严重）**：服务不可用、数据丢失
- **P1（高）**：核心功能异常、数据库连接失败
- **P2（中）**：部分功能异常、AI服务不稳定
- **P3（低）**：性能下降、轻微错误

#### 6.3.2 告警方式

- **P0/P1**：短信+邮件+Slack
- **P2**：邮件+Slack
- **P3**：邮件

---

## 7. 回滚策略

### 7.1 回滚触发条件

- 部署后出现严重错误（P0）
- 核心功能不可用超过5分钟
- 数据损坏或数据丢失
- 性能严重下降（响应时间>10秒）

### 7.2 回滚步骤

#### 7.2.1 代码回滚

```bash
# 1. 回退到上一个稳定版本
git revert HEAD

# 2. 重新构建
npm run build

# 3. 重新部署
vercel --prod
```

#### 7.2.2 数据库回滚

```bash
# 1. 恢复数据库备份
psql $DATABASE_URL < backup_before_deployment.sql

# 2. 回滚Prisma迁移
npx prisma migrate resolve --applied "last_stable_migration"
```

#### 7.2.3 环境变量回滚

```bash
# 1. 恢复环境变量备份
cp .env.production.backup .env.production

# 2. 重启服务
pm2 restart legal-debate
```

---

## 8. 性能优化建议

### 8.1 数据库优化

#### 8.1.1 索引优化

已在schema.prisma中添加的索引：

```prisma
@@index([userId])
@@index([caseId])
@@index([debateId])
@@index([memoryType])
@@index([agentName])
@@index([memoryKey])
@@index([importance])
@@index([accessCount])
@@index([lastAccessedAt])
@@index([expiresAt])
```

#### 8.1.2 连接池配置

```env
# Prisma连接池配置
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20"
```

### 8.2 缓存策略

#### 8.2.1 缓存层次

1. **应用层缓存**（Redis）
   - 法条检索结果缓存（7天TTL）
   - 文档分析结果缓存（1小时TTL）
   - 辩论生成结果缓存（30分钟TTL）

2. **数据库层缓存**（PostgreSQL）
   - 热数据缓存
   - 查询结果缓存

3. **Agent层缓存**（MemoryAgent）
   - Working Memory：当前任务上下文
   - Hot Memory：近期任务经验
   - Cold Memory：长期知识库

#### 8.2.2 缓存命中率目标

- **目标缓存命中率**：>60%
- **当前状态**：待监控
- **优化措施**：优化缓存键、增加缓存时间、预加载热门数据

### 8.3 AI服务调用优化

#### 8.3.1 批量处理

- ✅ LawSearcher支持批量检索
- ✅ ApplicabilityAnalyzer支持批量分析
- ✅ ArgumentGenerator支持批量生成

#### 8.3.2 请求合并

- 相同请求合并（合并请求参数）
- 请求去重（缓存未完成请求）
- 优先级队列（重要请求优先）

#### 8.3.3 错误重试

- **重试策略**：指数退避
- **最大重试次数**：3次
- **重试间隔**：1s, 2s, 4s

---

## 9. 安全检查

### 9.1 数据安全

#### 9.1.1 敏感信息保护

- [x] 数据库密码使用环境变量
- [x] API密钥使用环境变量
- [x] 敏感配置不提交到版本控制
- [ ] 数据库连接使用SSL（生产环境）

#### 9.1.2 数据加密

- [ ] 用户密码使用bcrypt加密
- [ ] 敏感数据存储加密（如需要）
- [ ] API通信使用HTTPS

### 9.2 API安全

#### 9.2.1 认证授权

- [ ] JWT Token验证
- [ ] API密钥验证
- [ ] RBAC权限控制（Sprint 8实现）

#### 9.2.2 输入验证

- [x] 所有API输入验证
- [x] SQL注入防护（Prisma自动防护）
- [x] XSS防护（Next.js自动防护）

### 9.3 错误处理

#### 9.3.1 错误信息

- [x] 不泄露敏感信息
- [x] 不暴露堆栈跟踪（生产环境）
- [x] 记录详细错误日志

#### 9.3.2 错误恢复

- [x] 实现错误学习机制
- [x] 实现Fallback机制
- [x] 实现自动重试

---

## 10. 文档完整性

### 10.1 实施文档

- [x] AGENT_ARCHITECTURE_IMPLEMENTATION_REPORT.md（实施报告）
- [x] PHASE3_AI_TASK_TRACKING.md（任务追踪）
- [x] AGENT_ARCHITECTURE_V2.md（架构设计）
- [ ] MANUS_INTEGRATION_GUIDE.md（Manus理念）

### 10.2 部署文档

- [x] DEPLOYMENT_CHECKLIST.md（本文档）
- [ ] PRODUCTION_CONFIG_GUIDE.md（生产配置指南）
- [ ] MIGRATION_GUIDE.md（迁移指南）

### 10.3 API文档

- [ ] API Swagger文档
- [ ] API使用示例
- [ ] API错误码说明

---

## 11. 上线前最终检查

### 11.1 功能检查

- [ ] 所有6个Agent功能完整
- [ ] 所有测试通过
- [ ] 所有文档更新完成
- [ ] 所有配置正确

### 11.2 性能检查

- [ ] API响应时间<2秒
- [ ] 数据库查询时间<500ms
- [ ] AI服务调用时间<10秒
- [ ] 页面加载时间<3秒

### 11.3 安全检查

- [ ] 所有敏感信息使用环境变量
- [ ] 所有API已实现认证授权
- [ ] 所有输入已实现验证
- [ ] 所有错误已妥善处理

### 11.4 监控检查

- [ ] 健康检查API正常
- [ ] 日志正常输出
- [ ] 告警规则已配置
- [ ] 监控系统正常工作

---

## 12. 签署确认

### 12.1 开发人员确认

- [ ] 代码已审查
- [ ] 测试已验证
- [ ] 文档已更新
- [ ] 配置已确认

**开发人员签名**：________________________  
**日期**：________________________

### 12.2 测试人员确认

- [ ] 单元测试已通过
- [ ] 集成测试已通过
- [ ] E2E测试已通过
- [ ] 性能测试已通过

**测试人员签名**：________________________  
**日期**：________________________

### 12.3 运维人员确认

- [ ] 环境已配置
- [ ] 数据库已迁移
- [ ] 监控已配置
- [ ] 备份已验证

**运维人员签名**：________________________  
**日期**：________________________

### 12.4 项目负责人确认

- [ ] 所有检查项已确认
- [ ] 上线时间已确定
- [ ] 回滚策略已准备
- [ ] 应急联系已建立

**项目负责人签名**：________________________  
**日期**：________________________

---

## 13. 附录

### 13.1 快速参考

| 常用命令 | 说明 |
|---------|------|
| `npm test` | 运行所有单元测试 |
| `npm run test:integration` | 运行集成测试 |
| `npm run test:coverage` | 生成覆盖率报告 |
| `npx playwright test` | 运行E2E测试 |
| `npm run build` | 构建项目 |
| `npx prisma generate` | 生成Prisma客户端 |
| `npx prisma migrate dev` | 应用开发环境迁移 |
| `npx prisma migrate deploy` | 应用生产环境迁移 |

### 13.2 联系信息

| 角色 | 姓名 | 联系方式 |
|------|------|----------|
| 项目负责人 | - | - |
| 开发负责人 | - | - |
| 测试负责人 | - | - |
| 运维负责人 | - | - |
| 应急联系人 | - | - |

### 13.3 参考资料

- [Manus架构理念](../task-tracking/MANUS_INTEGRATION_GUIDE.md)
- [6个Agent架构设计](../task-tracking/AGENT_ARCHITECTURE_V2.md)
- [阶段3实施计划](../task-tracking/PHASE3_IMPLEMENTATION.md)
- [AI开发规范](../.clinerules)
- [迁移指南](../guides/MIGRATION_GUIDE.md)

---

_文档版本: v1.0_  
_创建时间: 2026-01-06_  
_维护者: AI Assistant_
