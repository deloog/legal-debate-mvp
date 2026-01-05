/**
 * PartyExtractor - 当事人提取器（算法兜底层）
 *
 * 功能：
 * - 使用正则表达式和规则算法提取当事人信息
 * - 作为AI识别失败或遗漏时的兜底方案
 * - 补充和修正AI识别的当事人数据
 */

import type { Party } from "../core/types";
import { logger } from "../../../agent/security/logger";

export interface PartyExtractionResult {
  parties: Party[];
  confidence: number;
  method: "regex" | "rule" | "hybrid";
}

/**
 * 当事人模式定义
 */
interface PartyPattern {
  regex: RegExp;
  type: "plaintiff" | "defendant" | "other";
  role?: string;
}

export class PartyExtractor {
  // 原告模式
  private readonly plaintiffPatterns: PartyPattern[] = [
    {
      regex: /(?:原告|申请人|上诉人)[：:]\s*([^\n]+)/,
      type: "plaintiff",
      role: "原告",
    },
    {
      regex: /(?:原告|申请人)[：:]\s*([^\n]+)，(?:性别|男|女)/,
      type: "plaintiff",
      role: "原告",
    },
  ];

  // 被告模式
  private readonly defendantPatterns: PartyPattern[] = [
    {
      regex: /(?:被告|被申请人|被上诉人)[：:]\s*([^\n]+)/,
      type: "defendant",
      role: "被告",
    },
    {
      regex: /(?:被告|被申请人)[：:]\s*([^\n]+)，(?:性别|男|女)/,
      type: "defendant",
      role: "被告",
    },
  ];

  // 第三人模式
  private readonly thirdPartyPatterns: PartyPattern[] = [
    {
      regex: /第三人[：:]\s*([^\n]+)/,
      type: "other",
      role: "第三人",
    },
  ];

  // 法定代表人模式（用于过滤）
  private readonly legalRepPattern: RegExp =
    /(?:法定代表人|法人代表)[：:]\s*([^\n]+)/;

  // 诉讼代理人模式（用于过滤）
  private readonly agentPattern: RegExp =
    /(?:委托代理人|诉讼代理人|代理律师|律师)[：:]\s*([^\n]+)/;

  /**
   * 从文本中提取当事人信息
   */
  public async extractFromText(
    text: string,
    existingParties: Party[] = [],
  ): Promise<PartyExtractionResult> {
    const extractedParties: Party[] = [...existingParties];
    const existingNames = new Set(existingParties.map((p) => p.name));

    // 提取原告
    const plaintiffs = this.extractByPatterns(text, this.plaintiffPatterns);
    for (const plaintiff of plaintiffs) {
      if (!existingNames.has(plaintiff.name)) {
        extractedParties.push(plaintiff);
        existingNames.add(plaintiff.name);
        logger.debug("算法兜底提取原告", { name: plaintiff.name });
      }
    }

    // 提取被告
    const defendants = this.extractByPatterns(text, this.defendantPatterns);
    for (const defendant of defendants) {
      if (!existingNames.has(defendant.name)) {
        extractedParties.push(defendant);
        existingNames.add(defendant.name);
        logger.debug("算法兜底提取被告", { name: defendant.name });
      }
    }

    // 提取第三人
    const thirdParties = this.extractByPatterns(text, this.thirdPartyPatterns);
    for (const thirdParty of thirdParties) {
      if (!existingNames.has(thirdParty.name)) {
        extractedParties.push(thirdParty);
        existingNames.add(thirdParty.name);
        logger.debug("算法兜底提取第三人", { name: thirdParty.name });
      }
    }

    // 从诉讼请求中推断被告
    const inferredDefendant = this.inferDefendantFromClaims(text);
    if (inferredDefendant && !existingNames.has(inferredDefendant.name)) {
      extractedParties.push(inferredDefendant);
      logger.info("从诉讼请求推断被告", {
        name: inferredDefendant.name,
      });
    }

    // 过滤法定代表人和诉讼代理人
    const filteredParties = this.filterNonParties(extractedParties);

    // 计算置信度
    const confidence = this.calculateConfidence(
      extractedParties.length,
      filteredParties.length,
    );

    return {
      parties: filteredParties,
      confidence,
      method: "regex",
    };
  }

  /**
   * 根据模式提取当事人
   */
  private extractByPatterns(text: string, patterns: PartyPattern[]): Party[] {
    const parties: Party[] = [];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const name = this.cleanName(match[1]);
        if (name && name.length > 0) {
          parties.push({
            type: pattern.type,
            name,
            role: pattern.role,
            _inferred: true,
          });
        }
      }
    }

    return parties;
  }

  /**
   * 清理当事人名称
   */
  private cleanName(name: string): string {
    return name
      .trim()
      .replace(/[，,].*$/, "") // 移除逗号后的内容
      .replace(/[（\(].*?[）\)]$/, "") // 移除括号内容
      .replace(/等/g, "") // 移除"等"
      .trim();
  }

  /**
   * 从诉讼请求中推断被告
   */
  private inferDefendantFromClaims(text: string): Party | null {
    // 匹配"判令XX偿还/支付/承担"等模式
    const patterns = [
      /判令\s*([^\s，]{2,10})\s*(?:偿还|支付|承担|履行)/,
      /判令\s*([^\s，]{2,10})\s*[承担|履行]/,
      /请求判令\s*([^\s，]{2,10})\s*(?:偿还|支付)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const name = this.cleanName(match[1]);
        // 验证名称有效性
        if (name && !this.isCommonWords(name)) {
          return {
            type: "defendant",
            name,
            role: "推断被告",
            _inferred: true,
          };
        }
      }
    }

    return null;
  }

  /**
   * 判断是否为常见词汇（非当事人名称）
   */
  private isCommonWords(text: string): boolean {
    const commonWords = [
      "对方",
      "被告方",
      "原告方",
      "当事人",
      "第三人",
      "诉讼请求",
      "诉讼费",
      "律师费",
      "利息",
      "本金",
    ];
    return commonWords.includes(text);
  }

  /**
   * 过滤非当事人（法定代表人、诉讼代理人等）
   */
  private filterNonParties(parties: Party[]): Party[] {
    const filtered: Party[] = [];

    for (const party of parties) {
      // 检查是否为公司名称（公司名称通常是有效的当事人）
      if (this.isCompanyName(party.name)) {
        filtered.push(party);
        continue;
      }

      // 检查名称长度（过短可能是误识别）
      if (party.name.length < 2) {
        logger.debug("过滤过短名称", { name: party.name });
        continue;
      }

      // 检查是否包含律师关键字
      if (this.isLawyer(party.name)) {
        logger.debug("过滤诉讼代理人", { name: party.name });
        continue;
      }

      filtered.push(party);
    }

    return filtered;
  }

  /**
   * 判断是否为公司名称
   */
  private isCompanyName(name: string): boolean {
    const companyKeywords = [
      "公司",
      "企业",
      "集团",
      "有限",
      "股份",
      "责任",
      "合伙",
      "个体",
    ];
    return companyKeywords.some((keyword) => name.includes(keyword));
  }

  /**
   * 判断是否为律师
   */
  private isLawyer(name: string): boolean {
    const lawyerKeywords = ["律师", "律师所", "律所"];
    return lawyerKeywords.some((keyword) => name.includes(keyword));
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    originalCount: number,
    filteredCount: number,
  ): number {
    if (originalCount === 0) {
      return 0.0;
    }
    return filteredCount / originalCount;
  }

  /**
   * 合并当事人信息（AI提取 + 算法兜底）
   */
  public mergeParties(aiParties: Party[], algorithmParties: Party[]): Party[] {
    const merged: Party[] = [];
    const mergedNames = new Set<string>();

    // 优先保留AI识别的结果
    for (const aiParty of aiParties) {
      if (!mergedNames.has(aiParty.name)) {
        merged.push(aiParty);
        mergedNames.add(aiParty.name);
      }
    }

    // 补充算法识别的结果
    for (const algParty of algorithmParties) {
      if (!mergedNames.has(algParty.name)) {
        // 检查是否与现有当事人相似（可能是同一人的不同表述）
        const similar = merged.find((p) =>
          this.isSimilarName(p.name, algParty.name),
        );
        if (similar) {
          // 如果相似，保留置信度更高的
          if (!similar._inferred && algParty._inferred) {
            // AI识别的优先
            continue;
          }
        } else {
          merged.push(algParty);
          mergedNames.add(algParty.name);
        }
      }
    }

    return merged;
  }

  /**
   * 判断两个名称是否相似
   */
  private isSimilarName(name1: string, name2: string): boolean {
    // 移除空格和标点
    const n1 = name1.replace(/\s+/g, "");
    const n2 = name2.replace(/\s+/g, "");

    if (n1 === n2) {
      return true;
    }

    // 检查一个是否是另一个的子串
    if (n1.includes(n2) || n2.includes(n1)) {
      return true;
    }

    return false;
  }
}
