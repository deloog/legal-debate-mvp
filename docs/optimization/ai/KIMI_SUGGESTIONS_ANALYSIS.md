# KIMI优化建议分析报告（修订版）

## 📋 概述

本文档对KIMI提出的 `doc-analyzer-optimized.ts` 优化建议进行全面分析，并根据KIMI的反馈进行修正，评估其可行性、优先级和实施建议。

> **修订说明**：根据KIMI的反馈，对金额提取优化、优先级排序、后处理策略和测试驱动开发进行了重要修正。

---

## 🎯 问题回顾

### 当前性能表现

| 指标             | 设计目标 | 实际达成 | 差距     | 状态      |
| ---------------- | -------- | -------- | -------- | --------- |
| 当事人信息准确率 | ≥98%     | 90.0%    | -8%      | ❌ 未达成 |
| 诉讼请求准确率   | ≥95%     | 75.0%    | -20%     | ❌ 未达成 |
| 金额识别精度     | ≥99%     | 75.0%    | -24%     | ❌ 未达成 |
| AI响应时间       | <5秒     | 16-91秒  | +11-86秒 | ❌ 未达成 |

### 核心问题

1. **诉讼请求分类不足**：LITIGATION_COST、PAY_PRINCIPAL、PAY_PENALTY 等标准类型未识别
2. **AI服务稳定性**：响应时间过长（16-91秒），偶发性服务超时
3. **金额识别精度**：中文数字转换算法缺陷
4. **当事人识别**：复杂角色推断错误

---

## 🔍 KIMI建议详细分析

### 建议1：诉讼请求分类优化（立即修复）

#### 建议内容

- 在 `buildOptimizedAnalysisPrompt` 中添加强制识别规则
- 添加 `getClaimExamples()` 方法提供少样本学习案例

#### 现有代码分析

```typescript
// 当前代码已有结构（第470-483行）
**第4步：诉讼请求原子化拆解**
将复合长句拆解为原子化的短句：
- 分类映射：
  * PAY_PRINCIPAL：偿还本金
  * PAY_INTEREST：支付利息
  * PAY_PENALTY：违约金
  * PAY_DAMAGES：赔偿损失
  * LITIGATION_COST：诉讼费用
  * PERFORMANCE：履行义务
  * TERMINATION：解除合同
  * OTHER：其他
```

#### 评估结果

| 维度   | 评估  | 说明                                |
| ------ | ----- | ----------------------------------- |
| 必要性 | ✅ 高 | 测试显示 LITIGATION_COST 经常被遗漏 |
| 可行性 | ✅ 高 | 少样本学习是有效的AI提示技术        |
| 风险   | ⚠️ 中 | 需要确保示例的准确性                |
| 工作量 | 🟡 中 | 需要编写和验证示例                  |

#### 实施建议

✅ **采纳，但需调整**

**调整方案**：

1. 不完全替换 `buildOptimizedAnalysisPrompt`，而是在现有基础上增强
2. 添加 `getClaimExamples()` 方法，提供3-5个典型案例
3. 在 prompt 中添加强制识别规则，特别是 LITIGATION_COST
4. 保持现有的6步思维链结构

**示例代码**：

```typescript
private getClaimExamples(): string {
  return `
### 典型案例（必须学习）：

**案例1：标准借款纠纷**
原文："1. 判令被告偿还借款本金100万元；2. 判令被告支付利息（按LPR四倍计算）；3. 诉讼费用由被告承担"
输出：
[
  {"type": "PAY_PRINCIPAL", "content": "偿还借款本金100万元", "amount": 1000000},
  {"type": "PAY_INTEREST", "content": "支付利息（按LPR四倍计算）", "amount": null},
  {"type": "LITIGATION_COST", "content": "诉讼费用由被告承担", "amount": null}
]

**案例2：复合请求拆解**
原文："判令被告偿还本金及利息共计150万元"
输出：
[
  {"type": "PAY_PRINCIPAL", "content": "偿还本金", "amount": null},
  {"type": "PAY_INTEREST", "content": "支付利息", "amount": null}
]
`;
}
```

---

### 建议2：后处理规则引擎（双重保险 - 需更激进）

#### 建议内容

- 在 `analyzeDocumentWithOptimizedAI` 中添加后处理规则
- 添加 `applyPostProcessingRules`、`likelyHasLitigationCost`、`decomposeCompoundClaims`、`reextractAmounts` 方法

#### 现有代码分析

```typescript
// 当前代码已有后处理（第635-653行）
private postProcessExtractedData(extractedData: any): DocumentAnalysisOutput['extractedData'] {
  // 当事人去重
  const uniqueParties = this.deduplicateParties(extractedData.parties || []);

  // 诉讼请求标准化
  const normalizedClaims = this.normalizeClaims(extractedData.claims || []);

  // 金额标准化
  const processedClaims = this.processAmounts(normalizedClaims);

  return {
    parties: uniqueParties,
    claims: processedClaims,
    timeline: extractedData.timeline || [],
    summary: extractedData.summary,
    caseType: extractedData.caseType,
    keyFacts: extractedData.keyFacts || []
  };
}
```

#### 评估结果

| 维度   | 评估  | 说明                         |
| ------ | ----- | ---------------------------- |
| 必要性 | ✅ 高 | 后处理是弥补AI遗漏的有效策略 |
| 可行性 | ✅ 高 | 可以基于现有代码扩展         |
| 风险   | 🟡 中 | 需要仔细设计规则，避免误判   |
| 工作量 | 🟡 中 | 需要编写和测试多个规则       |

**⚠️ KIMI修正**：后处理必须更激进，因为测试报告显示 PAY_PRINCIPAL、PAY_PENALTY 也频繁出错。后处理必须更激进。

#### 实施建议

✅ **采纳（需更激进）**

**实施要点**：

1. 在 `analyzeDocumentWithOptimizedAI` 中添加后处理调用
2. 添加 `likelyHasLitigationCost` 方法，强制补充被遗漏的诉讼费用
3. 添加 `decomposeCompoundClaimsAdvanced` 方法，拆解复合请求（基于正则表达式）
4. 强制补充 PAY_PRINCIPAL、PAY_PENALTY 等频繁遗漏的类型

**关键代码**：

```typescript
private async applyPostProcessingRules(
  data: DocumentAnalysisOutput['extractedData'],
  fullText: string
): Promise<DocumentAnalysisOutput['extractedData']> {
  const processedClaims = [...data.claims];

  // 规则1：强制补充LITIGATION_COST
  const hasLitigationCost = processedClaims.some(c => c.type === 'LITIGATION_COST');
  if (!hasLitigationCost && this.likelyHasLitigationCost(fullText)) {
    logger.warn('AI遗漏诉讼费用，强制补充', { text: fullText.substring(0, 200) });
    processedClaims.push({
      type: 'LITIGATION_COST',
      content: '诉讼费用由被告承担',
      amount: null,
      currency: 'CNY',
      evidence: [],
      legalBasis: '民事诉讼法'
    });
  }

  // 规则2：强制补充PAY_PRINCIPAL（如果文本中有"本金"但AI没识别）
  if (!processedClaims.some(c => c.type === 'PAY_PRINCIPAL') &&
      /本金|借款本金|货款本金/.test(fullText)) {
    processedClaims.push({
      type: 'PAY_PRINCIPAL',
      content: '偿还本金（从文本推断）',
      amount: null,
      currency: 'CNY'
    });
    logger.warn('AI遗漏本金请求，强制补充');
  }

  // 规则3：强制补充PAY_PENALTY（如果文本中有"违约金"但AI没识别）
  if (!processedClaims.some(c => c.type === 'PAY_PENALTY') &&
      /违约金|罚息|滞纳金/.test(fullText)) {
    processedClaims.push({
      type: 'PAY_PENALTY',
      content: '支付违约金（从文本推断）',
      amount: null,
      currency: 'CNY'
    });
    logger.warn('AI遗漏违约金请求，强制补充');
  }

  // 规则4：复合请求拆解（增强版）
  this.decomposeCompoundClaimsAdvanced(processedClaims, fullText);

  return { ...data, claims: processedClaims };
}

/**
 * 高级复合请求拆解（基于正则表达式，更可靠）
 */
private decomposeCompoundClaimsAdvanced(claims: any[], fullText: string): void {
  // 使用正则表达式而非依赖AI的分类，更可靠
  const compoundPatterns = [
    {
      regex: /本金.*?(\d+\.?\d*万?)元?.*?及.*?利息/,
      types: ['PAY_PRINCIPAL', 'PAY_INTEREST']
    },
    {
      regex: /货款.*?(\d+\.?\d*万?)元?.*?及.*?违约金/,
      types: ['PAY_PRINCIPAL', 'PAY_PENALTY']
    }
  ];

  for (const pattern of compoundPatterns) {
    if (pattern.regex.test(fullText)) {
      logger.info('识别到复合请求模式，强制拆解', { pattern: pattern.regex });
      // 拆解逻辑...
    }
  }
}
```

---

### 建议3：金额提取精度优化（需增强现有实现）

#### 建议内容

- 引入 `nzh` 库处理中文数字
- 替换 `normalizeAmount` 方法

#### 现有代码分析

```typescript
// 当前代码的金额标准化（第751-797行）
private normalizeAmount(amount: any): number {
  if (typeof amount === 'number') {
    return amount;
  }

  if (typeof amount === 'string') {
    // 移除逗号分隔符
    let normalized = amount.replace(/,/g, '');

    // 处理中文数字
    const chineseNumbers: { [key: string]: number } = {
      '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
      '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
      '百': 100, '千': 1000, '万': 10000, '亿': 100000000,
      '壹': 1, '贰': 2, '叁': 3, '肆': 4, '伍': 5,
      '陆': 6, '柒': 7, '捌': 8, '玖': 9, '拾': 10,
      '佰': 100, '仟': 1000, '圆': 1, '元': 1
    };

    // 简单的中文数字转换逻辑...
  }

  return 0;
}
```

#### 关键发现

项目中已有 `PrecisionAmountExtractor` 类（`src/lib/extraction/amount-extractor-precision.ts`），提供了更专业的金额提取方案：

- 支持多种金额格式（阿拉伯数字、中文大写、混合格式）
- 完整的中文数字映射表
- 上下文验证机制
- 金额一致性验证

**⚠️ KIMI修正**：测试报告显示金额识别精度只有75%，说明现有实现存在明显短板：

- 中文数字转换可能只支持简单格式
- 无法处理"约五十万元"、"100万（大写：壹佰万元整）"等复杂场景
- 缺乏置信度评估机制

#### 评估结果

| 维度   | 评估  | 说明                                 |
| ------ | ----- | ------------------------------------ |
| 必要性 | ✅ 高 | 金额识别精度仅75%，远低于99%目标     |
| 可行性 | ✅ 高 | 可增强现有 PrecisionAmountExtractor  |
| 风险   | 🟡 中 | 需要确保与现有代码的兼容性           |
| 工作量 | 🟡 中 | 需要补充增强规则，覆盖现有实现的盲区 |

#### 实施建议

✅ **采纳，但需增强**

**调整方案**：

1. **不简单复用现有实现**，而是增强它
2. **优先使用 `PrecisionAmountExtractor`**（高置信度场景）
3. **补充 `enhancedAmountParsing` 方法**（覆盖盲区）
4. **可以考虑引入 `nzh` 作为最终兜底**（轻量级依赖）

**关键代码**：

```typescript
import { PrecisionAmountExtractor } from "../extraction/amount-extractor-precision";

export class DocAnalyzerAgentOptimized extends BaseAgent {
  private amountExtractor: PrecisionAmountExtractor;

  constructor() {
    super();
    this.documentParser = getDocumentParser();
    this.amountExtractor = new PrecisionAmountExtractor();
  }

  private async normalizeAmount(amount: any): Promise<number> {
    if (typeof amount === "number") {
      return amount;
    }

    if (typeof amount === "string") {
      // 1. 优先使用 PrecisionAmountExtractor
      const results = await this.amountExtractor.extractWithPrecision(amount);
      const best = this.amountExtractor.getBestExtraction(results);

      if (best && best.confidence > 0.8) {
        return best.normalizedAmount;
      }

      // 2. 如果置信度不足，使用增强规则（关键补充）
      return this.enhancedAmountParsing(amount);
    }

    return 0;
  }

  /**
   * 增强金额解析（覆盖 PrecisionAmountExtractor 的盲区）
   */
  private enhancedAmountParsing(text: string): number {
    const normalized = text.replace(/[,，]/g, "");

    // 模式1："约50万"或"大约100万元"
    const approxMatch = normalized.match(/约|大约.*?(\d+\.?\d*)\s*万/);
    if (approxMatch) {
      return parseFloat(approxMatch[1]) * 10000;
    }

    // 模式2：混合格式 "100万元（壹佰万元整）"
    const mixedMatch = normalized.match(
      /(\d+\.?\d*)\s*万?元?.*[壹贰叁肆伍陆柒捌玖]/,
    );
    if (mixedMatch) {
      return parseFloat(mixedMatch[1]) * 10000;
    }

    // 模式3：直接调用 nzh 作为最终兜底（轻量级依赖）
    try {
      // 如果安装了 nzh 库，可以使用它
      // const nzh = require('nzh');
      // return nzh.cn.decodeS(normalized.replace(/[^一二三四五六七八九十百千万亿]/g, ''));
      return 0;
    } catch {
      return 0;
    }
  }
}
```

---

### 建议4：AI性能优化（🔴 最高优先级）

#### 建议内容

- 添加缓存机制
- 设置超时控制
- 并行处理
- 智能重试
- 分块处理大文档

#### 现有代码分析

```typescript
// 当前代码的 executeLogic 方法（第133-237行）
protected async executeLogic(context: AgentContext): Promise<DocumentAnalysisOutput> {
  const input = context.data as DocumentAnalysisInput;
  const startTime = Date.now();

  return await documentConcurrencyController.withConcurrency(
    'document-analysis',
    getConfig().maxConcurrentDocuments,
    async () => {
      try {
        // ... 文档提取和分析逻辑
        const analysisResult = await this.analyzeDocumentWithOptimizedAI(
          extractedText,
          input.options
        );
        // ...
      } catch (error) {
        // 错误处理
      }
    }
  );
}
```

#### 评估结果

| 维度   | 评估    | 说明                                        |
| ------ | ------- | ------------------------------------------- |
| 必要性 | 🔴 紧急 | 16-91秒的响应时间导致系统不可用，是生存问题 |
| 可行性 | ✅ 高   | 项目已有 ioredis 依赖                       |
| 风险   | 🟡 中   | 需要设计合理的缓存策略                      |
| 工作量 | 🟡 中   | 需要实现多个优化点                          |

**⚠️ KIMI修正**：性能优化应列为最高优先级，因为：

- 16-91秒的响应时间意味着系统不可用
- 用户会频繁遇到超时错误
- 系统吞吐量极低（<1 QPS）
- 故障恢复能力差

#### 实施建议

✅ **采纳（最高优先级）**

**实施要点**：

1. **缓存机制**：利用现有的 ioredis，设置合理的TTL（24小时）
2. **超时控制**：设置25秒超时，避免长时间阻塞
3. **智能重试**：最多重试3次，指数退避
4. **并行处理**：文件读取和AI分析可以并行
5. **分块处理**：大文档分块处理，避免超时
6. **降级策略**：返回简化版结果而非直接失败

**关键代码**：

```typescript
import { createHash } from "crypto";
import { getCacheManager } from "../cache";

export class DocAnalyzerAgentOptimized extends BaseAgent {
  private cacheManager = getCacheManager();

  protected async executeLogic(
    context: AgentContext,
  ): Promise<DocumentAnalysisOutput> {
    const input = context.data as DocumentAnalysisInput;
    const startTime = Date.now();

    return await documentConcurrencyController.withConcurrency(
      "document-analysis",
      getConfig().maxConcurrentDocuments,
      async () => {
        // 1. 缓存检查（最关键的性能优化）
        const cacheKey = this.generateCacheKey(input, extractedText);
        const cached =
          await this.cacheManager.get<DocumentAnalysisOutput>(cacheKey);
        if (cached) {
          logger.info("缓存命中", { documentId: input.documentId, cacheKey });
          return { ...cached, processingTime: Date.now() - startTime }; // 更新处理时间
        }

        try {
          // 2. 更智能的AI调用策略：分块处理大文档
          const maxChunkSize = getConfig().maxTextChunkSize || 8000;
          let analysisResult;

          if (extractedText.length > maxChunkSize) {
            logger.warn("文档过大，启用分块处理", {
              documentId: input.documentId,
              length: extractedText.length,
            });
            analysisResult = await this.analyzeLargeDocument(
              extractedText,
              input.options,
            );
          } else {
            analysisResult = await this.callAIWithTimeout(
              this.analyzeDocumentWithOptimizedAI(extractedText, input.options),
            );
          }

          // 3. 并行处理辅助任务
          const [fileSize, wordCount, confidenceBoost] = await Promise.all([
            input.fileType !== "IMAGE"
              ? this.getFileSizeSecurely(input.filePath)
              : 0,
            this.countWords(extractedText),
            this.validateAnalysisQuality(analysisResult), // 新增：质量验证
          ]);

          // 4. 写入缓存（TTL根据文档类型动态调整）
          const ttl = this.calculateCacheTTL(input.fileType);
          await this.cacheManager.set(cacheKey, result, ttl);

          return result;
        } catch (error) {
          // 5. 降级策略：返回简化版结果而非直接失败
          if (context.retryCount >= getConfig().maxRetries) {
            logger.error("达到最大重试次数，返回降级结果", {
              documentId: input.documentId,
            });
            return this.generateFallbackResult(input, extractedText);
          }

          // 原有的重试逻辑...
        }
      },
    );
  }

  /**
   * 分块处理大文档（关键性能优化）
   */
  private async analyzeLargeDocument(
    text: string,
    options?: any,
  ): Promise<any> {
    const chunks = this.splitTextSmart(text, 8000); // 按句子边界分割
    const chunkResults = [];

    for (let i = 0; i < chunks.length; i++) {
      logger.info(`处理文档分块 ${i + 1}/${chunks.length}`);
      const chunkResult = await this.callAIWithTimeout(
        this.analyzeDocumentWithOptimizedAI(chunks[i].text, options),
      );
      chunkResults.push(chunkResult);
    }

    return this.mergeChunkResults(chunkResults); // 合并结果
  }

  /**
   * AI调用包装：超时控制 + 重试
   */
  private async callAIWithTimeout<T>(promise: Promise<T>): Promise<T> {
    const timeoutMs = getConfig().aiTimeout || 25000; // 25秒超时

    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI调用超时")), timeoutMs),
      ),
    ]);
  }
}
```

---

### 建议5：当事人识别优化

#### 建议内容

- 增强 `postProcessExtractedData` 中的当事人处理
- 添加 `validatePartyRoles`、`inferDefendantFromClaims` 方法

#### 现有代码分析

```typescript
// 当前代码的当事人去重（第658-694行）
private deduplicateParties(parties: any[]): Array<{
  type: 'plaintiff' | 'defendant' | 'other';
  name: string;
  role?: string;
  contact?: string;
  address?: string;
}> {
  const nameMap = new Map<string, any>();

  parties.forEach(party => {
    const name = party.name?.trim();
    if (!name) return;

    const existing = nameMap.get(name);
    if (existing) {
      // 合并信息，保留最完整的角色信息
      // ...
    } else {
      nameMap.set(name, { ...party });
    }
  });

  return Array.from(nameMap.values());
}
```

#### 评估结果

| 维度   | 评估  | 说明                           |
| ------ | ----- | ------------------------------ |
| 必要性 | 🟡 中 | 当事人准确率90%，接近98%目标   |
| 可行性 | ✅ 高 | 可以基于现有代码扩展           |
| 风险   | 🟡 中 | 推断逻辑需要谨慎，避免错误推断 |
| 工作量 | 🟢 低 | 主要添加验证和推断逻辑         |

#### 实施建议

✅ **采纳，但需谨慎**

**实施要点**：

1. 添加 `validatePartyRoles` 方法，验证当事人角色的完整性
2. 添加 `inferDefendantFromClaims` 方法，从诉讼请求推断被告
3. 设置较低的置信度，记录推断结果
4. 仅在明确情况下进行推断，避免过度推断

**关键代码**：

```typescript
/**
 * 验证当事人角色
 */
private validatePartyRoles(parties: any[], claims: any[]): void {
  const hasPlaintiff = parties.some(p => p.type === 'plaintiff');
  const hasDefendant = parties.some(p => p.type === 'defendant');

  // 如果没有被告，从诉讼请求中推断
  if (!hasDefendant && claims.length > 0) {
    const defendantName = this.inferDefendantFromClaims(claims);
    if (defendantName) {
      logger.info('从诉讼请求推断被告', { name: defendantName });
      parties.push({
        type: 'defendant',
        name: defendantName,
        role: '推断被告',
        _inferred: true // 标记为推断结果
      });
    }
  }
}

/**
 * 从诉讼请求推断被告（谨慎使用）
 */
private inferDefendantFromClaims(claims: any[]): string | null {
  for (const claim of claims) {
    // 模式："判令XXX偿还" → XXX是被告
    const match = claim.content.match(/判令(.+?)偿还|判令(.+?)支付/);
    if (match) {
      const name = match[1] || match[2];
      // 只返回明确的名称，避免推断错误
      if (name && name.length < 20 && !name.includes('等')) {
        return name.trim();
      }
    }
  }
  return null;
}
```

---

## 建议6：测试驱动开发 - 建立Bad Case库

#### 建议内容

- 整理所有测试失败案例，建立Bad Case库
- 每个Bad Case包含：输入文本、期望输出、AI实际错误、验证逻辑
- 运行Bad Case回归测试，确保优化后全部通过

#### 评估结果

| 维度   | 评估  | 说明                           |
| ------ | ----- | ------------------------------ |
| 必要性 | ✅ 高 | 没有测试覆盖的优化就是盲目优化 |
| 可行性 | ✅ 高 | 可以基于现有测试框架扩展       |
| 风险   | 🟢 低 | 测试可以降低优化风险           |
| 工作量 | 🟡 中 | 需要整理和编写大量测试用例     |

**⚠️ KIMI修正**：测试驱动是必须优先进行的，没有测试覆盖的优化就是盲目优化。

#### 实施建议

✅ **采纳（必须优先）**

**实施要点**：

1. 建立Bad Case库（至少50个案例）
2. 每个Bad Case包含完整的输入、输出和验证逻辑
3. 运行Bad Case回归测试，确保优化后全部通过

**关键代码**：

```typescript
// test/bad-cases/litigation-cost-miss.test.ts
const badCases = [
  {
    name: "LITIGATION_COST遗漏案例",
    text: "诉讼请求：1. 判令被告偿还本金100万元；2. 诉讼费用由被告承担",
    expectedTypes: ["PAY_PRINCIPAL", "LITIGATION_COST"],
    aiMissed: ["LITIGATION_COST"], // AI历史遗漏的类型
    expectedAfterPostProcess: true,
  },
  {
    name: "复合请求未拆解",
    text: "判令被告偿还本金及利息共计150万元",
    expectedTypes: ["PAY_PRINCIPAL", "PAY_INTEREST"],
    aiMissed: ["PAY_INTEREST"],
    expectedAfterPostProcess: true,
  },
];

badCases.forEach((testCase, idx) => {
  test(`Bad Case ${idx + 1}: ${testCase.name}`, async () => {
    const result = await agent.analyze({
      documentId: `bad-case-${idx}`,
      content: testCase.text,
    });

    // 验证后处理效果
    const hasAllTypes = testCase.expectedTypes.every((t) =>
      result.extractedData.claims.some((c) => c.type === t),
    );

    expect(hasAllTypes).toBe(true);
  });
});
```

---

## 📊 优先级排序（修订版）

### 🔴 紧急优先级（必须立即实施）

| 建议          | 理由                           | 预期效果         | 工作量 |
| ------------- | ------------------------------ | ---------------- | ------ |
| 4. AI性能优化 | 超时导致系统不可用，是生存问题 | 16-91秒 → 5-10秒 | 🟡 中  |
| 6. 测试基建   | 没有测试覆盖的优化就是盲目优化 | 建立Bad Case库   | 🟡 中  |

### 🟠 高优先级（核心业务指标）

| 建议                | 理由                       | 预期效果   | 工作量 |
| ------------------- | -------------------------- | ---------- | ------ |
| 1. 诉讼请求分类优化 | 业务核心指标，是竞争力问题 | 75% → 92%  | 🟡 中  |
| 2. 后处理规则引擎   | 兜底保障，是可靠性问题     | 75% → 90%+ | 🟡 中  |

### 🟡 中优先级（精度提升）

| 建议                | 理由                    | 预期效果  | 工作量 |
| ------------------- | ----------------------- | --------- | ------ |
| 3. 金额提取精度优化 | 精度已达75%，是体验问题 | 75% → 95% | 🟡 中  |

### 🟢 低优先级（精益求精）

| 建议              | 理由                          | 预期效果  | 工作量 |
| ----------------- | ----------------------------- | --------- | ------ |
| 5. 当事人识别优化 | 90%已接近目标，是精益求精问题 | 90% → 95% | 🟢 低  |

---

## 🚀 实施路线图（修订版）

### 阶段0：测试基建（必须优先，0.5天）

- [ ] 整理所有测试失败案例，建立Bad Case库（至少50个）
- [ ] 每个Bad Case必须包含：输入文本、期望输出、AI实际错误、验证逻辑
- [ ] 运行Bad Case回归测试，确保优化后全部通过

### 阶段1：AI性能优化（1天，最高优先级）

- [ ] 实现Redis缓存（关键路径）
- [ ] 实现25秒超时控制
- [ ] 实现分块处理大文档
- [ ] 预期：平均响应时间<8秒，超时率<5%

### 阶段2：Prompt增强 + 后处理（1-2天，核心）

- [ ] 添加getClaimExamples() 5个典型案例
- [ ] 在Prompt中添加"强制识别规则"
- [ ] 实现applyPostProcessingRules()（补充LITIGATION_COST、PAY_PRINCIPAL、PAY_PENALTY）
- [ ] 实现decomposeCompoundClaimsAdvanced()
- [ ] 预期：诉讼请求准确率从75%→92%

### 阶段3：金额提取增强（0.5天）

- [ ] 复用PrecisionAmountExtractor（高置信度场景）
- [ ] 补充enhancedAmountParsing()（覆盖盲区）
- [ ] 预期：金额精度从75%→95%

### 阶段4：当事人识别微调（0.5天）

- [ ] 添加角色推断逻辑（仅用于极端缺失场景）
- [ ] 添加置信度标记（\_inferred: true）
- [ ] 预期：当事人准确率从90%→95%

---

## ⚠️ 注意事项

### 代码规范

- 遵循项目现有的代码风格（单引号、2空格缩进）
- 避免使用默认导出，优先使用命名导出
- 使用 TypeScript 类型定义而非 JSDoc 注释

### 测试要求

- 每个优化点都需要编写对应的测试用例
- 运行现有测试确保没有破坏性更改
- 添加集成测试验证整体效果

### 文档更新

- 更新 `docs/AI_TASK_TRACKING.md`
- 记录优化效果和经验教训
- 更新 API 文档（如有变更）

---

## 📝 结论（修订版）

### 总体评估

KIMI的建议整体上是**有价值的**，经过修正后更加完善：

1. ✅ **高价值建议**：AI性能优化（最高优先级）、诉讼请求分类优化、后处理规则引擎
2. ✅ **有价值但需增强**：金额提取精度优化（增强现有实现，覆盖盲区）
3. ✅ **有价值但需谨慎**：当事人识别优化（避免过度推断）
4. ✅ **必须优先**：测试驱动开发（建立Bad Case库）

### 关键调整（基于KIMI反馈）

1. **AI性能优化应列为最高优先级**：16-91秒的响应时间导致系统不可用，是生存问题
2. **金额提取需增强现有实现**：不能简单复用 `PrecisionAmountExtractor`，需要补充增强规则
3. **后处理必须更激进**：不仅要补充LITIGATION_COST，还要补充PAY_PRINCIPAL、PAY_PENALTY
4. **测试驱动是必须优先**：没有测试覆盖的优化就是盲目优化，必须建立Bad Case库

### 预期效果（修订版）

实施上述优化后，预期达到以下效果：

| 指标             | 当前    | 目标 | 预期   |
| ---------------- | ------- | ---- | ------ |
| 当事人信息准确率 | 90%     | ≥98% | 95%+   |
| 诉讼请求准确率   | 75%     | ≥95% | 92%+   |
| 金额识别精度     | 75%     | ≥99% | 95%+   |
| AI响应时间       | 16-91秒 | <5秒 | 5-10秒 |

### 最终建议

**KIMI的建议是值得采纳的**，但需要根据上述修正进行调整：

1. **立即实施**：AI性能优化、测试基建
2. **核心优化**：诉讼请求分类优化、后处理规则引擎
3. **精度提升**：金额提取增强
4. **持续优化**：当事人识别微调

---

## 📚 参考资料

- 测试报告：`scripts/test-optimization-effects.ts`
- 金额提取器：`src/lib/extraction/amount-extractor-precision.ts`
- 当前实现：`src/lib/agent/doc-analyzer-optimized.ts`
- 项目依赖：`package.json`
