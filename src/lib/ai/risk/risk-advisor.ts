/**
 * AIRiskAdvisor - AI风险建议器
 *
 * 功能：基于识别的风险提供具体的风险规避建议
 */

import type { AIService } from '../service';
import type { AIRequestConfig } from '../../../types/ai-service.d';
import type {
  RiskIdentificationResult,
  RiskAssessmentResult,
  RiskMitigationSuggestion,
  RiskType,
} from '../../../types/risk';
import {
  RiskLevel,
  MitigationSuggestionType,
  SuggestionPriority,
} from '../../../types/risk';

/**
 * 风险建议器配置
 */
interface RiskAdvisorConfig {
  aiService: AIService;
  enableFallback?: boolean;
  confidenceThreshold?: number;
}

/**
 * AI风险建议结果
 */
interface AIRiskAdviceResult {
  suggestionType: MitigationSuggestionType;
  priority: SuggestionPriority;
  action: string;
  reason: string;
  estimatedImpact: string;
  estimatedEffort: string;
  relatedRisks: RiskType[];
}

/**
 * AIRiskAdvisor主类
 */
export class AIRiskAdvisor {
  private readonly aiService: AIService;
  private readonly enableFallback: boolean;
  private readonly _confidenceThreshold: number;

  constructor(config: RiskAdvisorConfig) {
    this.aiService = config.aiService;
    this.enableFallback = config.enableFallback ?? true;
    this.confidenceThreshold = config.confidenceThreshold ?? 0.6;
  }

  /**
   * 为风险评估生成建议
   */
  async advise(
    assessment: RiskAssessmentResult
  ): Promise<RiskMitigationSuggestion[]> {
    if (!assessment.risks || assessment.risks.length === 0) {
      return [];
    }

    // 获取高优先级风险
    const highPriorityRisks = assessment.risks.filter(
      risk =>
        risk.riskLevel === RiskLevel.CRITICAL ||
        risk.riskLevel === RiskLevel.HIGH
    );

    if (highPriorityRisks.length === 0) {
      // 如果没有高风险，使用规则生成
      return this.adviseByRules(assessment);
    }

    try {
      return await this.adviseByAI(highPriorityRisks, assessment);
    } catch (error) {
      console.error('AI建议生成失败，使用规则引擎:', error);

      if (this.enableFallback) {
        return this.adviseByRules(assessment);
      }

      throw error;
    }
  }

  /**
   * 基于AI生成建议
   */
  private async adviseByAI(
    risks: RiskIdentificationResult[],
    assessment: RiskAssessmentResult
  ): Promise<RiskMitigationSuggestion[]> {
    const prompt = this.buildAdvicePrompt(risks, assessment);

    const request: AIRequestConfig = {
      model: 'deepseek-chat',
      provider: 'deepseek',
      messages: [
        {
          role: 'system',
          content:
            '你是专业的法律风险顾问。请根据识别的风险提供具体、可操作的风险规避建议。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 1500,
    };

    const response = await this.aiService.chatCompletion(request);

    return this.parseAdviceResponse(
      response.choices[0].message.content || '',
      risks
    );
  }

  /**
   * 构建建议提示词
   */
  private buildAdvicePrompt(
    risks: RiskIdentificationResult[],
    assessment: RiskAssessmentResult
  ): string {
    const parts: string[] = [];

    // 案件信息
    parts.push(`案件ID：${assessment.caseId}`);
    parts.push(`整体风险等级：${assessment.overallRiskLevel}`);
    parts.push(
      `整体风险评分：${(assessment.overallRiskScore * 100).toFixed(1)}%`
    );

    // 风险列表
    parts.push('\n识别到的风险：');
    risks.forEach((risk, index) => {
      parts.push(`${index + 1}. ${this.formatRiskSummary(risk)}`);
    });

    // 统计信息
    if (assessment.statistics) {
      parts.push('\n风险统计：');
      parts.push(`- 总风险数：${assessment.statistics.totalRisks}`);
      parts.push(`- 严重风险：${assessment.statistics.criticalRisks}`);
      parts.push(`- 高风险：${assessment.statistics.highRisks}`);
      parts.push(`- 中风险：${assessment.statistics.mediumRisks}`);
    }

    parts.push(
      '\n请为上述风险提供具体的风险规避建议，返回JSON格式：\n' +
        '{\n' +
        '  "suggestions": [\n' +
        '    {\n' +
        '      "type": "GATHER_EVIDENCE|AMEND_CLAIM|CHANGE_STRATEGY|ADD_LEGAL_BASIS|CONSULT_EXPERT|CONSIDER_SETTLEMENT|VERIFY_FACTS",\n' +
        '      "priority": "URGENT|HIGH|MEDIUM|LOW",\n' +
        '      "action": "具体行动建议",\n' +
        '      "reason": "建议原因",\n' +
        '      "estimatedImpact": "预期影响",\n' +
        '      "estimatedEffort": "预估工作量"\n' +
        '    }\n' +
        '  ]\n' +
        '}'
    );

    return parts.join('\n');
  }

  /**
   * 格式化风险摘要
   */
  private formatRiskSummary(risk: RiskIdentificationResult): string {
    return `${risk.riskLevel.toUpperCase()} - ${risk.riskType}: ${risk.description}`;
  }

  /**
   * 解析建议响应
   */
  private parseAdviceResponse(
    response: string,
    risks: RiskIdentificationResult[]
  ): RiskMitigationSuggestion[] {
    const suggestions: RiskMitigationSuggestion[] = [];
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
          for (const suggestionData of parsed.suggestions) {
            const suggestion = this.buildSuggestion(suggestionData, risks);
            suggestions.push(suggestion);
          }
        }
      } catch (error) {
        console.error('解析AI建议响应失败:', error);
      }
    }

    return suggestions;
  }

  /**
   * 构建建议对象
   */
  private buildSuggestion(
    suggestionData: AIRiskAdviceResult,
    risks: RiskIdentificationResult[]
  ): RiskMitigationSuggestion {
    return {
      id: this.generateSuggestionId(),
      riskType: suggestionData.relatedRisks[0] || risks[0].riskType,
      suggestionType: this.validateSuggestionType(
        suggestionData.suggestionType
      ),
      priority: this.validatePriority(suggestionData.priority),
      action: suggestionData.action,
      reason: suggestionData.reason,
      estimatedImpact: suggestionData.estimatedImpact,
      estimatedEffort: suggestionData.estimatedEffort || '2-3天',
    };
  }

  /**
   * 基于规则生成建议
   */
  private adviseByRules(
    assessment: RiskAssessmentResult
  ): RiskMitigationSuggestion[] {
    const suggestions: RiskMitigationSuggestion[] = [];

    for (const risk of assessment.risks) {
      // 根据风险类型生成对应建议
      const riskSuggestions = this.getSuggestionsForRiskType(risk);
      suggestions.push(...riskSuggestions);
    }

    // 按优先级排序
    suggestions.sort((a, b) => {
      const priorityOrder: Record<SuggestionPriority, number> = {
        [SuggestionPriority.URGENT]: 0,
        [SuggestionPriority.HIGH]: 1,
        [SuggestionPriority.MEDIUM]: 2,
        [SuggestionPriority.LOW]: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return suggestions;
  }

  /**
   * 根据风险类型获取建议
   */
  private getSuggestionsForRiskType(
    risk: RiskIdentificationResult
  ): RiskMitigationSuggestion[] {
    const suggestions: RiskMitigationSuggestion[] = [];

    switch (risk.riskType) {
      case 'legal_procedure':
        suggestions.push({
          id: this.generateSuggestionId(),
          riskType: risk.riskType,
          suggestionType: MitigationSuggestionType.CHANGE_STRATEGY,
          priority:
            risk.riskLevel === RiskLevel.CRITICAL
              ? SuggestionPriority.URGENT
              : SuggestionPriority.HIGH,
          action: '审查诉讼程序，确保符合法律规定',
          reason: '程序问题可能导致案件被驳回或重审',
          estimatedImpact: '降低程序风险，提高胜诉概率',
          estimatedEffort: '1-2天',
        });
        break;

      case 'evidence_strength':
        suggestions.push({
          id: this.generateSuggestionId(),
          riskType: risk.riskType,
          suggestionType: MitigationSuggestionType.GATHER_EVIDENCE,
          priority:
            risk.riskLevel === RiskLevel.CRITICAL
              ? SuggestionPriority.URGENT
              : SuggestionPriority.HIGH,
          action: '收集并整理相关证据材料',
          reason: '证据不足是败诉的主要原因之一',
          estimatedImpact: '显著提升胜诉概率',
          estimatedEffort: '1-2周',
        });
        break;

      case 'statute_limitation':
        suggestions.push({
          id: this.generateSuggestionId(),
          riskType: risk.riskType,
          suggestionType: MitigationSuggestionType.CHANGE_STRATEGY,
          priority: SuggestionPriority.URGENT,
          action: '立即核实诉讼时效',
          reason: '超过诉讼时效将丧失胜诉权',
          estimatedImpact: '避免因时效问题败诉',
          estimatedEffort: '1天',
        });
        break;

      case 'jurisdiction':
        suggestions.push({
          id: this.generateSuggestionId(),
          riskType: risk.riskType,
          suggestionType: MitigationSuggestionType.CHANGE_STRATEGY,
          priority: SuggestionPriority.HIGH,
          action: '确认案件管辖权',
          reason: '管辖权问题可能导致案件被移送或驳回',
          estimatedImpact: '确保案件在正确的法院审理',
          estimatedEffort: '2-3天',
        });
        break;

      case 'cost_benefit':
        suggestions.push({
          id: this.generateSuggestionId(),
          riskType: risk.riskType,
          suggestionType: MitigationSuggestionType.CONSIDER_SETTLEMENT,
          priority: SuggestionPriority.MEDIUM,
          action: '评估诉讼成本与预期收益',
          reason: '成本过高的诉讼可能得不偿失',
          estimatedImpact: '优化资源配置，提高收益比',
          estimatedEffort: '1-2天',
        });
        break;

      case 'fact_verification':
        suggestions.push({
          id: this.generateSuggestionId(),
          riskType: risk.riskType,
          suggestionType: MitigationSuggestionType.VERIFY_FACTS,
          priority:
            risk.riskLevel === RiskLevel.CRITICAL
              ? SuggestionPriority.URGENT
              : SuggestionPriority.HIGH,
          action: '核实案件事实细节',
          reason: '事实不清会导致法律论证不成立',
          estimatedImpact: '提高事实认定准确性',
          estimatedEffort: '2-3天',
        });
        break;

      case 'legal_basis':
        suggestions.push({
          id: this.generateSuggestionId(),
          riskType: risk.riskType,
          suggestionType: MitigationSuggestionType.ADD_LEGAL_BASIS,
          priority: SuggestionPriority.HIGH,
          action: '查找并补充法律依据',
          reason: '充分的法律依据是胜诉的基础',
          estimatedImpact: '增强法律论证力度',
          estimatedEffort: '2-3天',
        });
        break;

      case 'contradiction':
        suggestions.push({
          id: this.generateSuggestionId(),
          riskType: risk.riskType,
          suggestionType: MitigationSuggestionType.CHANGE_STRATEGY,
          priority: SuggestionPriority.HIGH,
          action: '识别并解决事实或法律依据的矛盾',
          reason: '矛盾会削弱案件的可信度',
          estimatedImpact: '提高案件的一致性',
          estimatedEffort: '1-2天',
        });
        break;

      case 'proof_burden':
        suggestions.push({
          id: this.generateSuggestionId(),
          riskType: risk.riskType,
          suggestionType: MitigationSuggestionType.CONSULT_EXPERT,
          priority: SuggestionPriority.MEDIUM,
          action: '咨询专家确认举证责任',
          reason: '举证责任不清可能导致败诉',
          estimatedImpact: '明确举证要求',
          estimatedEffort: '1-2天',
        });
        break;
    }

    return suggestions;
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
   * 验证优先级
   */
  private validatePriority(priority: string): SuggestionPriority {
    const validPriorities = [
      SuggestionPriority.URGENT,
      SuggestionPriority.HIGH,
      SuggestionPriority.MEDIUM,
      SuggestionPriority.LOW,
    ];

    if (validPriorities.includes(priority as SuggestionPriority)) {
      return priority as SuggestionPriority;
    }

    return SuggestionPriority.MEDIUM;
  }

  /**
   * 生成建议ID
   */
  private generateSuggestionId(): string {
    return `suggestion_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 获取建议类型的中文名称
   */
  getSuggestionTypeLabel(type: MitigationSuggestionType): string {
    const labels: Record<MitigationSuggestionType, string> = {
      [MitigationSuggestionType.GATHER_EVIDENCE]: '收集证据',
      [MitigationSuggestionType.AMEND_CLAIM]: '修改诉讼请求',
      [MitigationSuggestionType.CHANGE_STRATEGY]: '改变策略',
      [MitigationSuggestionType.ADD_LEGAL_BASIS]: '增加法律依据',
      [MitigationSuggestionType.CONSULT_EXPERT]: '咨询专家',
      [MitigationSuggestionType.CONSIDER_SETTLEMENT]: '考虑和解',
      [MitigationSuggestionType.VERIFY_FACTS]: '核实事实',
    };
    return labels[type] || '未知';
  }

  /**
   * 获取优先级的中文名称
   */
  getPriorityLabel(priority: SuggestionPriority): string {
    const labels: Record<SuggestionPriority, string> = {
      [SuggestionPriority.URGENT]: '紧急',
      [SuggestionPriority.HIGH]: '高',
      [SuggestionPriority.MEDIUM]: '中',
      [SuggestionPriority.LOW]: '低',
    };
    return labels[priority] || '未知';
  }
}
