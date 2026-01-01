# 律伴助手 Agent架构设计 v2.0

## 📋 文档信息

- **版本**: v2.0
- **创建日期**: 2026-01-01
- **基于**: Manus智能体架构理念
- **说明**: 借鉴Manus多智能体应用的架构设计，将10个Agent精简为6个核心Agent

## 🎯 设计目标

### 核心目标

- ✅ Agent数量减少40%（10个→6个）
- ✅ 功能不减反增（整合优化）
- ✅ 通信开销降低60%
- ✅ 准确性提升15-20%（88分→95分+）
- ✅ 错误恢复率提升90%（0%→90%+）

### 设计原则

1. **职责清晰**：每个Agent有明确的职责边界
2. **高内聚低耦合**：Agent内部功能紧密相关，Agent间依赖最小化
3. **可测试性**：每个Agent可独立测试
4. **可扩展性**：支持未来功能扩展
5. **容错性**：支持错误恢复和降级

---

## 🏗️ 架构演进

### v1.0架构（10个Agent）

```
输入层 (Input Layer)
├── DocAnalyzer          - 文档解析
├── EvidenceAnalyzer     - 证据分析
└── TimelineExtractor    - 时间线提取

分析层 (Analysis Layer)
├── LawRetriever         - 法律检索
├── ArgumentGenerator    - 论点生成
└── Strategist           - 策略规划

输出层 (Output Layer)
├── DocumentGenerator    - 文书生成
├── Reviewer             - 质量审查
└── RiskAssessor         - 风险评估

支持层 (Support Layer)
└── Coordinator          - 工作流协调
```

**问题分析**：

- ❌ Agent数量过多（10个），维护成本高
- ❌ 职责划分过细，通信开销大
- ❌ 缺少统一的记忆管理和错误学习机制
- ❌ 验证机制分散，质量保障不统一

---

### v2.0架构（6个核心Agent）⭐ 借鉴Manus理念

```
规划层 (Planning Layer) - 借鉴Manus的Planning Layer
└── PlanningAgent        - 整合 Coordinator + Strategist
    ├── 任务分解
    ├── 策略规划
    └── 工作流编排

执行层 (Execution Layer) - 借鉴Manus的Execution Layer
├── AnalysisAgent        - 整合 DocAnalyzer + EvidenceAnalyzer + TimelineExtractor
│   ├── 文档解析
│   ├── 证据分析
│   └── 时间线提取
│
├── LegalAgent           - 整合 LawRetriever + ArgumentGenerator
│   ├── 法律检索
│   ├── 法条适用性分析
│   └── 论点生成
│
└── GenerationAgent      - DocumentGenerator
    ├── 文书生成
    └── 辩论内容生成

验证层 (Verification Layer) - 借鉴Manus的Verification Layer
└── VerificationAgent    - 整合 Reviewer + RiskAssessor
    ├── 质量审查（三重验证）
    ├── 风险评估
    └── 结果验证

支持层 (Support Layer) - 借鉴Manus的记忆管理理念
└── MemoryAgent          - 新增（Manus核心理念）
    ├── 上下文管理（三层记忆）
    ├── 记忆压缩
    └── 错误学习
```

**架构优势**：

- ✅ 符合Manus的PEV三层架构（Planning-Execution-Verification）
- ✅ 引入三层记忆管理（Working/Hot/Cold Memory）
- ✅ 建立统一验证层（事实+逻辑+完成度三重验证）
- ✅ 支持错误学习和自动恢复

---

## 📊 6个核心Agent详细设计

### 1. PlanningAgent（规划Agent）

**职责**：任务分解、策略规划、工作流编排

**整合的原Agent**：

- Coordinator（工作流协调）
- Strategist（策略规划）

**核心功能**：

```typescript
interface PlanningAgent {
  // 任务分解
  decomposeTask(task: Task): SubTask[];

  // 策略规划
  planStrategy(caseInfo: CaseInfo): Strategy;

  // 工作流编排
  orchestrateWorkflow(tasks: SubTask[]): Workflow;

  // 资源调度
  allocateResources(workflow: Workflow): ResourceAllocation;
}
```

**输入**：

- 案件信息（CaseInfo）
- 用户目标（UserGoal）
- 可用资源（AvailableResources）

**输出**：

- 任务分解结果（SubTask[]）
- 执行策略（Strategy）
- 工作流定义（Workflow）

**实现示例**：

```typescript
class PlanningAgentImpl implements PlanningAgent {
  async decomposeTask(task: Task): Promise<SubTask[]> {
    // 1. 分析任务类型
    const taskType = this.analyzeTaskType(task);

    // 2. 根据任务类型分解
    switch (taskType) {
      case "DEBATE":
        return [
          { name: "analyze_document", agent: "AnalysisAgent" },
          { name: "search_laws", agent: "LegalAgent" },
          { name: "generate_debate", agent: "GenerationAgent" },
          { name: "verify_result", agent: "VerificationAgent" },
        ];
      case "DOCUMENT_GENERATION":
        return [
          { name: "analyze_case", agent: "AnalysisAgent" },
          { name: "generate_document", agent: "GenerationAgent" },
          { name: "verify_document", agent: "VerificationAgent" },
        ];
      default:
        throw new Error(`Unknown task type: ${taskType}`);
    }
  }

  async planStrategy(caseInfo: CaseInfo): Promise<Strategy> {
    // 1. SWOT分析
    const swot = await this.analyzeSWOT(caseInfo);

    // 2. 生成策略建议
    const strategies = await this.generateStrategies(swot);

    // 3. 评估策略可行性
    const feasibleStrategies = this.evaluateFeasibility(strategies);

    // 4. 选择最优策略
    return this.selectBestStrategy(feasibleStrategies);
  }
}
```

**与Manus的关系**：

- 借鉴Manus的Planning Layer理念
- 负责整体任务规划和资源调度
- 不直接执行具体任务，而是编排其他Agent

---

### 2. AnalysisAgent（分析Agent）

**职责**：文档解析、证据分析、时间线提取

**整合的原Agent**：

- DocAnalyzer（文档解析）
- EvidenceAnalyzer（证据分析）
- TimelineExtractor（时间线提取）

**核心功能**：

```typescript
interface AnalysisAgent {
  // 文档解析（五层架构）
  parseDocument(document: Document): DocumentAnalysisResult;

  // 证据分析
  analyzeEvidence(evidence: Evidence[]): EvidenceAnalysisResult;

  // 时间线提取
  extractTimeline(caseInfo: CaseInfo): Timeline;

  // 综合分析
  comprehensiveAnalysis(caseData: CaseData): AnalysisReport;
}
```

**输入**：

- 文档文件（PDF/Word/TXT）
- 证据材料（Evidence[]）
- 案件信息（CaseInfo）

**输出**：

- 文档解析结果（DocumentAnalysisResult）
- 证据分析报告（EvidenceAnalysisResult）
- 时间线（Timeline）
- 综合分析报告（AnalysisReport）

**实现示例（保留五层架构）**：

```typescript
class AnalysisAgentImpl implements AnalysisAgent {
  async parseDocument(document: Document): Promise<DocumentAnalysisResult> {
    // 保留现有的五层架构
    // Layer 0: TextExtractor
    const text = await this.textExtractor.extract(document);

    // Layer 1: FilterProcessor
    const filtered = await this.filterProcessor.process(text);

    // Layer 2: AIProcessor（AI识别）
    const aiResult = await this.aiProcessor.process(filtered);

    // Layer 3: RuleProcessor（算法兜底）
    const enhanced = await this.ruleProcessor.enhance(aiResult);

    // Layer 4: ReviewerManager（AI审查）
    const reviewed = await this.reviewerManager.review(enhanced);

    // Layer 5: CacheProcessor
    await this.cacheProcessor.cache(reviewed);

    return reviewed;
  }

  async analyzeEvidence(evidence: Evidence[]): Promise<EvidenceAnalysisResult> {
    // 1. 证据分类
    const classified = this.classifyEvidence(evidence);

    // 2. 证据链分析
    const chains = this.buildEvidenceChains(classified);

    // 3. 证据强度评估
    const strength = this.evaluateStrength(chains);

    return { classified, chains, strength };
  }

  async extractTimeline(caseInfo: CaseInfo): Promise<Timeline> {
    // 1. 提取时间点
    const timePoints = await this.extractTimePoints(caseInfo);

    // 2. 构建时间线
    const timeline = this.buildTimeline(timePoints);

    // 3. 识别关键节点
    const keyEvents = this.identifyKeyEvents(timeline);

    return { timeline, keyEvents };
  }
}
```

**与Manus的关系**：

- 属于Manus的Execution Layer
- 保留律伴助手现有的五层文档解析架构（成功经验）
- 整合多个分析功能，减少Agent间通信

---

### 3. LegalAgent（法律Agent）

**职责**：法律检索、法条适用性分析、论点生成

**整合的原Agent**：

- LawRetriever（法律检索）
- ArgumentGenerator（论点生成）

**核心功能**：

```typescript
interface LegalAgent {
  // 法律检索（本地+外部）
  searchLaws(query: LegalQuery): LawArticle[];

  // 法条适用性分析
  analyzeApplicability(
    articles: LawArticle[],
    caseInfo: CaseInfo,
  ): ApplicabilityResult;

  // 论点生成
  generateArguments(legalBasis: LegalBasis, side: ArgumentSide): Argument[];

  // 法律推理
  legalReasoning(facts: Fact[], laws: LawArticle[]): ReasoningChain;
}
```

**输入**：

- 检索关键词（LegalQuery）
- 案件信息（CaseInfo）
- 法律依据（LegalBasis）
- 论点方向（ArgumentSide）

**输出**：

- 相关法条（LawArticle[]）
- 适用性分析（ApplicabilityResult）
- 论点列表（Argument[]）
- 推理链（ReasoningChain）

**实现示例**：

```typescript
class LegalAgentImpl implements LegalAgent {
  async searchLaws(query: LegalQuery): Promise<LawArticle[]> {
    // 1. 本地检索（优先）
    const localResults = await this.localSearch(query);

    // 2. 外部API检索（补充）
    const externalResults =
      localResults.length < 5 ? await this.externalSearch(query) : [];

    // 3. 合并去重
    const merged = this.mergeResults(localResults, externalResults);

    // 4. 相关性排序
    return this.rankByRelevance(merged, query);
  }

  async analyzeApplicability(
    articles: LawArticle[],
    caseInfo: CaseInfo,
  ): Promise<ApplicabilityResult> {
    // 借鉴DocAnalyzer的三层验证理念

    // Layer 1: AI语义匹配
    const semanticScores = await this.aiSemanticMatch(articles, caseInfo);

    // Layer 2: 规则验证
    const ruleValidation = this.validateByRules(articles, caseInfo);
    // - 时效性检查
    // - 适用范围检查
    // - 法条层级检查

    // Layer 3: AI审查
    const aiReview = await this.aiReviewApplicability(
      articles,
      caseInfo,
      semanticScores,
      ruleValidation,
    );

    return {
      applicableArticles: aiReview.applicable,
      notApplicableArticles: aiReview.notApplicable,
      scores: semanticScores,
      validation: ruleValidation,
    };
  }

  async generateArguments(
    legalBasis: LegalBasis,
    side: ArgumentSide,
  ): Promise<Argument[]> {
    // 1. 生成主要论点
    const mainPoints = await this.generateMainPoints(legalBasis, side);

    // 2. 生成支持论据
    const supportingArgs = await this.generateSupportingArgs(mainPoints);

    // 3. 生成法律依据引用
    const legalReferences = this.generateLegalReferences(legalBasis);

    return [...mainPoints, ...supportingArgs, ...legalReferences];
  }
}
```

**与Manus的关系**：

- 属于Manus的Execution Layer
- 借鉴五层架构的成功经验（AI+规则+AI审查）
- 整合检索和论点生成，提高效率

---

### 4. GenerationAgent（生成Agent）

**职责**：文书生成、辩论内容生成

**整合的原Agent**：

- DocumentGenerator（文书生成）

**核心功能**：

```typescript
interface GenerationAgent {
  // 文书生成
  generateDocument(template: Template, data: CaseData): Document;

  // 辩论内容生成
  generateDebate(caseInfo: CaseInfo, legalBasis: LegalBasis): DebateContent;

  // 流式输出
  generateStream(prompt: string): AsyncIterator<string>;

  // 内容优化
  optimizeContent(content: string, criteria: OptimizationCriteria): string;
}
```

**输入**：

- 文书模板（Template）
- 案件数据（CaseData）
- 法律依据（LegalBasis）
- 优化标准（OptimizationCriteria）

**输出**：

- 生成的文书（Document）
- 辩论内容（DebateContent）
- 流式输出（AsyncIterator<string>）

**实现示例**：

```typescript
class GenerationAgentImpl implements GenerationAgent {
  async generateDocument(
    template: Template,
    data: CaseData,
  ): Promise<Document> {
    // 1. 模板解析
    const parsed = this.parseTemplate(template);

    // 2. 数据填充
    const filled = this.fillData(parsed, data);

    // 3. AI内容生成（动态部分）
    const enhanced = await this.aiEnhance(filled);

    // 4. 格式校验
    const validated = this.validateFormat(enhanced);

    return validated;
  }

  async generateDebate(
    caseInfo: CaseInfo,
    legalBasis: LegalBasis,
  ): Promise<DebateContent> {
    // 1. 生成正方论点
    const plaintiffArgs = await this.generateSideArguments(
      caseInfo,
      legalBasis,
      "PLAINTIFF",
    );

    // 2. 生成反方论点
    const defendantArgs = await this.generateSideArguments(
      caseInfo,
      legalBasis,
      "DEFENDANT",
    );

    // 3. 确保论点平衡
    const balanced = this.balanceArguments(plaintiffArgs, defendantArgs);

    return balanced;
  }

  async *generateStream(prompt: string): AsyncIterator<string> {
    // 流式输出实现（解决DeepSeek 21.2s响应问题）
    const stream = await this.aiService.streamGenerate(prompt);

    for await (const chunk of stream) {
      yield chunk;
    }
  }
}
```

**与Manus的关系**：

- 属于Manus的Execution Layer
- 专注于内容生成任务
- 支持流式输出，提升用户体验

---

### 5. VerificationAgent（验证Agent）⭐ Manus核心理念

**职责**：质量审查、风险评估、结果验证（三重验证机制）

**整合的原Agent**：

- Reviewer（质量审查）
- RiskAssessor（风险评估）

**核心功能**：

```typescript
interface VerificationAgent {
  // 三重验证（Manus核心理念）
  comprehensiveVerify(entity: any, entityType: string): VerificationResult;

  // 事实准确性验证
  verifyFactualAccuracy(data: any, source: any): FactualVerificationResult;

  // 逻辑一致性验证
  verifyLogicalConsistency(data: any): LogicalVerificationResult;

  // 任务完成度验证
  verifyTaskCompleteness(
    data: any,
    requirements: Requirements,
  ): CompletenessResult;

  // 风险评估
  assessRisk(caseInfo: CaseInfo): RiskAssessment;
}
```

**输入**：

- 待验证实体（any）
- 实体类型（entityType）
- 原始数据源（source）
- 业务要求（requirements）

**输出**：

- 综合验证结果（VerificationResult）
- 事实验证结果（FactualVerificationResult）
- 逻辑验证结果（LogicalVerificationResult）
- 完成度验证结果（CompletenessResult）
- 风险评估报告（RiskAssessment）

**实现示例（Manus三重验证）**：

```typescript
class VerificationAgentImpl implements VerificationAgent {
  async comprehensiveVerify(
    entity: any,
    entityType: string,
  ): Promise<VerificationResult> {
    // Manus三重验证机制

    // 1. 事实准确性验证（最基础）
    const factualResult = await this.verifyFactualAccuracy(
      entity,
      entity.source,
    );

    // 2. 逻辑一致性验证（中层）
    const logicalResult = await this.verifyLogicalConsistency(entity);

    // 3. 任务完成度验证（最高层）
    const completenessResult = await this.verifyTaskCompleteness(
      entity,
      entity.requirements,
    );

    // 4. 综合评分
    const overallScore = this.calculateOverallScore(
      factualResult.score,
      logicalResult.score,
      completenessResult.score,
    );

    // 5. 生成问题和建议
    const issues = this.collectIssues(
      factualResult,
      logicalResult,
      completenessResult,
    );
    const suggestions = this.generateSuggestions(issues);

    return {
      overallScore,
      factualAccuracy: factualResult.score,
      logicalConsistency: logicalResult.score,
      taskCompleteness: completenessResult.score,
      passed: overallScore >= 0.9,
      issues,
      suggestions,
    };
  }

  async verifyFactualAccuracy(
    data: any,
    source: any,
  ): Promise<FactualVerificationResult> {
    // 1. 当事人信息验证
    const partyCheck = this.verifyParties(data.parties, source);

    // 2. 金额数据验证
    const amountCheck = this.verifyAmounts(data.amounts, source);

    // 3. 日期时间验证
    const dateCheck = this.verifyDates(data.dates, source);

    // 4. 与原文档对比
    const consistencyCheck = this.checkConsistency(data, source);

    return {
      score: this.calculateFactualScore([
        partyCheck,
        amountCheck,
        dateCheck,
        consistencyCheck,
      ]),
      details: { partyCheck, amountCheck, dateCheck, consistencyCheck },
    };
  }

  async verifyLogicalConsistency(
    data: any,
  ): Promise<LogicalVerificationResult> {
    // 1. 诉讼请求与事实理由匹配度
    const claimFactMatch = this.checkClaimFactMatch(data);

    // 2. 论点推理链完整性
    const reasoningChain = this.checkReasoningChain(data);

    // 3. 法条引用逻辑性
    const legalLogic = this.checkLegalLogic(data);

    // 4. 矛盾检测
    const contradictions = this.detectContradictions(data);

    return {
      score: this.calculateLogicalScore([
        claimFactMatch,
        reasoningChain,
        legalLogic,
        contradictions,
      ]),
      details: { claimFactMatch, reasoningChain, legalLogic, contradictions },
    };
  }

  async verifyTaskCompleteness(
    data: any,
    requirements: Requirements,
  ): Promise<CompletenessResult> {
    // 1. 必填字段完整性
    const requiredFields = this.checkRequiredFields(data, requirements);

    // 2. 业务规则符合性
    const businessRules = this.checkBusinessRules(data, requirements);

    // 3. 输出格式正确性
    const formatCheck = this.checkFormat(data, requirements);

    // 4. 质量阈值检查
    const qualityCheck = this.checkQualityThreshold(data, requirements);

    return {
      score: this.calculateCompletenessScore([
        requiredFields,
        businessRules,
        formatCheck,
        qualityCheck,
      ]),
      details: { requiredFields, businessRules, formatCheck, qualityCheck },
    };
  }
}
```

**与Manus的关系**：

- 直接借鉴Manus的Verification Layer理念
- 实现三重验证机制（事实+逻辑+完成度）
- 提供详细的问题追踪和改进建议

---

### 6. MemoryAgent（记忆Agent）⭐ Manus核心理念

**职责**：上下文管理、记忆压缩、错误学习（三层记忆架构）

**新增Agent**：借鉴Manus的记忆管理理念

**核心功能**：

```typescript
interface MemoryAgent {
  // Working Memory管理
  storeWorkingMemory(key: string, value: any, ttl?: number): Promise<void>;
  getWorkingMemory(key: string): Promise<any>;

  // Hot Memory管理
  storeHotMemory(key: string, value: any, importance: number): Promise<void>;
  getHotMemory(key: string): Promise<any>;

  // Cold Memory管理
  storeColdMemory(key: string, value: any): Promise<void>;
  getColdMemory(key: string): Promise<any>;

  // 记忆压缩
  compressMemory(memory: Memory): Promise<CompressedMemory>;

  // 记忆迁移
  migrateMemory(from: MemoryType, to: MemoryType): Promise<void>;

  // 错误学习
  learnFromError(error: ErrorLog): Promise<LearningResult>;
}
```

**输入**：

- 记忆键值（key, value）
- 重要性评分（importance）
- 错误日志（ErrorLog）

**输出**：

- 记忆数据（Memory）
- 压缩后的记忆（CompressedMemory）
- 学习结果（LearningResult）

**实现示例（Manus三层记忆）**：

```typescript
class MemoryAgentImpl implements MemoryAgent {
  async storeWorkingMemory(
    key: string,
    value: any,
    ttl: number = 3600,
  ): Promise<void> {
    // Working Memory: 1小时TTL
    await this.db.agentMemory.create({
      data: {
        memoryType: "WORKING",
        memoryKey: key,
        memoryValue: value,
        importance: 0.9, // 高重要性
        expiresAt: new Date(Date.now() + ttl * 1000),
        accessCount: 0,
      },
    });
  }

  async storeHotMemory(
    key: string,
    value: any,
    importance: number,
  ): Promise<void> {
    // Hot Memory: 7天TTL，需要压缩
    const compressed = await this.compressMemory(value);

    await this.db.agentMemory.create({
      data: {
        memoryType: "HOT",
        memoryKey: key,
        memoryValue: compressed,
        importance,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        compressed: true,
        compressionRatio: compressed.ratio,
      },
    });
  }

  async storeColdMemory(key: string, value: any): Promise<void> {
    // Cold Memory: 永久保留，高度压缩
    const highlyCompressed = await this.compressMemory(value, 0.1);

    await this.db.agentMemory.create({
      data: {
        memoryType: "COLD",
        memoryKey: key,
        memoryValue: highlyCompressed,
        importance: 0.5, // 中等重要性
        compressed: true,
        compressionRatio: highlyCompressed.ratio,
      },
    });
  }

  async compressMemory(
    memory: Memory,
    targetRatio: number = 0.2,
  ): Promise<CompressedMemory> {
    // 1. 提取关键信息
    const keyInfo = this.extractKeyInfo(memory);

    // 2. AI摘要生成
    const summary = await this.aiSummarize(memory, targetRatio);

    // 3. 计算压缩比例
    const ratio = summary.length / JSON.stringify(memory).length;

    return {
      summary,
      keyInfo,
      ratio,
      originalSize: JSON.stringify(memory).length,
      compressedSize: summary.length,
    };
  }

  async migrateMemory(from: MemoryType, to: MemoryType): Promise<void> {
    // Working → Hot → Cold 迁移
    if (from === "WORKING" && to === "HOT") {
      // 1. 获取即将过期的Working Memory
      const expiring = await this.getExpiringMemories("WORKING");

      // 2. 压缩并迁移到Hot Memory
      for (const memory of expiring) {
        const compressed = await this.compressMemory(memory.memoryValue);
        await this.storeHotMemory(
          memory.memoryKey,
          compressed,
          memory.importance,
        );
      }

      // 3. 删除原Working Memory
      await this.deleteMemories(expiring.map((m) => m.id));
    }
  }

  async learnFromError(error: ErrorLog): Promise<LearningResult> {
    // Manus错误学习机制

    // 1. 错误模式分析
    const pattern = await this.analyzeErrorPattern(error);

    // 2. 提取学习笔记
    const learningNotes = await this.extractLearningNotes(error, pattern);

    // 3. 生成预防措施
    const preventionMeasures = this.generatePreventionMeasures(pattern);

    // 4. 更新知识库
    await this.updateKnowledgeBase(learningNotes, preventionMeasures);

    // 5. 标记为已学习
    await this.db.errorLog.update({
      where: { id: error.id },
      data: {
        learned: true,
        learningNotes: JSON.stringify(learningNotes),
      },
    });

    return {
      pattern,
      learningNotes,
      preventionMeasures,
      knowledgeUpdated: true,
    };
  }
}
```

**与Manus的关系**：

- 直接借鉴Manus的三层记忆架构
- 实现Working/Hot/Cold Memory分层管
