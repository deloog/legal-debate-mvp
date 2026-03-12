import { Prisma, PrismaClient, RiskLevel, RelationType } from '@prisma/client';
import { logger } from '@/lib/logger';

interface ClauseRiskInput {
  text: string;
  number?: string;
  type?: string;
}

interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
}

interface ClauseRiskAnalysis {
  contractId: string;
  userId: string;
  clauseText: string;
  clauseNumber?: string;
  clauseType?: string;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  riskDescription: string;
  relatedLawArticleIds: string[];
  conflictRelations: string[];
  obsoleteRelations: string[];
}

interface ContractRiskSummary {
  contractId: string;
  totalClauses: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  overallRiskLevel: RiskLevel;
  topRisks: Array<{
    id: string;
    clauseNumber?: string;
    riskLevel: RiskLevel;
    riskDescription: string;
  }>;
}

/**
 * 合同条款风险评估服务
 * 负责分析合同条款的法律风险，基于知识图谱数据
 */
export class ContractClauseRiskService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 分析单个合同条款风险
   */
  async analyzeClauseRisk(
    contractId: string,
    userId: string,
    clauseText: string,
    clauseNumber?: string,
    clauseType?: string,
    aiProvider?: string
  ): Promise<ClauseRiskAnalysis> {
    try {
      // 验证合同是否存在
      const contract = await this.prisma.contract.findUnique({
        where: { id: contractId },
      });

      if (!contract) {
        throw new Error('合同不存在');
      }

      // 1. 检索相关法条
      const relatedLawArticles =
        await this.searchRelatedLawArticles(clauseText);

      const relatedLawArticleIds = relatedLawArticles.map(law => law.id);

      // 2. 检索法条关系
      const conflictRelations =
        await this.findConflictRelations(relatedLawArticleIds);
      const obsoleteRelations =
        await this.findObsoleteRelations(relatedLawArticleIds);

      // 3. 分析风险因子
      const riskFactors = this.analyzeRiskFactors(
        clauseText,
        clauseType,
        relatedLawArticles,
        conflictRelations,
        obsoleteRelations
      );

      // 4. 计算风险等级
      const riskLevel = this.calculateRiskLevel(riskFactors);

      // 5. 生成风险描述
      const riskDescription = this.generateRiskDescription(
        riskFactors,
        riskLevel
      );

      // 6. 保存风险记录
      const riskRecord = await this.prisma.contractClauseRisk.create({
        data: {
          contractId,
          userId,
          clauseText,
          clauseNumber,
          clauseType,
          relatedLawArticleIds,
          riskLevel,
          riskFactors: riskFactors as unknown as Prisma.InputJsonValue[],
          riskDescription,
          conflictRelations,
          obsoleteRelations,
          analyzedAt: new Date(),
          aiProvider,
        },
      });

      logger.info('合同条款风险分析完成', {
        contractId,
        riskId: riskRecord.id,
        riskLevel,
        factorsCount: riskFactors.length,
      });

      return {
        contractId,
        userId,
        clauseText,
        clauseNumber,
        clauseType,
        riskLevel,
        riskFactors,
        riskDescription,
        relatedLawArticleIds,
        conflictRelations,
        obsoleteRelations,
      };
    } catch (error) {
      logger.error('合同条款风险分析失败', { contractId, error });
      throw error;
    }
  }

  /**
   * 批量分析合同中的多个条款
   */
  async batchAnalyzeContractClauses(
    contractId: string,
    userId: string,
    clauses: ClauseRiskInput[],
    aiProvider?: string
  ): Promise<ClauseRiskAnalysis[]> {
    try {
      // 并行处理所有条款，避免串行等待
      const results = await Promise.all(
        clauses.map(clause =>
          this.analyzeClauseRisk(
            contractId,
            userId,
            clause.text,
            clause.number,
            clause.type,
            aiProvider
          )
        )
      );

      return results;
    } catch (error) {
      logger.error('批量分析合同条款失败', {
        contractId,
        clausesCount: clauses.length,
        error,
      });
      throw error;
    }
  }

  /**
   * 获取合同风险摘要
   */
  async getContractRiskSummary(
    contractId: string
  ): Promise<ContractRiskSummary> {
    try {
      const risks = await this.prisma.contractClauseRisk.findMany({
        where: { contractId },
        orderBy: { riskLevel: 'desc' },
      });

      const distribution = await this.prisma.contractClauseRisk.groupBy({
        by: ['riskLevel'],
        where: { contractId },
        _count: true,
      });

      const riskDistribution = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      };

      distribution.forEach(item => {
        const key =
          item.riskLevel.toLowerCase() as keyof typeof riskDistribution;
        if (key in riskDistribution) {
          riskDistribution[key] = item._count;
        }
      });

      const overallRiskLevel = this.calculateOverallRiskLevel(riskDistribution);

      const topRisks = risks.slice(0, 10).map(risk => ({
        id: risk.id,
        clauseNumber: risk.clauseNumber ?? undefined,
        riskLevel: risk.riskLevel,
        riskDescription: risk.riskDescription,
      }));

      return {
        contractId,
        totalClauses: risks.length,
        riskDistribution,
        overallRiskLevel,
        topRisks,
      };
    } catch (error) {
      logger.error('获取合同风险摘要失败', { contractId, error });
      throw error;
    }
  }

  /**
   * 按风险级别获取合同风险
   */
  async getContractRisksByLevel(
    contractId: string,
    riskLevel: RiskLevel
  ): Promise<ClauseRiskAnalysis[]> {
    try {
      const risks = await this.prisma.contractClauseRisk.findMany({
        where: {
          contractId,
          riskLevel,
        },
        orderBy: { riskLevel: 'desc' },
      });

      return risks.map(risk => ({
        contractId: risk.contractId,
        userId: risk.userId,
        clauseText: risk.clauseText,
        clauseNumber: risk.clauseNumber ?? undefined,
        clauseType: risk.clauseType ?? undefined,
        riskLevel: risk.riskLevel,
        riskFactors: risk.riskFactors as unknown as RiskFactor[],
        riskDescription: risk.riskDescription,
        relatedLawArticleIds: risk.relatedLawArticleIds,
        conflictRelations: risk.conflictRelations,
        obsoleteRelations: risk.obsoleteRelations,
      }));
    } catch (error) {
      logger.error('获取合同风险失败', { contractId, riskLevel, error });
      throw error;
    }
  }

  /**
   * 更新条款风险记录
   */
  async updateClauseRisk(
    id: string,
    updateData: Partial<{
      riskLevel: RiskLevel;
      riskFactors: RiskFactor[];
      riskDescription: string;
      analyzedBy: string;
    }>
  ): Promise<ClauseRiskAnalysis> {
    try {
      // 处理 Json 数组字段
      const updated = await this.prisma.contractClauseRisk.update({
        where: { id },
        data: {
          ...(updateData.riskLevel && { riskLevel: updateData.riskLevel }),
          ...(updateData.riskDescription && { riskDescription: updateData.riskDescription }),
          ...(updateData.analyzedBy && { analyzedBy: updateData.analyzedBy }),
          ...(updateData.riskFactors && {
            riskFactors: updateData.riskFactors as unknown as Prisma.InputJsonValue[],
          }),
          analyzedAt: new Date(),
        },
      });

      return {
        contractId: updated.contractId,
        userId: updated.userId,
        clauseText: updated.clauseText,
        clauseNumber: updated.clauseNumber ?? undefined,
        clauseType: updated.clauseType ?? undefined,
        riskLevel: updated.riskLevel,
        riskFactors: updated.riskFactors as unknown as RiskFactor[],
        riskDescription: updated.riskDescription,
        relatedLawArticleIds: updated.relatedLawArticleIds,
        conflictRelations: updated.conflictRelations,
        obsoleteRelations: updated.obsoleteRelations,
      };
    } catch (error) {
      logger.error('更新条款风险记录失败', { id, error });
      throw error;
    }
  }

  /**
   * 删除条款风险记录
   */
  async deleteClauseRisk(id: string): Promise<void> {
    try {
      await this.prisma.contractClauseRisk.delete({
        where: { id },
      });

      logger.info('条款风险记录已删除', { id });
    } catch (error) {
      logger.error('删除条款风险记录失败', { id, error });
      throw error;
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 检索与条款相关的法条
   */
  private async searchRelatedLawArticles(clauseText: string) {
    // 简化实现：基于关键词搜索
    const keywords = this.extractKeywords(clauseText);

    const articles = await this.prisma.lawArticle.findMany({
      where: {
        OR: keywords.map(keyword => ({
          OR: [
            { fullText: { contains: keyword } },
            { keywords: { hasSome: [keyword] } },
          ],
        })),
      },
      take: 10,
    });

    return articles;
  }

  /**
   * 从文本中提取关键词
   */
  private extractKeywords(text: string): string[] {
    const riskKeywords = [
      '违约',
      '赔偿',
      '责任',
      '解除',
      '终止',
      '变更',
      '转让',
      '不可撤销',
      '无效',
      '违法',
      '付款',
      '支付',
      '逾期',
      '违约金',
      '利息',
    ];

    const foundKeywords: string[] = [];

    for (const keyword of riskKeywords) {
      if (text.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }

    return foundKeywords.length > 0 ? foundKeywords : ['合同'];
  }

  /**
   * 查找法条冲突关系
   */
  private async findConflictRelations(
    lawArticleIds: string[]
  ): Promise<string[]> {
    const relations = await this.prisma.lawArticleRelation.findMany({
      where: {
        sourceId: { in: lawArticleIds },
        relationType: 'CONFLICTS',
        confidence: { gte: 0.7 },
      },
    });

    return relations.map(r => r.id);
  }

  /**
   * 查找已过时的法条关系
   */
  private async findObsoleteRelations(
    lawArticleIds: string[]
  ): Promise<string[]> {
    const relations = await this.prisma.lawArticleRelation.findMany({
      where: {
        sourceId: { in: lawArticleIds },
        relationType: { in: [RelationType.SUPERSEDED_BY, RelationType.SUPERSEDES] },
        confidence: { gte: 0.7 },
      },
    });

    return relations.map(r => r.id);
  }

  /**
   * 分析风险因子
   */
  private analyzeRiskFactors(
    clauseText: string,
    clauseType: string | undefined,
    _relatedLawArticles: unknown[],
    conflictRelations: string[],
    obsoleteRelations: string[]
  ): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // 1. 检查不公平条款
    if (this.containsUnfairTerms(clauseText)) {
      factors.push({
        type: 'fairness',
        severity: 'high',
        description: '存在可能不公平的条款',
        impact: '可能影响合同效力，建议审查',
      });
    }

    // 2. 检查法律合规性
    if (this.hasComplianceIssues(clauseText)) {
      factors.push({
        type: 'legality',
        severity: 'high',
        description: '可能存在法律合规风险',
        impact: '建议参考相关法律法规',
      });
    }

    // 3. 检查条款完整性
    if (this.isIncomplete(clauseText)) {
      factors.push({
        type: 'completeness',
        severity: 'medium',
        description: '条款可能不够完整',
        impact: '建议补充相关约定',
      });
    }

    // 4. 检查法条冲突
    if (conflictRelations.length > 0) {
      factors.push({
        type: 'conflict',
        severity: 'high',
        description: `存在${conflictRelations.length}个法条冲突关系`,
        impact: '建议优先解决法条冲突',
      });
    }

    // 5. 检查过时法条
    if (obsoleteRelations.length > 0) {
      factors.push({
        type: 'obsolete',
        severity: 'high',
        description: `存在${obsoleteRelations.length}个已过时的法条引用`,
        impact: '建议更新法条引用',
      });
    }

    return factors;
  }

  /**
   * 检查是否包含不公平条款
   */
  private containsUnfairTerms(clauseText: string): boolean {
    const unfairTerms = [
      '不可撤销',
      '任何情况下',
      '均不允许',
      '不得转让',
      '无权',
    ];

    return unfairTerms.some(term => clauseText.includes(term));
  }

  /**
   * 检查是否有合规问题
   */
  private hasComplianceIssues(clauseText: string): boolean {
    const issuePatterns = [
      '违约金.*超过.*30%',
      '利息.*超过.*4倍',
      '排除.*责任',
    ];

    return issuePatterns.some(pattern => new RegExp(pattern).test(clauseText));
  }

  /**
   * 检查条款是否完整
   */
  private isIncomplete(clauseText: string): boolean {
    // 简化检查：条款过短或缺少关键要素
    return clauseText.length < 20 || !/[：:，,。]/.test(clauseText);
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(factors: RiskFactor[]): RiskLevel {
    if (factors.length === 0) {
      return 'LOW';
    }

    const criticalCount = factors.filter(f => f.severity === 'critical').length;
    const highCount = factors.filter(f => f.severity === 'high').length;

    if (criticalCount > 0) {
      return 'CRITICAL';
    }
    if (highCount >= 2) {
      return 'CRITICAL';
    }
    if (highCount === 1) {
      return 'HIGH';
    }
    if (factors.length >= 3) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * 计算整体风险等级
   */
  private calculateOverallRiskLevel(distribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  }): RiskLevel {
    if (distribution.critical > 0) {
      return 'CRITICAL';
    }
    if (distribution.high > 0) {
      return 'HIGH';
    }
    if (distribution.medium >= 2) {
      return 'MEDIUM';
    }
    if (distribution.medium > 0) {
      return 'LOW';
    }

    return 'LOW';
  }

  /**
   * 生成风险描述
   */
  private generateRiskDescription(
    factors: RiskFactor[],
    riskLevel: RiskLevel
  ): string {
    if (factors.length === 0) {
      return '未发现明显风险';
    }

    const descriptions = factors.map(f => f.description);
    const riskLevelText: Record<RiskLevel, string> = {
      LOW: '低风险',
      MEDIUM: '中等风险',
      HIGH: '高风险',
      CRITICAL: '严重风险',
    };

    return `${riskLevelText[riskLevel]}：${descriptions.join('；')}`;
  }
}
