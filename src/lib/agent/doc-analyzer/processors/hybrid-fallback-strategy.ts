/**
 * 混合兜底策略
 *
 * 核心功能：
 * - 混合AI结果和规则提取结果
 * - 根据置信度决定优先级
 * - 补充缺失的数据
 */

import type { ExtractedData, Party, Claim } from '../core/types';
import type { ConfidenceScores } from './confidence-evaluator';

export class HybridFallbackStrategy {
  /**
   * 混合AI结果和规则提取结果
   */
  public async merge(
    aiResult: ExtractedData,
    ruleResult: ExtractedData,
    confidence: ConfidenceScores
  ): Promise<ExtractedData> {
    const merged: ExtractedData = {
      parties: [],
      claims: [],
      caseType: aiResult.caseType,
      timeline: aiResult.timeline,
      disputeFocuses: aiResult.disputeFocuses,
      keyFacts: aiResult.keyFacts,
      summary: aiResult.summary,
    };

    // 1. 当事人合并策略
    if (confidence.parties < 0.7) {
      // AI置信度低，优先使用规则结果
      merged.parties = this.mergeParties(ruleResult.parties, aiResult.parties);
    } else {
      // AI置信度高，用规则结果补充
      merged.parties = this.mergeParties(aiResult.parties, ruleResult.parties);
    }

    // 2. 诉讼请求合并策略
    if (confidence.claims < 0.7) {
      // AI置信度低，优先使用规则结果
      merged.claims = this.mergeClaims(ruleResult.claims, aiResult.claims);
    } else {
      // AI置信度高，用规则结果补充
      merged.claims = this.mergeClaims(aiResult.claims, ruleResult.claims);
    }

    // 3. 案件类型合并策略
    if (confidence.overall < 0.7 && ruleResult.caseType) {
      merged.caseType = ruleResult.caseType;
    }

    return merged;
  }

  /**
   * 合并当事人数据
   * @param primary 主要数据源
   * @param secondary 次要数据源（用于补充）
   */
  private mergeParties(primary: Party[], secondary: Party[]): Party[] {
    const merged = [...primary];
    const existingNames = new Set(primary.map(p => p.name));

    // 补充缺失的当事人
    for (const party of secondary) {
      if (!existingNames.has(party.name)) {
        merged.push(party);
        existingNames.add(party.name);
      }
    }

    return merged;
  }

  /**
   * 合并诉讼请求数据
   * @param primary 主要数据源
   * @param secondary 次要数据源（用于补充）
   */
  private mergeClaims(primary: Claim[], secondary: Claim[]): Claim[] {
    const merged = [...primary];
    const existingDescriptions = new Set(primary.map(c => c.content));

    // 补充缺失的请求
    for (const claim of secondary) {
      if (!existingDescriptions.has(claim.content)) {
        merged.push(claim);
        existingDescriptions.add(claim.content);
      }
    }

    return merged;
  }
}
