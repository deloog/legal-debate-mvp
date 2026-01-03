/**
 * 诉讼请求与事实匹配器
 * 检查诉讼请求与事实的匹配度和相关性
 */

/**
 * 待验证数据接口
 */
interface DataToVerify {
  claims?: string[]; // 诉讼请求
  facts?: string[]; // 事实理由
  [key: string]: unknown;
}

/**
 * 诉讼请求与事实匹配器类
 */
export class ClaimFactMatcher {
  /**
   * 检查诉讼请求与事实匹配度
   */
  async check(data: DataToVerify): Promise<number> {
    if (!data.claims || !data.facts || data.claims.length === 0) {
      return 0;
    }

    const factsText = data.facts.join(" ");
    let totalMatchScore = 0;

    // 检查每个诉讼请求是否在事实中有支撑
    for (const claim of data.claims) {
      const matchScore = this.calculateClaimFactMatch(claim, factsText);
      totalMatchScore += matchScore;
    }

    return totalMatchScore / data.claims.length;
  }

  /**
   * 计算单个诉讼请求与事实的匹配度
   */
  private calculateClaimFactMatch(claim: string, factsText: string): number {
    // 提取关键词
    const claimKeywords = this.extractKeywords(claim);
    if (claimKeywords.length === 0) {
      return 0;
    }

    // 计算关键词匹配率
    let matchedKeywords = 0;
    for (const keyword of claimKeywords) {
      if (factsText.includes(keyword)) {
        matchedKeywords++;
      }
    }

    return matchedKeywords / claimKeywords.length;
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
}
