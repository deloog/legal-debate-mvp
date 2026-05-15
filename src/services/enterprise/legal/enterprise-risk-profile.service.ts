import { logger } from '@/lib/logger';
import { ContractStatus } from '@/types/contract';
import {
  Contract,
  ContractClauseRisk,
  Prisma,
  PrismaClient,
} from '@prisma/client';

// 类型定义
interface RiskFactor {
  type: string;
  severity: string;
  description?: string;
}

interface IndustryBenchmark {
  industryType: string;
  averageRiskScore: number;
  riskLevelDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

interface EnterpriseRiskProfileData {
  enterpriseId: string;
  industryType: string;
  legalRiskScore: number;
  contractRiskScore: number;
  complianceRiskScore: number;
  overallRiskScore: number;
  riskLevel: string;
  riskFactors: Prisma.JsonValue;
  topRisks: Prisma.JsonArray;
  recommendations: Prisma.JsonArray;
  totalContractsAnalyzed: number;
  highRiskContracts: number;
  mediumRiskContracts: number;
  lowRiskContracts: number;
}

interface BenchmarkComparison {
  enterpriseRiskScore: number;
  industryAverageRiskScore: number;
  difference: number;
  position: 'ABOVE_AVERAGE' | 'BELOW_AVERAGE' | 'AT_AVERAGE';
  relativePercentage: number;
}

/**
 * 企业风险画像服务
 * 负责分析企业的法律风险状况，生成企业风险画像
 */
export class EnterpriseRiskProfileService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 生成企业风险画像
   */
  async generateEnterpriseRiskProfile(
    enterpriseId: string,
    _userId: string
  ): Promise<EnterpriseRiskProfileData> {
    try {
      // 验证企业是否存在
      const enterprise = await this.prisma.enterpriseAccount.findUnique({
        where: { id: enterpriseId },
      });

      if (!enterprise) {
        throw new Error('企业不存在');
      }

      // 获取企业的所有合同
      const contracts = await this.prisma.contract.findMany({
        where: {
          case: { is: { userId: enterprise.userId, deletedAt: null } },
          status: { notIn: ['DRAFT', 'TERMINATED'] as ContractStatus[] },
        },
      });

      const contractIds = contracts.map(c => c.id);

      // 获取合同风险数据
      const contractRisks = await this.prisma.contractClauseRisk.findMany({
        where: { contractId: { in: contractIds } },
      });

      // 计算风险评分
      const scores = this.calculateRiskScores(contractRisks, contracts);

      // 计算风险等级
      const riskLevel = this.calculateRiskLevel(scores.overallRiskScore);

      // 分析风险因子
      const riskFactors = this.analyzeRiskFactors(contractRisks);

      // 识别Top 5风险
      const topRisks = this.identifyTopRisks(contractRisks, 5);

      // 生成改进建议
      const recommendations = this.generateRecommendations(
        scores,
        riskLevel,
        riskFactors
      );

      // 统计风险分布
      const riskDistribution = this.calculateRiskDistribution(contractRisks);

      // 保存风险画像
      const profile = await this.prisma.enterpriseRiskProfile.create({
        data: {
          enterpriseId,
          industryType: enterprise.industryType,
          legalRiskScore: scores.legalRiskScore,
          contractRiskScore: scores.contractRiskScore,
          complianceRiskScore: scores.complianceRiskScore,
          overallRiskScore: scores.overallRiskScore,
          riskLevel,
          riskFactors: riskFactors as unknown as Prisma.InputJsonValue,
          topRisks: topRisks as unknown as Prisma.InputJsonValue[],
          recommendations:
            recommendations as unknown as Prisma.InputJsonValue[],
          totalContractsAnalyzed: contracts.length,
          ...riskDistribution,
        },
      });

      logger.info('企业风险画像生成完成', {
        enterpriseId,
        profileId: profile.id,
        overallRiskScore: scores.overallRiskScore,
        riskLevel,
      });

      return {
        enterpriseId,
        industryType: enterprise.industryType,
        legalRiskScore: scores.legalRiskScore,
        contractRiskScore: scores.contractRiskScore,
        complianceRiskScore: scores.complianceRiskScore,
        overallRiskScore: scores.overallRiskScore,
        riskLevel,
        riskFactors,
        topRisks,
        recommendations,
        totalContractsAnalyzed: contracts.length,
        ...riskDistribution,
      };
    } catch (error) {
      logger.error('生成企业风险画像失败', { enterpriseId, error });
      throw error;
    }
  }

  /**
   * 获取最新的企业风险画像
   */
  async getEnterpriseRiskProfile(enterpriseId: string) {
    try {
      const profile = await this.prisma.enterpriseRiskProfile.findFirst({
        where: { enterpriseId },
        orderBy: { assessedAt: 'desc' },
      });

      return profile;
    } catch (error) {
      logger.error('获取企业风险画像失败', { enterpriseId, error });
      throw error;
    }
  }

  /**
   * 获取企业风险历史记录
   */
  async getEnterpriseRiskHistory(enterpriseId: string, limit: number = 10) {
    try {
      const history = await this.prisma.enterpriseRiskProfile.findMany({
        where: { enterpriseId },
        orderBy: { assessedAt: 'desc' },
        take: limit,
      });

      return history;
    } catch (error) {
      logger.error('获取企业风险历史失败', { enterpriseId, error });
      throw error;
    }
  }

  /**
   * 与行业基准比较
   */
  async compareWithIndustryBenchmark(
    enterpriseId: string,
    benchmark: IndustryBenchmark
  ): Promise<BenchmarkComparison> {
    try {
      const profile = await this.getEnterpriseRiskProfile(enterpriseId);

      if (!profile) {
        throw new Error('企业风险画像不存在');
      }

      const difference = profile.overallRiskScore - benchmark.averageRiskScore;
      const relativePercentage = Math.round(
        (difference / benchmark.averageRiskScore) * 100
      );

      let position: BenchmarkComparison['position'] = 'AT_AVERAGE';

      if (difference > 5) {
        position = 'ABOVE_AVERAGE';
      } else if (difference < -5) {
        position = 'BELOW_AVERAGE';
      }

      return {
        enterpriseRiskScore: profile.overallRiskScore,
        industryAverageRiskScore: benchmark.averageRiskScore,
        difference,
        position,
        relativePercentage,
      };
    } catch (error) {
      logger.error('行业基准比较失败', { enterpriseId, error });
      throw error;
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 计算风险评分
   */
  private calculateRiskScores(
    contractRisks: Array<
      ContractClauseRisk & { riskFactors?: Prisma.JsonArray }
    >,
    _contracts: Contract[]
  ): {
    legalRiskScore: number;
    contractRiskScore: number;
    complianceRiskScore: number;
    overallRiskScore: number;
  } {
    if (contractRisks.length === 0) {
      return {
        legalRiskScore: 0,
        contractRiskScore: 0,
        complianceRiskScore: 0,
        overallRiskScore: 0,
      };
    }

    // 基于风险因子计算各维度分数
    const legalRiskScore = this.calculateDimensionScore(
      contractRisks,
      'legality'
    );
    const contractRiskScore = this.calculateDimensionScore(
      contractRisks,
      'fairness'
    );
    const complianceRiskScore = this.calculateDimensionScore(
      contractRisks,
      'completeness'
    );

    // 综合风险分数
    const overallRiskScore = Math.round(
      legalRiskScore * 0.4 + contractRiskScore * 0.4 + complianceRiskScore * 0.2
    );

    return {
      legalRiskScore,
      contractRiskScore,
      complianceRiskScore,
      overallRiskScore,
    };
  }

  /**
   * 计算维度风险分数
   */
  private calculateDimensionScore(
    contractRisks: Array<
      ContractClauseRisk & { riskFactors?: Prisma.JsonArray }
    >,
    factorType: string
  ): number {
    let totalScore = 0;
    let count = 0;

    contractRisks.forEach(risk => {
      const factors = (risk.riskFactors as unknown as RiskFactor[]) || [];
      const factor = factors.find(f => f.type === factorType);

      if (factor) {
        const severityScore = {
          low: 25,
          medium: 50,
          high: 75,
          critical: 100,
        };
        totalScore +=
          severityScore[factor.severity as keyof typeof severityScore] || 50;
        count++;
      }
    });

    return count > 0 ? Math.round(totalScore / count) : 0;
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(score: number): string {
    if (score >= 75) {
      return 'critical';
    } else if (score >= 60) {
      return 'high';
    } else if (score >= 40) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * 分析风险因子
   */
  private analyzeRiskFactors(
    contractRisks: Array<
      ContractClauseRisk & { riskFactors?: Prisma.JsonArray }
    >
  ): Array<{
    type: string;
    count: number;
    severity: string;
    avgScore: number;
  }> {
    const factorMap = new Map<
      string,
      {
        type: string;
        count: number;
        severities: number[];
        descriptions: string[];
      }
    >();

    contractRisks.forEach(risk => {
      const factors = (risk.riskFactors as unknown as RiskFactor[]) || [];

      factors.forEach(factor => {
        const key = factor.type;

        if (!factorMap.has(key)) {
          factorMap.set(key, {
            type: key,
            count: 0,
            severities: [] as number[],
            descriptions: [] as string[],
          });
        }

        const data = factorMap.get(key);
        if (data) {
          data.count++;

          const severityScore = {
            low: 1,
            medium: 2,
            high: 3,
            critical: 4,
          };
          data.severities.push(
            severityScore[factor.severity as keyof typeof severityScore] || 2
          );
        }
      });
    });

    const result = Array.from(factorMap.values()).map(data => {
      const avgScore =
        data.severities.reduce((sum: number, score: number) => sum + score, 0) /
        data.severities.length;

      const severity =
        avgScore >= 3.5
          ? 'critical'
          : avgScore >= 2.5
            ? 'high'
            : avgScore >= 1.5
              ? 'medium'
              : 'low';

      return {
        type: data.type,
        count: data.count,
        severity,
        avgScore: Math.round(avgScore * 10) / 10,
      };
    });

    return result.sort((a, b) => b.count - a.count);
  }

  /**
   * 识别Top风险
   */
  private identifyTopRisks(
    contractRisks: ContractClauseRisk[],
    limit: number
  ): Array<{
    contractId: string;
    clauseNumber?: string;
    riskLevel: string;
    riskDescription: string;
  }> {
    const highRiskContracts = contractRisks
      .filter(r => ['HIGH', 'CRITICAL'].includes(r.riskLevel))
      .sort((a, b) => {
        const levelOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (
          levelOrder[b.riskLevel as keyof typeof levelOrder] -
          levelOrder[a.riskLevel as keyof typeof levelOrder]
        );
      })
      .slice(0, limit);

    return highRiskContracts.map(risk => ({
      contractId: risk.contractId,
      clauseNumber: risk.clauseNumber ?? undefined,
      riskLevel: risk.riskLevel,
      riskDescription: risk.riskDescription,
    }));
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(
    scores: {
      legalRiskScore: number;
      contractRiskScore: number;
      complianceRiskScore: number;
      overallRiskScore: number;
    },
    riskLevel: string,
    riskFactors: RiskFactor[]
  ): Array<{ priority: string; text: string; category: string }> {
    const recommendations: Array<{
      priority: string;
      text: string;
      category: string;
    }> = [];

    // 基于风险等级的建议
    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push({
        priority: 'high',
        text: '立即审查高风险合同，优化高风险条款',
        category: 'contract',
      });
    }

    // 基于风险因子的建议
    riskFactors.forEach(factor => {
      if (factor.type === 'legality' && factor.severity === 'high') {
        recommendations.push({
          priority: 'high',
          text: '存在法律合规问题，建议咨询专业律师',
          category: 'legal',
        });
      } else if (factor.type === 'fairness' && factor.severity === 'high') {
        recommendations.push({
          priority: 'medium',
          text: '存在不公平条款，建议重新协商',
          category: 'contract',
        });
      } else if (
        factor.type === 'completeness' &&
        factor.severity === 'medium'
      ) {
        recommendations.push({
          priority: 'low',
          text: '部分条款不完整，建议补充完善',
          category: 'contract',
        });
      }
    });

    // 基于分数的建议
    if (scores.complianceRiskScore > 60) {
      recommendations.push({
        priority: 'high',
        text: '合规风险较高，建议建立合规管理体系',
        category: 'compliance',
      });
    }

    if (scores.contractRiskScore > 60) {
      recommendations.push({
        priority: 'medium',
        text: '合同风险较高，建议加强合同审核流程',
        category: 'contract',
      });
    }

    // 去重
    const uniqueRecommendations = recommendations.filter(
      (item, index, self) => index === self.findIndex(t => t.text === item.text)
    );

    return uniqueRecommendations.slice(0, 10);
  }

  /**
   * 计算风险分布
   */
  private calculateRiskDistribution(contractRisks: ContractClauseRisk[]): {
    highRiskContracts: number;
    mediumRiskContracts: number;
    lowRiskContracts: number;
  } {
    const distribution = {
      highRiskContracts: 0,
      mediumRiskContracts: 0,
      lowRiskContracts: 0,
    };

    contractRisks.forEach(risk => {
      if (risk.riskLevel === 'CRITICAL' || risk.riskLevel === 'HIGH') {
        distribution.highRiskContracts++;
      } else if (risk.riskLevel === 'MEDIUM') {
        distribution.mediumRiskContracts++;
      } else {
        distribution.lowRiskContracts++;
      }
    });

    return distribution;
  }
}
