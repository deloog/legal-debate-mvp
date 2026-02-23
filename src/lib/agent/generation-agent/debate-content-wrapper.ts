// 辩论内容包装器：为生成的内容添加格式化和包装

import {
  DebateGenerationResult,
  Argument,
  LegalReference,
} from '@/types/debate';
import type { LawArticle } from '@prisma/client';
import { DebateGenerationConfig, QualityMetrics } from './types';

/**
 * 辩论内容包装器类
 */
export class DebateContentWrapper {
  private config: Partial<DebateGenerationConfig>;

  constructor(config: Partial<DebateGenerationConfig> = {}) {
    this.config = {
      balanceStrictness: config.balanceStrictness ?? 'medium',
      includeLegalAnalysis: config.includeLegalAnalysis ?? true,
      maxArgumentsPerSide: config.maxArgumentsPerSide ?? 3,
      qualityThreshold: config.qualityThreshold ?? 0.7,
    };
  }

  /**
   * 包装辩论结果
   */
  wrapDebateResult(
    plaintiffArguments: Argument[],
    defendantArguments: Argument[],
    lawArticles: LawArticle[]
  ): DebateGenerationResult {
    const validPlaintiffArguments =
      this.validateAndFilterArguments(plaintiffArguments);
    const validDefendantArguments =
      this.validateAndFilterArguments(defendantArguments);

    const balancedPlaintiffArgs = this.balanceArguments(
      validPlaintiffArguments,
      validDefendantArguments
    );
    const balancedDefendantArgs = this.balanceArguments(
      validDefendantArguments,
      validPlaintiffArguments
    );

    const legalBasis = this.convertToLegalReferences(lawArticles);
    const qualityScore = this.calculateOverallQuality(
      balancedPlaintiffArgs,
      balancedDefendantArgs
    );

    return {
      plaintiffArguments: balancedPlaintiffArgs,
      defendantArguments: balancedDefendantArgs,
      legalBasis,
      metadata: {
        generatedAt: new Date(),
        model: 'deepseek',
        tokensUsed: 0,
        confidence: qualityScore,
        executionTime: 0,
      },
    };
  }

  /**
   * 包装单方论点
   */
  wrapSideArguments(
    _side: 'plaintiff' | 'defendant',
    argumentsList: Argument[],
    lawArticles: LawArticle[]
  ): Argument[] {
    const validArguments = this.validateAndFilterArguments(argumentsList);
    const wrappedArguments = validArguments.map(arg => ({
      ...arg,
      legalBasis: this.getLegalBasisForArgument(arg, lawArticles),
      reasoning: this.enhanceReasoning(arg),
      evidenceRefs: arg.evidenceRefs || [],
    }));

    return wrappedArguments.slice(0, this.config.maxArgumentsPerSide);
  }

  /**
   * 格式化辩论输出为文本
   */
  formatDebateAsText(result: DebateGenerationResult): string {
    let output = '';

    output += '【原告观点】\n';
    result.plaintiffArguments.forEach((arg, index) => {
      output += `${index + 1}. ${arg.content}\n`;
      if (arg.legalBasis) {
        output += `   法律依据：${arg.legalBasis}\n`;
      }
      if (arg.reasoning) {
        output += `   论证：${arg.reasoning}\n`;
      }
      output += '\n';
    });

    output += '\n【被告观点】\n';
    result.defendantArguments.forEach((arg, index) => {
      output += `${index + 1}. ${arg.content}\n`;
      if (arg.legalBasis) {
        output += `   法律依据：${arg.legalBasis}\n`;
      }
      if (arg.reasoning) {
        output += `   论证：${arg.reasoning}\n`;
      }
      output += '\n';
    });

    if (this.config.includeLegalAnalysis && result.legalBasis.length > 0) {
      output += '\n【法律依据】\n';
      result.legalBasis.forEach((ref, index) => {
        output += `${index + 1}. ${ref.lawName} ${ref.articleNumber}\n`;
        output += `   ${ref.fullText?.substring(0, 100)}...\n`;
        output += '\n';
      });
    }

    return output;
  }

  /**
   * 格式化辩论输出为JSON
   */
  formatDebateAsJSON(result: DebateGenerationResult): string {
    return JSON.stringify(
      {
        plaintiff: result.plaintiffArguments,
        defendant: result.defendantArguments,
        legalBasis: result.legalBasis,
        metadata: result.metadata,
      },
      null,
      2
    );
  }

  /**
   * 验证并过滤论点
   */
  private validateAndFilterArguments(argumentList: Argument[]): Argument[] {
    return argumentList.filter(arg => {
      if (!arg.content || arg.content.trim().length === 0) {
        return false;
      }

      if (
        arg.score !== undefined &&
        arg.score < this.config.qualityThreshold!
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * 平衡双方论点
   */
  private balanceArguments(
    targetArguments: Argument[],
    opponentArguments: Argument[]
  ): Argument[] {
    const maxCount = this.config.maxArgumentsPerSide!;

    if (
      targetArguments.length < maxCount &&
      opponentArguments.length > maxCount
    ) {
      return targetArguments;
    }

    return targetArguments.slice(0, maxCount);
  }

  /**
   * 转换法律依据
   */
  private convertToLegalReferences(
    lawArticles: LawArticle[]
  ): LegalReference[] {
    return lawArticles.map(article => ({
      lawName: article.lawName,
      articleNumber: article.articleNumber,
      fullText: article.fullText,
      relevanceScore: 0.8,
      applicabilityScore: 0.75,
    }));
  }

  /**
   * 为论点获取法律依据
   */
  private getLegalBasisForArgument(
    argument: Argument,
    lawArticles: LawArticle[]
  ): string {
    if (argument.legalBasis) {
      return argument.legalBasis;
    }

    const keywords = this.extractKeywords(argument.content);
    const matchedArticles = lawArticles.filter(article =>
      keywords.some(keyword =>
        article.fullText?.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    if (matchedArticles.length > 0) {
      const article = matchedArticles[0];
      return `《${article.lawName}》${article.articleNumber}`;
    }

    return '暂无明确法律依据';
  }

  /**
   * 增强论证
   */
  private enhanceReasoning(argument: Argument): string {
    if (argument.reasoning) {
      return argument.reasoning;
    }

    return '基于上述事实，本观点具有合理性和法律依据。';
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const commonWords = new Set([
      '的',
      '了',
      '在',
      '是',
      '我',
      '有',
      '和',
      '就',
      '不',
      '人',
      '都',
      '一',
      '一个',
      '上',
      '也',
      '很',
      '到',
      '说',
      '要',
      '去',
      '你',
      '会',
      '着',
      '没有',
      '看',
      '好',
      '自己',
      '这',
    ]);

    return text
      .split(/[，。！？、\s]+/)
      .filter(word => word.length > 1 && !commonWords.has(word))
      .slice(0, 5);
  }

  /**
   * 计算整体质量
   */
  private calculateOverallQuality(
    plaintiffArgs: Argument[],
    defendantArgs: Argument[]
  ): number {
    let totalScore = 0;
    let count = 0;

    plaintiffArgs.forEach(arg => {
      if (arg.score !== undefined) {
        totalScore += arg.score;
        count++;
      }
    });

    defendantArgs.forEach(arg => {
      if (arg.score !== undefined) {
        totalScore += arg.score;
        count++;
      }
    });

    if (count === 0) return 0.5;

    return totalScore / count;
  }

  /**
   * 获取质量指标
   */
  getQualityMetrics(result: DebateGenerationResult): QualityMetrics {
    const allArguments = [
      ...result.plaintiffArguments,
      ...result.defendantArguments,
    ];

    const clarity = this.calculateClarity(allArguments);
    const logic = this.calculateLogic(allArguments);
    const completeness = this.calculateCompleteness(allArguments);
    const format = this.calculateFormat(allArguments);

    const overall = (clarity + logic + completeness + format) / 4;

    return {
      clarity,
      logic,
      completeness,
      format,
      overall,
    };
  }

  /**
   * 计算清晰度
   */
  private calculateClarity(argumentList: Argument[]): number {
    if (argumentList.length === 0) return 0;

    let totalClarity = 0;
    argumentList.forEach(arg => {
      let clarity = 0.5;
      if (arg.content.length > 20) clarity += 0.2;
      if (arg.content.length > 50) clarity += 0.2;
      if (arg.content.includes('，') || arg.content.includes('、'))
        clarity += 0.1;
      totalClarity += Math.min(1, clarity);
    });

    return totalClarity / argumentList.length;
  }

  /**
   * 计算逻辑性
   */
  private calculateLogic(argumentList: Argument[]): number {
    if (argumentList.length === 0) return 0;

    let totalLogic = 0;
    argumentList.forEach(arg => {
      let logic = 0.5;
      if (arg.legalBasis) logic += 0.2;
      if (arg.reasoning) logic += 0.2;
      if (arg.evidenceRefs && arg.evidenceRefs.length > 0) logic += 0.1;
      totalLogic += Math.min(1, logic);
    });

    return totalLogic / argumentList.length;
  }

  /**
   * 计算完整性
   */
  private calculateCompleteness(argumentList: Argument[]): number {
    if (argumentList.length === 0) return 0;

    const count = argumentList.length;
    return Math.min(1, count / 5);
  }

  /**
   * 计算格式
   */
  private calculateFormat(argumentList: Argument[]): number {
    if (argumentList.length === 0) return 0;

    return 1;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DebateGenerationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): Partial<DebateGenerationConfig> {
    return { ...this.config };
  }
}
