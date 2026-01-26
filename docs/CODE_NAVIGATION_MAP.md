# 代码导航地图

> **文档版本**：v1.0  
> **创建时间**：2026-01-04  
> **用途**：为AI助手提供代码库的直观导航，快速定位关键代码

---

## 🚀 快速导航索引

### 按模块分类

#### 核心Agent模块（6个）

- [DocAnalyzerAgent](#docanalyzeragent) - 文档解析，五层架构，准确率88分
- [MemoryAgent](#memoryagent) - 三层记忆架构，缓存命中率60%+
- [VerificationAgent](#verificationagent) - 三重验证，准确率≥95%
- [PlanningAgent](#planningagent) - 任务规划和策略制定
- [AnalysisAgent](#analysisagent) - 证据分析和时间线提取
- [LegalAgent](#legalagent) - 法律检索和法条适用性分析
- [GenerationAgent](#generationagent) - 文书生成和流式输出

#### AI服务模块

- [AIService](#aiservice) - 统一AI服务接口
- [DeepSeek Client](#deepseek-client) - DeepSeek API客户端
- [AI Client Factory](#ai-client-factory) - AI客户端工厂模式

#### 前端模块

- [App Page](#app-page) - 主应用页面
- [Debate Page](#debate-page) - 辩论页面
- [Components](#components) - 可复用组件

#### 数据库模块

- [Prisma Schema](#prisma-schema) - 数据库模型定义
- [Memory Tables](#memory-tables) - 记忆相关表

#### 测试模块

- [Unit Tests](#unit-tests) - 单元测试
- [Integration Tests](#integration-tests) - 集成测试
- [E2E Tests](#e2e-tests) - 端到端测试

---

## 核心Agent模块

### DocAnalyzerAgent

**文件路径**：`src/lib/agent/doc-analyzer/doc-analyzer-agent.ts`

**功能**：文档解析，识别当事人、诉讼请求、金额等信息

**架构**：五层架构

```
Layer 0: 文本提取 (TextExtractor)
    ↓
Layer 1: 质量预检 (FilterProcessor)
    ↓
Layer 2: AI核心理解 (AIProcessor)
    ↓
Layer 3: 规则验证 (RuleProcessor + LegalRepresentativeFilter)
    ↓
Layer 4: 双重审查 (AIReviewer + RuleReviewer)
    ↓
Layer 5: 缓存层 (CacheProcessor)
```

**准确率**：88分（综合评分）

**关键子模块**：

- `extractors/text-extractor.ts` - 文本提取（支持PDF、DOCX、TXT）
- `processors/filter-processor.ts` - 质量预检（OCR质量、文档类型）
- `processors/ai-processor.ts` - AI核心理解（使用DeepSeek/智谱）
- `processors/rule-processor.ts` - 规则验证（算法兜底）
- `processors/legal-representative-filter.ts` - 法定代表人过滤
- `reviewers/ai-reviewer.ts` - AI审查（验证语义正确性）
- `reviewers/rule-reviewer.ts` - 规则审查（验证结构完整性）
- `processors/cache-processor.ts` - 缓存层（缓存命中率60%+）

**设计决策**：参见文件头部的"为什么这样设计"注释

**使用示例**：

```typescript
const docAnalyzer = new DocAnalyzerAgent(useMock);
const result = await docAnalyzer.execute({
  documentId: '123',
  content: '原告张三，被告李四...',
  fileType: 'pdf',
});
```

---

### MemoryAgent

**文件路径**：`src/lib/agent/memory-agent/memory-agent.ts`

**功能**：三层记忆管理，自动迁移和压缩

**架构**：三层记忆架构

```
Working Memory (TTL: 1小时)
    ↓ 每小时自动迁移
    ↓ 过滤条件: 访问次数≥3 且 重要性评分≥0.7
Hot Memory (TTL: 7天)
    ↓ 每天自动归档
    ↓ 过滤条件: 访问次数≥5 或 重要性评分≥0.9
Cold Memory (TTL: 永久)
```

**缓存命中率**：60%+（减少AI调用40-60%）

**关键子模块**：

- `memory-manager.ts` - 记忆管理器（CRUD操作）
- `compressor.ts` - 记忆压缩器（AI生成摘要，压缩比>0.5）
- `migrator.ts` - 记忆迁移器（自动迁移Working→Hot→Cold）
- `error-learner.ts` - 错误学习器（分析错误模式，生成预防措施）

**设计决策**：参见文件头部的"为什么这样设计"注释

**使用示例**：

```typescript
const memoryAgent = new MemoryAgent(prisma, aiService);
await memoryAgent.initialize();

// 存储记忆
const memoryId = await memoryAgent.storeMemory(
  { type: 'WORKING', value: '用户需求...' },
  userId,
  caseId
);

// 获取记忆
const memory = await memoryAgent.getMemory({ memoryId, type: 'WORKING' });
```

---

### VerificationAgent

**文件路径**：`src/lib/agent/verification-agent/index.ts`

**功能**：三重验证，确保辩论质量

**架构**：三重验证架构

```
并行执行：
  ├─ 事实准确性验证 (FactualVerifier) - 权重40%
  ├─ 逻辑一致性验证 (LogicalVerifier) - 权重30%
  └─ 任务完成度验证 (CompletenessVerifier) - 权重30%
    ↓
  综合评分 = 事实×0.4 + 逻辑×0.3 + 完成度×0.3
    ↓
  问题收集和优先级排序
    ↓
  生成修复建议和改进计划
```

**准确率**：

- 事实准确率：≥98%
- 逻辑一致性：≥95%
- 任务完成度：≥95%

**关键子模块**：

- `verifiers/factual-verifier.ts` - 事实验证（验证数据一致性和格式）
- `verifiers/logical-verifier.ts` - 逻辑验证（验证论点自洽性）
- `verifiers/completeness-verifier.ts` - 完成度验证（验证任务完成情况）
- `analyzers/score-calculator.ts` - 评分计算器（加权评分）
- `analyzers/issue-collector.ts` - 问题收集器（问题分类和优先级）
- `analyzers/suggestion-generator.ts` - 建议生成器（生成修复建议）

**设计决策**：参见文件头部的"为什么这样设计"注释

**使用示例**：

```typescript
const verificationAgent = new VerificationAgent();
const result = await verificationAgent.verify(
  {
    parties: { plaintiff: '张三', defendant: '李四' },
    claims: ['请求赔偿...'],
    legalBasis: [{ lawName: '民法典', articleNumber: '第xxx条' }],
  },
  sourceData
);

if (!result.passed) {
  console.log('验证未通过，问题数:', result.issues.length);
  console.log('修复建议:', result.suggestions);
}
```

---

### PlanningAgent

**文件路径**：`src/lib/agent/coordinator/coordinator-agent.ts`（待重构为PlanningAgent）

**功能**：任务规划和策略制定

**职责**：

- 任务分解（将复杂任务拆解为子任务）
- 策略规划（选择最优执行策略）
- 工作流编排（协调其他Agent执行任务）

**设计决策**：参见 [ADR-001: 采用6个核心Agent替代10个Agent](docs/architecture/ARCHITECTURE_DECISION_RECORDS.md#adr-001采用6个核心agent替代10个agent)

---

### AnalysisAgent

**文件路径**：`src/lib/agent/doc-analyzer/doc-analyzer-agent.ts`（整合后）

**功能**：证据分析和时间线提取

**职责**：

- 整合DocAnalyzer、EvidenceAnalyzer、TimelineExtractor
- 文档解析、证据分析、时间线提取

**设计决策**：参见 [ADR-001: 采用6个核心Agent替代10个Agent](docs/architecture/ARCHITECTURE_DECISION_RECORDS.md#adr-001采用6个核心agent替代10个agent)

---

### LegalAgent

**文件路径**：待创建（整合LawRetriever + ArgumentGenerator）

**功能**：法律检索和法条适用性分析

**职责**：

- 法律检索（根据案件信息检索相关法条）
- 法条适用性分析（判断法条是否适用于当前案件）
- 论点生成（基于法条和法律原则生成论点）

**设计决策**：参见 [ADR-001: 采用6个核心Agent替代10个Agent](docs/architecture/ARCHITECTURE_DECISION_RECORDS.md#adr-001采用6个核心agent替代10个agent)

---

### GenerationAgent

**文件路径**：待创建（从ArgumentGenerator独立出来）

**功能**：文书生成和流式输出

**职责**：

- 文书生成（生成起诉状、答辩状等法律文书）
- 辩论内容生成（生成辩论论点和论据）
- 流式输出（使用SSE实现实时输出）

**设计决策**：参见 [ADR-008: 选择SSE流式输出而非WebSocket](docs/architecture/ARCHITECTURE_DECISION_RECORDS.md#adr-008选择sse流式输出而非websocket)

---

## AI服务模块

### AIService

**文件路径**：`src/lib/ai/service-refactored.ts`

**功能**：统一AI服务接口，支持DeepSeek和智谱清言

**架构**：

```
AIService (统一接口)
    ├─ DeepSeekClient
    └─ ZhipuAIClient
```

**关键特性**：

- 自动降级：DeepSeek失败时自动切换到智谱清言
- 错误重试：支持重试机制
- 流式输出：支持SSE流式输出

**使用示例**：

```typescript
const aiService = new AIService();
const response = await aiService.chat({
  model: 'deepseek-chat',
  messages: [{ role: 'user', content: '用户消息' }],
  maxTokens: 1500,
  timeout: 60000,
});
```

---

### DeepSeek Client

**文件路径**：`src/lib/ai/deepseek/client.ts`

**功能**：DeepSeek API客户端

**关键特性**：

- 中文优化：针对中文场景优化
- 低成本：API成本约为OpenAI的1/5
- 高准确率：适合法律辩论场景

**配置**：

```typescript
{
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseUrl: "https://api.deepseek.com/v1",
  defaultModel: "deepseek-chat",
  timeout: 60000,
}
```

---

### AI Client Factory

**文件路径**：`src/lib/ai/client-factory.ts`

**功能**：AI客户端工厂模式，支持多种AI服务

**支持的AI服务**：

- DeepSeek（主要）
- 智谱清言（备用）

**使用示例**：

```typescript
const client = await createAIClient({
  provider: 'deepseek',
  config: {
    apiKey: process.env.DEEPSEEK_API_KEY,
  },
});
```

---

## 前端模块

### App Page

**文件路径**：`src/app/page.tsx`

**功能**：主应用页面，案件列表和案件详情

**路由**：`/`

**关键组件**：

- 案件列表
- 案件详情
- 文件上传
- 辩论历史

---

### Debate Page

**文件路径**：`src/app/debate/[caseId]/page.tsx`

**功能**：辩论页面，进行多轮辩论

**路由**：`/debate/[caseId]`

**关键功能**：

- 实时辩论
- 流式输出（SSE）
- 辩论历史
- AI对战

---

### Components

**目录**：`src/components/`

**主要组件**：

- `debate/` - 辩论相关组件
- `document/` - 文档相关组件
- `ui/` - UI基础组件（shadcn/ui）

---

## 数据库模块

### Prisma Schema

**文件路径**：`prisma/schema.prisma`

**功能**：数据库模型定义

**主要模型**：

- `Case` - 案件
- `Document` - 文档
- `Debate` - 辩论
- `DebateRound` - 辩论轮次
- `User` - 用户
- `LawArticle` - 法条
- `AgentMemory` - 记忆

---

### Memory Tables

**表名**：`agent_memories`

**字段**：

- `memoryId` - 记忆ID
- `type` - 记忆类型（WORKING、HOT、COLD）
- `memoryValue` - 记忆值（JSON格式）
- `importanceScore` - 重要性评分
- `accessCount` - 访问次数
- `ttl` - 过期时间
- `compressed` - 是否压缩

**索引**：

- `memoryId` - 主键
- `type` - 按类型查询
- `userId` - 按用户查询

---

## 测试模块

### Unit Tests

**目录**：`src/__tests__/unit/`

**测试覆盖**：

- DocAnalyzer单元测试
- MemoryAgent单元测试
- VerificationAgent单元测试
- AI服务单元测试

**运行命令**：

```bash
npm run test:unit
```

---

### Integration Tests

**目录**：`src/__tests__/integration/`

**测试覆盖**：

- Agent间集成测试
- 数据库集成测试
- API集成测试

**运行命令**：

```bash
npm run test:integration
```

---

### E2E Tests

**目录**：`src/__tests__/e2e/`

**测试覆盖**：

- 完整辩论流程测试
- 文档上传和分析测试
- 多轮辩论测试

**运行命令**：

```bash
npm run test:e2e
```

---

## 关键流程

### 辩论生成流程

```
1. 用户上传文档
   ↓
2. DocAnalyzer解析文档
   ├─ Layer 0: 文本提取
   ├─ Layer 1: 质量预检
   ├─ Layer 2: AI核心理解
   ├─ Layer 3: 规则验证
   ├─ Layer 4: 双重审查
   └─ Layer 5: 缓存层
   ↓
3. PlanningAgent规划辩论策略
   ├─ 任务分解
   ├─ 策略规划
   └─ 工作流编排
   ↓
4. MemoryAgent检索相关记忆
   ├─ Working Memory: 当前会话
   ├─ Hot Memory: 近期历史
   └─ Cold Memory: 长期知识
   ↓
5. LegalAgent检索法条和生成论点
   ├─ 法律检索
   ├─ 法条适用性分析
   └─ 论点生成
   ↓
6. GenerationAgent生成辩论内容
   ├─ 文书生成
   ├─ 辩论内容生成
   └─ 流式输出（SSE）
   ↓
7. VerificationAgent验证辩论质量
   ├─ 事实准确性验证
   ├─ 逻辑一致性验证
   └─ 任务完成度验证
   ↓
8. MemoryAgent存储辩论结果
   └─ Working Memory → Hot Memory → Cold Memory
```

---

## 设计决策记录

所有关键设计决策记录在：

- **docs/architecture/ARCHITECTURE_DECISION_RECORDS.md**
  - ADR-001: 采用6个核心Agent替代10个Agent
  - ADR-002: 保留DocAnalyzer五层架构
  - ADR-003: 采用Manus三层记忆架构
  - ADR-004: 选择Next.js全栈框架
  - ADR-005: 选择PostgreSQL关系型数据库
  - ADR-006: 选择Prisma ORM
  - ADR-007: 选择DeepSeek作为主要AI服务
  - ADR-008: 选择SSE流式输出而非WebSocket
  - ADR-009: 文件行数限制500行
  - ADR-010: 禁止创建重复文件

---

## AI开发规范

所有AI开发规范记录在：

- **.clinerules**
  - 代码风格要求
  - 文件行数限制
  - 禁止创建重复文件
  - 测试覆盖率要求
  - 错误处理规范

---

## 常见任务快速指南

### 如何添加新功能？

1. 在AI_TASK_TRACKING.md中找到相关任务
2. 查阅ARCHITECTURE_DECISION_RECORDS.md了解设计背景
3. 查阅CODE_NAVIGATION_MAP.md定位相关代码
4. 查阅AI_ASSISTANT_QUICK_START.md了解项目结构
5. 按照CLINERULES规范编写代码

### 如何调试问题？

1. 查阅docs/archive/problems-and-solutions.md（已解决的历史问题）
2. 查阅AI_TASK_TRACKING.md（查看相关任务的解决方案）
3. 查阅ARCHITECTURE_DECISION_RECORDS.md（了解设计背景）
4. 运行相关测试验证修复

### 如何编写测试？

1. 查阅CLINERULES中的测试规范
2. 查阅src/**tests**/（参考现有测试）
3. 确保测试覆盖率>80%
4. 运行`npm run test:unit`验证

### 如何优化代码？

1. 检查文件行数是否超过500行（CLINERULES）
2. 检查是否违反"禁止创建重复文件"规则（CLINERULES）
3. 参考ARCHITECTURE_DECISION_RECORDS.md中的设计决策
4. 运行测试确保优化不影响功能

---

## 相关文档

- [AI助手快速上手指南](docs/AI_ASSISTANT_QUICK_START.md)
- [主任务追踪文件](docs/task-tracking/AI_TASK_TRACKING.md)
- [架构决策记录](docs/architecture/ARCHITECTURE_DECISION_RECORDS.md)
- [代码风格指南](docs/guides/CODE_STYLE.md)
- [AI开发规范](.clinerules)
- [技术问题解决记录](docs/archive/problems-and-solutions.md)

---

_文档版本：v1.0_  
_创建时间：2026-01-04_
