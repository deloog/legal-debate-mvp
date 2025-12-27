/**
 * AI处理器 - 负责AI文档分析
 * 
 * 核心功能：
 * - 构建优化的分析提示词
 * - 调用AI服务并处理响应
 * - 分块处理大文档
 * - 超时控制和重试机制
 */

import type {
  AIAnalysisResponse,
  ExtractedData,
  TextChunk,
  DocumentAnalysisOptions
} from '../core/types';
import { DEFAULT_CONFIG, ERROR_MESSAGES } from '../core/constants';
import { DocumentParser } from '../../../ai/document-parser';
import { logger } from '../../../agent/security/logger';

export class AIProcessor {
  private config: typeof DEFAULT_CONFIG;
  private parser: DocumentParser;

  constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.parser = new DocumentParser();
  }

  /**
   * 获取AI服务实例（用于Reviewer初始化）
   */
  public async getAIService(): Promise<any> {
    const { getUnifiedAIService } = await import('../../../ai/unified-service');
    return getUnifiedAIService();
  }

  /**
   * 处理文档分析
   */
  public async process(
    text: string,
    options?: DocumentAnalysisOptions
  ): Promise<AIAnalysisResponse> {
    if (text.length > this.config.maxTextChunkSize) {
      return await this.processLargeDocument(text, options);
    }
    return await this.processWithTimeout(
      this.analyzeDocument(text, options)
    );
  }

  /**
   * 分析文档
   */
  private async analyzeDocument(
    text: string,
    options?: DocumentAnalysisOptions
  ): Promise<AIAnalysisResponse> {
    const prompt = this.buildPrompt(text, options);
    const aiResponse = await this.parser.analyzeWithAI(prompt);
    return this.parseResponse(aiResponse);
  }

  /**
   * 构建分析提示词
   */
  private buildPrompt(text: string, options?: DocumentAnalysisOptions): string {
    const tasks = [];
    if (options?.extractParties !== false) tasks.push('当事人信息提取');
    if (options?.extractClaims !== false) tasks.push('诉讼请求识别');
    if (options?.extractTimeline !== false) tasks.push('时间线整理');
    if (options?.generateSummary === true) tasks.push('案件摘要生成');

    return `你是专业法律文档分析专家。请对以下文档进行深入分析。

【重点任务】

1. 当事人角色识别（优先级最高）：
   - 准确识别原告、被告、第三人、法定代表人、诉讼代理人等角色
   - 区分自然人和法人（公司、企业、组织）
   - 识别法定代表人信息，避免将其误识别为独立当事人
   - 提取角色判断依据（如"原告："、"被告："等关键词）
   - 标注每个当事人的详细信息（联系人、地址等）

2. 诉讼请求分类（优先级高）：
   - 准确分类诉讼请求类型：PAY_PRINCIPAL（偿还本金）、PAY_INTEREST（支付利息）、PAY_PENALTY（违约金）、PAY_DAMAGES（赔偿损失）、LITIGATION_COST（诉讼费用）、PERFORMANCE（履行义务）、TERMINATION（解除合同）
   - 识别复合请求并进行初步拆解（如"本金及利息"应拆解为两个独立请求）
   - 提取每个请求的关键信息（金额、币种、具体描述）
   - 强制补充LITIGATION_COST（如果文本中提到"诉讼费用由被告承担"）

3. 金额模糊识别（优先级高）：
   - 识别所有金额信息，包括模糊表达如"约50万元"、"大概100万"等
   - 区分本金、利息、违约金、赔偿金等不同类型金额
   - 标注金额的上下文和置信度
   - 标准化金额格式（统一转换为数字，"50万元" → 500000）
   - 处理大额金额的正确识别（如"1000000"为一百万）

4. 语义关系抽取：
   - 提取关键事实（争议焦点、合同条款、违约行为等）
   - 理解因果关系（违约→赔偿）
   - 整理时间线（签订合同→履行→违约→起诉）
   - 识别法律关系（合同关系、侵权关系等）

分析任务：${tasks.join('、')}

文档内容：
${text}

【输出要求】
按以下JSON格式返回：
{
  "extractedData": {
    "parties": [
      {
        "type": "plaintiff|defendant|other",
        "name": "姓名或公司名",
        "role": "角色描述（如法定代表人、原告、被告等）",
        "contact": "联系方式（如有）",
        "address": "地址（如有）"
      }
    ],
    "claims": [
      {
        "type": "PAY_PRINCIPAL|PAY_INTEREST|PAY_PENALTY|PAY_DAMAGES|LITIGATION_COST|PERFORMANCE|TERMINATION|OTHER",
        "content": "请求的完整描述",
        "amount": 数字金额（如500000）,
        "currency": "CNY",
        "evidence": ["证据引用"],
        "legalBasis": "法律依据（如有）"
      }
    ],
    "timeline": [{"date": "YYYY-MM-DD", "event": "事件"}],
    "summary": "案件摘要（100-200字）",
    "caseType": "civil|criminal|administrative|commercial|labor|intellectual|other",
    "keyFacts": ["关键事实1", "关键事实2"]
  },
  "confidence": 0.95,
  "analysisProcess": {
    "ocrErrors": [],
    "entitiesListed": {"persons": ["人名列表"], "companies": ["公司列表"], "amounts": ["金额列表"]},
    "roleReasoning": "当事人角色识别的推理过程",
    "claimDecomposition": "复合请求拆解的说明",
    "amountNormalization": "金额标准化的说明（如"50万元" → 500000）",
    "validationResults": {
      "duplicatesFound": ["重复项"],
      "roleConflicts": ["角色冲突"],
      "missingClaims": ["可能遗漏的诉讼请求"],
      "amountInconsistencies": ["金额不一致"]
    }
  }
}

【特别提醒】
- 只返回JSON格式，不要包含其他文字
- 法定代表人不应作为独立的原告或被告，应与公司关联
- 诉讼费用（LITIGATION_COST）如果文本中有提及，必须提取
- 金额必须转换为纯数字，不包含单位
- 复合请求必须拆解为多个独立请求`;
  }

  /**
   * 解析AI响应
   */
  private parseResponse(response: string): AIAnalysisResponse {
    try {
      let cleaned = response.trim().replace(/```json\s*/, '').replace(/```\s*$/, '');
      const parsed = JSON.parse(cleaned);

      if (!parsed.extractedData) {
        throw new Error(ERROR_MESSAGES.PARSE_ERROR);
      }

      return {
        extractedData: this.normalizeData(parsed.extractedData),
        confidence: parsed.confidence || 0.8,
        tokenUsed: this.estimateTokens(response),
        analysisProcess: parsed.analysisProcess
      };
    } catch (error) {
      logger.error('AI响应解析失败', error);
      return this.getErrorResponse();
    }
  }

  /**
   * 标准化数据
   */
  private normalizeData(data: ExtractedData): ExtractedData {
    return {
      parties: data.parties?.map(p => ({ ...p, type: p.type || 'other' })) || [],
      claims: data.claims?.map(c => ({ ...c, currency: c.currency || 'CNY' })) || [],
      timeline: data.timeline || [],
      summary: data.summary || '',
      caseType: data.caseType || 'civil',
      keyFacts: data.keyFacts || []
    };
  }

  /**
   * 处理大文档
   */
  private async processLargeDocument(
    text: string,
    options?: DocumentAnalysisOptions
  ): Promise<AIAnalysisResponse> {
    const chunks = this.splitText(text, this.config.maxTextChunkSize);
    const results = [];

    for (let i = 0; i < chunks.length; i++) {
      logger.info(`处理分块 ${i + 1}/${chunks.length}`);
      const result = await this.processWithTimeout(
        this.analyzeDocument(chunks[i].text, options)
      );
      results.push(result);
    }

    return this.mergeResults(results);
  }

  /**
   * 分割文本
   */
  private splitText(text: string, maxSize: number): TextChunk[] {
    const chunks: TextChunk[] = [];
    let pos = 0;

    while (pos < text.length) {
      let end = Math.min(pos + maxSize, text.length);
      if (end < text.length) {
        const match = text.substring(pos, end).match(/[。！？；\n]/g);
        if (match) {
          const lastMatch = match[match.length - 1];
          const lastPos = pos + text.substring(pos, end).lastIndexOf(lastMatch);
          if (lastPos > pos) end = lastPos + 1;
        }
      }
      chunks.push({ text: text.substring(pos, end), start: pos, end });
      pos = end;
    }

    return chunks;
  }

  /**
   * 合并结果
   */
  private mergeResults(results: AIAnalysisResponse[]): AIAnalysisResponse {
    const partyMap = new Map<string, any>();
    const claims: any[] = [];
    let totalConfidence = 0;
    let totalTokens = 0;

    results.forEach(r => {
      r.extractedData.parties?.forEach((p: any) => {
        const key = `${p.name}_${p.type}`;
        if (!partyMap.has(key)) partyMap.set(key, p);
      });
      if (r.extractedData.claims) claims.push(...r.extractedData.claims);
      totalConfidence += r.confidence;
      totalTokens += r.tokenUsed;
    });

    return {
      extractedData: {
        parties: Array.from(partyMap.values()),
        claims: this.deduplicate(claims),
        timeline: [],
        summary: '分块合并结果',
        caseType: 'civil',
        keyFacts: []
      },
      confidence: totalConfidence / results.length,
      tokenUsed: totalTokens,
      analysisProcess: {
        ocrErrors: [],
        entitiesListed: { persons: [], companies: [], amounts: [] },
        roleReasoning: '分块处理',
        claimDecomposition: '多分块合并',
        amountNormalization: '已标准化',
        validationResults: { duplicatesFound: [], roleConflicts: [], missingClaims: [], amountInconsistencies: [] }
      }
    };
  }

  /**
   * 去重
   */
  private deduplicate(items: any[]): any[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        return true;
      }
      return false;
    });
  }

  /**
   * 超时处理
   */
  private async processWithTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(ERROR_MESSAGES.AI_TIMEOUT)), this.config.aiTimeout)
      )
    ]);
  }

  /**
   * 估算Token
   */
  private estimateTokens(text: string): number {
    const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const other = text.length - chinese;
    return Math.ceil(chinese / 1.5 + other / 4);
  }

  /**
   * 错误响应
   */
  private getErrorResponse(): AIAnalysisResponse {
    return {
      extractedData: { parties: [], claims: [], timeline: [], summary: '', keyFacts: [] },
      confidence: 0.3,
      tokenUsed: 0,
      analysisProcess: {
        ocrErrors: ['JSON解析失败'],
        entitiesListed: { persons: [], companies: [], amounts: [] },
        roleReasoning: '解析失败',
        claimDecomposition: '无法进行',
        amountNormalization: '无法进行',
        validationResults: { duplicatesFound: [], roleConflicts: [], missingClaims: [], amountInconsistencies: [] }
      }
    };
  }
}
