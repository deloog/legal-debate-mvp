import { LawArticle, LawStatus, LawType } from '@prisma/client';
import { DocumentAnalysisOutput } from '@/lib/agent/doc-analyzer/core/types';
import { RuleValidationResult } from './types';

/**
 * 规则验证器
 *
 * Layer 2: 规则验证
 * 时效性检查、适用范围检查、法条层级检查
 */
export class RuleValidator {
  /**
   * 验证单条法条
   */
  public validateArticle(
    article: LawArticle,
    caseInfo: DocumentAnalysisOutput
  ): RuleValidationResult {
    // 时效性检查
    const validity = this.checkValidity(article);

    // 适用范围检查
    const scope = this.checkScope(article, caseInfo);

    // 法条层级评分
    const levelScore = this.calculateLevelScore(article);

    // 综合规则评分
    const overallScore = this.calculateOverallScore(
      validity,
      scope,
      levelScore
    );

    return {
      validity,
      scope,
      levelScore,
      overallScore,
    };
  }

  /**
   * 批量验证法条
   */
  public validateArticles(
    articles: LawArticle[],
    caseInfo: DocumentAnalysisOutput
  ): Map<string, RuleValidationResult> {
    const results = new Map<string, RuleValidationResult>();

    for (const article of articles) {
      const result = this.validateArticle(article, caseInfo);
      results.set(article.id, result);
    }

    return results;
  }

  /**
   * 时效性检查
   */
  private checkValidity(article: LawArticle): {
    passed: boolean;
    reason?: string;
  } {
    const now = new Date();

    // 检查法条状态
    if (article.status !== LawStatus.VALID) {
      const statusText = this.translateLawStatus(article.status);
      return {
        passed: false,
        reason: `法条状态为${statusText}，不适用于当前案件`,
      };
    }

    // 检查生效日期
    if (article.effectiveDate > now) {
      return {
        passed: false,
        reason: `法条尚未生效（生效日期：${this.formatDate(article.effectiveDate)}）`,
      };
    }

    // 检查失效日期
    if (article.expiryDate && article.expiryDate < now) {
      return {
        passed: false,
        reason: `法条已失效（失效日期：${this.formatDate(article.expiryDate)}）`,
      };
    }

    return {
      passed: true,
      reason: '法条在有效期内，状态正常',
    };
  }

  /**
   * 适用范围检查
   */
  private checkScope(
    article: LawArticle,
    caseInfo: DocumentAnalysisOutput
  ): { passed: boolean; reason?: string } {
    const caseType = caseInfo.extractedData.caseType;

    // 检查法条分类与案件类型的匹配度
    const categoryMatch = this.checkCategoryMatch(article, caseType);
    if (!categoryMatch.passed) {
      return categoryMatch;
    }

    // 检查法条类型与案件的匹配度
    const typeMatch = this.checkTypeMatch(article, caseInfo);
    if (!typeMatch.passed) {
      return typeMatch;
    }

    // 检查管辖权范围
    if (article.jurisdiction) {
      const isLocalRegulation = article.lawType === LawType.LOCAL_REGULATION;
      if (isLocalRegulation) {
        return {
          passed: true,
          reason: '地方法规，需确认管辖权范围',
        };
      }
    }

    return {
      passed: true,
      reason: '法条适用范围与案件匹配',
    };
  }

  /**
   * 检查法律分类匹配
   */
  private checkCategoryMatch(
    article: LawArticle,
    caseType: string | undefined
  ): { passed: boolean; reason?: string } {
    if (!caseType) {
      // 无法确定案件类型，不进行分类检查
      return { passed: true };
    }

    const categoryMap = this.getCategoryMapping();
    const expectedCategories = categoryMap[caseType];

    if (!expectedCategories) {
      // 无法确定预期分类，不进行检查
      return { passed: true };
    }

    // 检查法条分类是否在预期分类中
    if (!expectedCategories.includes(article.category)) {
      const categoryText = this.translateLawCategory(article.category);
      const caseTypeText = this.translateCaseType(caseType);
      return {
        passed: false,
        reason: `法条分类（${categoryText}）与案件类型（${caseTypeText}）不匹配`,
      };
    }

    return {
      passed: true,
      reason: `法条分类（${article.category}）与案件类型匹配`,
    };
  }

  /**
   * 检查法条类型匹配
   */
  private checkTypeMatch(
    article: LawArticle,
    caseInfo: DocumentAnalysisOutput
  ): { passed: boolean; reason?: string } {
    const caseType = caseInfo.extractedData.caseType;

    // 刑事案件主要使用刑法相关法条
    if (caseType === 'criminal' && article.lawType !== LawType.LAW) {
      return {
        passed: false,
        reason: '刑事案件应优先适用法律层级法条，而非其他层级法条',
      };
    }

    // 民事案件可以使用多种法条类型
    if (caseType === 'civil') {
      // 民事案件优先使用法律和行政法规
      if (
        article.lawType === LawType.CONSTITUTION ||
        article.lawType === LawType.OTHER
      ) {
        return {
          passed: false,
          reason: '法条类型不适用于民事案件',
        };
      }
    }

    return {
      passed: true,
      reason: '法条类型与案件类型匹配',
    };
  }

  /**
   * 计算法条层级评分
   */
  private calculateLevelScore(article: LawArticle): number {
    // 1. 计算法条类型评分（权重80%）
    const levelScores: Record<LawType, number> = {
      CONSTITUTION: 0.9, // 宪法
      LAW: 1.0, // 法律（最高层级，最高分）
      ADMINISTRATIVE_REGULATION: 0.85, // 行政法规
      LOCAL_REGULATION: 0.7, // 地方性法规
      JUDICIAL_INTERPRETATION: 0.8, // 司法解释
      DEPARTMENTAL_RULE: 0.65, // 部门规章
      OTHER: 0.5, // 其他
    };

    const typeScore = levelScores[article.lawType] || 0.5;

    // 2. 计算热度评分（权重20%）
    const hotnessScore = this.calculateHotnessScore(article);

    // 3. 综合评分：类型权重80%，热度权重20%
    const finalScore = typeScore * 0.8 + hotnessScore * 0.2;

    return Math.min(finalScore, 1);
  }

  /**
   * 计算法条热度评分
   */
  private calculateHotnessScore(article: LawArticle): number {
    // 获取最大值用于归一化
    const maxViewCount = 10000; // 假设最大浏览量为10000
    const maxReferenceCount = 5000; // 假设最大引用量为5000

    // 归一化浏览量评分
    const viewScore = Math.min(article.viewCount / maxViewCount, 1);

    // 归一化引用量评分
    const referenceScore = Math.min(
      article.referenceCount / maxReferenceCount,
      1
    );

    // 热度评分：浏览量权重60%，引用量权重40%
    const hotnessScore = viewScore * 0.6 + referenceScore * 0.4;

    return hotnessScore;
  }

  /**
   * 计算综合规则评分
   */
  private calculateOverallScore(
    validity: { passed: boolean; reason?: string },
    scope: { passed: boolean; reason?: string },
    levelScore: number
  ): number {
    let score = levelScore;

    // 时效性通过，加分
    if (validity.passed) {
      score *= 1.0;
    } else {
      // 时效性不通过，大幅降分
      score *= 0.2;
    }

    // 适用范围通过，加分
    if (scope.passed) {
      score *= 1.0;
    } else {
      // 适用范围不通过，大幅降分
      score *= 0.3;
    }

    return Math.min(score, 1);
  }

  /**
   * 获取案件类型与法条分类的映射
   */
  private getCategoryMapping(): Record<string, string[]> {
    return {
      civil: ['CIVIL'],
      criminal: ['CRIMINAL'],
      administrative: ['ADMINISTRATIVE'],
      commercial: ['CIVIL', 'COMMERCIAL'],
      labor: ['LABOR'],
      intellectual: ['INTELLECTUAL_PROPERTY'],
      other: ['CIVIL', 'ADMINISTRATIVE', 'OTHER'],
    };
  }

  /**
   * 翻译法条状态
   */
  private translateLawStatus(status: LawStatus): string {
    const translations: Record<LawStatus, string> = {
      DRAFT: '草案',
      VALID: '有效',
      AMENDED: '已修订',
      REPEALED: '已废止',
      EXPIRED: '已过期',
    };
    return translations[status] || status;
  }

  /**
   * 翻译法律分类
   */
  private translateLawCategory(category: string): string {
    const translations: Record<string, string> = {
      CIVIL: '民事',
      CRIMINAL: '刑事',
      ADMINISTRATIVE: '行政',
      COMMERCIAL: '商事',
      ECONOMIC: '经济',
      LABOR: '劳动',
      INTELLECTUAL_PROPERTY: '知识产权',
      PROCEDURE: '程序',
      OTHER: '其他',
    };
    return translations[category] || category;
  }

  /**
   * 翻译案件类型
   */
  private translateCaseType(type: string): string {
    const translations: Record<string, string> = {
      civil: '民事案件',
      criminal: '刑事案件',
      administrative: '行政案件',
      commercial: '商事案件',
      labor: '劳动案件',
      intellectual: '知识产权案件',
      other: '其他案件',
    };
    return translations[type] || type;
  }

  /**
   * 格式化日期
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

// 默认导出
export default RuleValidator;
