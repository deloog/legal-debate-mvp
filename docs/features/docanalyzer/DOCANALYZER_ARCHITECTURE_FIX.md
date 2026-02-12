# DocAnalyzer架构修复方案

## 问题分析

### 用户要求

根据《DocAnalyzer模块化重构计划》，系统应该实现：

- **AI为主**：AI负责核心理解（当事人角色识别、诉讼请求分类、金额模糊识别）
- **算法兜底**：规则验证层强制补充、拆解、标准化
- **Reviewer审查**：独立的质量审查层

### 当前实现的问题

#### 1. 第一层快速过滤缺失

**文档设计**：

```
第一层：快速过滤（算法，<10ms）
├─ OCR文本质量检查
├─ 文档类型分类
└─ 基础格式校验
```

**当前实现**：直接跳过了这一层，没有：

- OCR文本质量检查（如乱码检测、字数验证）
- 文档类型分类（民事/刑事/行政等）
- 基础格式校验（如缺少必要的标题、当事人信息等）

#### 2. 第二层AI分析不够深入

**文档设计**：

```
第二层：AI核心理解（AI，2-5秒）
├─ 当事人角色识别
├─ 诉讼请求分类
├─ 金额模糊识别
└─ 语义关系抽取
```

**当前实现**：

- AIProcessor只是简单调用DocumentParser.analyzeWithAI()
- 没有使用专门的法律分析提示词
- 没有强调当事人角色识别
- 没有重点处理金额模糊识别

#### 3. 第三层规则验证未正确使用提取器

**文档设计**：

```
第三层：规则验证（算法，<100ms）
├─ 强制补充LITIGATION_COST
├─ 复合请求二次拆解
├─ 金额格式标准化
├─ 当事人去重与验证
└─ 一致性检查
```

**当前实现**：

- AmountExtractor已创建但未在流程中调用
- ClaimExtractor已创建但未在流程中调用
- 只使用了RuleProcessor，但规则处理不够完整

#### 4. Reviewer审查流程不明确

**文档设计**：Reviewer应该是独立的第五层

**当前实现**：

- Reviewer被当作第三层的一部分
- AIReviewer和RuleReviewer虽然创建，但审查逻辑不够完善

## 修复方案

### 方案1：完整重构（推荐）

#### 新的四层架构实现

```typescript
class DocAnalyzerAgent {
  async executeLogic(context: AgentContext): Promise<DocumentAnalysisOutput> {
    // ========== 第一层：快速过滤（算法，<10ms） ==========
    const filterResult = await this.filterLayer(input);
    if (!filterResult.passed) {
      return filterResult.output;
    }

    // ========== 第二层：AI核心理解（AI，2-5秒） ==========
    const aiResult = await this.aiCoreLayer(
      filterResult.filteredText,
      filterResult.documentType
    );

    // ========== 第三层：规则验证（算法兜底，<100ms） ==========
    const ruleResult = await this.ruleValidationLayer(
      aiResult.extractedData,
      filterResult.filteredText
    );

    // ========== 第四层：Reviewer审查（AI + 规则，1-2秒） ==========
    const reviewResult = await this.reviewerLayer(
      ruleResult.data,
      filterResult.filteredText
    );

    // ========== 第五层：缓存（算法 + 存储，<10ms） ==========
    const cached = await this.cacheLayer(input, reviewResult);
    if (cached) return cached;

    await this.cacheLayer.set(input, reviewResult.output);
    return reviewResult.output;
  }

  private async filterLayer(input: DocumentAnalysisInput) {
    // OCR文本质量检查
    // 文档类型分类
    // 基础格式校验
  }

  private async aiCoreLayer(text: string, docType: string) {
    // 构建专业的法律分析提示词
    // 强调当事人角色识别
    // 诉讼请求分类
    // 金额模糊识别
  }

  private async ruleValidationLayer(data: ExtractedData, text: string) {
    // 使用AmountExtractor提取和标准化金额
    // 使用ClaimExtractor补充和拆解诉讼请求
    // 当事人去重与验证
    // 一致性检查
  }

  private async reviewerLayer(data: ExtractedData, text: string) {
    // AI审查：语义完整性、逻辑一致性
    // 规则审查：数据格式、必要字段
  }

  private async cacheLayer(
    input: DocumentAnalysisInput,
    output?: DocumentAnalysisOutput
  ) {
    // 检查缓存
    // 写入缓存
  }
}
```

### 方案2：渐进式修复

#### 步骤1：添加第一层快速过滤

创建 `src/lib/agent/doc-analyzer/processors/filter-processor.ts`

#### 步骤2：增强第二层AI分析

修改 `src/lib/agent/doc-analyzer/processors/ai-processor.ts`

- 构建专门的法律分析提示词
- 强调当事人角色识别

#### 步骤3：完善第三层规则验证

修改 `src/lib/agent/doc-analyzer/processors/rule-processor.ts`

- 集成AmountExtractor
- 集成ClaimExtractor

#### 步骤4：明确第五层Reviewer审查

修改 `src/lib/agent/doc-analyzer/doc-analyzer-agent.ts`

- 将Reviewer作为独立的第五层

## 具体修改内容

### 修改1：创建FilterProcessor

```typescript
// src/lib/agent/doc-analyzer/processors/filter-processor.ts
export class FilterProcessor {
  async process(text: string): Promise<FilterResult> {
    // OCR质量检查
    if (!this.checkOCRQuality(text)) {
      return { passed: false, reason: 'OCR质量不合格' };
    }

    // 文档类型分类
    const documentType = this.classifyDocument(text);

    // 基础格式校验
    const formatCheck = this.validateFormat(text, documentType);
    if (!formatCheck.valid) {
      return { passed: false, reason: formatCheck.reason };
    }

    return {
      passed: true,
      filteredText: text,
      documentType,
      qualityScore: this.calculateQualityScore(text),
    };
  }

  private checkOCRQuality(text: string): boolean {
    // 检查是否有乱码
    // 检查字数是否足够
    // 检查是否有中文字符
  }

  private classifyDocument(text: string): DocumentType {
    // 民事/刑事/行政/其他
  }

  private validateFormat(
    text: string,
    docType: DocumentType
  ): FormatCheckResult {
    // 检查必要的字段是否存在
    // 检查格式是否正确
  }
}
```

### 修改2：增强AIProcessor

```typescript
// src/lib/agent/doc-analyzer/processors/ai-processor.ts
private buildPrompt(text: string, docType: string): string {
  return `你是专业法律文档分析专家。请对以下${docType}文档进行深入分析。

【重点任务】
1. 当事人角色识别：
   - 准确识别原告、被告、第三人、法定代表人等角色
   - 区分自然人和法人
   - 提取角色判断依据

2. 诉讼请求分类：
   - 准确分类诉讼请求类型（PAY_PRINCIPAL、PAY_PENALTY、LITIGATION_COST等）
   - 识别复合请求并进行初步拆解
   - 提取每个请求的关键信息

3. 金额模糊识别：
   - 识别所有金额信息（包括模糊表达如"约50万元"）
   - 区分本金、利息、违约金、赔偿金等
   - 标注金额的上下文和置信度

4. 语义关系抽取：
   - 提取关键事实
   - 理解因果关系
   - 整理时间线

文档内容：
${text}

【输出要求】
只返回JSON格式，不要包含其他文字。
`;
}
```

### 修改3：完善RuleProcessor

```typescript
// src/lib/agent/doc-analyzer/processors/rule-processor.ts
export class RuleProcessor {
  constructor(
    private amountExtractor: AmountExtractor,
    private claimExtractor: ClaimExtractor
  ) {}

  async process(data: ExtractedData, text: string): Promise<RuleProcessResult> {
    // 使用AmountExtractor提取和标准化金额
    for (const claim of data.claims) {
      if (!claim.amount && claim.content) {
        const amountResult = await this.amountExtractor.extractFromText(
          claim.content
        );
        if (amountResult.amounts.length > 0) {
          claim.amount = amountResult.amounts[0].normalizedAmount;
        }
      }
    }

    // 使用ClaimExtractor补充和拆解诉讼请求
    const enhancedClaims = await this.claimExtractor.extractFromText(text);
    data.claims = this.mergeAndDeduplicate(data.claims, enhancedClaims);

    // 当事人去重与验证
    data.parties = this.deduplicateParties(data.parties);
    data.parties = this.validateParties(data.parties);

    // 一致性检查
    const inconsistencies = this.checkConsistency(data);

    return {
      data,
      modifications: this.trackModifications(),
      inconsistencies,
    };
  }
}
```

### 修改4：明确Reviewer审查

```typescript
// src/lib/agent/doc-analyzer/doc-analyzer-agent.ts
async executeLogic(context: AgentContext): Promise<DocumentAnalysisOutput> {
  // 第一层：快速过滤
  const filterResult = await this.filterProcessor.process(text);

  // 第二层：AI核心理解
  const aiResult = await this.aiProcessor.process(text, filterResult.documentType);

  // 第三层：规则验证
  const ruleResult = await this.ruleProcessor.process(aiResult.extractedData, text);

  // 第四层：Reviewer审查（独立层）
  const reviewResult = await this.reviewerManager.review(
    ruleResult.data,
    text,
    true // 总是启用Reviewer
  );

  // 第五层：缓存
  const cacheResult = await this.cacheProcessor.get(input.documentId);
  if (cacheResult) return cacheResult;

  await this.cacheProcessor.set(input.documentId, ruleResult.data);

  return {
    ...ruleResult.data,
    confidence: this.calculateConfidence(aiResult, ruleResult, reviewResult),
    reviewScore: reviewResult.score
  };
}
```

## 预期效果

| 指标             | 当前      | 目标 | 改进 |
| ---------------- | --------- | ---- | ---- |
| 当事人信息准确率 | 待验证    | ≥98% | +N%  |
| 诉讼请求准确率   | 待验证    | ≥95% | +N%  |
| 金额识别精度     | 待验证    | ≥99% | +N%  |
| AI响应时间       | 缓存<10ms | <5秒 | ✓    |
| 架构清晰度       | 混乱      | 清晰 | ✓    |

## 测试验证

修复后需要验证：

1. 第一层快速过滤正确工作
2. 第二层AI分析输出符合法律文档要求
3. 第三层规则验证正确使用提取器
4. 第四层Reviewer审查独立且有效
5. 第五层缓存正常工作
6. 整体准确率达到设计目标

---

_文档版本：v1.0_  
_创建时间：2025-12-25_  
_状态：待实施_
