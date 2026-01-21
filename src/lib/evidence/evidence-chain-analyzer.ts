/**
 * EvidenceChainAnalyzer - 证据链分析器
 *
 * 功能：分析证据链，生成证据链分析报告
 */

import type {
  EvidenceChainAnalysisRequest,
  EvidenceChainAnalysisResponse,
  EvidenceChainGraph,
  EvidenceChainPath,
  EvidenceEffectivenessEvaluation,
  EvidenceChainSummary,
} from '../../types/evidence-chain';

import {
  EvidenceChainRelationType,
  EvidenceRelationStrength,
  EffectivenessLevel,
} from '../../types/evidence-chain';

import { EvidenceGraphBuilder } from './evidence-graph-builder';
import { EvidencePathFinder } from './evidence-path-finder';

/**
 * 证据链分析器类
 */
export class EvidenceChainAnalyzer {
  private readonly graphBuilder: EvidenceGraphBuilder;
  private readonly pathFinder: EvidencePathFinder;

  constructor() {
    this.graphBuilder = new EvidenceGraphBuilder();
    this.pathFinder = new EvidencePathFinder();
  }

  /**
   * 分析证据链（主入口）
   */
  analyzeEvidenceChain(
    request: EvidenceChainAnalysisRequest
  ): EvidenceChainAnalysisResponse {
    const startTime = Date.now();

    const { evidences, existingRelations } = request;

    // 构建证据链图
    const normalizedEvidences = evidences.map(e => ({
      id: e.id,
      name: e.name,
      type: e.type,
      status: e.status,
      relevanceScore: e.relevanceScore ?? 50,
    }));
    const relations = this.normalizeRelations(
      existingRelations,
      normalizedEvidences
    );
    const chainGraph = this.graphBuilder.buildGraph(
      normalizedEvidences,
      relations
    );

    // 查找证据链路径
    const chains = this.pathFinder.findAllPaths(chainGraph);

    // 计算证据效力评估
    const effectivenessEvaluations =
      this.calculateEffectivenessEvaluations(chainGraph);

    // 生成分析摘要
    const summary = this.generateSummary(
      chainGraph,
      chains,
      effectivenessEvaluations
    );

    const executionTime = Date.now() - startTime;

    return {
      chainGraph,
      chains,
      effectivenessEvaluations: effectivenessEvaluations,
      summary,
      executionTime,
    };
  }

  /**
   * 规范化证据关系
   */
  private normalizeRelations(
    existingRelations:
      | Array<{
          evidenceId: string;
          relationType: string;
          relatedId: string;
          description?: string;
        }>
      | undefined,
    evidences: Array<{ id: string }>
  ): Array<{
    evidenceId: string;
    relationType: EvidenceChainRelationType;
    relatedId: string;
    description?: string;
    strength: EvidenceRelationStrength;
    confidence: number;
  }> {
    const normalized: Array<{
      evidenceId: string;
      relationType: EvidenceChainRelationType;
      relatedId: string;
      description?: string;
      strength: EvidenceRelationStrength;
      confidence: number;
    }> = [];

    if (!existingRelations) {
      return normalized;
    }

    for (const relation of existingRelations) {
      // 验证关系类型
      const validType = this.validateRelationType(relation.relationType);

      if (!validType) {
        continue;
      }

      // 验证证据ID存在
      const fromExists = evidences.some(e => e.id === relation.evidenceId);
      const toExists = evidences.some(e => e.id === relation.relatedId);

      if (!fromExists || !toExists) {
        continue;
      }

      normalized.push({
        evidenceId: relation.evidenceId,
        relationType: validType,
        relatedId: relation.relatedId,
        description: relation.description,
        strength: 3, // 默认中等强度
        confidence: 0.7, // 默认置信度
      });
    }

    return normalized;
  }

  /**
   * 验证关系类型
   */
  private validateRelationType(type: string): EvidenceChainRelationType | null {
    const validTypes: EvidenceChainRelationType[] = [
      EvidenceChainRelationType.SUPPORTS,
      EvidenceChainRelationType.REFUTES,
      EvidenceChainRelationType.SUPPLEMENTS,
      EvidenceChainRelationType.CONTRADICTS,
      EvidenceChainRelationType.INDEPENDENT,
    ];

    if (validTypes.includes(type as EvidenceChainRelationType)) {
      return type as EvidenceChainRelationType;
    }

    return null;
  }

  /**
   * 计算证据效力评估
   */
  private calculateEffectivenessEvaluations(
    chainGraph: EvidenceChainGraph
  ): Map<string, EvidenceEffectivenessEvaluation> {
    const evaluations = new Map<string, EvidenceEffectivenessEvaluation>();

    for (const node of chainGraph.nodes) {
      const evaluation = this.evaluateEvidenceEffectiveness(node, chainGraph);
      evaluations.set(node.evidenceId, evaluation);
    }

    return evaluations;
  }

  /**
   * 评估单个证据的效力
   */
  private evaluateEvidenceEffectiveness(
    node: {
      evidenceId: string;
      evidenceName: string;
      evidenceType: string;
      status: string;
      relevanceScore: number | null;
      incomingRelations: unknown[];
      outgoingRelations: unknown[];
    },
    chainGraph: EvidenceChainGraph
  ): EvidenceEffectivenessEvaluation {
    // 计算相关性评分
    const relevance = this.calculateRelevanceScore(node);

    // 计算可靠性评分
    const reliability = this.calculateReliabilityScore(node);

    // 计算完整性评分
    const completeness = this.calculateCompletenessScore(node, chainGraph);

    // 计算合法性评分（简化版）
    const legality = this.calculateLegalityScore(node);

    // 计算证据链位置评分
    const chainPosition = this.calculateChainPositionScore(node, chainGraph);

    // 计算整体效力评分
    const effectivenessScore = Math.round(
      (relevance + reliability + completeness + legality + chainPosition) / 5
    );

    // 确定效力等级
    const effectivenessLevel =
      this.determineEffectivenessLevel(effectivenessScore);

    // 生成改进建议
    const suggestions = this.generateSuggestions(
      node,
      relevance,
      reliability,
      completeness,
      legality,
      chainPosition
    );

    return {
      evidenceId: node.evidenceId,
      effectivenessScore,
      effectivenessLevel,
      scores: {
        relevance,
        reliability,
        completeness,
        legality,
        chainPosition,
      },
      suggestions,
      legalSupportScore: Math.round(chainPosition * 0.8),
      caseSupportScore: Math.round(reliability * 0.8),
    };
  }

  /**
   * 计算相关性评分
   */
  private calculateRelevanceScore(node: {
    relevanceScore: number | null;
  }): number {
    // 使用证据的相关性评分，如果没有则使用默认值
    if (node.relevanceScore !== null) {
      return Math.round(node.relevanceScore * 100);
    }
    return 50; // 默认中等相关性
  }

  /**
   * 计算可靠性评分
   */
  private calculateReliabilityScore(node: {
    status: string;
    incomingRelations: unknown[];
    outgoingRelations: unknown[];
  }): number {
    let score = 50; // 基础分

    // 根据证据在链中的位置调整
    const inDegree = node.incomingRelations.length;
    const outDegree = node.outgoingRelations.length;
    const totalConnections = inDegree + outDegree;

    if (totalConnections >= 3) {
      score += 20;
    } else if (totalConnections >= 2) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 计算完整性评分
   */
  private calculateCompletenessScore(
    node: {
      status: string;
      incomingRelations: unknown[];
      outgoingRelations: unknown[];
    },
    chainGraph: EvidenceChainGraph
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
    score += chainGraph.statistics.chainCompleteness * 0.2;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 计算合法性评分
   */
  private calculateLegalityScore(node: { status: string }): number {
    let score = 50; // 基础分

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
  private calculateChainPositionScore(
    node: { evidenceId: string },
    chainGraph: EvidenceChainGraph
  ): number {
    let score = 50; // 基础分

    // 如果是核心证据，得分高
    if (chainGraph.coreEvidences.includes(node.evidenceId)) {
      score += 40;
    }

    // 如果是孤证证据，得分低
    if (chainGraph.isolatedEvidences.includes(node.evidenceId)) {
      score -= 20;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 确定效力等级
   */
  private determineEffectivenessLevel(score: number): EffectivenessLevel {
    if (score >= 90) return EffectivenessLevel.VERY_HIGH;
    if (score >= 70) return EffectivenessLevel.HIGH;
    if (score >= 50) return EffectivenessLevel.MODERATE;
    if (score >= 30) return EffectivenessLevel.LOW;
    return EffectivenessLevel.VERY_LOW;
  }

  /**
   * 生成改进建议
   */
  private generateSuggestions(
    node: { evidenceId: string; status: string },
    relevance: number,
    reliability: number,
    completeness: number,
    legality: number,
    chainPosition: number
  ): string[] {
    const suggestions: string[] = [];

    if (relevance < 50) {
      suggestions.push('建议提高证据与案件的相关性');
    }

    if (reliability < 50) {
      suggestions.push('建议补充证据的来源和可信度信息');
    }

    if (completeness < 50) {
      suggestions.push('建议完善证据链，补充相关证据');
    }

    if (legality < 50) {
      suggestions.push('建议确保证据的合法性和有效性');
    }

    if (chainPosition < 50) {
      suggestions.push('建议加强证据与核心证据的关联');
    }

    if (node.status === 'PENDING') {
      suggestions.push('建议尽快完成证据的审核和验证');
    }

    return suggestions;
  }

  /**
   * 生成分析摘要
   */
  private generateSummary(
    chainGraph: EvidenceChainGraph,
    chains: EvidenceChainPath[],
    effectivenessEvaluations: Map<string, EvidenceEffectivenessEvaluation>
  ): EvidenceChainSummary {
    const totalEvidences = chainGraph.nodes.length;
    const detectedRelations = chainGraph.edges.length;

    const chainCount = chains.length;
    const longestChainLength = this.calculateLongestChainLength(chains);

    const averageEffectiveness = this.calculateAverageEffectiveness(
      effectivenessEvaluations
    );

    const keyFindings = this.generateKeyFindings(
      chainGraph,
      chains,
      effectivenessEvaluations
    );

    return {
      totalEvidences,
      detectedRelations,
      chainCount,
      longestChainLength,
      averageEffectiveness,
      keyFindings,
    };
  }

  /**
   * 计算最长证据链长度
   */
  private calculateLongestChainLength(chains: EvidenceChainPath[]): number {
    if (chains.length === 0) {
      return 0;
    }

    return Math.max(...chains.map(chain => chain.length));
  }

  /**
   * 计算平均效力
   */
  private calculateAverageEffectiveness(
    evaluations: Map<string, EvidenceEffectivenessEvaluation>
  ): number {
    if (evaluations.size === 0) {
      return 0;
    }

    let totalScore = 0;
    for (const evaluation of evaluations.values()) {
      totalScore += evaluation.effectivenessScore;
    }

    return Math.round(totalScore / evaluations.size);
  }

  /**
   * 生成关键发现
   */
  private generateKeyFindings(
    chainGraph: EvidenceChainGraph,
    _chains: EvidenceChainPath[],
    effectivenessEvaluations: Map<string, EvidenceEffectivenessEvaluation>
  ): string[] {
    const findings: string[] = [];

    // 证据链完整性
    const completeness = chainGraph.statistics.chainCompleteness;
    if (completeness >= 80) {
      findings.push('证据链完整性良好，证据关联紧密');
    } else if (completeness >= 50) {
      findings.push('证据链完整性一般，部分证据缺乏关联');
    } else {
      findings.push('证据链完整性较差，需要补充证据关联');
    }

    // 核心证据
    if (chainGraph.coreEvidences.length > 0) {
      findings.push(`发现${chainGraph.coreEvidences.length}个核心证据`);
    }

    // 孤证证据
    if (chainGraph.isolatedEvidences.length > 0) {
      findings.push(
        `发现${chainGraph.isolatedEvidences.length}个孤证证据，建议补充关联`
      );
    }

    // 证据效力
    let highEffectivenessCount = 0;
    for (const evaluation of effectivenessEvaluations.values()) {
      if (evaluation.effectivenessScore >= 70) {
        highEffectivenessCount++;
      }
    }

    if (highEffectivenessCount > 0) {
      findings.push(`${highEffectivenessCount}个证据具有较高的效力`);
    }

    return findings;
  }

  /**
   * 获取证据链分析器实例
   */
  static getInstance(): EvidenceChainAnalyzer {
    return new EvidenceChainAnalyzer();
  }
}
