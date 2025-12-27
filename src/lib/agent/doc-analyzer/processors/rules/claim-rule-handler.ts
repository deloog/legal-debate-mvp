/**
 * 诉讼请求规则处理器
 * 
 * 负责处理诉讼请求相关的规则：
 * - 强制补充诉讼费用
 * - 强制补充本金请求
 * - 强制补充利息请求
 * - 强制补充违约金请求
 * - 拆解复合请求
 */

import type { Claim, Correction } from '../../core/types';
import { POST_PROCESSING_RULES, CLAIM_TYPE_LABELS } from '../../core/constants';
import { logger } from '../../../../agent/security/logger';

export class ClaimRuleHandler {
  /**
   * 处理诉讼请求规则
   */
  public processClaims(claims: Claim[], fullText: string, corrections: Correction[]): void {
    this.addLitigationCost(claims, fullText, corrections);
    this.addPrincipalClaim(claims, fullText, corrections);
    this.addInterestClaim(claims, fullText, corrections);
    this.addPenaltyClaim(claims, fullText, corrections);
    this.decomposeCompoundClaims(claims, fullText, corrections);
  }

  /**
   * 添加诉讼费用
   */
  private addLitigationCost(
    claims: Claim[],
    text: string,
    corrections: Correction[]
  ): void {
    const hasLitigationCost = claims.some(c => c.type === 'LITIGATION_COST');
    if (!hasLitigationCost && this.matchesPatterns(text, POST_PROCESSING_RULES.LITIGATION_COST_PATTERNS)) {
      claims.push({
        type: 'LITIGATION_COST',
        content: '诉讼费用由被告承担',
        amount: null,
        currency: 'CNY',
        evidence: [],
        legalBasis: '民事诉讼法',
        _inferred: true
      });
      corrections.push({
        type: 'ADD_CLAIM',
        description: 'AI遗漏诉讼费用，强制补充',
        rule: 'LITIGATION_COST_PATTERN'
      });
      logger.warn('强制补充诉讼费用');
    }
  }

  /**
   * 添加本金请求
   */
  private addPrincipalClaim(
    claims: Claim[],
    text: string,
    corrections: Correction[]
  ): void {
    if (!claims.some(c => c.type === 'PAY_PRINCIPAL') &&
        this.matchesPatterns(text, POST_PROCESSING_RULES.PRINCIPAL_PATTERNS)) {
      claims.push({
        type: 'PAY_PRINCIPAL',
        content: '偿还本金（从文本推断）',
        amount: null,
        currency: 'CNY',
        evidence: [],
        legalBasis: '',
        _inferred: true
      });
      corrections.push({
        type: 'ADD_CLAIM',
        description: 'AI遗漏本金请求，强制补充',
        rule: 'PRINCIPAL_PATTERN'
      });
      logger.warn('强制补充本金请求');
    }
  }

  /**
   * 添加利息请求
   */
  private addInterestClaim(
    claims: Claim[],
    text: string,
    corrections: Correction[]
  ): void {
    if (!claims.some(c => c.type === 'PAY_INTEREST') &&
        this.matchesPatterns(text, POST_PROCESSING_RULES.INTEREST_PATTERNS)) {
      claims.push({
        type: 'PAY_INTEREST',
        content: '支付利息（从文本推断）',
        amount: null,
        currency: 'CNY',
        evidence: [],
        legalBasis: '',
        _inferred: true
      });
      corrections.push({
        type: 'ADD_CLAIM',
        description: 'AI遗漏利息请求，强制补充',
        rule: 'INTEREST_PATTERN'
      });
      logger.warn('强制补充利息请求');
    }
  }

  /**
   * 添加违约金请求
   */
  private addPenaltyClaim(
    claims: Claim[],
    text: string,
    corrections: Correction[]
  ): void {
    if (!claims.some(c => c.type === 'PAY_PENALTY') &&
        this.matchesPatterns(text, POST_PROCESSING_RULES.PENALTY_PATTERNS)) {
      claims.push({
        type: 'PAY_PENALTY',
        content: '支付违约金（从文本推断）',
        amount: null,
        currency: 'CNY',
        evidence: [],
        legalBasis: '',
        _inferred: true
      });
      corrections.push({
        type: 'ADD_CLAIM',
        description: 'AI遗漏违约金请求，强制补充',
        rule: 'PENALTY_PATTERN'
      });
      logger.warn('强制补充违约金请求');
    }
  }

  /**
   * 拆解复合请求
   */
  private decomposeCompoundClaims(
    claims: Claim[],
    text: string,
    corrections: Correction[]
  ): void {
    for (const pattern of POST_PROCESSING_RULES.COMPOUND_PATTERNS) {
      if (pattern.regex.test(text)) {
        logger.info('识别到复合请求模式，强制拆解', { pattern: pattern.regex.source });
        
        const compoundClaim = claims.find(c => 
          c.content.length > 20 && pattern.regex.test(c.content)
        );

        if (compoundClaim) {
          const index = claims.indexOf(compoundClaim);
          if (index > -1) {
            claims.splice(index, 1);
            corrections.push({
              type: 'FIX_AMOUNT',
              description: '拆解复合请求',
              rule: 'COMPOUND_DECOMPOSITION',
              originalValue: compoundClaim
            });
          }

          pattern.types.forEach(type => {
            if (!claims.some(c => c.type === type)) {
              claims.push({
                type: type as any,
                content: `${CLAIM_TYPE_LABELS[type] || type}（从复合请求拆解）`,
                amount: null,
                currency: 'CNY',
                evidence: [],
                legalBasis: '',
                _inferred: true
              });
            }
          });
        }
      }
    }
  }

  /**
   * 匹配模式
   */
  private matchesPatterns(text: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(text));
  }
}
