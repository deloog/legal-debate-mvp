/**
 * AI证据链构建器
 *
 * 功能：基于AI关系识别结果构建证据链，整合证据链分析
 */

import type {
  EvidenceChainAnalysisRequest,
  EvidenceChainAnalysisResponse,
  EvidenceChainGraph,
  EvidenceChainPath,
} from '../../../types/evidence-chain';

import { EvidenceChainAnalyzer } from '../../evidence/evidence-chain-analyzer';
import { EvidencePathFinder } from '../../evidence/evidence-path-finder';
import { AIEvidenceRelationshipIdentifier } from '../evidence-relationship-identifier';
import type { AIService } from '../service';

/**
 * AI证据链构建器类
 */
export class AIEvidenceChainBuilder {
  private readonly analyzer: EvidenceChainAnalyzer;
  private readonly identifier: AIEvidenceRelationshipIdentifier;
  private readonly pathFinder: EvidencePathFinder;

  constructor(aiService: AIService) {
    this.analyzer = EvidenceChainAnalyzer.getInstance();
    this.pathFinder = new EvidencePathFinder();
    this.identifier = new AIEvidenceRelationshipIdentifier(aiService);
  }

  /**
   * 构建证据链（主入口）
   */
  async buildEvidenceChain(
    request: EvidenceChainAnalysisRequest
  ): Promise<EvidenceChainAnalysisResponse> {
    const startTime = Date.now();

    const { evidences, existingRelations, options } = request;

    // 如果启用AI关系识别
    let relations = existingRelations || [];

    if (options?.useAI !== false) {
      // 使用AI识别证据之间的关系
      const aiRelations = await this.identifyAllRelationships(evidences);

      // 合并AI识别的关系和现有关系
      relations = this.mergeRelations(relations, aiRelations, options);
    }

    // 构建分析请求
    const analysisRequest = {
      caseId: request.caseId,
      evidences,
      existingRelations: relations,
      options,
    };

    // 使用证据链分析器进行分析
    const response = this.analyzer.analyzeEvidenceChain(analysisRequest);

    const executionTime = Date.now() - startTime;

    return {
      ...response,
      executionTime,
    };
  }

  /**
   * 识别所有证据之间的关系
   */
  private async identifyAllRelationships(
    evidences: Array<{
      id: string;
      name: string;
      type: string;
      content?: string;
      description?: string;
    }>
  ): Promise<
    Array<{
      evidenceId: string;
      relationType: string;
      relatedId: string;
      description?: string;
    }>
  > {
    if (evidences.length < 2) {
      return [];
    }

    // 使用批量识别功能
    const relationships = await this.identifier.identifyRelationshipsBatch(
      evidences,
      {
        skipIndependent: true,
        confidenceThreshold: 0.6,
      }
    );

    // 转换为统一格式
    return relationships.map(rel => ({
      evidenceId: rel.evidenceAId,
      relationType: rel.relationType,
      relatedId: rel.evidenceBId,
      description: rel.description,
    }));
  }

  /**
   * 合并关系
   */
  private mergeRelations(
    existingRelations: Array<{
      evidenceId: string;
      relationType: string;
      relatedId: string;
      description?: string;
    }>,
    aiRelations: Array<{
      evidenceId: string;
      relationType: string;
      relatedId: string;
      description?: string;
    }>,
    options?: {
      confidenceThreshold?: number;
      maxRelations?: number;
    }
  ): Array<{
    evidenceId: string;
    relationType: string;
    relatedId: string;
    description?: string;
  }> {
    const merged: Array<{
      evidenceId: string;
      relationType: string;
      relatedId: string;
      description?: string;
    }> = [...existingRelations];

    // 使用Map避免重复关系
    const relationKeySet = new Set<string>();

    for (const rel of existingRelations) {
      relationKeySet.add(this.getRelationKey(rel));
    }

    for (const rel of aiRelations) {
      const key = this.getRelationKey(rel);

      // 如果关系已存在，跳过
      if (relationKeySet.has(key)) {
        continue;
      }

      merged.push(rel);
      relationKeySet.add(key);
    }

    // 限制最大关系数
    if (options?.maxRelations && merged.length > options.maxRelations) {
      // 根据置信度排序，保留最强的关系
      return merged.slice(0, options.maxRelations);
    }

    return merged;
  }

  /**
   * 获取关系键
   */
  private getRelationKey(rel: {
    evidenceId: string;
    relationType: string;
    relatedId: string;
  }): string {
    return `${rel.evidenceId}-${rel.relationType}-${rel.relatedId}`;
  }

  /**
   * 分析证据链路径
   */
  analyzeChainPaths(
    graph: EvidenceChainGraph,
    options?: {
      maxLength?: number;
      minStrength?: number;
    }
  ): EvidenceChainPath[] {
    const paths = this.pathFinder.findAllPaths(graph);

    // 根据选项过滤
    const filtered = paths.filter(path => {
      if (options?.maxLength && path.length > options.maxLength) {
        return false;
      }

      if (options?.minStrength && path.totalStrength < options.minStrength) {
        return false;
      }

      return true;
    });

    return filtered;
  }

  /**
   * 查找最强证据链
   */
  findStrongestChain(graph: EvidenceChainGraph): EvidenceChainPath | null {
    return this.pathFinder.findStrongestChain(graph);
  }

  /**
   * 查找最长证据链
   */
  findLongestChain(graph: EvidenceChainGraph): EvidenceChainPath | null {
    return this.pathFinder.findLongestChain(graph);
  }

  /**
   * 生成证据链报告
   */
  generateChainReport(response: EvidenceChainAnalysisResponse): string {
    const { chainGraph, summary } = response;

    let report = '# 证据链分析报告\n\n';

    // 总体统计
    report += `## 总体统计\n`;
    report += `- 证据数量：${summary.totalEvidences}\n`;
    report += `- 关系数量：${summary.detectedRelations}\n`;
    report += `- 证据链数量：${summary.chainCount}\n`;
    report += `- 最强证据链长度：${summary.longestChainLength}\n`;
    report += `- 平均证据效力：${summary.averageEffectiveness.toFixed(2)}\n\n`;

    // 核心证据
    if (chainGraph.coreEvidences.length > 0) {
      report += `## 核心证据\n`;
      for (const coreId of chainGraph.coreEvidences) {
        const node = chainGraph.nodes.find(n => n.evidenceId === coreId);
        if (node) {
          report += `- ${node.evidenceName}（ID: ${coreId}）\n`;
        }
      }
      report += '\n';
    }

    // 孤证证据
    if (chainGraph.isolatedEvidences.length > 0) {
      report += `## 孤证证据\n`;
      report += `发现${chainGraph.isolatedEvidences.length}个孤证证据，建议补充关联\n\n`;
    }

    // 关键发现
    if (summary.keyFindings.length > 0) {
      report += `## 关键发现\n`;
      for (const finding of summary.keyFindings) {
        report += `- ${finding}\n`;
      }
      report += '\n';
    }

    // 最强证据链
    const strongestChain = this.findStrongestChain(chainGraph);
    if (strongestChain) {
      report += `## 最强证据链\n`;
      report += `证据链长度：${strongestChain.length}\n`;
      report += `总强度：${strongestChain.totalStrength}\n`;
      report += `平均置信度：${strongestChain.averageConfidence.toFixed(3)}\n`;
      report += `证据序列：${strongestChain.evidenceIds.join(' → ')}\n\n`;
    }

    // 证据链完整性
    const completeness = chainGraph.statistics.chainCompleteness;
    if (completeness >= 80) {
      report += `## 评估结论\n证据链完整性良好，证据关联紧密，证据效力较高。\n`;
    } else if (completeness >= 50) {
      report += `## 评估结论\n证据链完整性一般，部分证据缺乏关联，建议补充相关证据。\n`;
    } else {
      report += `## 评估结论\n证据链完整性较差，建议大幅补充证据关联。\n`;
    }

    return report;
  }

  /**
   * 获取证据链构建器实例
   */
  static getInstance(aiService: AIService): AIEvidenceChainBuilder {
    return new AIEvidenceChainBuilder(aiService);
  }
}
