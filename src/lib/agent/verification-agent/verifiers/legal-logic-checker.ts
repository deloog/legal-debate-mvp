/**
 * 法条引用逻辑性检查器
 * 检查法条的有效性、相关性和层级
 */
import { LegalLogicCheck } from "../types";

/**
 * 待验证数据接口
 */
interface DataToVerify {
  claims?: string[]; // 诉讼请求
  legalBasis?: Array<{ lawName: string; articleNumber: string }>; // 法律依据
  [key: string]: unknown;
}

/**
 * 法条引用检查器类
 */
export class LegalLogicChecker {
  /**
   * 检查法条引用逻辑性
   */
  async check(data: DataToVerify): Promise<LegalLogicCheck> {
    const result: LegalLogicCheck = {
      score: 0,
      valid: false,
      relevant: false,
      hierarchy: "unknown",
    };

    if (!data.legalBasis || data.legalBasis.length === 0) {
      return result;
    }

    // 检查法条是否有效（简单检查格式）
    const validCount = data.legalBasis.filter(
      (item) => item.lawName && item.articleNumber,
    ).length;

    result.valid = validCount === data.legalBasis.length;

    // 检查法条与诉讼请求的相关性
    if (data.claims && data.claims.length > 0) {
      let relevantCount = 0;
      for (const legal of data.legalBasis) {
        const relevance = this.checkLegalRelevance(legal, data.claims);
        if (relevance > 0.5) {
          relevantCount++;
        }
      }
      result.relevant = relevantCount > data.legalBasis.length / 2;
    } else {
      result.relevant = true;
    }

    // 确定法条层级
    const lawLevels: Record<string, number> = {
      法: 3,
      条例: 2,
      规定: 1,
      办法: 1,
    };

    let maxLevel = 0;
    for (const legal of data.legalBasis) {
      for (const [keyword, level] of Object.entries(lawLevels)) {
        if (legal.lawName.includes(keyword)) {
          maxLevel = Math.max(maxLevel, level);
          break;
        }
      }
    }

    result.hierarchy = this.getHierarchyLabel(maxLevel);

    // 计算评分
    let score = 0;
    if (result.valid) score += 0.4;
    if (result.relevant) score += 0.4;
    if (maxLevel >= 2) score += 0.2;

    result.score = score;

    return result;
  }

  /**
   * 检查法条与诉讼请求的相关性
   */
  private checkLegalRelevance(
    legal: { lawName: string; articleNumber: string },
    claims: string[],
  ): number {
    const legalText = `${legal.lawName}${legal.articleNumber}`;
    const claimsText = claims.join(" ");

    const legalKeywords = this.extractKeywords(legalText);
    if (legalKeywords.length === 0) {
      return 0;
    }

    let matchedKeywords = 0;
    for (const keyword of legalKeywords) {
      if (claimsText.includes(keyword)) {
        matchedKeywords++;
      }
    }

    return matchedKeywords / legalKeywords.length;
  }

  /**
   * 提取文本中的关键词
   */
  private extractKeywords(text: string): string[] {
    // 移除停用词和标点
    const stopWords = new Set([
      "的",
      "了",
      "是",
      "在",
      "和",
      "有",
      "我",
      "你",
      "他",
      "她",
      "它",
      "我们",
      "你们",
      "他们",
      "这",
      "那",
      "这个",
      "那个",
    ]);

    const words = text
      .replace(/[，。！？；：""''（）]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 1 && !stopWords.has(word));

    return [...new Set(words)].slice(0, 10); // 最多返回10个关键词
  }

  /**
   * 获取法条层级标签
   */
  private getHierarchyLabel(level: number): string {
    switch (level) {
      case 3:
        return "law";
      case 2:
        return "regulation";
      case 1:
        return "rule";
      default:
        return "unknown";
    }
  }

  /**
   * 创建空的法条引用结果
   */
  async getEmptyResult(): Promise<LegalLogicCheck> {
    return {
      score: 0,
      valid: false,
      relevant: false,
      hierarchy: "unknown",
    };
  }
}
