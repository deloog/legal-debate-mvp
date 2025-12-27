/**
 * 规则处理器 - 负责应用后处理规则
 * 
 * 核心功能：
 * - 强制补充缺失的诉讼请求类型
 * - 复合请求拆解
 * - 当事人角色验证
 * - 数据去重和标准化
 */

import type {
  ExtractedData,
  Party,
  Claim,
  Correction
} from '../core/types';
import {
  POST_PROCESSING_RULES,
  CLAIM_TYPE_LABELS
} from '../core/constants';
import { logger } from '../../../agent/security/logger';
import { ClaimRuleHandler } from './rules/claim-rule-handler';
import { DeduplicationHandler } from './rules/deduplication-handler';
import { AmountExtractor } from '../extractors/amount-extractor';
import { ClaimExtractor } from '../extractors/claim-extractor';
import { DisputeFocusExtractor } from '../extractors/dispute-focus-extractor';
import { TimelineExtractor } from '../extractors/timeline-extractor';
import { KeyFactExtractor } from '../extractors/key-fact-extractor';

export class RuleProcessor {
  private claimHandler: ClaimRuleHandler;
  private dedupHandler: DeduplicationHandler;
  private amountExtractor: AmountExtractor;
  private claimExtractor: ClaimExtractor;
  private disputeFocusExtractor: DisputeFocusExtractor;
  private timelineExtractor: TimelineExtractor;
  private keyFactExtractor: KeyFactExtractor;

  constructor() {
    this.claimHandler = new ClaimRuleHandler();
    this.dedupHandler = new DeduplicationHandler();
    this.amountExtractor = new AmountExtractor();
    this.claimExtractor = new ClaimExtractor();
    this.disputeFocusExtractor = new DisputeFocusExtractor();
    this.timelineExtractor = new TimelineExtractor();
    this.keyFactExtractor = new KeyFactExtractor();
  }

  /**
   * 处理数据
   */
  public async process(
    data: ExtractedData,
    fullText: string
  ): Promise<{
    data: ExtractedData;
    corrections: Correction[];
  }> {
    const corrections: Correction[] = [];
    const processedClaims = [...data.claims];
    const processedParties = [...data.parties];

    // 使用AmountExtractor提取和标准化金额
    await this.enrichClaimsWithAmounts(processedClaims, corrections);

    // 使用ClaimExtractor补充和拆解诉讼请求
    await this.enrichClaimsFromText(processedClaims, fullText, corrections);

    // 处理诉讼请求规则
    this.claimHandler.processClaims(processedClaims, fullText, corrections);

    // 验证当事人角色
    this.validatePartyRoles(processedParties, processedClaims, corrections);

    // 去重
    this.dedupHandler.deduplicateParties(processedParties, corrections);
    this.dedupHandler.deduplicateClaims(processedClaims, corrections);

    // 标准化类型
    this.normalizeClaimTypes(processedClaims, corrections);

    // 使用三个新提取器增强数据
    await this.enrichWithExtractors(data, processedClaims, fullText, corrections);

    return {
      data: {
        ...data,
        parties: processedParties,
        claims: processedClaims
      },
      corrections
    };
  }

  /**
   * 验证当事人角色
   */
  private validatePartyRoles(
    parties: Party[],
    claims: Claim[],
    corrections: Correction[]
  ): void {
    const hasDefendant = parties.some(p => p.type === 'defendant');
    if (!hasDefendant && claims.length > 0) {
      const defendantName = this.inferDefendant(claims);
      if (defendantName) {
        parties.push({
          type: 'defendant',
          name: defendantName,
          role: '推断被告',
          _inferred: true
        });
        corrections.push({
          type: 'ADD_PARTY',
          description: `从诉讼请求推断被告：${defendantName}`,
          rule: 'DEFENDANT_INFERENCE'
        });
        logger.info('从诉讼请求推断被告', { name: defendantName });
      }
    }

    // 过滤法定代表人（不应作为独立当事人）
    this.filterLegalRepresentatives(parties, corrections);
  }

  /**
   * 过滤法定代表人（移除被识别为独立当事人的法定代表人）
   */
  private filterLegalRepresentatives(
    parties: Party[],
    corrections: Correction[]
  ): void {
    const companyNames = parties.filter(p => 
      p.role?.includes('公司') || p.role?.includes('企业')
    ).map(p => p.name);

    // 移除只出现在"法定代表人："或"法定代表："后面的人名
    const filtered = parties.filter(party => {
      // 如果名称匹配公司模式，保留
      if (this.isCompanyName(party.name)) {
        return true;
      }

      // 检查是否是法定代表人（长度较短、无详细信息、只在法定代表人行出现）
      const isLikelyLegalRep = party.name.length <= 3 &&
        party.role === undefined &&
        !party.contact &&
        !party.address;

      // 如果是类似法定代表人的名称且公司已存在，过滤掉
      if (isLikelyLegalRep && companyNames.length > 0) {
        corrections.push({
          type: 'OTHER',
          description: `移除可能的法定代表人：${party.name}`,
          rule: 'LEGAL_REP_FILTER'
        });
        logger.info('过滤法定代表人', { name: party.name });
        return false;
      }

      return true;
    });

    // 更新parties数组
    parties.length = 0;
    parties.push(...filtered);
  }

  /**
   * 判断是否为公司名称
   */
  private isCompanyName(name: string): boolean {
    return /(公司|企业|集团|有限责任|股份)/.test(name);
  }

  /**
   * 使用AmountExtractor丰富诉讼请求的金额信息
   */
  private async enrichClaimsWithAmounts(
    claims: Claim[],
    corrections: Correction[]
  ): Promise<void> {
    for (const claim of claims) {
      // 如果已经有金额且是数字，跳过
      if (typeof claim.amount === 'number' && claim.amount > 0) {
        continue;
      }

      // 如果有金额字符串，尝试解析
      if (typeof claim.amount === 'string') {
        try {
          const result = await this.amountExtractor.extractFromText(claim.amount);
          if (result.amounts.length > 0) {
            const best = result.amounts[0];
            claim.amount = best.normalizedAmount;
            claim.currency = best.currency;
            corrections.push({
              type: 'FIX_AMOUNT',
              description: `标准化金额："${claim.amount}" → ${best.normalizedAmount}`,
              originalValue: claim.amount,
              correctedValue: best.normalizedAmount,
              rule: 'AMOUNT_NORMALIZATION'
            });
            logger.debug('金额标准化完成', {
              claimType: claim.type,
              original: claim.amount,
              normalized: best.normalizedAmount
            });
          }
        } catch (error) {
          logger.warn('金额标准化失败', { error, claimContent: claim.content });
        }
      }

      // 尝试从内容中提取金额
      if (claim.content && (typeof claim.amount !== 'number' || claim.amount === 0)) {
        try {
          const result = await this.amountExtractor.extractFromText(claim.content);
          if (result.amounts.length > 0) {
            const best = result.amounts[0];
            claim.amount = best.normalizedAmount;
            claim.currency = best.currency;
            corrections.push({
              type: 'FIX_AMOUNT',
              description: `从内容提取金额：${best.normalizedAmount}`,
              originalValue: claim.amount,
              correctedValue: best.normalizedAmount,
              rule: 'AMOUNT_EXTRACTION'
            });
            logger.debug('从内容提取金额完成', {
              claimType: claim.type,
              amount: best.normalizedAmount
            });
          }
        } catch (error) {
          logger.warn('从内容提取金额失败', { error, claimContent: claim.content });
        }
      }
    }
  }

  /**
   * 使用ClaimExtractor从全文中补充和拆解诉讼请求
   */
  private async enrichClaimsFromText(
    claims: Claim[],
    fullText: string,
    corrections: Correction[]
  ): Promise<void> {
    try {
      const extractionResult = await this.claimExtractor.extractFromText(fullText, {
        decomposeCompound: true,
        addMissingTypes: true
      });

      // 检查是否有新增的诉讼请求
      const existingTypes = new Set(claims.map(c => c.type));
      let addedCount = 0;

      for (const extractedClaim of extractionResult.claims) {
        // 如果是推断的且已存在该类型，跳过
        if (extractedClaim._inferred && existingTypes.has(extractedClaim.type)) {
          continue;
        }

        // 添加新的诉讼请求
        claims.push(extractedClaim);
        existingTypes.add(extractedClaim.type);
        addedCount++;

        corrections.push({
          type: 'ADD_CLAIM',
          description: `补充诉讼请求：${extractedClaim.type} - ${extractedClaim.content}`,
          correctedValue: extractedClaim,
          rule: 'CLAIM_EXTRACTION'
        });
      }

      if (addedCount > 0) {
        logger.info('补充诉讼请求完成', {
          addedCount,
          totalClaims: claims.length,
          decomposed: extractionResult.compoundDecomposed
        });
      }
    } catch (error) {
      logger.warn('从全文提取诉讼请求失败', { error });
    }
  }

  /**
   * 标准化类型
   */
  private normalizeClaimTypes(claims: Claim[], corrections: Correction[]): void {
    const typeMap: Record<string, string> = {
      '偿还本金': 'PAY_PRINCIPAL',
      '支付利息': 'PAY_INTEREST',
      '违约金': 'PAY_PENALTY',
      '赔偿损失': 'PAY_DAMAGES',
      '诉讼费用': 'LITIGATION_COST',
      '履行义务': 'PERFORMANCE',
      '解除合同': 'TERMINATION'
    };

    let fixed = 0;
    claims.forEach(claim => {
      const mappedType = typeMap[claim.type];
      if (mappedType && mappedType !== claim.type) {
        claim.type = mappedType as any;
        fixed++;
      }
    });

    if (fixed > 0) {
      corrections.push({
        type: 'FIX_AMOUNT',
        description: `标准化类型：${fixed}条`,
        rule: 'CLAIM_TYPE_NORMALIZATION'
      });
    }
  }

  /**
   * 使用三个新提取器增强数据
   */
  private async enrichWithExtractors(
    data: ExtractedData,
    claims: Claim[],
    fullText: string,
    corrections: Correction[]
  ): Promise<void> {
    // 争议焦点提取
    try {
      const disputeResult = await this.disputeFocusExtractor.extractFromText(
        fullText,
        data,
        { minConfidence: 0.5 }
      );
      if (disputeResult.disputeFocuses.length > 0) {
        data.disputeFocuses = disputeResult.disputeFocuses;
        corrections.push({
          type: 'OTHER',
          description: `提取争议焦点：${disputeResult.disputeFocuses.length}个`,
          rule: 'DISPUTE_FOCUS_EXTRACTION'
        });
        logger.info('争议焦点提取完成', {
          count: disputeResult.disputeFocuses.length,
          avgConfidence: disputeResult.summary.avgConfidence
        });
      }
    } catch (error) {
      logger.warn('争议焦点提取失败', { error });
    }

    // 时间线提取
    try {
      const timelineResult = await this.timelineExtractor.extractFromText(
        fullText,
        data
      );
      if (timelineResult.events.length > 0) {
        data.timeline = timelineResult.events;
        corrections.push({
          type: 'OTHER',
          description: `提取时间线：${timelineResult.events.length}个事件`,
          rule: 'TIMELINE_EXTRACTION'
        });
        logger.info('时间线提取完成', {
          count: timelineResult.events.length,
          explicitCount: timelineResult.summary.explicitCount,
          inferredCount: timelineResult.summary.inferredCount
        });
      }
    } catch (error) {
      logger.warn('时间线提取失败', { error });
    }

    // 关键事实提取
    try {
      const factResult = await this.keyFactExtractor.extractFromText(
        fullText,
        data,
        { minConfidence: 0.5, minImportance: 5 }
      );
      if (factResult.facts.length > 0) {
        data.keyFacts = factResult.facts;
        corrections.push({
          type: 'OTHER',
          description: `提取关键事实：${factResult.facts.length}个`,
          rule: 'KEY_FACT_EXTRACTION'
        });
        logger.info('关键事实提取完成', {
          count: factResult.facts.length,
          avgImportance: factResult.summary.avgImportance,
          avgConfidence: factResult.summary.avgConfidence
        });
      }
    } catch (error) {
      logger.warn('关键事实提取失败', { error });
    }
  }

  /**
   * 推断被告
   */
  private inferDefendant(claims: Claim[]): string | null {
    for (const claim of claims) {
      const match = claim.content?.match(/判令(.+?)偿还|判令(.+?)支付/);
      if (match) {
        const name = match[1] || match[2];
        if (name && name.length < 20 && !name.includes('等')) {
          return name.trim();
        }
      }
    }
    return null;
  }
}
