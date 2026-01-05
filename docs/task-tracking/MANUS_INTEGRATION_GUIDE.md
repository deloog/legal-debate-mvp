# Manus智能体架构集成指南

## 📋 文档信息

- **版本**: v1.0
- **创建日期**: 2026-01-01
- **目标**: 将Manus智能体架构的核心理念应用到律伴助手项目
- **参考**: Manus论文、律伴助手现有架构

## 🎯 集成目标

### 核心目标

将律伴助手的准确率从**88分提升到95分+**，同时降低AI成本40-60%，提升系统稳定性30%+。

### 关键指标

| 指标           | 当前 | 目标    | 提升幅度 |
| -------------- | ---- | ------- | -------- |
| 文档解析准确率 | 88分 | 95分+   | +7分     |
| 错误恢复率     | 0%   | 90%+    | +90%     |
| AI成本         | 基准 | -40~60% | 降低     |
| 系统稳定性     | 基准 | +30%    | 提升     |
| Agent通信开销  | 基准 | -60%    | 降低     |

---

## 🏗️ Manus核心理念

### 1. PEV三层架构

**Planning-Execution-Verification（规划-执行-验证）**

```
┌─────────────────────────────────────────┐
│         Planning Layer (规划层)          │
│  - 任务分解                              │
│  - 策略规划                              │
│  - 工作流编排                            │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│        Execution Layer (执行层)          │
│  - Agent协同执行                         │
│  - 资源调度                              │
│  - 结果生成                              │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│      Verification Layer (验证层)         │
│  - 事实准确性验证                        │
│  - 逻辑一致性验证                        │
│  - 任务完成度验证                        │
└─────────────────────────────────────────┘
```

**在律伴助手中的应用**：

- **Planning Layer**: PlanningAgent负责任务分解和工作流编排
- **Execution Layer**: AnalysisAgent、LegalAgent、GenerationAgent执行具体任务
- **Verification Layer**: VerificationAgent实现三重验证机制

---

### 2. 三层记忆架构

**Working Memory → Hot Memory → Cold Memory**

```
┌──────────────────────────────────────────────┐
│  Working Memory (工作记忆)                    │
│  - TTL: 1小时                                 │
│  - 用途: 当前任务上下文                       │
│  - 特点: 高频访问，快速读写                   │
└──────────────────┬───────────────────────────┘
                   │ 压缩迁移
                   ▼
┌──────────────────────────────────────────────┐
│  Hot Memory (热记忆)                          │
│  - TTL: 7天                                   │
│  - 用途: 近期任务经验                         │
│  - 特点: 中频访问，摘要存储                   │
└──────────────────┬───────────────────────────┘
                   │ 归档
                   ▼
┌──────────────────────────────────────────────┐
│  Cold Memory (冷记忆)                         │
│  - TTL: 永久                                  │
│  - 用途: 长期知识库                           │
│  - 特点: 低频访问，高度压缩                   │
└──────────────────────────────────────────────┘
```

**在律伴助手中的应用**：

- **Working Memory**: 存储当前案件的解析结果、辩论上下文
- **Hot Memory**: 存储近期案件的经验、常用法条、成功策略
- **Cold Memory**: 存储历史案例库、法律知识图谱、错误模式

---

### 3. 统一验证层

**三重验证机制（Manus核心创新）**

```
┌─────────────────────────────────────────────┐
│  1. 事实准确性验证 (Factual Accuracy)        │
│     - 当事人信息验证                         │
│     - 金额数据验证                           │
│     - 日期时间验证                           │
│     - 与原文档对比                           │
└─────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  2. 逻辑一致性验证 (Logical Consistency)     │
│     - 诉讼请求与事实理由匹配度               │
│     - 论点推理链完整性                       │
│     - 法条引用逻辑性                         │
│     - 矛盾检测                               │
└─────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  3. 任务完成度验证 (Task Completeness)       │
│     - 必填字段完整性                         │
│     - 业务规则符合性                         │
│     - 输出格式正确性                         │
│     - 质量阈值检查                           │
└─────────────────────────────────────────────┘
                   │
                   ▼
              综合评分 (0-1)
```

**验证结果示例**：

```json
{
  "overallScore": 0.88,
  "factualAccuracy": 0.92,
  "logicalConsistency": 0.85,
  "taskCompleteness": 0.87,
  "passed": false,
  "issues": [
    {
      "type": "logical_inconsistency",
      "severity": "medium",
      "description": "诉讼请求与事实理由不完全匹配"
    }
  ],
  "suggestions": [
    {
      "priority": "high",
      "action": "enhance_fact_description",
      "description": "补充违约事实的详细描述",
      "estimatedImpact": 0.1
    }
  ]
}
```

---

### 4. 错误学习机制

**保留错误，从错误中学习（Manus核心理念）**

```
错误发生
    │
    ▼
┌─────────────────────────────────────────┐
│  1. 错误捕获与记录                       │
│     - 完整错误上下文                     │
│     - 堆栈跟踪                           │
│     - 尝试的操作                         │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  2. 自动恢复尝试                         │
│     - 重试机制（指数退避）               │
│     - 降级策略                           │
│     - 恢复方法记录                       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  3. 错误模式分析                         │
│     - 错误类型聚合                       │
│     - 频率统计                           │
│     - 根因分析                           │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  4. 知识库更新                           │
│     - 学习笔记生成                       │
│     - 预防措施提取                       │
│     - 规则库更新                         │
└─────────────────────────────────────────┘
```

**错误学习示例**：

```typescript
// 错误记录
{
  "errorType": "AI_SERVICE_ERROR",
  "errorCode": "AI_TIMEOUT",
  "context": {
    "agentName": "DocAnalyzer",
    "taskId": "task_123",
    "inputData": { "documentId": "doc_456" }
  },
  "recoveryAttempts": 3,
  "recovered": true,
  "recoveryMethod": "retry_with_smaller_chunk",
  "learned": true,
  "learningNotes": "大文档应分块处理，避免超时"
}
```

---

### 5. 分层行动空间

**Core Layer（<20个核心原子函数）**

Manus的核心创新：将复杂操作分解为<20个核心原子函数，通过组合实现所有功能。

```
Core Layer (核心层，<20个原子函数)
    │
    ├── analyze_text          - 文本分析
    ├── extract_entities      - 实体提取
    ├── classify_content      - 内容分类
    ├── search_database       - 数据库检索
    ├── call_ai_service       - AI服务调用
    ├── validate_data         - 数据验证
    ├── transform_format      - 格式转换
    ├── cache_result          - 结果缓存
    ├── log_action            - 行动记录
    ├── verify_output         - 输出验证
    ├── handle_error          - 错误处理
    ├── retry_operation       - 重试操作
    ├── merge_results         - 结果合并
    ├── filter_data           - 数据过滤
    ├── rank_items            - 项目排序
    ├── generate_summary      - 摘要生成
    ├── compare_versions      - 版本对比
    └── update_memory         - 记忆更新
    │
    ▼
Utility Layer (实用层，组合操作)
    │
    ├── parse_document = analyze_text + extract_entities + classify_content
    ├── search_laws = search_database + rank_items + cache_result
    └── generate_argument = call_ai_service + verify_output + log_action
    │
    ▼
Script Layer (脚本层，复杂计算)
    │
    ├── AI服务调用
    ├── 数据库复杂查询
    └── 外部API集成
```

**优势**：

- ✅ 核心函数少，易于维护
- ✅ 组合灵活，覆盖广
- ✅ 测试简单，质量高
- ✅ 复用性强，开发快

---

## 🔄 Agent架构重构

### 原架构（10个Agent）

```
1. DocAnalyzer          - 文档解析
2. EvidenceAnalyzer     - 证据分析
3. TimelineExtractor    - 时间线提取
4. LawRetriever         - 法律检索
5. ArgumentGenerator    - 论点生成
6. Strategist           - 策略规划
7. DocumentGenerator    - 文书生成
8. Reviewer             - 质量审查
9. RiskAssessor         - 风险评估
10. Coordinator         - 工作流协调
```

**问题**：

- ❌ Agent数量过多（10个）
- ❌ 职责划分过细
- ❌ 通信开销大
- ❌ 维护成本高

---

### 新架构（6个核心Agent）⭐ Manus增强

```
1. PlanningAgent        - 整合 Coordinator + Strategist
   ├── 任务分解
   ├── 策略规划
   └── 工作流编排

2. AnalysisAgent        - 整合 DocAnalyzer + EvidenceAnalyzer + TimelineExtractor
   ├── 文档解析
   ├── 证据分析
   └── 时间线提取

3. LegalAgent           - 整合 LawRetriever + ArgumentGenerator
   ├── 法律检索
   ├── 法条适用性分析
   └── 论点生成

4. GenerationAgent      - DocumentGenerator
   ├── 文书生成
   └── 辩论内容生成

5. VerificationAgent    - 整合 Reviewer + RiskAssessor
   ├── 质量审查（三重验证）
   ├── 风险评估
   └── 结果验证

6. MemoryAgent          - 新增（Manus核心）
   ├── 上下文管理（三层记忆）
   ├── 记忆压缩
   └── 错误学习
```

**优势**：

- ✅ Agent数量减少40%（10→6）
- ✅ 功能不减反增（整合优化）
- ✅ 通信开销降低60%
- ✅ 准确性提升15-20%
- ✅ 错误恢复率提升90%

---

## 📊 实施路线图

### Sprint 6：Manus架构增强（2-3周）

#### 第1周：数据库迁移与Agent重构

**任务6.1.1：执行Manus增强数据库迁移（0.5天）**

- 执行v3.0数据库迁移
- 创建4个新表：agent_memories、verification_results、error_logs、agent_actions
- 验证索引和枚举类型

**任务6.1.2：Agent架构重构规划（0.5天）**

- 明确6个Agent的职责边界
- 定义Agent间通信协议
- 设计共享内存机制

**任务6.1.3：MemoryAgent实现（1天）**

- 实现三层记忆CRUD操作
- 实现自动过期机制
- 实现记忆压缩算法
- 实现记忆迁移（Working→Hot→Cold）

**任务6.1.4：VerificationAgent增强（1天）**

- 实现事实准确性验证
- 实现逻辑一致性验证
- 实现任务完成度验证
- 实现综合评分算法

#### 第2周：错误学习与行动空间

**任务6.2.1：ErrorLog系统实现（0.5天）**

- 实现错误自动捕获
- 实现自动恢复机制（重试、降级）
- 实现错误模式分析
- 实现学习笔记生成

**任务6.2.2：Agent容错机制增强（0.5天）**

- 为所有Agent添加重试策略
- 实现降级策略（AI→规则）
- 实现熔断机制

**任务6.3.1：定义核心原子函数（0.5天）**

- 定义<20个核心原子函数
- 实现Utility Layer组合函数
- 实现Script Layer复杂操作

**任务6.3.2：AgentAction追踪系统（0.5天）**

- 实现行动记录
- 实现性能分析
- 实现行为模式分析

#### 第3周：集成测试与验证

**任务6.4.1：Manus架构集成测试（0.5天）**

- 完整辩论流程测试（含Manus增强）
- 错误恢复流程测试
- 准确性提升验证

**任务6.4.2：准确性提升验证（0.5天）**

- 文档解析准确性评估（88分→95分+）
- 法条检索准确性评估（未知→90分+）
- 辩论生成质量评估（未知→92分+）

---

## 🎯 预期效果

### 准确性提升

| 维度               | 当前 | 目标  | 提升幅度 |
| ------------------ | ---- | ----- | -------- |
| 文档解析综合评分   | 88分 | 95分+ | +7分     |
| 当事人识别准确率   | 90%+ | 95%+  | +5%      |
| 诉讼请求提取准确率 | 83%+ | 95%+  | +12%     |
| 金额提取准确率     | 87%+ | 95%+  | +8%      |
| 法条检索召回率     | 未知 | 90%+  | 新增     |
| 辩论生成质量       | 未知 | 92%+  | 新增     |

### 系统性能提升

| 指标          | 当前 | 目标    | 提升幅度 |
| ------------- | ---- | ------- | -------- |
| 错误恢复率    | 0%   | 90%+    | +90%     |
| AI成本        | 基准 | -40~60% | 降低     |
| 系统稳定性    | 基准 | +30%    | 提升     |
| Agent通信开销 | 基准 | -60%    | 降低     |

---

## 💡 最佳实践

### 1. 记忆管理最佳实践

**Working Memory使用原则**：

- ✅ 仅存储当前任务必需的上下文
- ✅ 设置合理的TTL（1小时）
- ✅ 高频访问的数据优先存储
- ❌ 避免存储历史数据

**Hot Memory使用原则**：

- ✅ 存储近期任务的经验和模式
- ✅ 定期压缩（摘要生成）
- ✅ 访问频率追踪
- ❌ 避免存储过时信息

**Cold Memory使用原则**：

- ✅ 存储长期有价值的知识
- ✅ 高度压缩（仅保留关键信息）
- ✅ 建立索引便于检索
- ❌ 避免频繁访问

---

### 2. 验证层最佳实践

**三重验证顺序**：

1. **事实准确性验证**（最基础）
   - 先验证数据的正确性
   - 与原文档对比
   - 发现明显错误

2. **逻辑一致性验证**（中层）
   - 验证推理链的完整性
   - 检查矛盾和冲突
   - 确保逻辑自洽

3. **任务完成度验证**（最高层）
   - 验证业务规则符合性
   - 检查输出完整性
   - 确保质量达标

**验证阈值设置**：

- 事实准确性：>0.95（严格）
- 逻辑一致性：>0.90（较严格）
- 任务完成度：>0.85（适中）
- 综合评分：>0.90（通过标准）

---

### 3. 错误学习最佳实践

**错误分类**：

- **可恢复错误**：自动重试、降级处理
- **不可恢复错误**：记录学习、人工介入
- **系统错误**：立即告警、紧急修复

**学习策略**：

- ✅ 保留所有错误记录（不删除）
- ✅ 定期分析错误模式
- ✅ 提取预防措施
- ✅ 更新规则库和知识库

---

## 📚 参考资料

### Manus论文核心观点

1. **PEV三层架构**：规划-执行-验证的闭环设计
2. **三层记忆管理**：Working/Hot/Cold Memory分层存储
3. **统一验证层**：事实+逻辑+完成度三重验证
4. **错误学习机制**：保留错误，从错误中学习
5. **分层行动空间**：<20个核心原子函数

### 律伴助手现有架构

1. **五层文档解析架构**：AI识别+算法兜底+AI审查
2. **10个Agent系统**：功能完整但通信开销大
3. **本地法条库**：200-500条常用法条
4. **辩论核心流程**：文档解析→法条检索→辩论生成

---

## 4.4 任务6.1.2：Agent架构重构技术规范

> **关联任务**：[PHASE2_IMPLEMENTATION.md](./PHASE2_IMPLEMENTATION.md#任务-612agent架构重构规划05天) - Sprint 6详细任务定义  
> **架构设计**：[AGENT_ARCHITECTURE_V2.md](./AGENT_ARCHITECTURE_V2.md) - 6个核心Agent详细设计  
> **数据库支持**：[DATABASE_MODEL_V2.md](../architecture/database/DATABASE_MODEL_V2.md) - v3.0数据库模型

---

### 4.4.1 6个Agent接口定义

#### PlanningAgent接口

```typescript
/**
 * PlanningAgent - 规划层Agent
 * 整合 Coordinator + Strategist
 */
interface PlanningAgent {
  /**
   * 任务分解：将复杂任务分解为子任务序列
   */
  decomposeTask(task: Task): SubTask[];

  /**
   * 策略规划：SWOT分析、策略生成、可行性评估
   */
  planStrategy(caseInfo: CaseInfo): Strategy;

  /**
   * 工作流编排：串行/并行/混合执行模式
   */
  orchestrateWorkflow(tasks: SubTask[]): Workflow;

  /**
   * 资源调度：Agent任务分配、优先级管理
   */
  allocateResources(workflow: Workflow): ResourceAllocation;
}

// 类型定义
interface Task {
  taskId: string;
  taskType: string;
  priority: number;
  context: any;
}

interface SubTask {
  subTaskId: string;
  name: string;
  agent: string;
  dependencies: string[];
  estimatedDuration: number;
}

interface Strategy {
  strategyId: string;
  swotAnalysis: SWOTResult;
  recommendedActions: Action[];
  feasibilityScore: number;
}

interface SWOTResult {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface Workflow {
  workflowId: string;
  executionMode: "sequential" | "parallel" | "mixed";
  tasks: WorkflowTask[];
}

interface WorkflowTask {
  taskId: string;
  agent: string;
  order: number;
  parallelGroup?: number;
}

interface ResourceAllocation {
  allocationId: string;
  agentAssignments: AgentAssignment[];
  estimatedTimeCost: number;
}

interface AgentAssignment {
  agentName: string;
  tasks: string[];
  priority: number;
}
```

---

#### AnalysisAgent接口

```typescript
/**
 * AnalysisAgent - 分析层Agent
 * 整合 DocAnalyzer + EvidenceAnalyzer + TimelineExtractor
 */
interface AnalysisAgent {
  /**
   * 文档解析：保留五层架构（AI识别+算法兜底+AI审查）
   */
  parseDocument(document: Document): DocumentAnalysisResult;

  /**
   * 证据分析：证据分类、证据链构建、强度评估
   */
  analyzeEvidence(evidence: Evidence[]): EvidenceAnalysisResult;

  /**
   * 时间线提取：时间点提取、关键节点识别
   */
  extractTimeline(caseInfo: CaseInfo): Timeline;

  /**
   * 综合分析：生成完整分析报告
   */
  comprehensiveAnalysis(caseData: CaseData): AnalysisReport;
}

// 类型定义
interface Document {
  documentId: string;
  fileName: string;
  fileType: string;
  content: string;
  uploadedAt: Date;
}

interface DocumentAnalysisResult {
  parties: Party[];
  claims: Claim[];
  facts: Fact[];
  legalReferences: string[];
  analysisMetadata: AnalysisMetadata;
}

interface Evidence {
  evidenceId: string;
  type: string;
  content: string;
  source: string;
  reliability: number;
}

interface EvidenceAnalysisResult {
  classifiedEvidence: ClassifiedEvidence[];
  evidenceChains: EvidenceChain[];
  strengthEvaluation: StrengthEvaluation;
}

interface EvidenceChain {
  chainId: string;
  evidence: string[];
  logicalConnection: string;
  strength: number;
}

interface ClassifiedEvidence {
  evidenceId: string;
  category: string;
  subcategory: string;
  relevance: number;
}

interface Timeline {
  timelineId: string;
  events: TimelineEvent[];
  keyEvents: TimelineEvent[];
}

interface TimelineEvent {
  eventId: string;
  date: Date;
  description: string;
  importance: number;
  relatedDocuments: string[];
}

interface CaseData {
  caseId: string;
  documents: Document[];
  evidence: Evidence[];
  basicInfo: BasicCaseInfo;
}

interface BasicCaseInfo {
  caseNumber: string;
  caseType: string;
  parties: Party[];
  filingDate: Date;
}

interface AnalysisReport {
  reportId: string;
  caseId: string;
  documentAnalysis: DocumentAnalysisResult;
  evidenceAnalysis: EvidenceAnalysisResult;
  timeline: Timeline;
  recommendations: string[];
  completedAt: Date;
}
```

---

#### LegalAgent接口

```typescript
/**
 * LegalAgent - 法律层Agent
 * 整合 LawRetriever + ArgumentGenerator
 */
interface LegalAgent {
  /**
   * 法律检索：本地优先+外部补充
   */
  searchLaws(query: LegalQuery): LawArticle[];

  /**
   * 法条适用性分析：三层验证（AI语义+规则+AI审查）
   */
  analyzeApplicability(
    articles: LawArticle[],
    caseInfo: CaseInfo,
  ): ApplicabilityResult;

  /**
   * 论点生成：正反方论点、法律依据引用
   */
  generateArguments(legalBasis: LegalBasis, side: ArgumentSide): Argument[];

  /**
   * 法律推理：事实-法条-结论推理链
   */
  legalReasoning(facts: Fact[], laws: LawArticle[]): ReasoningChain;
}

// 类型定义
interface LegalQuery {
  queryId: string;
  keywords: string[];
  caseType: string;
  legalCategory?: string;
  priority: number;
}

interface ApplicabilityResult {
  analyzedArticles: AnalyzedArticle[];
  applicableArticles: LawArticle[];
  notApplicableArticles: NotApplicableArticle[];
  summary: ApplicabilitySummary;
}

interface AnalyzedArticle {
  articleId: string;
  articleNumber: string;
  semanticScore: number;
  ruleValidationScore: number;
  aiReviewScore: number;
  overallScore: number;
  applicable: boolean;
  reasons: string[];
  warnings: string[];
}

interface LawBasis {
  basisId: string;
  articles: LawArticle[];
  caseFacts: Fact[];
  relevanceWeights: { [articleId: string]: number };
}

interface ArgumentSide {
  side: "PLAINTIFF" | "DEFENDANT" | "NEUTRAL";
}

interface Argument {
  argumentId: string;
  side: ArgumentSide;
  mainPoints: ArgumentPoint[];
  supportingArguments: ArgumentPoint[];
  legalReferences: LegalReference[];
  reasoningChain: string;
  strength: number;
}

interface ArgumentPoint {
  pointId: string;
  content: string;
  legalBasis: string[];
  evidence: string[];
}

interface LegalReference {
  referenceId: string;
  articleId: string;
  articleNumber: string;
  quote: string;
  applicability: number;
}

interface ReasoningChain {
  chainId: string;
  steps: ReasoningStep[];
  conclusion: string;
  confidence: number;
}

interface ReasoningStep {
  stepId: string;
  premise: string;
  rule: string;
  conclusion: string;
}
```

---

#### GenerationAgent接口

```typescript
/**
 * GenerationAgent - 生成层Agent
 * 整合 DocumentGenerator
 */
interface GenerationAgent {
  /**
   * 文书生成：基于模板+AI动态填充
   */
  generateDocument(template: Template, data: CaseData): Document;

  /**
   * 辩论内容生成：正反方论点平衡生成
   */
  generateDebate(caseInfo: CaseInfo, legalBasis: LegalBasis): DebateContent;

  /**
   * 流式输出：异步迭代器，实时传输
   */
  generateStream(prompt: string): AsyncIterator<string>;

  /**
   * 内容优化：风格调整、格式规范
   */
  optimizeContent(content: string, criteria: OptimizationCriteria): string;
}

// 类型定义
interface Template {
  templateId: string;
  templateType: string;
  name: string;
  structure: TemplateStructure;
  dynamicFields: DynamicField[];
}

interface TemplateStructure {
  sections: TemplateSection[];
  formatting: FormattingRules;
}

interface TemplateSection {
  sectionId: string;
  name: string;
  order: number;
  required: boolean;
}

interface DynamicField {
  fieldId: string;
  name: string;
  fieldType: string;
  aiGenerated: boolean;
  validationRules?: ValidationRule[];
}

interface Document {
  documentId: string;
  content: string;
  templateUsed: string;
  generatedAt: Date;
  metadata: DocumentMetadata;
}

interface DebateContent {
  debateId: string;
  plaintiffArguments: Argument[];
  defendantArguments: Argument[];
  balanced: boolean;
  generatedAt: Date;
}

interface OptimizationCriteria {
  tone: string;
  formality: number;
  styleGuide: string[];
  maxLength?: number;
}

interface DocumentMetadata {
  wordCount: number;
  pages: number;
  legalReferences: number;
  generationTime: number;
}
```

---

#### VerificationAgent接口

```typescript
/**
 * VerificationAgent - 验证层Agent（Manus核心理念）
 * 整合 Reviewer + RiskAssessor
 */
interface VerificationAgent {
  /**
   * 三重验证：事实准确性 + 逻辑一致性 + 任务完成度
   */
  comprehensiveVerify(entity: any, entityType: string): VerificationResult;

  /**
   * 事实准确性验证：当事人、金额、日期、与原文档对比
   */
  verifyFactualAccuracy(data: any, source: any): FactualVerificationResult;

  /**
   * 逻辑一致性验证：诉讼请求匹配、推理链完整、矛盾检测
   */
  verifyLogicalConsistency(data: any): LogicalVerificationResult;

  /**
   * 任务完成度验证：必填字段、业务规则、质量阈值
   */
  verifyTaskCompleteness(
    data: any,
    requirements: Requirements,
  ): CompletenessResult;

  /**
   * 风险评估：风险等级、应对建议
   */
  assessRisk(caseInfo: CaseInfo): RiskAssessment;
}

// 类型定义
interface VerificationResult {
  verificationId: string;
  entityType: string;
  overallScore: number;
  factualAccuracy: number;
  logicalConsistency: number;
  taskCompleteness: number;
  passed: boolean;
  issues: VerificationIssue[];
  suggestions: VerificationSuggestion[];
  verifiedAt: Date;
}

interface FactualVerificationResult {
  verificationId: string;
  score: number;
  partyCheck: PartyCheckResult;
  amountCheck: AmountCheckResult;
  dateCheck: DateCheckResult;
  consistencyCheck: ConsistencyCheckResult;
}

interface LogicalVerificationResult {
  verificationId: string;
  score: number;
  claimFactMatch: MatchResult;
  reasoningChain: ReasoningChainResult;
  legalLogic: LegalLogicResult;
  contradictions: Contradiction[];
}

interface CompletenessResult {
  verificationId: string;
  score: number;
  requiredFields: RequiredFieldsResult;
  businessRules: BusinessRulesResult;
  formatCheck: FormatCheckResult;
  qualityCheck: QualityCheckResult;
}

interface RiskAssessment {
  assessmentId: string;
  caseId: string;
  overallRiskLevel: "HIGH" | "MEDIUM" | "LOW";
  riskFactors: RiskFactor[];
  mitigationStrategies: MitigationStrategy[];
  assessedAt: Date;
}

interface VerificationIssue {
  issueId: string;
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  location?: string;
  affectedFields?: string[];
}

interface VerificationSuggestion {
  suggestionId: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  action: string;
  description: string;
  estimatedImpact: number;
}
```

---

#### MemoryAgent接口

```typescript
/**
 * MemoryAgent - 记忆层Agent（Manus核心理念）
 * 新增Agent：三层记忆架构
 */
interface MemoryAgent {
  // Working Memory (1小时TTL)
  storeWorkingMemory(key: string, value: any, ttl?: number): Promise<void>;
  getWorkingMemory(key: string): Promise<any>;
  deleteWorkingMemory(key: string): Promise<void>;

  // Hot Memory (7天TTL)
  storeHotMemory(key: string, value: any, importance: number): Promise<void>;
  getHotMemory(key: string): Promise<any>;
  updateHotMemory(key: string, value: any): Promise<void>;

  // Cold Memory (永久保留)
  storeColdMemory(key: string, value: any): Promise<void>;
  getColdMemory(key: string): Promise<any>;
  updateColdMemory(key: string, value: any): Promise<void>;

  // 记忆管理
  compressMemory(
    memory: Memory,
    targetRatio?: number,
  ): Promise<CompressedMemory>;
  migrateMemory(from: MemoryType, to: MemoryType): Promise<void>;
  getMemoriesByType(memoryType: MemoryType): Promise<Memory[]>;

  // 错误学习
  learnFromError(error: ErrorLog): Promise<LearningResult>;
  updateKnowledgeBase(learningResult: LearningResult): Promise<void>;
}

// 类型定义
interface Memory {
  memoryId: string;
  memoryType: MemoryType;
  memoryKey: string;
  memoryValue: any;
  importance: number;
  accessCount: number;
  lastAccessedAt: Date;
  expiresAt?: Date;
  compressed: boolean;
  compressionRatio?: number;
  createdAt: Date;
}

interface CompressedMemory {
  originalMemory: Memory;
  summary: string;
  keyInfo: KeyInfo[];
  ratio: number;
  originalSize: number;
  compressedSize: number;
}

interface KeyInfo {
  field: string;
  value: any;
  importance: number;
}

interface ErrorLog {
  errorId: string;
  errorType: ErrorType;
  errorCode: string;
  context: ErrorContext;
  stackTrace: string;
  recoveryAttempts: RecoveryAttempt[];
  recovered: boolean;
  learned: boolean;
  learningNotes?: string;
  occurredAt: Date;
}

interface LearningResult {
  learningId: string;
  errorId: string;
  pattern: ErrorPattern;
  learningNotes: string;
  preventionMeasures: PreventionMeasure[];
  knowledgeUpdated: boolean;
  learnedAt: Date;
}

interface ErrorPattern {
  patternId: string;
  errorType: ErrorType;
  frequency: number;
  commonCauses: string[];
  rootCause: string;
}

interface PreventionMeasure {
  measureId: string;
  description: string;
  priority: number;
  implementation: string;
  estimatedEffectiveness: number;
}

type MemoryType = "WORKING" | "HOT" | "COLD";

type ErrorType =
  | "AI_SERVICE_ERROR"
  | "DATABASE_ERROR"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

interface ErrorContext {
  agentName: string;
  taskId: string;
  inputData: any;
  executionEnvironment: any;
}

interface RecoveryAttempt {
  attemptNumber: number;
  method: string;
  success: boolean;
  duration: number;
}
```

---

### 4.4.2 Agent间通信协议设计

#### 统一消息格式

```typescript
/**
 * AgentRequest - 请求消息
 */
interface AgentRequest {
  // 唯一标识
  requestId: string;

  // 来源Agent
  sourceAgent: string;

  // 目标Agent
  targetAgent: string;

  // 操作名称
  action: string;

  // 请求数据
  payload: any;

  // 执行上下文
  context: ExecutionContext;

  // 优先级（1-10，10最高）
  priority: number;

  // 超时时间（毫秒）
  timeout: number;

  // 时间戳
  timestamp: Date;
}

/**
 * AgentResponse - 响应消息
 */
interface AgentResponse {
  // 对应的请求ID
  requestId: string;

  // 响应Agent
  sourceAgent: string;

  // 是否成功
  success: boolean;

  // 响应数据
  data?: any;

  // 错误信息
  error?: AgentError;

  // 执行时间（毫秒）
  executionTime: number;

  // 时间戳
  timestamp: Date;
}

/**
 * ExecutionContext - 执行上下文
 */
interface ExecutionContext {
  // 案件ID
  caseId: string;

  // 辩论ID（如有）
  debateId?: string;

  // 用户ID
  userId: string;

  // 工作流ID
  workflowId: string;

  // 前序步骤
  previousSteps: string[];

  // 相关记忆键
  memoryKeys: string[];
}

/**
 * AgentError - 错误信息
 */
interface AgentError {
  // 错误码
  code: string;

  // 错误信息
  message: string;

  // 错误类型
  type: ErrorType;

  // 严重程度
  severity: ErrorSeverity;

  // 是否可重试
  retryable: boolean;

  // 降级方案
  fallback?: any;
}

type ErrorSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
```

---

#### 通信模式

**（1）请求-响应模式（同步通信）**

```typescript
class AgentCommunicator {
  async send(request: AgentRequest): Promise<AgentResponse> {
    // 1. 记录请求到agent_actions表
    await this.logAction(request);

    // 2. 发送请求
    const response = await this.executeRequest(request);

    // 3. 记录响应
    await this.logResponse(request, response);

    return response;
  }
}

// 使用示例
const request: AgentRequest = {
  requestId: uuid(),
  sourceAgent: "PlanningAgent",
  targetAgent: "AnalysisAgent",
  action: "parseDocument",
  payload: { documentId: "doc123" },
  context: executionContext,
  priority: 8,
  timeout: 30000,
  timestamp: new Date(),
};

const response = await agentCommunicator.send(request);
```

---

**（2）事件驱动模式（异步通信）**

```typescript
class EventBus {
  emit(event: AgentEvent): void {
    // 发布事件到消息总线
    this.messageBus.publish(event);
  }

  on(eventType: string, handler: EventHandler): void {
    // 订阅事件
    this.messageBus.subscribe(eventType, handler);
  }
}

// 使用示例：AnalysisAgent完成后通知PlanningAgent
eventBus.emit("document.analyzed", {
  documentId: "doc123",
  result: analysisResult,
  nextSteps: ["search_laws", "generate_arguments"],
  emittedAt: new Date(),
});

// PlanningAgent监听事件
eventBus.on("document.analyzed", async (event) => {
  await this.orchestrateNextSteps(event.nextSteps);
});
```

---

**（3）流式通信模式（用于GenerationAgent）**

```typescript
class StreamCommunicator {
  async stream(request: AgentRequest): AsyncIterator<AgentResponseChunk> {
    // 1. 创建流式请求
    const stream = await this.agent.executeStream(request.action, request.payload);

    // 2. 逐块返回
    for await (const chunk of stream) {
      yield {
        requestId: request.requestId,
        sourceAgent: request.targetAgent,
        data: chunk,
        timestamp: new Date(),
        isLast: false
      };
    }

    // 3. 返回结束标记
    yield {
      requestId: request.requestId,
      sourceAgent: request.targetAgent,
      isLast: true,
      timestamp: new Date()
    };
  }
}

// 使用示例：流式输出辩论内容
for await (const chunk of streamCommunicator.stream(request)) {
  if (chunk.isLast) {
    break;
  }
  await sseManager.send(chunk.data);
  await memoryAgent.storeWorkingMemory(`debate_chunk_${index}`, chunk.data);
}
```

---

#### 错误处理机制

```typescript
class AgentCommunicator {
  async sendWithRetry(request: AgentRequest): Promise<AgentResponse> {
    try {
      // 1. 记录请求到agent_actions表
      await this.logAction(request);

      // 2. 超时控制
      const response = await Promise.race([
        this.executeRequest(request),
        this.timeout(request.timeout),
      ]);

      // 3. 错误重试（指数退避）
      if (!response.success && response.error?.retryable) {
        return await this.retryWithBackoff(request, response.error);
      }

      return response;
    } catch (error) {
      // 4. 错误学习和降级
      await errorLogSystem.captureError(error, request.context);

      // 5. 降级处理
      if (request.action in fallbackStrategies) {
        return await this.executeFallback(request, error);
      }

      throw error;
    }
  }

  private async retryWithBackoff(
    request: AgentRequest,
    error: AgentError,
    maxRetries: number = 3,
  ): Promise<AgentResponse> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        await this.sleep(delay);

        const response = await this.executeRequest(request);
        if (response.success) {
          return response;
        }
      } catch (retryError) {
        if (attempt === maxRetries) {
          throw retryError;
        }
      }
    }

    throw new Error(`Max retries (${maxRetries}) exceeded`);
  }
}
```

---

### 4.4.3 共享内存机制设计

#### 基于MemoryAgent的三层记忆

```typescript
/**
 * ExecutionContext - 上下文传递机制
 */
class ExecutionContext {
  constructor(
    private memoryAgent: MemoryAgent,
    private workflowId: string,
    private caseType: string,
  ) {}

  async loadContext(): Promise<ContextData> {
    // 1. 从Working Memory加载当前上下文
    const workingContext = await this.memoryAgent.getWorkingMemory(
      `workflow_${this.workflowId}_context`,
    );

    // 2. 从Hot Memory加载相关经验
    const relevantExperience = await this.memoryAgent.getHotMemory(
      `case_pattern_${this.caseType}`,
    );

    // 3. 合并上下文
    return {
      ...workingContext,
      experience: relevantExperience,
      previousSteps: this.previousSteps,
      loadedAt: new Date(),
    };
  }

  async saveContext(data: any): Promise<void> {
    // 保存到Working Memory
    await this.memoryAgent.storeWorkingMemory(
      `workflow_${this.workflowId}_context`,
      data,
    );
  }
}

interface ContextData {
  caseInfo?: any;
  analysisResult?: any;
  legalBasis?: any;
  experience?: any;
  previousSteps: string[];
  loadedAt: Date;
}

// 使用示例：当前辩论上下文
await memoryAgent.storeWorkingMemory(
  `debate_${debateId}_context`,
  {
    caseInfo: analysisResult,
    legalBasis: searchResult,
    currentRound: 1,
    previousArguments: [],
    storedAt: new Date(),
  },
  3600, // 1小时TTL
);

// Hot Memory示例：近期案件经验
await memoryAgent.storeHotMemory(
  `case_pattern_${caseType}`,
  {
    successfulStrategies: ["strategy_1", "strategy_2"],
    commonPitfalls: ["pitfall_1"],
    referenceCount: 15,
    lastUsed: new Date(),
  },
  0.8, // 重要性评分
);

// Cold Memory示例：长期知识库
await memoryAgent.storeColdMemory(`legal_knowledge_${lawCategory}`, {
  frequentArticles: ["article_1", "article_2"],
  applicabilityPatterns: {
    contract_dispute: ["articles_X", "articles_Y"],
  },
  precedents: ["case_1", "case_2"],
});
```

---

#### 记忆压缩和迁移

```typescript
/**
 * MemoryMigrator - 记忆迁移和压缩
 */
class MemoryMigrator {
  constructor(private memoryAgent: MemoryAgent) {
    // 定时任务：每小时执行一次记忆迁移
    cron.schedule("0 * * * *", async () => {
      await this.migrateWorkingToHot();
    });

    // 定时任务：每天执行一次记忆压缩
    cron.schedule("0 0 * * *", async () => {
      await this.compressHotToCold();
    });
  }

  /**
   * Working Memory → Hot Memory迁移
   */
  private async migrateWorkingToHot(): Promise<void> {
    // 1. 获取即将过期的Working Memory
    const expiringMemories =
      await this.memoryAgent.getMemoriesByType("WORKING");

    // 2. 压缩并迁移到Hot Memory
    for (const memory of expiringMemories) {
      const compressed = await this.memoryAgent.compressMemory(memory);

      await this.memoryAgent.storeHotMemory(
        memory.memoryKey,
        compressed,
        memory.importance,
      );

      // 3. 删除原Working Memory
      await this.memoryAgent.deleteWorkingMemory(memory.memoryKey);
    }
  }

  /**
   * Hot Memory → Cold Memory压缩迁移
   */
  private async compressHotToCold(): Promise<void> {
    // 1. 获取低频访问的Hot Memory
    const hotMemories = await this.memoryAgent.getMemoriesByType("HOT");
    const lowAccessMemories = hotMemories.filter((m) => m.accessCount < 5);

    // 2. 高度压缩并迁移到Cold Memory
    for (const memory of lowAccessMemories) {
      const highlyCompressed = await this.memoryAgent.compressMemory(
        memory,
        0.1, // 10%压缩比例
      );

      await this.memoryAgent.storeColdMemory(
        memory.memoryKey,
        highlyCompressed,
      );
    }
  }
}
```

---

### 4.4.4 代码迁移路径（8阶段）

#### 阶段1：基础准备（0.5天）✅ 已完成

- [x] 创建v3.0数据库表（任务6.1.1）
- [x] 编写数据库迁移测试
- [x] 阅读架构设计文档

**参考**：任务6.1.1已完成，相关数据库表已创建

---

#### 阶段2：MemoryAgent实现（1天）

**原因**：其他Agent依赖MemoryAgent，需优先实现

**迁移步骤**：

1. 创建目录结构：`src/lib/agent/memory-agent/`
2. 实现核心类：
   - `memory-manager.ts` - 三层记忆管理（~180行）
   - `compressor.ts` - 记忆压缩算法（~150行）
   - `migrator.ts` - 记忆迁移逻辑（~120行）
   - `error-learner.ts` - 错误学习机制（~160行）
   - `index.ts` - 导出入口（~20行）
3. 编写单元测试（覆盖率>90%）：
   - `memory-manager.test.ts`（~200行）
   - `compressor.test.ts`（~150行）
   - `migrator.test.ts`（~100行）
   - `error-learner.test.ts`（~150行）
4. 集成测试：验证三层记忆CRUD

**验收标准**：

- ✅ 三层记忆CRUD操作完整
- ✅ 自动过期机制生效
- ✅ 压缩算法准确率>90%
- ✅ 记忆检索速度<100ms

---

#### 阶段3：VerificationAgent增强（1天）

**原因**：VerificationAgent是质量保障核心，需尽早实现

**迁移步骤**：

1. 创建目录结构：`src/lib/agent/verification-agent/`
2. 实现核心类：
   - `comprehensive-verifier.ts` - 综合验证入口（~150行）
   - `factual-verifier.ts` - 事实验证（~180行）
   - `logical-verifier.ts` - 逻辑验证（~200行）
   - `completeness-verifier.ts` - 完成度验证（~180行）
   - `risk-assessor.ts` - 风险评估（保留现有实现，~150行）
   - `index.ts` - 导出入口（~20行）
3. 整合现有Reviewer和RiskAssessor逻辑
4. 编写单元测试（覆盖率>90%）：
   - `comprehensive-verifier.test.ts`（~180行）
   - `factual-verifier.test.ts`（~200行）
   - `logical-verifier.test.ts`（~220行）
   - `completeness-verifier.test.ts`（~200行）
5. 准确性验证测试（>85%）

**验收标准**：

- ✅ 三重验证全部实现
- ✅ 综合评分算法准确
- ✅ 问题识别准确率>85%
- ✅ 验证速度<2秒

---

#### 阶段4：PlanningAgent整合（0.5天）

**迁移步骤**：

1. 创建目录结构：`src/lib/agent/planning-agent/`
2. 实现核心类：
   - `task-decomposer.ts` - 任务分解（~150行）
   - `strategy-planner.ts` - 整合现有Strategist（~180行）
   - `workflow-orchestrator.ts` - 整合现有Coordinator（~200行）
   - `resource-allocator.ts` - 资源调度（~120行）
   - `index.ts` - 导出入口（~20行）
3. 测试工作流编排功能

**验收标准**：

- ✅ 任务分解准确
- ✅ 策略规划合理
- ✅ 工作流编排正确

---

#### 阶段5：AnalysisAgent整合（0.5天）

**迁移步骤**：

1. 创建目录结构：`src/lib/agent/analysis-agent/`
2. 保留现有实现：
   - `doc-analyzer/` - 保留五层架构（已验证88分）
   - `evidence-analyzer.ts` - 证据分析（新增~180行）
   - `timeline-extractor.ts` - 时间线提取（新增~150行）
   - `comprehensive-analyzer.ts` - 综合分析（~120行）
   - `index.ts` - 统一入口（~30行）
3. 测试整合后的分析功能

**验收标准**：

- ✅ 文档解析准确率保持88分+
- ✅ 证据分析功能完整
- ✅ 时间线提取准确

---

#### 阶段6：LegalAgent整合（0.5天）

**迁移步骤**：

1. 创建目录结构：`src/lib/agent/legal-agent/`
2. 整合现有实现：
   - `law-searcher.ts` - 整合LawRetriever（已完成）
   - `applicability-analyzer.ts` - 整合现有逻辑（已完成）
   - `argument-generator.ts` - 整合ArgumentGenerator（已完成）
   - `legal-reasoner.ts` - 法律推理（新增~150行）
   - `index.ts` - 统一入口（~30行）
3. 测试法律检索和论点生成

**验收标准**：

- ✅ 法条检索准确率>90%
- ✅ 适用性分析准确率>80%
- ✅ 论点生成质量评分>4/5

---

#### 阶段7：GenerationAgent整合（0.5天）

**迁移步骤**：

1. 创建目录结构：`src/lib/agent/generation-agent/`
2. 保留现有实现：
   - `document-generator.ts` - 保留现有逻辑
   - `debate-generator.ts` - 保留现有逻辑（已完成）
   - `stream-generator.ts` - 保留流式输出（已完成）
   - `content-optimizer.ts` - 内容优化（新增~120行）
   - `index.ts` - 统一入口（~30行）
3. 测试文书和辩论生成

**验收标准**：

- ✅ 文书生成准确
- ✅ 辩论内容平衡
- ✅ 流式输出正常

---

#### 阶段8：集成测试与验证（0.5天）

**测试内容**：

1. **完整辩论流程**（含Manus增强）
   - PlanningAgent分解任务
   - AnalysisAgent解析文档
   - LegalAgent检索法条
   - GenerationAgent生成辩论
   - VerificationAgent验证结果
   - MemoryAgent存储上下文

2. **三层记忆管理测试**
   - Working Memory存储和检索
   - Hot Memory压缩和迁移
   - Cold Memory长期保存

3. **三重验证机制测试**
   - 事实准确性验证
   - 逻辑一致性验证
   - 任务完成度验证

4. **错误恢复流程测试**
   - 错误自动捕获
   - 重试机制
   - 降级处理
   - 错误学习

**验收标准**：

- ✅ 集成测试通过率>95%
- ✅ 准确性提升验证（88分→95分+）
- ✅ 错误恢复率>90%

---

### 4.4.5 实施时间表

```
Week 1 (2026-01-02 ~ 2026-01-08)
├── Day 1-2: MemoryAgent实现（1天）
├── Day 3-4: VerificationAgent增强（1天）
├── Day 5: PlanningAgent整合（0.5天）
├── Day 5-6: AnalysisAgent整合（0.5天）
└── Day 6-7: LegalAgent整合（0.5天）

Week 2 (2026-01-09 ~ 2026-01-15)
├── Day 1: GenerationAgent整合（0.5天）
├── Day 1-2: 集成测试与验证（0.5天）
└── Day 2-3: 准确性验证与优化（缓冲时间）

总计：2-3周（质量优先，不限时间）
```

**关键里程碑**：

- ✅ M1：MemoryAgent实现完成（2026-01-04）
- ✅ M2：VerificationAgent增强完成（2026-01-06）
- ✅ M3：所有Agent整合完成（2026-01-09）
- ✅ M4：集成测试通过（2026-01-11）
- ✅ M5：准确性验证达标（2026-01-15）

---

### 4.4.6 风险控制

#### 风险1：代码迁移破坏现有功能

**缓解措施**：

- ✅ 保留现有五层文档解析架构（已验证88分）
- ✅ 渐进式迁移，每完成一个Agent立即测试
- ✅ 完整的单元测试和集成测试覆盖

---

#### 风险2：Agent间通信开销增加

**缓解措施**：

- ✅ 使用MemoryAgent减少重复计算
- ✅ 实现智能缓存机制
- ✅ 异步通信+事件驱动减少阻塞

---

#### 风险3：准确性提升目标未达成

**缓解措施**：

- ✅ 三重验证机制提供质量保障
- ✅ 错误学习机制持续优化
- ✅ 人工评估验证准确性

---

#### 风险4：开发时间超出预期

**缓解措施**：

- ✅ 质量优先，不限时间
- ✅ 分阶段交付，及时调整计划
- ✅ 充分利用现有实现，减少重复开发

---

### 4.4.7 验收标准检查

任务6.1.2的验收标准：

- ✅ **明确6个Agent的职责边界**：已详细定义每个Agent的核心职责、接口和协作方式
- ✅ **定义Agent间通信协议**：已设计统一消息格式、三种通信模式、错误处理机制
- ✅ **设计共享内存机制**：已基于MemoryAgent设计三层记忆管理
- ✅ **制定重构时间表和风险评估**：已提供8阶段迁移路径、2-3周实施时间表、4个风险点及缓解措施

---

## 🔗 相关文档

- [DATABASE_MODEL_V2.md](../architecture/database/DATABASE_MODEL_V2.md) - v3.0数据库设计（支持三层记忆、统一验证、错误学习）
- [PHASE2_IMPLEMENTATION.md](./PHASE2_IMPLEMENTATION.md) - Sprint 6详细任务定义（任务6.1.2详细要求）
- [AGENT_ARCHITECTURE_V2.md](./AGENT_ARCHITECTURE_V2.md) - 6个核心Agent详细设计（接口定义+实现示例）
- [AI_TASK_TRACKING.md](./AI_TASK_TRACKING.md) - Sprint 6任务追踪（任务6.1.2完成状态）
- [MANUS_INTEGRATION_GUIDE.md](./MANUS_INTEGRATION_GUIDE.md) - Manus核心理念和实施路线图（本文档）

---

_文档版本: v2.0_
_创建时间: 2026-01-01_
_最后更新: 2026-01-02（添加任务6.1.2技术规范）_
_维护者: 开发团队_

---

_文档版本: v1.0_
_创建时间: 2026-01-01_
_维护者: 开发团队_
