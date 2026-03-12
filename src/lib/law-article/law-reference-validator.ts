/**
 * 法条引用强制验证服务
 *
 * 提供法条引用的强制验证功能：
 * 1. 验证法条存在性 - 检查引用的法条是否在数据库中存在
 * 2. 验证内容准确性 - 检查法条内容是否与数据库中的内容匹配
 * 3. 验证效力状态 - 检查法条是否有效（VALID, EXPIRED, AMENDED, REPEALED）
 * 4. 无法验证时标记为"未经核实"
 */

import { prisma } from '@/lib/db';
import { LawArticle, LegalReference, LawStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

/** 验证状态枚举 */
export enum ValidationStatus {
  VERIFIED = 'VERIFIED', // 已验证通过
  INVALID = 'INVALID', // 验证无效（参数错误等）
  UNVERIFIED = 'UNVERIFIED', // 未经核实（法条不存在）
}

/** 验证结果类型 */
export interface ValidationResult {
  /** 是否验证通过 */
  isValid: boolean;
  /** 验证状态 */
  validationStatus: ValidationStatus;
  /** 关联的法条ID */
  articleId: string | null;
  /** 法条状态 */
  lawStatus: LawStatus | null;
  /** 内容是否匹配 */
  contentMatch: boolean | null;
  /** 相似度分数 (0-1) */
  similarityScore: number | null;
  /** 错误消息 */
  errorMessage: string | null;
  /** 权威来源URL */
  sourceUrl: string | null;
  /** 验证时间 */
  validatedAt: Date;
}

/** 批量验证统计 */
export interface ValidationStats {
  total: number;
  valid: number;
  invalid: number;
  unverified: number;
  verificationRate: number;
}

/** 法条查询参数 */
interface LawArticleQueryParams {
  lawType?: string | null;
  articleNumber?: string | null;
  lawName?: string | null;
}

/** 验证配置选项 */
export interface ValidationOptions {
  /** 内容相似度阈值，低于此值认为内容不匹配 */
  contentSimilarityThreshold?: number;
  /** 是否严格匹配（完全相同才算匹配） */
  strictContentMatch?: boolean;
  /** 是否启用权威来源验证 */
  enableSourceValidation?: boolean;
}

/** 默认配置 */
const DEFAULT_OPTIONS: ValidationOptions = {
  contentSimilarityThreshold: 0.5,
  strictContentMatch: false,
  enableSourceValidation: true,
};

/** 相似度计算结果 */
interface SimilarityResult {
  score: number;
  isMatch: boolean;
}

export class LawReferenceValidator {
  private options: ValidationOptions;

  constructor(options: ValidationOptions = DEFAULT_OPTIONS) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 验证单个法条引用
   */
  async validateReference(
    reference: LegalReference
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const result: ValidationResult = {
      isValid: false,
      validationStatus: ValidationStatus.INVALID,
      articleId: null,
      lawStatus: null,
      contentMatch: null,
      similarityScore: null,
      errorMessage: null,
      sourceUrl: null,
      validatedAt: new Date(),
    };

    try {
      // 1. 参数校验
      if (!reference.articleNumber || reference.articleNumber.trim() === '') {
        result.errorMessage = '法条编号不能为空';
        result.validationStatus = ValidationStatus.INVALID;
        logger.warn('法条引用验证失败：法条编号为空', {
          referenceId: reference.id,
        });
        return result;
      }

      // 2. 查询法条是否存在
      const article = await this.findLawArticle(reference);

      if (!article) {
        // 法条不存在，标记为"未经核实"
        result.validationStatus = ValidationStatus.UNVERIFIED;
        result.errorMessage = `未找到法条：${reference.lawType || ''} ${reference.articleNumber}`;
        logger.info('法条引用验证：法条不存在', {
          referenceId: reference.id,
          lawType: reference.lawType,
          articleNumber: reference.articleNumber,
        });
        return result;
      }

      // 3. 法条存在，进行详细验证
      result.articleId = article.id;
      result.lawStatus = article.status;

      // 3.1 效力状态验证
      const statusValidation = this.validateLawStatus(article);
      if (!statusValidation.isValid) {
        result.isValid = false;
        result.errorMessage = statusValidation.errorMessage;
        result.validationStatus = ValidationStatus.VERIFIED; // 已核实但是无效
        logger.info('法条引用验证：法条状态无效', {
          referenceId: reference.id,
          articleId: article.id,
          status: article.status,
        });
        return result;
      }

      // 3.2 内容准确性验证
      if (reference.content) {
        const contentValidation = await this.validateContent(
          reference.content,
          article.fullText
        );
        result.contentMatch = contentValidation.isMatch;
        result.similarityScore = contentValidation.score;

        if (!contentValidation.isMatch) {
          result.isValid = false;
          result.errorMessage = `法条内容不匹配（相似度：${(contentValidation.score * 100).toFixed(1)}%）`;
          result.validationStatus = ValidationStatus.VERIFIED;
          logger.info('法条引用验证：内容不匹配', {
            referenceId: reference.id,
            articleId: article.id,
            similarity: contentValidation.score,
          });
          return result;
        }
      }

      // 4. 全部验证通过
      result.isValid = true;
      result.validationStatus = ValidationStatus.VERIFIED;
      result.sourceUrl = this.generateSourceUrl(article);

      logger.debug('法条引用验证通过', {
        referenceId: reference.id,
        articleId: article.id,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error('法条引用验证异常', {
        referenceId: reference.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量验证多个法条引用
   */
  async validateReferences(
    references: LegalReference[]
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const reference of references) {
      const result = await this.validateReference(reference);
      results.push(result);
    }

    return results;
  }

  /**
   * 获取批量验证统计信息
   */
  async getValidationStats(
    references: LegalReference[]
  ): Promise<ValidationStats> {
    const results = await this.validateReferences(references);

    const stats: ValidationStats = {
      total: references.length,
      valid: 0,
      invalid: 0,
      unverified: 0,
      verificationRate: 0,
    };

    for (const result of results) {
      if (
        result.validationStatus === ValidationStatus.VERIFIED &&
        result.isValid
      ) {
        stats.valid++;
      } else if (result.validationStatus === ValidationStatus.UNVERIFIED) {
        stats.unverified++;
      } else {
        stats.invalid++;
      }
    }

    stats.verificationRate =
      stats.total > 0 ? (stats.valid / stats.total) * 100 : 0;

    return stats;
  }

  /**
   * 查找法条
   */
  private async findLawArticle(
    reference: LegalReference
  ): Promise<LawArticle | null> {
    const query: LawArticleQueryParams = {};

    if (reference.articleNumber) {
      query.articleNumber = reference.articleNumber;
    }

    if (reference.lawType) {
      query.lawType = reference.lawType;
    }

    // 优先精确匹配
    let article = await prisma.lawArticle.findFirst({
      where: {
        articleNumber: query.articleNumber ?? undefined,
      },
      orderBy: { effectiveDate: 'desc' },
    });

    // 如果没找到，尝试模糊匹配
    if (!article && query.articleNumber) {
      article = await prisma.lawArticle.findFirst({
        where: {
          OR: [
            { articleNumber: { contains: query.articleNumber } },
            { searchableText: { contains: query.articleNumber } },
          ],
        },
        orderBy: { effectiveDate: 'desc' },
      });
    }

    return article;
  }

  /**
   * 验证法条效力状态
   */
  private validateLawStatus(article: LawArticle): {
    isValid: boolean;
    errorMessage: string | null;
  } {
    switch (article.status) {
      case LawStatus.VALID:
        return { isValid: true, errorMessage: null };

      case LawStatus.REPEALED:
        const repealDate = article.expiryDate
          ? `（已于${article.expiryDate.toLocaleDateString('zh-CN')}废止）`
          : '';
        return {
          isValid: false,
          errorMessage: `引用的法条已废止${repealDate}`,
        };

      case LawStatus.AMENDED:
        return {
          isValid: false,
          errorMessage: `引用的法条已被修订，请参考最新版本`,
        };

      case LawStatus.EXPIRED:
        const expiryDateStr = article.expiryDate
          ? `（已于${article.expiryDate.toLocaleDateString('zh-CN')}过期）`
          : '';
        return {
          isValid: false,
          errorMessage: `引用的法条已过期${expiryDateStr}`,
        };

      case LawStatus.DRAFT:
        return {
          isValid: false,
          errorMessage: '引用的法条为草案，尚未生效',
        };

      default:
        return {
          isValid: false,
          errorMessage: `法条状态未知：${article.status}`,
        };
    }
  }

  /**
   * 验证法条内容准确性
   */
  private async validateContent(
    referenceContent: string,
    articleContent: string
  ): Promise<SimilarityResult> {
    if (this.options.strictContentMatch) {
      // 严格模式：完全相同才算匹配
      const isMatch = referenceContent.trim() === articleContent.trim();
      return {
        score: isMatch ? 1.0 : 0.0,
        isMatch,
      };
    }

    // 计算相似度
    const similarity = this.calculateSimilarity(
      referenceContent,
      articleContent
    );
    const isMatch =
      similarity >= (this.options.contentSimilarityThreshold || 0.5);

    return {
      score: similarity,
      isMatch,
    };
  }

  /**
   * 计算文本相似度（使用改进的基于字符的相似度算法）
   * 结合了Jaccard相似度和最长公共子序列(LCS)的思想
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // 预处理：去除标点符号，转小写
    const normalizeText = (text: string): string => {
      return text
        .toLowerCase()
        .replace(/[，。、；：""''（）【】《》]/g, '')
        .replace(/\s+/g, '')
        .trim();
    };

    const normalized1 = normalizeText(text1);
    const normalized2 = normalizeText(text2);

    if (normalized1 === normalized2) {
      return 1.0;
    }

    if (normalized1.length === 0 || normalized2.length === 0) {
      return 0.0;
    }

    // 使用基于字符的Jaccard相似度（字符级）
    const charSet1 = new Set(normalized1.split(''));
    const charSet2 = new Set(normalized2.split(''));

    const intersection = new Set([...charSet1].filter(x => charSet2.has(x)));
    const union = new Set([...charSet1, ...charSet2]);

    const jaccardSimilarity = intersection.size / union.size;

    // 结合基于子字符串的相似度
    const substringSimilarity = this.calculateSubstringSimilarity(
      normalized1,
      normalized2
    );

    // 综合相似度：70%子字符串相似度 + 30%字符集相似度
    return substringSimilarity * 0.7 + jaccardSimilarity * 0.3;
  }

  /**
   * 计算基于最长公共子序列的相似度
   */
  private calculateSubstringSimilarity(text1: string, text2: string): number {
    // 计算LCS长度
    const lcsLength = this.getLCSLength(text1, text2);

    // 相似度 = 2 * LCS / (|A| + |B|)
    return (2 * lcsLength) / (text1.length + text2.length);
  }

  /**
   * 获取最长公共子序列长度（动态规划）
   */
  private getLCSLength(text1: string, text2: string): number {
    const m = text1.length;
    const n = text2.length;

    // 空间优化：只保留两行
    let prev: number[] = new Array(n + 1).fill(0);
    let curr: number[] = new Array(n + 1).fill(0);

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (text1[i - 1] === text2[j - 1]) {
          curr[j] = prev[j - 1] + 1;
        } else {
          curr[j] = Math.max(prev[j], curr[j - 1]);
        }
      }
      [prev, curr] = [curr, prev];
    }

    return prev[n];
  }

  /**
   * 生成权威来源URL
   */
  private generateSourceUrl(article: LawArticle): string | null {
    if (!this.options.enableSourceValidation) {
      return null;
    }

    // 根据法条类型生成不同的权威来源URL
    const baseUrls: Record<string, string> = {
      CONSTITUTION: 'http://www.npc.gov.cn/npc/c30834/',
      LAW: 'http://www.npc.gov.cn/npc/c',
      ADMINISTRATIVE_REGULATION: 'http://www.gov.cn/zhengce/',
      LOCAL_REGULATION: 'http://www.gov.cn/zhengce/',
      JUDICIAL_INTERPRETATION: 'http://www.court.gov.cn/',
    };

    const baseUrl = baseUrls[article.lawType] || 'http://www.npc.gov.cn/';
    return `${baseUrl}content/${article.id}`;
  }
}

/** 默认导出 */
export default LawReferenceValidator;
