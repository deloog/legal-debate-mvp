/**
 * AccuracyValidator - 准确率验证器
 *
 * 负责验证提取数据与原文档内容的一致性
 * 包括当事人、金额、日期、诉讼请求的验证
 */

import type { Party, Claim } from '../core/types';
import type {
  ExtractedAmount,
  ValidationIssue,
  AccuracyValidatorInterface,
} from './types';

/**
 * 准确率验证器
 */
export class AccuracyValidator implements AccuracyValidatorInterface {
  /**
   * 验证当事人信息与文档内容的一致性
   */
  async validateParties(
    content: string,
    parties: Party[]
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // 检查空当事人列表
    if (parties.length === 0) {
      issues.push({
        type: 'MISSING_REQUIRED',
        severity: 'ERROR',
        field: 'parties',
        message: '当事人列表为空',
        suggestion: '请检查文档是否包含当事人信息',
      });
      return issues;
    }

    // 检查重复当事人
    const nameSet = new Set<string>();
    for (const party of parties) {
      if (nameSet.has(party.name)) {
        issues.push({
          type: 'CLAIM_DUPLICATE',
          severity: 'WARNING',
          field: 'parties',
          message: `当事人"${party.name}"重复出现`,
          suggestion: '请去除重复的当事人',
        });
      }
      nameSet.add(party.name);
    }

    // 验证每个当事人
    for (const party of parties) {
      // 检查当事人名称是否在文档中
      if (!content.includes(party.name)) {
        issues.push({
          type: 'PARTY_INCONSISTENCY',
          severity: 'ERROR',
          field: 'parties',
          message: `当事人"${party.name}"未在文档中找到`,
          suggestion: '请核实当事人名称是否正确',
          originalValue: party.name,
        });
      }

      // 检查当事人角色是否与文档描述一致
      const roleIssue = this.validatePartyRole(content, party);
      if (roleIssue) {
        issues.push(roleIssue);
      }
    }

    return issues;
  }

  /**
   * 验证当事人角色
   */
  private validatePartyRole(
    content: string,
    party: Party
  ): ValidationIssue | null {
    // 更精确的模式匹配，避免误判
    // 只有当文档中明确使用"原告："或"被告："格式时才进行角色验证
    const plaintiffPattern = /原告[：:]\s*([^\s,，。诉]+)/;
    const defendantPattern = /被告[：:]\s*([^\s,，。]+)/;

    // 检查是否明确标记为原告
    const plaintiffMatch = content.match(plaintiffPattern);
    if (plaintiffMatch && plaintiffMatch[1] === party.name) {
      if (party.type !== 'plaintiff') {
        return {
          type: 'PARTY_INCONSISTENCY',
          severity: 'WARNING',
          field: 'parties',
          message: `当事人"${party.name}"在文档中标记为原告，但提取结果为${party.type}`,
          suggestion: '请核实当事人角色',
          originalValue: party.type,
          suggestedValue: 'plaintiff',
        };
      }
      return null;
    }

    // 检查是否明确标记为被告
    const defendantMatch = content.match(defendantPattern);
    if (defendantMatch && defendantMatch[1] === party.name) {
      if (party.type !== 'defendant') {
        return {
          type: 'PARTY_INCONSISTENCY',
          severity: 'WARNING',
          field: 'parties',
          message: `当事人"${party.name}"在文档中标记为被告，但提取结果为${party.type}`,
          suggestion: '请核实当事人角色',
          originalValue: party.type,
          suggestedValue: 'defendant',
        };
      }
      return null;
    }

    return null;
  }

  /**
   * 验证金额信息与文档内容的一致性
   */
  async validateAmounts(
    content: string,
    amounts: ExtractedAmount[]
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    for (const amount of amounts) {
      // 检查负数金额
      if (amount.value < 0) {
        issues.push({
          type: 'FORMAT_ERROR',
          severity: 'ERROR',
          field: 'amounts',
          message: `金额不能为负数: ${amount.value}`,
          suggestion: '请检查金额提取是否正确',
          originalValue: amount.value,
        });
        continue;
      }

      // 验证金额是否在文档中
      const amountFound = this.findAmountInContent(content, amount.value);
      if (!amountFound) {
        issues.push({
          type: 'AMOUNT_MISMATCH',
          severity: 'WARNING',
          field: 'amounts',
          message: `金额${amount.value}元未在文档中找到对应内容`,
          suggestion: '请核实金额是否正确',
          originalValue: amount.value,
        });
      }
    }

    return issues;
  }

  /**
   * 在文档内容中查找金额
   */
  private findAmountInContent(content: string, value: number): boolean {
    // 转换为万元
    const wanValue = value / 10000;

    // 常见金额格式
    const patterns = [
      new RegExp(`${value}[元圆]`),
      new RegExp(`${value.toLocaleString()}[元圆]`),
      new RegExp(`${wanValue}万[元圆]?`),
      new RegExp(`${Math.floor(wanValue)}万`),
    ];

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    // 检查数字是否存在
    if (content.includes(String(value)) || content.includes(String(wanValue))) {
      return true;
    }

    return false;
  }

  /**
   * 验证日期信息与文档内容的一致性
   */
  async validateDates(
    content: string,
    dates: string[]
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    for (const date of dates) {
      // 检查日期格式
      if (!this.isValidDateFormat(date)) {
        issues.push({
          type: 'FORMAT_ERROR',
          severity: 'ERROR',
          field: 'dates',
          message: `日期格式无效: ${date}`,
          suggestion: '请使用标准日期格式',
          originalValue: date,
        });
        continue;
      }

      // 检查日期是否在文档中
      if (!this.findDateInContent(content, date)) {
        issues.push({
          type: 'DATE_CONFLICT',
          severity: 'WARNING',
          field: 'dates',
          message: `日期"${date}"未在文档中找到`,
          suggestion: '请核实日期是否正确',
          originalValue: date,
        });
      }
    }

    return issues;
  }

  /**
   * 验证日期格式
   */
  private isValidDateFormat(date: string): boolean {
    const patterns = [
      /^\d{4}年\d{1,2}月\d{1,2}日$/,
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{4}\/\d{2}\/\d{2}$/,
      /^\d{4}年\d{1,2}月$/,
    ];

    return patterns.some(p => p.test(date));
  }

  /**
   * 在文档内容中查找日期
   */
  private findDateInContent(content: string, date: string): boolean {
    if (content.includes(date)) {
      return true;
    }

    const match = date.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (match) {
      const [, year, month, day] = match;
      const alternatives = [
        `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
        `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`,
        `${year}年${month}月${day}日`,
      ];

      for (const alt of alternatives) {
        if (content.includes(alt)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 验证诉讼请求与文档内容的一致性
   */
  async validateClaims(
    _content: string,
    claims: Claim[]
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // 检查空诉讼请求列表
    if (claims.length === 0) {
      issues.push({
        type: 'MISSING_REQUIRED',
        severity: 'ERROR',
        field: 'claims',
        message: '诉讼请求列表为空',
        suggestion: '请检查文档是否包含诉讼请求',
      });
      return issues;
    }

    // 检查重复诉讼请求
    const claimSet = new Set<string>();
    for (const claim of claims) {
      const key = `${claim.type}-${claim.content}`;
      if (claimSet.has(key)) {
        issues.push({
          type: 'CLAIM_DUPLICATE',
          severity: 'WARNING',
          field: 'claims',
          message: `诉讼请求重复: ${claim.content}`,
          suggestion: '请去除重复的诉讼请求',
        });
      }
      claimSet.add(key);
    }

    // 验证每个诉讼请求
    for (const claim of claims) {
      const typeIssue = this.validateClaimType(claim);
      if (typeIssue) {
        issues.push(typeIssue);
      }
    }

    return issues;
  }

  /**
   * 验证诉讼请求类型与内容是否匹配
   */
  private validateClaimType(claim: Claim): ValidationIssue | null {
    const typeContentMap: Record<string, RegExp[]> = {
      PAY_PRINCIPAL: [/本金/, /借款/, /货款/, /欠款/],
      PAY_INTEREST: [/利息/, /利率/],
      PAY_PENALTY: [/违约金/, /罚息/, /滞纳金/],
      PAY_DAMAGES: [/赔偿/, /损失/, /损害/],
      LITIGATION_COST: [/诉讼费/, /费用/],
      PERFORMANCE: [/履行/, /交付/],
      TERMINATION: [/解除/, /终止/],
    };

    const patterns = typeContentMap[claim.type];
    if (!patterns) {
      return null;
    }

    const contentMatches = patterns.some(p => p.test(claim.content));
    if (!contentMatches) {
      for (const [type, typePatterns] of Object.entries(typeContentMap)) {
        if (
          type !== claim.type &&
          typePatterns.some(p => p.test(claim.content))
        ) {
          return {
            type: 'LOGIC_ERROR',
            severity: 'WARNING',
            field: 'claims',
            message: `诉讼请求类型"${claim.type}"与内容"${claim.content}"不匹配`,
            suggestion: `建议类型改为"${type}"`,
            originalValue: claim.type,
            suggestedValue: type,
          };
        }
      }
    }

    return null;
  }

  /**
   * 计算验证分数
   */
  calculateValidationScore(issues: ValidationIssue[]): number {
    if (issues.length === 0) {
      return 1.0;
    }

    let score = 1.0;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'ERROR':
          score -= 0.2;
          break;
        case 'WARNING':
          score -= 0.08;
          break;
        case 'INFO':
          score -= 0.02;
          break;
      }
    }

    return Math.max(0, Math.min(1, score));
  }
}
