/**
 * 管理层报表服务
 *
 * 负责生成各类管理层报表（风险概览、合规状态、法务效率等）
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import type { ExecutiveReportType } from '@prisma/client';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 报表创建参数
 */
export interface CreateReportParams {
  periodStart: Date;
  periodEnd: Date;
  generatedBy?: string;
  recipients?: string[];
}

// =============================================================================
// 服务导出
// =============================================================================

/**
 * 管理层报表服务
 */
export const executiveReportService = {
  /**
   * 创建风险概览报表
   */
  async createRiskOverviewReport(enterpriseId: string, params: CreateReportParams) {
    // 验证企业存在
    const enterprise = await prisma.enterpriseAccount.findUnique({
      where: { id: enterpriseId },
    });

    if (!enterprise) {
      throw new Error('企业不存在');
    }

    // 获取最新的风险画像
    const riskProfile = await prisma.enterpriseRiskProfile.findFirst({
      where: { enterpriseId },
      orderBy: { assessedAt: 'desc' },
    });

    // 生成洞察建议
    const insights = [];
    if (riskProfile) {
      if (riskProfile.overallRiskScore >= 60) {
        insights.push('企业整体风险水平较高，建议优先处理高风险领域');
      } else if (riskProfile.overallRiskScore >= 40) {
        insights.push('企业风险水平中等，建议持续关注并加强风险防控');
      } else {
        insights.push('企业风险水平较低，建议保持现有风险管理策略');
      }

      if (riskProfile.highRiskContracts > 0) {
        insights.push(`存在 ${riskProfile.highRiskContracts} 份高风险合同需要关注`);
      }
    }

    const report = await prisma.executiveReport.create({
      data: {
        enterpriseId,
        reportType: 'RISK_OVERVIEW',
        title: `${enterprise.enterpriseName} - 风险概览报告`,
        summary: riskProfile
          ? `企业当前风险水平为${riskProfile.riskLevel}，综合风险评分${riskProfile.overallRiskScore}分`
          : '暂无风险评估数据',
        metrics: {
          overallScore: riskProfile?.overallRiskScore || 0,
          legalRiskScore: riskProfile?.legalRiskScore || 0,
          contractRiskScore: riskProfile?.contractRiskScore || 0,
          complianceRiskScore: riskProfile?.complianceRiskScore || 0,
          highRiskContracts: riskProfile?.highRiskContracts || 0,
          mediumRiskContracts: riskProfile?.mediumRiskContracts || 0,
          totalContractsAnalyzed: riskProfile?.totalContractsAnalyzed || 0,
        },
        charts: [],
        insights,
        generatedBy: params.generatedBy || 'ai',
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        recipients: params.recipients || [],
      },
    });

    logger.info('风险概览报表创建成功', {
      reportId: report.id,
      enterpriseId,
    });

    return report;
  },

  /**
   * 创建合规状态报表
   */
  async createComplianceStatusReport(enterpriseId: string, params: CreateReportParams) {
    // 验证企业存在
    const enterprise = await prisma.enterpriseAccount.findUnique({
      where: { id: enterpriseId },
    });

    if (!enterprise) {
      throw new Error('企业不存在');
    }

    // 获取合规检查统计
    const totalChecks = await prisma.enterpriseComplianceCheck.count({
      where: { enterpriseId },
    });

    const compliantCount = await prisma.enterpriseComplianceCheck.count({
      where: { enterpriseId, checkResult: 'COMPLIANT' },
    });

    const report = await prisma.executiveReport.create({
      data: {
        enterpriseId,
        reportType: 'COMPLIANCE_STATUS',
        title: `${enterprise.enterpriseName} - 合规状态报告`,
        summary: `本期完成 ${totalChecks} 项合规检查，其中 ${compliantCount} 项通过`,
        metrics: {
          totalChecks,
          compliantCount,
          nonCompliantCount: totalChecks - compliantCount,
          complianceRate: totalChecks > 0 ? (compliantCount / totalChecks) * 100 : 0,
        },
        charts: [],
        insights: [
          totalChecks === 0
            ? '暂无合规检查记录'
            : compliantCount === totalChecks
              ? '所有合规检查均已符合'
              : '部分合规检查未符合，需要关注',
        ],
        generatedBy: params.generatedBy || 'ai',
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        recipients: params.recipients || [],
      },
    });

    logger.info('合规状态报表创建成功', {
      reportId: report.id,
      enterpriseId,
    });

    return report;
  },

  /**
   * 获取企业报表列表
   */
  async getEnterpriseReports(enterpriseId: string) {
    const reports = await prisma.executiveReport.findMany({
      where: { enterpriseId },
      orderBy: { generatedAt: 'desc' },
    });

    return reports;
  },

  /**
   * 获取报表详情
   */
  async getReport(reportId: string) {
    const report = await prisma.executiveReport.findUnique({
      where: { id: reportId },
    });

    return report;
  },
};
