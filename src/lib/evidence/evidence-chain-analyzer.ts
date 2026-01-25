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
} from '../../types/evidence-chain';

import { EvidenceGraphBuilder } from './evidence-graph-builder';
import { EvidencePathFinder } from './evidence-path-finder';
import { EvidenceEffectivenessEvaluator } from './evidence-effectiveness-evaluator';

/**
 * 证据链分析器类
 */
export class EvidenceChainAnalyzer {
  private readonly graphBuilder: EvidenceGraphBuilder;
  private readonly pathFinder: EvidencePathFinder;
  private readonly effectivenessEvaluator: EvidenceEffectivenessEvaluator;

  constructor() {
    this.graphBuilder = new EvidenceGraphBuilder();
    this.pathFinder = new EvidencePathFinder();
    this.effectivenessEvaluator = EvidenceEffectivenessEvaluator.getInstance();
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
    const effectivenessEvaluations = this.effectivenessEvaluator.evaluateAll(
      chainGraph.nodes,
      chainGraph
    );

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
