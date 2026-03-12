/**
 * 企业风险画像服务
 *
 * 负责企业风险评估、风险分析、风险趋势追踪等功能。
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 创建风险画像输入
 */
export interface CreateRiskProfileInput {
  enterpriseId: string;
  industryType: string;
}

/**
 * 风险分析结果
 */
export interface RiskAnalysisResult {
  enterpriseId: string;
  industryType: string;
  legalRiskScore: number;
  contractRiskScore: number;
  complianceRiskScore: number;
  overallRiskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: Record<string, unknown>;
  topRisks: Array<{
    type: string;
    description: string;
    severity: string;
    recommendation: string;
  }>;
  recommendations: string[];
  totalContractsAnalyzed: number;
  highRiskContracts: number;
  mediumRiskContracts: number;
  lowRiskContracts: number;
  assessedAt: Date;
}

/**
 * 风险趋势数据点
 */
export interface RiskTrendPoint {
  assessedAt: Date;
  overallRiskScore: number;
  riskLevel: string;
}

/**
 * 风险等级计算阈值
 */
interface RiskThresholds {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
}

// =============================================================================
// 私有函数
// =============================================================================

/**
 * 计算风险等级
 */
function calculateRiskLevel(
  score: number,
  thresholds: RiskThresholds
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score < thresholds.LOW) return 'LOW';
  if (score < thresholds.MEDIUM) return 'MEDIUM';
  if (score < thresholds.HIGH) return 'HIGH';
  return 'CRITICAL';
}

/**
 * 分析合同风险
 */
async function analyzeContractRisk(enterpriseId: string): Promise<{
  score: number;
  totalContracts: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
}> {
  const contracts = await prisma.contract.findMany({
    where: {
      case: {
        user: {
          enterpriseAccount: {
            id: enterpriseId,
          },
        },
      },
      status: 'EXECUTING',
    },
  });

  const totalContracts = contracts.length;

  // 统计各风险等级合同数量
  let highRisk = 0;
  let mediumRisk = 0;
  let lowRisk = 0;

  for (const contract of contracts) {
    const highRiskCount = await prisma.contractClauseRisk.count({
      where: {
        contractId: contract.id,
        riskLevel: 'HIGH',
      },
    });

    const mediumRiskCount = await prisma.contractClauseRisk.count({
      where: {
        contractId: contract.id,
        riskLevel: 'MEDIUM',
      },
    });

    if (highRiskCount > 0) {
      highRisk++;
    } else if (mediumRiskCount > 0) {
      mediumRisk++;
    } else {
      lowRisk++;
    }
  }

  // 计算合同风险分数 (0-100)
  const score =
    totalContracts > 0
      ? Math.round(
          (highRisk * 80 + mediumRisk * 50 + lowRisk * 20) / totalContracts
        )
      : 0;

  return {
    score,
    totalContracts,
    highRisk,
    mediumRisk,
    lowRisk,
  };
}

/**
 * 分析法律风险（诉讼风险）
 */
async function analyzeLegalRisk(enterpriseId: string): Promise<{
  score: number;
  caseCount: number;
}> {
  // 统计企业相关的案件数量
  const caseCount = await prisma.case.count({
    where: {
      user: {
        enterpriseAccount: {
          id: enterpriseId,
        },
      },
    },
  });

  // 根据案件数量计算法律风险分数
  // 更多案件意味着更高的风险
  let score = 0;
  if (caseCount > 10) {
    score = 80;
  } else if (caseCount > 5) {
    score = 60;
  } else if (caseCount > 2) {
    score = 40;
  } else if (caseCount > 0) {
    score = 20;
  }

  return {
    score,
    caseCount,
  };
}

/**
 * 分析合规风险
 */
async function analyzeComplianceRisk(enterpriseId: string): Promise<{
  score: number;
  nonCompliantCount: number;
}> {
  // 统计企业不合规的检查项数量
  const nonCompliantChecks = await prisma.enterpriseComplianceCheck.count({
    where: {
      enterpriseId,
      checkResult: 'NON_COMPLIANT',
    },
  });

  // 根据不合规项数量计算合规风险分数
  let score = 0;
  if (nonCompliantChecks > 10) {
    score = 80;
  } else if (nonCompliantChecks > 5) {
    score = 60;
  } else if (nonCompliantChecks > 2) {
    score = 40;
  } else if (nonCompliantChecks > 0) {
    score = 20;
  }

  return {
    score,
    nonCompliantCount: nonCompliantChecks,
  };
}

// =============================================================================
// 服务导出
// =============================================================================

/**
 * 企业风险画像服务
 */
export const enterpriseRiskProfileService = {
  /**
   * 创建企业风险画像
   */
  async createRiskProfile(input: CreateRiskProfileInput) {
    const { enterpriseId, industryType } = input;

    // 验证企业存在
    const enterprise = await prisma.enterpriseAccount.findUnique({
      where: { id: enterpriseId },
    });

    if (!enterprise) {
      throw new Error('企业不存在');
    }

    const riskProfile = await prisma.enterpriseRiskProfile.create({
      data: {
        enterpriseId,
        industryType,
        riskLevel: 'LOW',
        riskFactors: {},
        topRisks: [],
        recommendations: [],
      },
    });

    logger.info('企业风险画像创建成功', {
      enterpriseId,
      profileId: riskProfile.id,
    });

    return riskProfile;
  },

  /**
   * 分析企业风险
   */
  async analyzeRisk(enterpriseId: string): Promise<RiskAnalysisResult> {
    // 验证企业存在
    const enterprise = await prisma.enterpriseAccount.findUnique({
      where: { id: enterpriseId },
    });

    if (!enterprise) {
      throw new Error('企业不存在');
    }

    // 获取行业风险特征
    const industryFeature = await prisma.industryRiskFeature.findUnique({
      where: { industryCode: enterprise.industryType },
    });

    const thresholds: RiskThresholds =
      (industryFeature?.riskThresholds as unknown as RiskThresholds) || {
        LOW: 30,
        MEDIUM: 60,
        HIGH: 80,
      };

    // 分析各类风险
    const contractRisk = await analyzeContractRisk(enterpriseId);
    const legalRisk = await analyzeLegalRisk(enterpriseId);
    const complianceRisk = await analyzeComplianceRisk(enterpriseId);

    // 计算综合风险分数 (加权平均)
    const overallScore = Math.round(
      contractRisk.score * 0.4 +
        legalRisk.score * 0.3 +
        complianceRisk.score * 0.3
    );

    const riskLevel = calculateRiskLevel(overallScore, thresholds);

    // 生成风险因素详情
    const riskFactors = {
      contractRisk: {
        score: contractRisk.score,
        totalContracts: contractRisk.totalContracts,
        highRisk: contractRisk.highRisk,
        mediumRisk: contractRisk.mediumRisk,
        lowRisk: contractRisk.lowRisk,
      },
      legalRisk: {
        score: legalRisk.score,
        caseCount: legalRisk.caseCount,
      },
      complianceRisk: {
        score: complianceRisk.score,
        nonCompliantCount: complianceRisk.nonCompliantCount,
      },
    };

    // 生成主要风险列表
    const topRisks: Array<{
      type: string;
      description: string;
      severity: string;
      recommendation: string;
    }> = [];
    if (contractRisk.highRisk > 0) {
      topRisks.push({
        type: 'contract',
        description: `存在 ${contractRisk.highRisk} 份高风险合同`,
        severity: 'HIGH',
        recommendation: '建议优先审查高风险合同条款',
      });
    }
    if (legalRisk.caseCount > 5) {
      topRisks.push({
        type: 'litigation',
        description: `企业存在 ${legalRisk.caseCount} 个关联案件`,
        severity: legalRisk.caseCount > 10 ? 'HIGH' : 'MEDIUM',
        recommendation: '建议加强法律风险防控',
      });
    }
    if (complianceRisk.nonCompliantCount > 0) {
      topRisks.push({
        type: 'compliance',
        description: `存在 ${complianceRisk.nonCompliantCount} 项不合规项`,
        severity: complianceRisk.nonCompliantCount > 5 ? 'HIGH' : 'MEDIUM',
        recommendation: '建议制定整改计划',
      });
    }

    // 生成建议
    const recommendations: string[] = [];
    if (overallScore >= 60) {
      recommendations.push('建议立即开展风险专项评估');
    }
    if (contractRisk.highRisk > 0) {
      recommendations.push('优先处理高风险合同');
    }
    if (legalRisk.caseCount > 0) {
      recommendations.push('建立案件追踪机制');
    }
    if (complianceRisk.nonCompliantCount > 0) {
      recommendations.push('制定合规整改计划');
    }
    if (recommendations.length === 0) {
      recommendations.push('继续保持当前风险管理水平');
    }

    // 创建风险画像记录
    const riskProfile = await prisma.enterpriseRiskProfile.create({
      data: {
        enterpriseId,
        industryType: enterprise.industryType,
        legalRiskScore: legalRisk.score,
        contractRiskScore: contractRisk.score,
        complianceRiskScore: complianceRisk.score,
        overallRiskScore: overallScore,
        riskLevel,
        riskFactors,
        topRisks: topRisks as unknown as Prisma.InputJsonValue[],
        recommendations: recommendations as unknown as Prisma.InputJsonValue[],
        totalContractsAnalyzed: contractRisk.totalContracts,
        highRiskContracts: contractRisk.highRisk,
        mediumRiskContracts: contractRisk.mediumRisk,
        lowRiskContracts: contractRisk.lowRisk,
      },
    });

    logger.info('企业风险分析完成', {
      enterpriseId,
      overallScore,
      riskLevel,
    });

    return riskProfile as unknown as RiskAnalysisResult;
  },

  /**
   * 获取企业风险画像
   */
  async getRiskProfile(enterpriseId: string) {
    return prisma.enterpriseRiskProfile.findFirst({
      where: { enterpriseId },
      orderBy: { assessedAt: 'desc' },
    });
  },

  /**
   * 获取风险趋势
   */
  async getRiskTrend(
    enterpriseId: string,
    limit: number = 6
  ): Promise<RiskTrendPoint[]> {
    const profiles = await prisma.enterpriseRiskProfile.findMany({
      where: { enterpriseId },
      orderBy: { assessedAt: 'desc' },
      take: limit,
    });

    return profiles.map(profile => ({
      assessedAt: profile.assessedAt,
      overallRiskScore: profile.overallRiskScore,
      riskLevel: profile.riskLevel,
    }));
  },

  /**
   * 更新风险画像
   */
  async updateRiskProfile(id: string, data: Partial<CreateRiskProfileInput>) {
    return prisma.enterpriseRiskProfile.update({
      where: { id },
      data,
    });
  },

  /**
   * 删除风险画像
   */
  async deleteRiskProfile(id: string) {
    return prisma.enterpriseRiskProfile.delete({
      where: { id },
    });
  },

  /**
   * 批量分析企业风险
   */
  async batchAnalyzeRisk(
    enterpriseIds: string[]
  ): Promise<RiskAnalysisResult[]> {
    const results: RiskAnalysisResult[] = [];

    for (const enterpriseId of enterpriseIds) {
      try {
        const result = await this.analyzeRisk(enterpriseId);
        results.push(result);
      } catch (error) {
        logger.error('批量风险分析失败', {
          enterpriseId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  },
};
