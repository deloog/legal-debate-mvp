/**
 * EvidenceEffectivenessEvaluator - 证据效力评估器
 *
 * 功能：基于法条和判例评估证据效力
 */

import type {
  EvidenceEffectivenessEvaluation,
  EvidenceChainGraph,
  EvidenceChainNode,
} from '../../types/evidence-chain';

import { EffectivenessLevel } from '../../types/evidence-chain';

/**
 * 证据效力评估器类
 */
export class EvidenceEffectivenessEvaluator {
  /**
   * 评估所有证据的效力
   */
  evaluateAll(
    nodes: EvidenceChainNode[],
    graph: EvidenceChainGraph
  ): Map<string, EvidenceEffectivenessEvaluation> {
    const evaluations = new Map<string, EvidenceEffectivenessEvaluation>();

    for (const node of nodes) {
      const evaluation = this.evaluateEvidence(node, graph);
      evaluations.set(node.evidenceId, evaluation);
    }

    return evaluations;
  }

  /**
   * 评估单个证据的效力
   */
  evaluateEvidence(
    node: EvidenceChainNode,
    graph: EvidenceChainGraph
  ): EvidenceEffectivenessEvaluation {
    // 计算各项指标评分
    const relevanceScore = this.calculateRelevance(node);
    const reliabilityScore = this.calculateReliability(node);
    const completenessScore = this.calculateCompleteness(node, graph);
    const legalityScore = this.calculateLegality(node);
    const chainPositionScore = this.calculateChainPosition(node, graph);

    // 计算整体效力评分
    const effectivenessScore = Math.round(
      (relevanceScore +
        reliabilityScore +
        completenessScore +
        legalityScore +
        chainPositionScore) /
        5
    );

    // 确定效力等级
    const effectivenessLevel =
      this.determineEffectivenessLevel(effectivenessScore);

    // 生成改进建议
    const suggestions = this.generateSuggestions(
      node,
      relevanceScore,
      reliabilityScore,
      completenessScore,
      legalityScore,
      chainPositionScore
    );

    return {
      evidenceId: node.evidenceId,
      effectivenessScore,
      effectivenessLevel,
      scores: {
        relevance: relevanceScore,
        reliability: reliabilityScore,
        completeness: completenessScore,
        legality: legalityScore,
        chainPosition: chainPositionScore,
      },
      suggestions,
      legalSupportScore: this.calculateLegalSupport(node, graph),
      caseSupportScore: this.calculateCaseSupport(node),
    };
  }

  /**
   * 计算相关性评分
   */
  private calculateRelevance(node: EvidenceChainNode): number {
    let score = 50; // 基础分

    // 根据相关性评分调整
    if (node.relevanceScore !== null) {
      score = Math.round(node.relevanceScore * 100);
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 计算可靠性评分
   */
  private calculateReliability(node: EvidenceChainNode): number {
    let score = 50; // 基础分

    // 根据证据类型调整
    const type = node.evidenceType;
    if (type === 'DOCUMENTARY_EVIDENCE') {
      score += 15;
    } else if (
      type === 'PHYSICAL_EVIDENCE' ||
      type === 'AUDIO_VIDEO_EVIDENCE'
    ) {
      score += 20;
    } else if (type === 'WITNESS_TESTIMONY') {
      score += 10;
    } else if (type === 'EXPERT_OPINION') {
      score += 15;
    }

    // 根据证据状态调整
    if (node.status === 'APPROVED' || node.status === 'VALIDATED') {
      score += 20;
    } else if (node.status === 'PENDING') {
      score += 10;
    } else if (node.status === 'REJECTED') {
      score -= 30;
    }

    // 根据证据链中的位置调整
    const connections =
      node.incomingRelations.length + node.outgoingRelations.length;
    if (connections >= 3) {
      score += 15;
    } else if (connections >= 2) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 计算完整性评分
   */
  private calculateCompleteness(
    node: EvidenceChainNode,
    graph: EvidenceChainGraph
  ): number {
    let score = 50; // 基础分

    // 根据证据在证据链中的完整性调整
    const inDegree = node.incomingRelations.length;
    const outDegree = node.outgoingRelations.length;

    if (inDegree > 0 && outDegree > 0) {
      score += 30; // 有输入和输出，完整性高
    } else if (inDegree > 0 || outDegree > 0) {
      score += 15; // 有输入或输出
    }

    // 根据证据链完整性调整
    score += graph.statistics.chainCompleteness * 0.2;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 计算合法性评分
   */
  private calculateLegality(node: EvidenceChainNode): number {
    let score = 50; // 基础分

    // 根据证据类型调整
    const type = node.evidenceType;
    if (type === 'DOCUMENTARY_EVIDENCE' || type === 'ELECTRONIC_EVIDENCE') {
      score += 10; // 书证和电子证据需要更多合法性验证
    }

    // 根据证据状态调整
    if (node.status === 'APPROVED' || node.status === 'VALIDATED') {
      score += 30;
    } else if (node.status === 'PENDING') {
      score += 10;
    } else if (node.status === 'REJECTED') {
      score -= 30;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 计算证据链位置评分
   */
  private calculateChainPosition(
    node: EvidenceChainNode,
    graph: EvidenceChainGraph
  ): number {
    let score = 50; // 基础分

    // 如果是核心证据，得分高
    if (graph.coreEvidences.includes(node.evidenceId)) {
      score += 40;
    }

    // 如果是孤证证据，得分低
    if (graph.isolatedEvidences.includes(node.evidenceId)) {
      score -= 20;
    }

    // 根据证据在链中的位置调整
    const connections =
      node.incomingRelations.length + node.outgoingRelations.length;
    if (connections >= 3) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 计算法条支持度
   */
  private calculateLegalSupport(
    node: EvidenceChainNode,
    graph: EvidenceChainGraph
  ): number {
    let score = 50; // 基础分

    // 根据证据类型调整
    const type = node.evidenceType;
    if (type === 'DOCUMENTARY_EVIDENCE' || type === 'EXPERT_OPINION') {
      score += 20; // 书证和专家意见通常有较强的法条支持
    }

    // 如果是核心证据，得分高
    if (graph.coreEvidences.includes(node.evidenceId)) {
      score += 20;
    }

    // 根据证据链完整性调整
    score += graph.statistics.chainCompleteness * 0.1;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 计算判例支持度
   */
  private calculateCaseSupport(node: EvidenceChainNode): number {
    let score = 50; // 基础分

    // 根据证据类型调整
    const type = node.evidenceType;
    if (type === 'PHYSICAL_EVIDENCE' || type === 'AUDIO_VIDEO_EVIDENCE') {
      score += 20; // 物证和音视频证据在判例中支持度高
    }

    // 根据证据链位置调整
    const connections =
      node.incomingRelations.length + node.outgoingRelations.length;
    if (connections >= 3) {
      score += 20;
    } else if (connections >= 2) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 确定效力等级
   */
  private determineEffectivenessLevel(score: number): EffectivenessLevel {
    if (score >= 90) {
      return EffectivenessLevel.VERY_HIGH;
    }
    if (score >= 70) {
      return EffectivenessLevel.HIGH;
    }
    if (score >= 50) {
      return EffectivenessLevel.MODERATE;
    }
    if (score >= 30) {
      return EffectivenessLevel.LOW;
    }
    return EffectivenessLevel.VERY_LOW;
  }

  /**
   * 生成改进建议
   */
  private generateSuggestions(
    node: EvidenceChainNode,
    relevanceScore: number,
    reliabilityScore: number,
    completenessScore: number,
    legalityScore: number,
    chainPositionScore: number
  ): string[] {
    const suggestions: string[] = [];

    if (relevanceScore < 50) {
      suggestions.push('建议提高证据与案件的相关性');
    }

    if (reliabilityScore < 50) {
      suggestions.push('建议补充证据的来源和可信度信息');
      if (node.evidenceType === 'WITNESS_TESTIMONY') {
        suggestions.push('建议提供证人身份和联系方式');
      }
    }

    if (completenessScore < 50) {
      suggestions.push('建议完善证据链，补充相关证据');
    }

    if (legalityScore < 50) {
      suggestions.push('建议确保证据的合法性和有效性');
      if (
        node.evidenceType === 'ELECTRONIC_EVIDENCE' ||
        node.evidenceType === 'AUDIO_VIDEO_EVIDENCE'
      ) {
        suggestions.push('建议提供电子数据的来源和取证过程说明');
      }
    }

    if (chainPositionScore < 50) {
      suggestions.push('建议加强证据与核心证据的关联');
    }

    if (node.status === 'PENDING') {
      suggestions.push('建议尽快完成证据的审核和验证');
    }

    return suggestions;
  }

  /**
   * 获取证据效力评估器实例
   */
  static getInstance(): EvidenceEffectivenessEvaluator {
    return new EvidenceEffectivenessEvaluator();
  }
}
