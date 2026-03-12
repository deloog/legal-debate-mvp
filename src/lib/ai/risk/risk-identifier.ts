/**
 * AIRiskIdentifier - AI法律风险识别器
 *
 * 功能：基于案件事实和法条，使用AI识别潜在法律风险
 */

import { logger } from '@/lib/logger';
import type { AIService } from '../service';
import type { AIRequestConfig } from '../../../types/ai-service';
import type {
  RiskIdentificationInput,
  RiskIdentificationResult,
  RiskMitigationSuggestion,
} from '../../../types/risk';
import {
  RiskType,
  RiskCategory,
  RiskLevel,
  MitigationSuggestionType,
  SuggestionPriority,
  DEFAULT_RISK_SCORING_CONFIG,
  calculateRiskLevel,
  generateRiskId,
  generateSuggestionId,
} from '../../../types/risk';

/**
 * 风险识别器配置
 */
interface RiskIdentifierConfig {
  aiService: AIService;
  enableFallback?: boolean;
  confidenceThreshold?: number;
  config?: typeof DEFAULT_RISK_SCORING_CONFIG;
}

/**
 * AI风险识别结果
 */
interface AIRiskIdentificationResult {
  riskType: RiskType;
  riskCategory: RiskCategory;
  score: number;
  confidence: number;
  description: string;
  evidence: string[];
  suggestions: Array<{
    type: string;
    action: string;
    reason: string;
    estimatedImpact: string;
  }>;
}

/**
 * AIRiskIdentifier主类
 */
export class AIRiskIdentifier {
  private readonly aiService: AIService;
  private readonly enableFallback: boolean;
  private readonly confidenceThreshold: number;
  private readonly config: typeof DEFAULT_RISK_SCORING_CONFIG;

  constructor(config: RiskIdentifierConfig) {
    this.aiService = config.aiService;
    this.enableFallback = config.enableFallback ?? true;
    this.confidenceThreshold = config.confidenceThreshold ?? 0.6;
    this.config = config.config ?? DEFAULT_RISK_SCORING_CONFIG;
  }

  /**
   * 识别案件风险
   */
  async identify(
    input: RiskIdentificationInput
  ): Promise<RiskIdentificationResult[]> {
    // 验证输入
    if (!this.validateInput(input)) {
      throw new Error('无效的风险识别输入');
    }

    const prompt = this.buildIdentificationPrompt(input);

    try {
      const request: AIRequestConfig = {
        model: 'deepseek-chat',
        provider: 'deepseek',
        messages: [
          {
            role: 'system',
            content: '你是专业的法律风险识别助手。请分析案件中的法律风险。',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      };

      const response = await this.aiService.chatCompletion(request);

      return this.parseIdentificationResponse(
        response.choices[0].message.content || '',
        input
      );
    } catch (error) {
      logger.error('AI风险识别失败，使用规则引擎:', error);

      // 规则回退
      if (this.enableFallback) {
        return this.identifyByRules(input);
      }

      throw error;
    }
  }

  /**
   * 验证输入
   */
  private validateInput(input: RiskIdentificationInput): boolean {
    if (!input.caseId || !input.caseTitle) {
      return false;
    }

    if (!Array.isArray(input.facts) || input.facts.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * 构建识别提示词
   */
  private buildIdentificationPrompt(input: RiskIdentificationInput): string {
    const parts: string[] = [];

    // 案件基本信息
    parts.push(`案件标题：${input.caseTitle}`);
    if (input.caseType) {
      parts.push(`案件类型：${input.caseType}`);
    }

    // 当事人信息
    if (input.parties?.plaintiff || input.parties?.defendant) {
      parts.push('当事人信息：');
      if (input.parties.plaintiff) {
        parts.push(`  原告：${input.parties.plaintiff}`);
      }
      if (input.parties.defendant) {
        parts.push(`  被告：${input.parties.defendant}`);
      }
    }

    // 案件事实
    parts.push('案件事实：');
    input.facts.forEach((fact, index) => {
      parts.push(`  ${index + 1}. ${fact}`);
    });

    // 诉讼请求
    if (input.claims && input.claims.length > 0) {
      parts.push('诉讼请求：');
      input.claims.forEach((claim, index) => {
        parts.push(`  ${index + 1}. ${claim}`);
      });
    }

    // 证据信息
    if (input.evidence && input.evidence.length > 0) {
      parts.push('证据信息：');
      input.evidence.forEach((evidence, index) => {
        parts.push(`  ${index + 1}. ${evidence.name}（${evidence.type}）`);
        if (evidence.description) {
          parts.push(`     描述：${evidence.description}`);
        }
      });
    }

    // 法律依据
    if (input.legalBasis && input.legalBasis.length > 0) {
      parts.push('法律依据：');
      input.legalBasis.forEach((basis, index) => {
        parts.push(`  ${index + 1}. ${basis.lawName} ${basis.articleNumber}`);
      });
    }

    parts.push(
      '\n请分析上述案件的潜在法律风险，并返回JSON格式：\n' +
        '{\n' +
        '  "risks": [\n' +
        '    {\n' +
        '      "riskType": "LEGAL_PROCEDURE|EVIDENCE_STRENGTH|STATUTE_LIMITATION|JURISDICTION|COST_BENEFIT|FACT_VERIFICATION|LEGAL_BASIS|CONTRADICTION|PROOF_BURDEN",\n' +
        '      "riskCategory": "PROCEDURAL|EVIDENTIARY|SUBSTANTIVE|STRATEGIC",\n' +
        '      "score": 0-1,\n' +
        '      "confidence": 0-1,\n' +
        '      "description": "风险描述",\n' +
        '      "evidence": ["支持该风险的证据或事实"],\n' +
        '      "suggestions": [\n' +
        '        {\n' +
        '          "type": "GATHER_EVIDENCE|AMEND_CLAIM|CHANGE_STRATEGY|ADD_LEGAL_BASIS|CONSULT_EXPERT|CONSIDER_SETTLEMENT|VERIFY_FACTS",\n' +
        '          "action": "具体行动",\n' +
        '          "reason": "建议原因",\n' +
        '          "estimatedImpact": "预期影响"\n' +
        '        }\n' +
        '      ]\n' +
        '    }\n' +
        '  ]\n' +
        '}'
    );

    return parts.join('\n');
  }

  /**
   * 解析识别响应
   */
  private parseIdentificationResponse(
    response: string,
    input: RiskIdentificationInput
  ): RiskIdentificationResult[] {
    const risks: RiskIdentificationResult[] = [];
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.risks && Array.isArray(parsed.risks)) {
          for (const riskData of parsed.risks) {
            const risk = this.buildRiskResult(riskData, input);

            // 过滤低置信度风险
            if (risk.confidence < this.confidenceThreshold) {
              continue;
            }

            risks.push(risk);
          }
        }
      } catch (error) {
        logger.error('解析AI响应失败:', error);
      }
    }

    return risks;
  }

  /**
   * 构建风险结果
   */
  private buildRiskResult(
    riskData: AIRiskIdentificationResult,
    input: RiskIdentificationInput
  ): RiskIdentificationResult {
    const riskLevel = calculateRiskLevel(riskData.score, this.config);

    return {
      id: generateRiskId(),
      riskType: this.validateRiskType(riskData.riskType),
      riskCategory: this.validateRiskCategory(riskData.riskCategory),
      riskLevel,
      score: this.validateScore(riskData.score),
      confidence: this.validateConfidence(riskData.confidence),
      description: riskData.description,
      evidence: riskData.evidence || [],
      suggestions: this.buildSuggestions(
        riskData.suggestions,
        riskData.riskType
      ),
      metadata: {
        caseId: input.caseId,
        caseTitle: input.caseTitle,
      },
      identifiedAt: new Date(),
    };
  }

  /**
   * 构建建议列表
   */
  private buildSuggestions(
    suggestions: Array<{
      type: string;
      action: string;
      reason: string;
      estimatedImpact: string;
    }>,
    riskType: RiskType
  ): RiskMitigationSuggestion[] {
    return suggestions.map(s => ({
      id: generateSuggestionId(),
      riskType,
      suggestionType: this.validateSuggestionType(s.type),
      priority: this.determinePriority(s.type),
      action: s.action,
      reason: s.reason,
      estimatedImpact: s.estimatedImpact,
      estimatedEffort: this.estimateEffort(s.type),
    }));
  }

  /**
   * 确定建议优先级
   */
  private determinePriority(suggestionType: string): SuggestionPriority {
    const priorityMap: Record<string, SuggestionPriority> = {
      GATHER_EVIDENCE: SuggestionPriority.HIGH,
      VERIFY_FACTS: SuggestionPriority.URGENT,
      ADD_LEGAL_BASIS: SuggestionPriority.HIGH,
      AMEND_CLAIM: SuggestionPriority.MEDIUM,
      CHANGE_STRATEGY: SuggestionPriority.MEDIUM,
      CONSULT_EXPERT: SuggestionPriority.MEDIUM,
      CONSIDER_SETTLEMENT: SuggestionPriority.LOW,
    };

    return priorityMap[suggestionType] || SuggestionPriority.MEDIUM;
  }

  /**
   * 估算工作量
   */
  private estimateEffort(suggestionType: string): string {
    const effortMap: Record<string, string> = {
      GATHER_EVIDENCE: '1-2周',
      VERIFY_FACTS: '2-3天',
      ADD_LEGAL_BASIS: '2-3天',
      AMEND_CLAIM: '1-2天',
      CHANGE_STRATEGY: '3-5天',
      CONSULT_EXPERT: '2-3天',
      CONSIDER_SETTLEMENT: '1周',
    };

    return effortMap[suggestionType] || '2-3天';
  }

  /**
   * 规则引擎识别（回退方案）
   */
  private identifyByRules(
    input: RiskIdentificationInput
  ): RiskIdentificationResult[] {
    const risks: RiskIdentificationResult[] = [];

    // 事实不足风险
    if (input.facts.length < 3) {
      risks.push({
        id: generateRiskId(),
        riskType: RiskType.FACT_VERIFICATION,
        riskCategory: RiskCategory.EVIDENTIARY,
        riskLevel: RiskLevel.HIGH,
        score: 0.7,
        confidence: 0.8,
        description: '案件事实描述较少，可能导致事实不清',
        evidence: [],
        suggestions: [
          {
            id: generateSuggestionId(),
            riskType: RiskType.FACT_VERIFICATION,
            suggestionType: MitigationSuggestionType.VERIFY_FACTS,
            priority: SuggestionPriority.URGENT,
            action: '补充案件事实细节',
            reason: '充足的案件事实是法律分析的基础',
            estimatedImpact: '降低事实模糊风险',
            estimatedEffort: '2-3天',
          },
        ],
        metadata: { caseId: input.caseId },
        identifiedAt: new Date(),
      });
    }

    // 证据不足风险
    if (!input.evidence || input.evidence.length === 0) {
      risks.push({
        id: generateRiskId(),
        riskType: RiskType.EVIDENCE_STRENGTH,
        riskCategory: RiskCategory.EVIDENTIARY,
        riskLevel: RiskLevel.CRITICAL,
        score: 0.85,
        confidence: 0.9,
        description: '案件缺少证据支持，可能导致举证不能',
        evidence: [],
        suggestions: [
          {
            id: generateSuggestionId(),
            riskType: RiskType.EVIDENCE_STRENGTH,
            suggestionType: MitigationSuggestionType.GATHER_EVIDENCE,
            priority: SuggestionPriority.URGENT,
            action: '收集相关证据材料',
            reason: '证据是胜诉的关键',
            estimatedImpact: '显著提升胜诉概率',
            estimatedEffort: '1-2周',
          },
        ],
        metadata: { caseId: input.caseId },
        identifiedAt: new Date(),
      });
    }

    // 法律依据不足风险
    if (!input.legalBasis || input.legalBasis.length === 0) {
      risks.push({
        id: generateRiskId(),
        riskType: RiskType.LEGAL_BASIS,
        riskCategory: RiskCategory.SUBSTANTIVE,
        riskLevel: RiskLevel.HIGH,
        score: 0.7,
        confidence: 0.85,
        description: '案件缺少明确的法律依据',
        evidence: [],
        suggestions: [
          {
            id: generateSuggestionId(),
            riskType: RiskType.LEGAL_BASIS,
            suggestionType: MitigationSuggestionType.ADD_LEGAL_BASIS,
            priority: SuggestionPriority.HIGH,
            action: '查找相关法条和判例',
            reason: '法律依据是诉讼的根本',
            estimatedImpact: '增强法律论证',
            estimatedEffort: '2-3天',
          },
        ],
        metadata: { caseId: input.caseId },
        identifiedAt: new Date(),
      });
    }

    return risks;
  }

  /**
   * 验证风险类型
   */
  private validateRiskType(type: string): RiskType {
    const validTypes = [
      RiskType.LEGAL_PROCEDURE,
      RiskType.EVIDENCE_STRENGTH,
      RiskType.STATUTE_LIMITATION,
      RiskType.JURISDICTION,
      RiskType.COST_BENEFIT,
      RiskType.FACT_VERIFICATION,
      RiskType.LEGAL_BASIS,
      RiskType.CONTRADICTION,
      RiskType.PROOF_BURDEN,
    ];

    if (validTypes.includes(type as RiskType)) {
      return type as RiskType;
    }

    return RiskType.FACT_VERIFICATION;
  }

  /**
   * 验证风险类别
   */
  private validateRiskCategory(category: string): RiskCategory {
    const validCategories = [
      RiskCategory.PROCEDURAL,
      RiskCategory.EVIDENTIARY,
      RiskCategory.SUBSTANTIVE,
      RiskCategory.STRATEGIC,
    ];

    if (validCategories.includes(category as RiskCategory)) {
      return category as RiskCategory;
    }

    return RiskCategory.SUBSTANTIVE;
  }

  /**
   * 验证建议类型
   */
  private validateSuggestionType(type: string): MitigationSuggestionType {
    const validTypes = [
      MitigationSuggestionType.GATHER_EVIDENCE,
      MitigationSuggestionType.AMEND_CLAIM,
      MitigationSuggestionType.CHANGE_STRATEGY,
      MitigationSuggestionType.ADD_LEGAL_BASIS,
      MitigationSuggestionType.CONSULT_EXPERT,
      MitigationSuggestionType.CONSIDER_SETTLEMENT,
      MitigationSuggestionType.VERIFY_FACTS,
    ];

    if (validTypes.includes(type as MitigationSuggestionType)) {
      return type as MitigationSuggestionType;
    }

    return MitigationSuggestionType.VERIFY_FACTS;
  }

  /**
   * 验证分数
   */
  private validateScore(score: unknown): number {
    if (typeof score === 'number' && score >= 0 && score <= 1) {
      return Math.round(score * 1000) / 1000;
    }

    return 0.5;
  }

  /**
   * 验证置信度
   */
  private validateConfidence(confidence: unknown): number {
    if (typeof confidence === 'number' && confidence >= 0 && confidence <= 1) {
      return Math.round(confidence * 1000) / 1000;
    }

    return 0.7;
  }
}
