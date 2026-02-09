/**
 * 置信度评估器
 *
 * 核心功能：
 * - 评估AI提取结果的置信度
 * - 评估当事人、诉讼请求、金额的质量
 * - 为混合兜底策略提供决策依据
 */

import type { ExtractedData, Party, Claim } from '../core/types';

export interface ConfidenceScores {
  overall: number; // 总体置信度 0-1
  parties: number; // 当事人置信度 0-1
  claims: number; // 诉讼请求置信度 0-1
  amount: number; // 金额置信度 0-1
  details: Record<string, number>; // 详细评分
}

export class ConfidenceEvaluator {
  /**
   * 评估AI提取结果的置信度
   */
  public evaluateAIResult(
    data: ExtractedData,
    fullText: string
  ): ConfidenceScores {
    const partiesScore = this.evaluateParties(data.parties, fullText);
    const claimsScore = this.evaluateClaims(data.claims, fullText);
    const amountScore = this.evaluateAmount(
      data.claims.length > 0 ? data.claims[0].amount : undefined,
      fullText
    );

    // 计算总体置信度（加权平均）
    const overall = partiesScore * 0.3 + claimsScore * 0.4 + amountScore * 0.3;

    return {
      overall,
      parties: partiesScore,
      claims: claimsScore,
      amount: amountScore,
      details: {},
    };
  }

  /**
   * 评估当事人提取的置信度
   */
  public evaluateParties(parties: Party[], fullText: string): number {
    if (parties.length === 0) {
      return 0;
    }

    let totalScore = 0;

    for (const party of parties) {
      let score = 1.0;

      // 检查必填字段
      if (!party.name || party.name.trim().length === 0) {
        score -= 0.6; // 增加惩罚，确保低于0.5
      }
      if (!party.role) {
        score -= 0.3;
      }

      // 检查姓名合理性 - 只有当姓名存在且不为空时才检查长度
      if (
        party.name &&
        party.name.trim().length > 0 &&
        party.name.length > 50
      ) {
        score -= 0.3; // 增加惩罚
      }

      // 检查是否包含职务描述
      if (
        party.name &&
        (party.name.includes('法定代表人') ||
          party.name.includes('委托代理人') ||
          party.name.includes('诉讼代理人'))
      ) {
        score -= 0.35; // 增加惩罚，确保低于0.7
      }

      // 检查是否在原文中出现
      if (
        party.name &&
        party.name.trim().length > 0 &&
        !fullText.includes(party.name)
      ) {
        score -= 0.4;
      }

      totalScore += Math.max(0, score);
    }

    return totalScore / parties.length;
  }

  /**
   * 评估诉讼请求提取的置信度
   */
  public evaluateClaims(claims: Claim[], fullText: string): number {
    if (claims.length === 0) {
      return 0;
    }

    let totalScore = 0;

    for (const claim of claims) {
      let score = 1.0;

      // 检查必填字段
      if (!claim.type || claim.type.trim().length === 0) {
        score -= 0.4;
      }
      if (!claim.content || claim.content.trim().length === 0) {
        score -= 0.3;
      }

      // 检查金额合理性（如果有）
      if (claim.amount !== undefined && claim.amount <= 0) {
        score -= 0.3;
      }

      // 检查描述是否在原文中出现（取前10个字符）
      if (claim.content && claim.content.length >= 10) {
        const contentPrefix = claim.content.substring(0, 10);
        if (!fullText.includes(contentPrefix)) {
          score -= 0.2;
        }
      }

      totalScore += Math.max(0, score);
    }

    return totalScore / claims.length;
  }

  /**
   * 评估金额提取的置信度
   */
  public evaluateAmount(amount: number | undefined, fullText: string): number {
    // 没有金额不一定是错误
    if (amount === undefined) {
      return 0.5;
    }

    let score = 1.0;

    // 检查金额合理性
    if (amount <= 0) {
      return 0;
    }

    // 检查金额是否过大（超过1000亿）
    if (amount > 100000000000) {
      score -= 0.3;
    }

    // 检查金额是否过小（小于1元）
    if (amount > 0 && amount < 1) {
      score -= 0.2;
    }

    // 检查金额是否在原文中出现
    const amountStr = amount.toString();
    if (!fullText.includes(amountStr)) {
      // 尝试其他格式
      const amountInWan = (amount / 10000).toFixed(0);
      const amountInYi = (amount / 100000000).toFixed(0);

      // 检查是否包含"X万"或"X亿"的格式（需要精确匹配，避免误匹配）
      const wanPattern = new RegExp(`${amountInWan}[万萬]`);
      const yiPattern = new RegExp(`${amountInYi}[亿億]`);

      const wanMatch = wanPattern.test(fullText);
      const yiMatch = yiPattern.test(fullText);

      if (!wanMatch && !yiMatch) {
        score -= 0.3; // 增加惩罚，确保低于0.8
      }
    }

    return Math.max(0, score);
  }
}
