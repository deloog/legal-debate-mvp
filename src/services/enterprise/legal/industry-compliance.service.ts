import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

// 类型定义
interface ComplianceCheckResultContract {
  id: string;
  contractNumber?: string | null;
  clientName: string;
  status: string;
}

interface ComplianceRule {
  ruleCode: string;
  ruleName: string;
  description: string;
  requiredLawArticles: string[];
  forbiddenLawArticles: string[];
  severity: string;
}

interface ComplianceCheckResult {
  contractId: string;
  contractNumber?: string;
  industryType: string;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  complianceScore: number;
  requiredViolations: Array<{
    ruleCode: string;
    ruleName: string;
    description: string;
    severity: string;
  }>;
  recommendedViolations: Array<{
    ruleCode: string;
    ruleName: string;
    description: string;
  }>;
  forbiddenViolations: Array<{
    ruleCode: string;
    ruleName: string;
    forbiddenLawArticles: string[];
    foundArticles: string[];
  }>;
}

interface ComplianceReport {
  industryType: string;
  totalContracts: number;
  averageComplianceScore: number;
  highComplianceContracts: number;
  mediumComplianceContracts: number;
  lowComplianceContracts: number;
  criticalViolations: Array<{
    ruleCode: string;
    frequency: number;
  }>;
  recommendations: Array<{
    priority: string;
    text: string;
    category: string;
  }>;
}

/**
 * 行业合规检查服务
 * 负责检查合同是否符合行业合规规则
 */
export class IndustryComplianceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 检查单个合同合规性
   */
  async checkContractCompliance(
    contractId: string,
    industryType: string
  ): Promise<ComplianceCheckResult> {
    try {
      // 获取合同信息
      const contract = await this.prisma.contract.findUnique({
        where: { id: contractId },
        select: {
          id: true,
          contractNumber: true,
          clientName: true,
          status: true,
        },
      });

      if (!contract) {
        throw new Error('合同不存在');
      }

      // 获取行业合规规则
      const rules = await this.prisma.industryComplianceRule.findMany({
        where: {
          industryType,
          isActive: true,
        },
      });

      // 获取合同关联的法条
      const contractLawArticles = await this.prisma.contractLawArticle.findMany(
        {
          where: { contractId },
          select: {
            lawArticleId: true,
          },
        }
      );

      const lawArticleIds = contractLawArticles.map(cla => cla.lawArticleId);

      // 执行合规检查
      const result = this.performComplianceCheck(
        contract,
        rules,
        lawArticleIds,
        industryType
      );

      logger.info('合同合规检查完成', {
        contractId,
        industryType,
        complianceScore: result.complianceScore,
      });

      return result;
    } catch (error) {
      logger.error('合同合规检查失败', { contractId, industryType, error });
      throw error;
    }
  }

  /**
   * 批量检查合同合规性
   */
  async batchCheckIndustryCompliance(
    contractIds: string[],
    industryType: string
  ): Promise<ComplianceCheckResult[]> {
    try {
      // 获取所有合同
      const contracts = await this.prisma.contract.findMany({
        where: { id: { in: contractIds } },
        select: {
          id: true,
          contractNumber: true,
          clientName: true,
          status: true,
        },
      });

      // 获取行业合规规则
      const rules = await this.prisma.industryComplianceRule.findMany({
        where: {
          industryType,
          isActive: true,
        },
      });

      // 获取所有合同的法条关联
      const allContractLawArticles =
        await this.prisma.contractLawArticle.findMany({
          where: { contractId: { in: contractIds } },
          select: {
            contractId: true,
            lawArticleId: true,
          },
        });

      // 按合同ID分组
      const lawArticlesByContract = new Map<string, string[]>();
      allContractLawArticles.forEach(cla => {
        if (!lawArticlesByContract.has(cla.contractId)) {
          lawArticlesByContract.set(cla.contractId, []);
        }
        lawArticlesByContract.get(cla.contractId)!.push(cla.lawArticleId);
      });

      // 批量执行检查
      const results: ComplianceCheckResult[] = [];

      for (const contract of contracts) {
        const lawArticleIds = lawArticlesByContract.get(contract.id) || [];
        const result = this.performComplianceCheck(
          contract,
          rules,
          lawArticleIds,
          industryType
        );
        results.push(result);
      }

      logger.info('批量合同合规检查完成', {
        contractCount: results.length,
        industryType,
      });

      return results;
    } catch (error) {
      logger.error('批量合同合规检查失败', {
        contractIds,
        industryType,
        error,
      });
      throw error;
    }
  }

  /**
   * 获取行业合规规则
   */
  async getIndustryComplianceRules(industryType: string) {
    try {
      const rules = await this.prisma.industryComplianceRule.findMany({
        where: {
          industryType,
          isActive: true,
        },
        orderBy: { ruleCode: 'asc' },
      });

      return rules;
    } catch (error) {
      logger.error('获取行业合规规则失败', { industryType, error });
      throw error;
    }
  }

  /**
   * 生成合规报告
   */
  async generateComplianceReport(
    industryType: string,
    checkResults: ComplianceCheckResult[]
  ): Promise<ComplianceReport> {
    try {
      const totalContracts = checkResults.length;
      const averageComplianceScore =
        checkResults.reduce((sum, r) => sum + r.complianceScore, 0) /
        totalContracts;

      // 统计合规等级分布
      let highComplianceContracts = 0;
      let mediumComplianceContracts = 0;
      let lowComplianceContracts = 0;

      checkResults.forEach(result => {
        if (result.complianceScore >= 80) {
          highComplianceContracts++;
        } else if (result.complianceScore >= 60) {
          mediumComplianceContracts++;
        } else {
          lowComplianceContracts++;
        }
      });

      // 分析严重违规
      const criticalViolations = this.analyzeCriticalViolations(checkResults);

      // 生成改进建议
      const recommendations = this.generateComplianceRecommendations(
        checkResults,
        averageComplianceScore
      );

      return {
        industryType,
        totalContracts,
        averageComplianceScore: Math.round(averageComplianceScore * 10) / 10,
        highComplianceContracts,
        mediumComplianceContracts,
        lowComplianceContracts,
        criticalViolations,
        recommendations,
      };
    } catch (error) {
      logger.error('生成合规报告失败', { industryType, error });
      throw error;
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 执行合规检查
   */
  private performComplianceCheck(
    contract: ComplianceCheckResultContract,
    rules: ComplianceRule[],
    lawArticleIds: string[],
    industryType: string
  ): ComplianceCheckResult {
    const requiredViolations: ComplianceCheckResult['requiredViolations'] = [];
    const recommendedViolations: ComplianceCheckResult['recommendedViolations'] =
      [];
    const forbiddenViolations: ComplianceCheckResult['forbiddenViolations'] =
      [];

    let passedRules = 0;

    rules.forEach(rule => {
      // 检查必需法条
      if (rule.requiredLawArticles && rule.requiredLawArticles.length > 0) {
        const missingArticles = rule.requiredLawArticles.filter(
          (id: string) => !lawArticleIds.includes(id)
        );

        if (missingArticles.length > 0) {
          requiredViolations.push({
            ruleCode: rule.ruleCode,
            ruleName: rule.ruleName,
            description: `缺少必需法条: ${missingArticles.join(', ')}`,
            severity: rule.severity,
          });
        } else {
          passedRules++;
        }
      }

      // 检查建议法条
      if (rule.severity === 'recommended') {
        const hasRequired = rule.requiredLawArticles?.some((id: string) =>
          lawArticleIds.includes(id)
        );

        if (!hasRequired) {
          recommendedViolations.push({
            ruleCode: rule.ruleCode,
            ruleName: rule.ruleName,
            description: rule.description,
          });
        } else {
          passedRules++;
        }
      }

      // 检查禁止法条
      if (rule.forbiddenLawArticles && rule.forbiddenLawArticles.length > 0) {
        const foundForbidden = rule.forbiddenLawArticles.filter((id: string) =>
          lawArticleIds.includes(id)
        );

        if (foundForbidden.length > 0) {
          forbiddenViolations.push({
            ruleCode: rule.ruleCode,
            ruleName: rule.ruleName,
            forbiddenLawArticles: rule.forbiddenLawArticles,
            foundArticles: foundForbidden,
          });
        }
      }
    });

    // 计算合规分数
    const totalRules = rules.length;
    const failedRules = requiredViolations.length + forbiddenViolations.length;
    const complianceScore =
      totalRules > 0
        ? Math.round(((totalRules - failedRules) / totalRules) * 100)
        : 100;

    return {
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      industryType,
      totalRules,
      passedRules,
      failedRules,
      complianceScore,
      requiredViolations,
      recommendedViolations,
      forbiddenViolations,
    };
  }

  /**
   * 分析严重违规
   */
  private analyzeCriticalViolations(
    checkResults: ComplianceCheckResult[]
  ): Array<{
    ruleCode: string;
    frequency: number;
  }> {
    const violationMap = new Map<string, number>();

    checkResults.forEach(result => {
      result.requiredViolations.forEach(violation => {
        if (violation.severity === 'required') {
          const key = violation.ruleCode;
          violationMap.set(key, (violationMap.get(key) || 0) + 1);
        }
      });
    });

    return Array.from(violationMap.entries())
      .map(([ruleCode, frequency]) => ({ ruleCode, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  /**
   * 生成合规改进建议
   */
  private generateComplianceRecommendations(
    checkResults: ComplianceCheckResult[],
    averageScore: number
  ): Array<{ priority: string; text: string; category: string }> {
    const recommendations: Array<{
      priority: string;
      text: string;
      category: string;
    }> = [];

    // 基于平均分数的建议
    if (averageScore < 60) {
      recommendations.push({
        priority: 'high',
        text: '整体合规性较低，建议全面审查合同模板和审核流程',
        category: 'general',
      });
    } else if (averageScore < 80) {
      recommendations.push({
        priority: 'medium',
        text: '合规性有待提升，建议重点关注高频违规项',
        category: 'general',
      });
    }

    // 基于违规类型的建议
    const violationTypes = new Set<string>();
    checkResults.forEach(result => {
      result.requiredViolations.forEach(v => violationTypes.add(v.ruleCode));
      result.forbiddenViolations.forEach(v => violationTypes.add(v.ruleCode));
    });

    if (violationTypes.size > 3) {
      recommendations.push({
        priority: 'medium',
        text: `存在${violationTypes.size}种违规类型，建议分类处理`,
        category: 'process',
      });
    }

    // 基于禁止违规的建议
    const hasForbiddenViolations = checkResults.some(
      r => r.forbiddenViolations.length > 0
    );

    if (hasForbiddenViolations) {
      recommendations.push({
        priority: 'high',
        text: '检测到禁止法条引用，需立即审查并修改',
        category: 'critical',
      });
    }

    // 基于低合规合同的建议
    const lowComplianceCount = checkResults.filter(
      r => r.complianceScore < 60
    ).length;

    if (lowComplianceCount > 0) {
      recommendations.push({
        priority: 'medium',
        text: `有${lowComplianceCount}个合同合规性较低，建议逐一检查`,
        category: 'contract',
      });
    }

    // 去重并排序
    const uniqueRecommendations = recommendations.filter(
      (item, index, self) => index === self.findIndex(t => t.text === item.text)
    );

    return uniqueRecommendations.slice(0, 10);
  }
}
