// =============================================================================
// DocAnalyzer 诉讼请求提取器
// 从文档中提取、分类和标准化诉讼请求信息
// 目标：诉讼请求准确率≥95%
// =============================================================================

import type { Claim, ClaimType } from "../core/types";
import {
  COMPOUND_CLAIM_PATTERNS,
  getClaimTypeLabel,
  shouldInferInterest,
  shouldInferLitigationCost,
  shouldInferPenalty,
} from "./claim-extraction-rules";

// =============================================================================
// 接口定义
// =============================================================================

export interface ClaimExtractionOptions {
  includeInferred?: boolean;
  decomposeCompound?: boolean;
  addMissingTypes?: boolean;
}

export interface ClaimExtractionOutput {
  claims: Claim[];
  summary: {
    byType: Record<ClaimType, number>;
    total: number;
    withAmount: number;
    inferred: number;
  };
  compoundDecomposed: number;
}

// =============================================================================
// 诉讼请求提取器类
// =============================================================================

export class ClaimExtractor {
  constructor() {
    // 规则已移至 claim-extraction-rules.ts
  }

  /**
   * 从文本中提取诉讼请求
   */
  async extractFromText(
    text: string,
    options: ClaimExtractionOptions = {},
  ): Promise<ClaimExtractionOutput> {
    let claims = this.matchClaims(text);
    let compoundDecomposed = 0;

    // 处理复合请求
    if (options.decomposeCompound !== false) {
      const { decomposedClaims, decomposedCount } =
        this.decomposeCompoundClaims(claims);
      claims = decomposedClaims;
      compoundDecomposed = decomposedCount;
    }

    // 补充缺失的诉讼请求类型
    if (options.addMissingTypes !== false) {
      claims = this.addMissingClaimTypes(claims, text);
    }

    // 过滤推断结果
    if (options.includeInferred === false) {
      claims = claims.filter((c) => !c._inferred);
    }

    const summary = this.generateSummary(claims);

    return {
      claims,
      summary,
      compoundDecomposed: compoundDecomposed || 0,
    };
  }

  /**
   * 从诉讼请求列表中提取和标准化
   */
  async normalizeClaims(claims: Claim[]): Promise<Claim[]> {
    const normalized: Claim[] = [];

    for (const claim of claims) {
      const normalizedClaim = this.normalizeClaim(claim);
      normalized.push(normalizedClaim);
    }

    return normalized;
  }

  /**
   * 标准化单个诉讼请求
   */
  private normalizeClaim(claim: Claim): Claim {
    return {
      ...claim,
      type: this.standardizeClaimType(claim.type),
      currency: claim.currency || "CNY",
      evidence: claim.evidence || [],
      legalBasis: claim.legalBasis || "",
    };
  }

  /**
   * 标准化诉讼请求类型
   */
  private standardizeClaimType(type: string | ClaimType): ClaimType {
    const validClaimTypes: ClaimType[] = [
      "PAY_PRINCIPAL",
      "PAY_INTEREST",
      "PAY_PENALTY",
      "PAY_DAMAGES",
      "LITIGATION_COST",
      "PERFORMANCE",
      "TERMINATION",
      "OTHER",
    ];

    if (validClaimTypes.includes(type as ClaimType)) {
      return type as ClaimType;
    }

    const typeMap: Record<string, ClaimType> = {
      偿还本金: "PAY_PRINCIPAL",
      支付利息: "PAY_INTEREST",
      违约金: "PAY_PENALTY",
      赔偿损失: "PAY_DAMAGES",
      诉讼费用: "LITIGATION_COST",
      履行义务: "PERFORMANCE",
      解除合同: "TERMINATION",
      payment: "PAY_PRINCIPAL",
      principal: "PAY_PRINCIPAL",
      penalty: "PAY_PENALTY",
      costs: "LITIGATION_COST",
      compensation: "PAY_DAMAGES",
      interest: "PAY_INTEREST",
      damages: "PAY_DAMAGES",
      other: "OTHER",
    };

    return typeMap[type] || "OTHER";
  }

  /**
   * 使用规则引擎匹配诉讼请求
   */
  private matchClaims(text: string): Claim[] {
    const claims: Claim[] = [];

    // 优先级匹配：先匹配具体类型
    const patterns: Array<{ type: ClaimType; regex: RegExp }> = [
      { type: "PAY_PRINCIPAL", regex: /(\d+(\.\d+)?)[万亿]?元/gi },
      { type: "PAY_PRINCIPAL", regex: /支付货款|偿还货款/gi },
      { type: "PAY_PRINCIPAL", regex: /货款/gi },
      { type: "PAY_INTEREST", regex: /资金占用费/gi },
      { type: "PAY_INTEREST", regex: /支付利息|承担利息|利息.*年利率/gi },
      { type: "PAY_INTEREST", regex: /计算利息|利息支付|利息承担|利息偿还/gi },
      { type: "PAY_INTEREST", regex: /年利率.*利息|月利率.*利息/gi },
      { type: "PAY_PENALTY", regex: /罚息/gi },
      { type: "PAY_PENALTY", regex: /滞纳金/gi },
      { type: "PAY_PENALTY", regex: /支付违约金|承担违约金|违约金/gi },
      { type: "PAY_PENALTY", regex: /罚金|罚款|违约罚金|迟延履行金/gi },
      { type: "PAY_PENALTY", regex: /赔偿金违约|违约赔偿/gi },
      { type: "PAY_DAMAGES", regex: /赔偿损失|承担损失|经济损失/gi },
      { type: "LITIGATION_COST", regex: /诉讼费用.*承担|本案.*诉讼费/gi },
      { type: "LITIGATION_COST", regex: /案件受理费|保全费|鉴定费/gi },
      { type: "LITIGATION_COST", regex: /公告费|执行费|律师费/gi },
      { type: "LITIGATION_COST", regex: /代理费|公证费|翻译费|差旅费/gi },
      { type: "LITIGATION_COST", regex: /案件费用/gi },
      { type: "PERFORMANCE", regex: /履行义务|继续履行|履行合同/gi },
      { type: "TERMINATION", regex: /解除合同|终止合同/gi },
      { type: "OTHER", regex: /判令被告/gi },
    ];

    const matched = new Set<string>();
    for (const { type, regex } of patterns) {
      const matches = text.matchAll(regex);
      for (const match of matches) {
        const key = `${type}_${match[0]}`;
        if (!matched.has(key) && match[0]) {
          matched.add(key);
          claims.push({
            type,
            content: match[0],
            amount: this.extractAmountFromMatch(match),
            currency: "CNY",
            evidence: [],
            legalBasis: "",
          });
        }
      }
    }

    // 匹配本金类型（如果有金额）
    if (!claims.some((c) => c.type === "PAY_PRINCIPAL")) {
      const amountMatch = text.match(/(\d+(\.\d+)?)[万亿]?元/);
      if (amountMatch) {
        if (
          text.includes("偿还") ||
          text.includes("支付") ||
          text.includes("本金") ||
          text.includes("货款")
        ) {
          claims.push({
            type: "PAY_PRINCIPAL",
            content: amountMatch[0],
            amount: this.parseAmount(amountMatch[0]),
            currency: "CNY",
            evidence: [],
            legalBasis: "",
          });
        }
      }
    }

    return claims;
  }

  /**
   * 解析金额
   */
  private parseAmount(text: string): number | undefined {
    const match = text.match(/(\d+(\.\d+)?)[万亿]?元/);
    if (!match) return undefined;

    const amount = parseFloat(match[1]);
    if (text.includes("万")) return amount * 10000;
    if (text.includes("亿")) return amount * 100000000;
    return amount;
  }

  /**
   * 从匹配中提取金额
   */
  private extractAmountFromMatch(match: RegExpMatchArray): number | undefined {
    const amountMatch = match[0]?.match(/(\d+\.?\d*)\s*万?/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1]);
      return amountMatch[0].includes("万") ? amount * 10000 : amount;
    }
    return undefined;
  }

  /**
   * 去重诉讼请求（按类型去重，保留金额最大的）
   */
  private deduplicateClaims(claims: Claim[]): Claim[] {
    const byType = new Map<ClaimType, Claim>();

    for (const claim of claims) {
      const existing = byType.get(claim.type);
      if (!existing) {
        byType.set(claim.type, claim);
      } else {
        // 保留有金额的
        if (
          claim.amount !== undefined &&
          (existing.amount === undefined || claim.amount > existing.amount)
        ) {
          byType.set(claim.type, claim);
        }
      }
    }

    return Array.from(byType.values());
  }

  /**
   * 处理复合请求
   */
  private decomposeCompoundClaims(claims: Claim[]): {
    decomposedClaims: Claim[];
    decomposedCount: number;
  } {
    const decomposed: Claim[] = [];
    let decomposedCount = 0;

    for (const claim of claims) {
      const decomposedClaim = this.tryDecomposeClaim(claim);
      if (decomposedClaim.length > 0) {
        decomposed.push(...decomposedClaim);
        decomposedCount++;
      } else {
        decomposed.push(claim);
      }
    }

    return { decomposedClaims: decomposed, decomposedCount };
  }

  /**
   * 尝试拆解复合请求
   */
  private tryDecomposeClaim(claim: Claim): Claim[] {
    const decomposed: Claim[] = [];

    for (const pattern of COMPOUND_CLAIM_PATTERNS) {
      if (
        pattern.originalText &&
        claim.content.includes(pattern.originalText)
      ) {
        for (const type of pattern.types) {
          if (!decomposed.some((c) => c.type === type)) {
            decomposed.push({
              type,
              content: `${getClaimTypeLabel(type)}（从复合请求拆解）`,
              amount: undefined,
              currency: "CNY",
              evidence: [],
              legalBasis: "",
            });
          }
        }
        return decomposed;
      }

      if (pattern.types.some((t) => t === claim.type)) {
        for (const type of pattern.types) {
          if (
            pattern.types.includes(type) &&
            !decomposed.some((c) => c.type === type)
          ) {
            decomposed.push({
              type,
              content: `${getClaimTypeLabel(type)}（从复合请求推断）`,
              amount: undefined,
              currency: "CNY",
              evidence: [],
              legalBasis: "",
            });
          }
        }
      }
    }

    return decomposed;
  }

  /**
   * 补充缺失的诉讼请求类型
   */
  private addMissingClaimTypes(claims: Claim[], fullText: string): Claim[] {
    const added: Claim[] = [...claims];
    const existingTypes = new Set(claims.map((c) => c.type));

    // 使用规则库的智能推断
    if (
      !existingTypes.has("LITIGATION_COST") &&
      shouldInferLitigationCost(fullText)
    ) {
      const hasExplicitMention = /诉讼费用|本案.*诉讼费|全部诉讼费用/.test(
        fullText,
      );
      added.push({
        type: "LITIGATION_COST",
        content: hasExplicitMention ? "承担诉讼费用" : "诉讼费用由被告承担",
        amount: undefined,
        currency: "CNY",
        evidence: [],
        legalBasis: "民事诉讼法",
        _inferred: true,
      });
    }

    // 本金推断
    if (
      existingTypes.has("LITIGATION_COST") &&
      !existingTypes.has("PAY_PRINCIPAL") &&
      /本金|货款|欠款|借款/.test(fullText)
    ) {
      added.push({
        type: "PAY_PRINCIPAL",
        content: "偿还本金（从上下文推断）",
        amount: undefined,
        currency: "CNY",
        evidence: [],
        legalBasis: "",
        _inferred: true,
      });
    }

    // 利息推断
    if (!existingTypes.has("PAY_INTEREST") && shouldInferInterest(fullText)) {
      added.push({
        type: "PAY_INTEREST",
        content: "支付利息（从上下文推断）",
        amount: undefined,
        currency: "CNY",
        evidence: [],
        legalBasis: "",
        _inferred: true,
      });
    }

    // 违约金推断
    const hasPenaltyInterest = /罚息/.test(fullText);
    const hasLateFee = /滞纳金/.test(fullText);
    const hasPenalty = /违约金/.test(fullText);

    // 如果已经提取到违约金类型，不再推断
    if (existingTypes.has("PAY_PENALTY")) {
      // 检查是否需要更新内容
      const penaltyClaim = added.find((c) => c.type === "PAY_PENALTY");
      if (penaltyClaim && (hasPenaltyInterest || hasLateFee || hasPenalty)) {
        if (hasPenaltyInterest) {
          penaltyClaim.content = "支付罚息";
        } else if (hasLateFee) {
          penaltyClaim.content = "支付滞纳金";
        } else if (hasPenalty) {
          penaltyClaim.content = "支付违约金";
        }
      }
    } else if (
      shouldInferPenalty(fullText) &&
      !hasPenalty &&
      !hasPenaltyInterest &&
      !hasLateFee
    ) {
      added.push({
        type: "PAY_PENALTY",
        content: "支付违约金（从上下文推断）",
        amount: undefined,
        currency: "CNY",
        evidence: [],
        legalBasis: "",
        _inferred: true,
      });
    }

    return added;
  }

  /**
   * 生成摘要
   */
  private generateSummary(claims: Claim[]): {
    byType: Record<ClaimType, number>;
    total: number;
    withAmount: number;
    inferred: number;
  } {
    const byType: Record<ClaimType, number> = {} as Record<ClaimType, number>;
    let withAmount = 0;
    let inferred = 0;

    const allTypes: ClaimType[] = [
      "PAY_PRINCIPAL",
      "PAY_INTEREST",
      "PAY_PENALTY",
      "PAY_DAMAGES",
      "LITIGATION_COST",
      "PERFORMANCE",
      "TERMINATION",
      "OTHER",
    ];

    for (const type of allTypes) {
      byType[type] = claims.filter((c) => c.type === type).length;
    }

    for (const claim of claims) {
      if (claim.amount !== undefined && claim.amount > 0) {
        withAmount++;
      }
      if (claim._inferred) {
        inferred++;
      }
    }

    return {
      byType,
      total: claims.length,
      withAmount,
      inferred,
    };
  }
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 创建默认诉讼请求提取器实例
 */
export function createClaimExtractor(): ClaimExtractor {
  return new ClaimExtractor();
}

/**
 * 从文本中快速提取诉讼请求
 */
export async function extractClaimsFromText(
  text: string,
  options?: ClaimExtractionOptions,
): Promise<Claim[]> {
  const extractor = createClaimExtractor();
  const result = await extractor.extractFromText(text, options);
  return result.claims;
}

/**
 * 标准化诉讼请求类型
 */
export function standardizeClaimType(type: string): ClaimType {
  const typeMap: Record<string, ClaimType> = {
    偿还本金: "PAY_PRINCIPAL",
    支付利息: "PAY_INTEREST",
    违约金: "PAY_PENALTY",
    赔偿损失: "PAY_DAMAGES",
    诉讼费用: "LITIGATION_COST",
    履行义务: "PERFORMANCE",
    解除合同: "TERMINATION",
    payment: "PAY_PRINCIPAL",
    principal: "PAY_PRINCIPAL",
    penalty: "PAY_PENALTY",
    costs: "LITIGATION_COST",
    compensation: "PAY_DAMAGES",
    interest: "PAY_INTEREST",
    damages: "PAY_DAMAGES",
    other: "OTHER",
  };
  return typeMap[type] || "OTHER";
}
