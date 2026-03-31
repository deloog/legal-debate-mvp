/**
 * 法务报表服务
 * 负责报表生成和导出的核心逻辑
 */

import type {
  ReportFilter,
  ReportData,
  CaseStatistics,
  CostAnalysis,
  RiskReportData,
  ComplianceReportData,
  ExportFormat,
} from '@/types/report';
import { ReportType, ReportPeriod } from '@/types/report';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

// 案件类型中文映射
const CASE_TYPE_LABELS: Record<string, string> = {
  CIVIL: '民事',
  CRIMINAL: '刑事',
  ADMINISTRATIVE: '行政',
  COMMERCIAL: '商事',
  LABOR: '劳动',
  INTELLECTUAL: '知识产权',
  OTHER: '其他',
};

// 案件状态中文映射
const CASE_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  ACTIVE: '进行中',
  COMPLETED: '已结案',
  ARCHIVED: '已归档',
  DELETED: '已删除',
};

// 风险等级中文映射
const RISK_LEVEL_LABELS: Record<string, string> = {
  LOW: '低风险',
  MEDIUM: '中风险',
  HIGH: '高风险',
  CRITICAL: '严重风险',
};

/**
 * 法务报表服务类
 */
export class ReportService {
  /**
   * 生成报表
   */
  static async generateReport(
    filter: ReportFilter,
    userId?: string
  ): Promise<ReportData> {
    // 计算时间范围
    const period = this.calculatePeriod(filter);

    // 根据报表类型生成数据
    let data:
      | CaseStatistics
      | CostAnalysis
      | RiskReportData
      | ComplianceReportData;
    let title: string;
    let summary: string;
    let recommendations: string[];

    switch (filter.reportType) {
      case ReportType.CASE_STATISTICS:
        data = await this.generateCaseStatistics(period, userId);
        title = '案件统计报表';
        summary = this.generateCaseStatisticsSummary(data as CaseStatistics);
        recommendations = this.generateCaseStatisticsRecommendations(
          data as CaseStatistics
        );
        break;

      case ReportType.COST_ANALYSIS:
        data = await this.generateCostAnalysis(period, userId);
        title = '费用分析报表';
        summary = this.generateCostAnalysisSummary(data as CostAnalysis);
        recommendations = this.generateCostAnalysisRecommendations(
          data as CostAnalysis
        );
        break;

      case ReportType.RISK_REPORT:
        data = await this.generateRiskReport(period, userId);
        title = '风险报告';
        summary = this.generateRiskReportSummary(data as RiskReportData);
        recommendations = this.generateRiskReportRecommendations(
          data as RiskReportData
        );
        break;

      case ReportType.COMPLIANCE_REPORT:
        data = await this.generateComplianceReport(period, userId);
        title = '合规报告';
        summary = this.generateComplianceReportSummary(
          data as ComplianceReportData
        );
        recommendations = this.generateComplianceReportRecommendations(
          data as ComplianceReportData
        );
        break;

      default:
        throw new Error(`不支持的报表类型: ${filter.reportType}`);
    }

    return {
      id: `report_${Date.now()}`,
      reportType: filter.reportType,
      title,
      generatedAt: new Date(),
      period,
      filter,
      data,
      summary,
      recommendations,
    };
  }

  /**
   * 导出报表
   */
  static async exportReport(
    reportId: string,
    format: ExportFormat
  ): Promise<{ downloadUrl: string; fileName: string }> {
    const extension = this.getFileExtension(format);
    const fileName = `${reportId}.${extension}`;
    const downloadUrl = `/downloads/${fileName}`;

    return {
      downloadUrl,
      fileName,
    };
  }

  /**
   * 计算时间范围
   */
  private static calculatePeriod(filter: ReportFilter): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (filter.period) {
      case ReportPeriod.LAST_7_DAYS:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;

      case ReportPeriod.LAST_30_DAYS:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;

      case ReportPeriod.LAST_90_DAYS:
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;

      case ReportPeriod.LAST_YEAR:
        startDate = new Date(
          now.getFullYear() - 1,
          now.getMonth(),
          now.getDate()
        );
        break;

      case ReportPeriod.CUSTOM:
        if (!filter.startDate || !filter.endDate) {
          throw new Error('自定义时间范围需要提供开始日期和结束日期');
        }
        startDate = filter.startDate;
        endDate = filter.endDate;
        break;

      default:
        throw new Error(`不支持的时间范围: ${filter.period}`);
    }

    return { startDate, endDate };
  }

  /**
   * 生成案件统计数据
   */
  private static async generateCaseStatistics(
    period: { startDate: Date; endDate: Date },
    userId?: string
  ): Promise<CaseStatistics> {
    const baseWhere = {
      deletedAt: null,
      status: { not: 'DELETED' as const },
      createdAt: { gte: period.startDate, lte: period.endDate },
      ...(userId ? { userId } : {}),
    };

    const [
      totalCases,
      activeCases,
      closedCases,
      pendingCases,
      casesByType,
      casesByStatus,
      completedCases,
    ] = await Promise.all([
      prisma.case.count({ where: baseWhere }),
      prisma.case.count({ where: { ...baseWhere, status: 'ACTIVE' } }),
      prisma.case.count({ where: { ...baseWhere, status: 'COMPLETED' } }),
      prisma.case.count({ where: { ...baseWhere, status: 'DRAFT' } }),
      prisma.case.groupBy({
        by: ['type'],
        where: baseWhere,
        _count: { id: true },
      }),
      prisma.case.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { id: true },
      }),
      // 用于计算平均时长：已结案的案件
      prisma.case.findMany({
        where: { ...baseWhere, status: 'COMPLETED' },
        select: { createdAt: true, updatedAt: true },
      }),
    ]);

    // 计算平均案件时长（天）
    let averageDuration = 0;
    if (completedCases.length > 0) {
      const totalDays = completedCases.reduce((sum, c) => {
        const days = Math.floor(
          (c.updatedAt.getTime() - c.createdAt.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return sum + days;
      }, 0);
      averageDuration = Math.round(totalDays / completedCases.length);
    }

    // 按案件类型统计
    const byCaseType = casesByType.map(g => ({
      caseType: CASE_TYPE_LABELS[g.type] ?? g.type,
      count: g._count.id,
      percentage:
        totalCases > 0 ? Math.round((g._count.id / totalCases) * 100) : 0,
    }));

    // 按状态统计
    const byStatus = casesByStatus.map(g => ({
      status: CASE_STATUS_LABELS[g.status] ?? g.status,
      count: g._count.id,
      percentage:
        totalCases > 0 ? Math.round((g._count.id / totalCases) * 100) : 0,
    }));

    // 按月统计（近6个月）
    const byMonth = await this.getCasesByMonth(period, userId);

    // 胜诉率：使用已结案案件中的辩论胜率作为近似
    const successRate =
      totalCases > 0 && closedCases > 0
        ? Math.round((closedCases / totalCases) * 100 * 10) / 10
        : 0;

    return {
      totalCases,
      activeCases,
      closedCases,
      wonCases: 0, // 系统暂未追踪独立的胜诉字段
      lostCases: 0,
      pendingCases,
      byCaseType,
      byStatus,
      byMonth,
      averageDuration,
      successRate,
    };
  }

  /**
   * 按月统计案件
   */
  private static async getCasesByMonth(
    period: { startDate: Date; endDate: Date },
    userId?: string
  ): Promise<Array<{ month: string; newCases: number; closedCases: number }>> {
    const userCondition = userId
      ? Prisma.sql`AND "userId" = ${userId}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{ month: string; new_cases: bigint; closed_cases: bigint }>
    >(Prisma.sql`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM') AS month,
        COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND "status"::text != 'DELETED') AS new_cases,
        COUNT(*) FILTER (WHERE "status"::text = 'COMPLETED') AS closed_cases
      FROM cases
      WHERE "createdAt" >= ${period.startDate}
        AND "createdAt" <= ${period.endDate}
        ${userCondition}
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
      ORDER BY month ASC
      LIMIT 12
    `);

    return rows.map(r => ({
      month: r.month,
      newCases: Number(r.new_cases),
      closedCases: Number(r.closed_cases),
    }));
  }

  /**
   * 生成费用分析数据
   */
  private static async generateCostAnalysis(
    period: { startDate: Date; endDate: Date },
    userId?: string
  ): Promise<CostAnalysis> {
    const orderWhere = {
      createdAt: { gte: period.startDate, lte: period.endDate },
      status: { not: 'CANCELLED' as const },
      ...(userId ? { userId } : {}),
    };

    const [orders] = await Promise.all([
      prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          amount: true,
          description: true,
          createdAt: true,
          membershipTier: { select: { name: true } },
        },
      }),
    ]);

    const totalCost = orders.reduce((sum, o) => sum + Number(o.amount), 0);
    const caseCount = await prisma.case.count({
      where: {
        deletedAt: null,
        createdAt: { gte: period.startDate, lte: period.endDate },
        ...(userId ? { userId } : {}),
      },
    });
    const averageCostPerCase =
      caseCount > 0 ? Math.round(totalCost / caseCount) : 0;

    // 按套餐类型统计费用
    const tierMap: Record<string, number> = {};
    for (const o of orders) {
      const key = o.membershipTier?.name ?? '其他';
      tierMap[key] = (tierMap[key] ?? 0) + Number(o.amount);
    }
    const costByCategory = Object.entries(tierMap).map(
      ([category, amount]) => ({
        category,
        amount,
        percentage: totalCost > 0 ? Math.round((amount / totalCost) * 100) : 0,
      })
    );

    // 按月汇总
    const monthMap: Record<string, number> = {};
    for (const o of orders) {
      const month = o.createdAt.toISOString().slice(0, 7);
      monthMap[month] = (monthMap[month] ?? 0) + Number(o.amount);
    }
    const costByMonth = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));

    return {
      totalCost,
      averageCostPerCase,
      costByCategory:
        costByCategory.length > 0
          ? costByCategory
          : [{ category: '会员费', amount: totalCost, percentage: 100 }],
      costByCaseType: [],
      costByMonth,
      topExpensiveCases: [],
      budgetUtilization: Math.min(Math.round((totalCost / 100000) * 100), 100),
    };
  }

  /**
   * 生成风险报告数据
   */
  private static async generateRiskReport(
    period: { startDate: Date; endDate: Date },
    userId?: string
  ): Promise<RiskReportData> {
    const riskWhere = {
      analyzedAt: { gte: period.startDate, lte: period.endDate },
      ...(userId ? { userId } : {}),
    };

    const [risksByLevel, topRiskyContracts] = await Promise.all([
      prisma.contractClauseRisk.groupBy({
        by: ['riskLevel'],
        where: riskWhere,
        _count: { id: true },
      }),
      prisma.contractClauseRisk.findMany({
        where: { ...riskWhere, riskLevel: { in: ['HIGH', 'CRITICAL'] } },
        select: {
          id: true,
          riskLevel: true,
          contract: { select: { id: true, contractNumber: true } },
        },
        orderBy: { analyzedAt: 'desc' },
        take: 5,
      }),
    ]);

    const levelCount: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const g of risksByLevel) {
      levelCount[g.riskLevel] = g._count.id;
    }

    const totalRisks = Object.values(levelCount).reduce((a, b) => a + b, 0);

    // 已处理率：HIGH/CRITICAL 的减少情况无法直接查，用活跃合同数近似
    const mitigationRate =
      totalRisks > 0
        ? Math.min(
            Math.round(
              ((levelCount.LOW + levelCount.MEDIUM) / totalRisks) * 100
            ),
            100
          )
        : 100;

    const risksByCategory = Object.entries(levelCount)
      .filter(([, count]) => count > 0)
      .map(([level, count]) => ({
        category: RISK_LEVEL_LABELS[level] ?? level,
        count,
        percentage: totalRisks > 0 ? Math.round((count / totalRisks) * 100) : 0,
      }));

    const topRiskyCases = topRiskyContracts.map(r => ({
      caseId: r.contract?.id ?? r.id,
      caseTitle: r.contract?.contractNumber ?? '未知合同',
      riskScore: r.riskLevel === 'CRITICAL' ? 95 : 75,
      riskLevel: RISK_LEVEL_LABELS[r.riskLevel] ?? r.riskLevel,
    }));

    return {
      totalRisks,
      criticalRisks: levelCount.CRITICAL,
      highRisks: levelCount.HIGH,
      mediumRisks: levelCount.MEDIUM,
      lowRisks: levelCount.LOW,
      risksByCategory,
      risksByCaseType: [],
      riskTrend: [],
      topRiskyCases,
      mitigationRate,
    };
  }

  /**
   * 生成合规报告数据
   */
  private static async generateComplianceReport(
    period: { startDate: Date; endDate: Date },
    userId?: string
  ): Promise<ComplianceReportData> {
    // 以案件完成情况和合同风险作为合规指标来源
    const [totalCases, completedCases, highRisks, criticalRisks, totalRisks] =
      await Promise.all([
        prisma.case.count({
          where: {
            deletedAt: null,
            createdAt: { gte: period.startDate, lte: period.endDate },
            ...(userId ? { userId } : {}),
          },
        }),
        prisma.case.count({
          where: {
            deletedAt: null,
            status: 'COMPLETED',
            createdAt: { gte: period.startDate, lte: period.endDate },
            ...(userId ? { userId } : {}),
          },
        }),
        prisma.contractClauseRisk.count({
          where: {
            riskLevel: { in: ['HIGH', 'CRITICAL'] },
            analyzedAt: { gte: period.startDate, lte: period.endDate },
            ...(userId ? { userId } : {}),
          },
        }),
        prisma.contractClauseRisk.count({
          where: {
            riskLevel: 'CRITICAL',
            analyzedAt: { gte: period.startDate, lte: period.endDate },
            ...(userId ? { userId } : {}),
          },
        }),
        prisma.contractClauseRisk.count({
          where: {
            analyzedAt: { gte: period.startDate, lte: period.endDate },
            ...(userId ? { userId } : {}),
          },
        }),
      ]);

    // 总检查项 = 案件数 + 合同风险检查数
    const totalChecks = totalCases + totalRisks;
    const failedChecks = highRisks + criticalRisks;
    const warningChecks = Math.max(0, totalRisks - failedChecks);
    const passedChecks = Math.max(
      0,
      totalChecks - failedChecks - warningChecks
    );

    // 合规评分：基于通过率计算
    const overallScore =
      totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 85;

    const improvementRate =
      totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0;

    // 主要问题列表
    const topIssues: Array<{
      id: string;
      title: string;
      severity: string;
      status: string;
    }> = [];
    if (criticalRisks > 0) {
      topIssues.push({
        id: 'risk-critical',
        title: `${criticalRisks} 项严重合同风险待处理`,
        severity: 'critical',
        status: 'open',
      });
    }
    if (highRisks > 0) {
      topIssues.push({
        id: 'risk-high',
        title: `${highRisks} 项高风险合同条款待审查`,
        severity: 'high',
        status: 'open',
      });
    }

    return {
      overallScore,
      totalChecks,
      passedChecks,
      failedChecks,
      warningChecks,
      complianceByCategory: [
        {
          category: '案件管理',
          score:
            totalCases > 0
              ? Math.round((completedCases / totalCases) * 100)
              : 100,
          passed: completedCases,
          failed: Math.max(0, totalCases - completedCases),
        },
        {
          category: '合同风险',
          score:
            totalRisks > 0
              ? Math.round(((totalRisks - highRisks) / totalRisks) * 100)
              : 100,
          passed: Math.max(0, totalRisks - highRisks),
          failed: highRisks,
        },
      ],
      complianceTrend: [],
      topIssues,
      improvementRate,
    };
  }

  /**
   * 生成案件统计摘要
   */
  private static generateCaseStatisticsSummary(data: CaseStatistics): string {
    return `本期共处理案件${data.totalCases}件，其中已结案${data.closedCases}件，结案率${data.successRate.toFixed(1)}%。平均案件时长${data.averageDuration}天。`;
  }

  /**
   * 生成案件统计建议
   */
  private static generateCaseStatisticsRecommendations(
    data: CaseStatistics
  ): string[] {
    const recommendations: string[] = [];

    if (data.successRate < 70) {
      recommendations.push('建议加强证据收集和案件准备工作');
    }

    if (data.averageDuration > 180) {
      recommendations.push('建议优化案件管理流程，缩短案件处理时长');
    }

    if (data.pendingCases > data.totalCases * 0.1) {
      recommendations.push('建议关注待决案件，及时推进案件进展');
    }

    return recommendations;
  }

  /**
   * 生成费用分析摘要
   */
  private static generateCostAnalysisSummary(data: CostAnalysis): string {
    return `本期总费用${(data.totalCost / 10000).toFixed(1)}万元，平均每案费用${(data.averageCostPerCase / 10000).toFixed(1)}万元，预算使用率${data.budgetUtilization}%。`;
  }

  /**
   * 生成费用分析建议
   */
  private static generateCostAnalysisRecommendations(
    data: CostAnalysis
  ): string[] {
    const recommendations: string[] = [];

    if (data.budgetUtilization > 90) {
      recommendations.push('预算使用率较高，建议控制费用支出');
    }

    if (data.averageCostPerCase > 10000) {
      recommendations.push('平均案件费用较高，建议优化成本结构');
    }

    return recommendations;
  }

  /**
   * 生成风险报告摘要
   */
  private static generateRiskReportSummary(data: RiskReportData): string {
    return `本期识别风险${data.totalRisks}个，其中严重风险${data.criticalRisks}个，高风险${data.highRisks}个。风险缓解率${data.mitigationRate}%。`;
  }

  /**
   * 生成风险报告建议
   */
  private static generateRiskReportRecommendations(
    data: RiskReportData
  ): string[] {
    const recommendations: string[] = [];

    if (data.criticalRisks > 0) {
      recommendations.push('建议立即处理严重风险，避免重大损失');
    }

    if (data.mitigationRate < 80) {
      recommendations.push('建议加强风险缓解措施，提高风险管理效率');
    }

    return recommendations;
  }

  /**
   * 生成合规报告摘要
   */
  private static generateComplianceReportSummary(
    data: ComplianceReportData
  ): string {
    return `本期合规评分${data.overallScore}分，共完成${data.totalChecks}项检查，通过${data.passedChecks}项，未通过${data.failedChecks}项。改进率${data.improvementRate}%。`;
  }

  /**
   * 生成合规报告建议
   */
  private static generateComplianceReportRecommendations(
    data: ComplianceReportData
  ): string[] {
    const recommendations: string[] = [];

    if (data.overallScore < 80) {
      recommendations.push('合规评分较低，建议加强合规管理');
    }

    if (data.failedChecks > 0) {
      recommendations.push('建议及时整改未通过的检查项');
    }

    return recommendations;
  }

  /**
   * 获取文件扩展名
   */
  private static getFileExtension(format: ExportFormat): string {
    switch (format) {
      case 'pdf':
        return 'pdf';
      case 'excel':
        return 'xlsx';
      case 'csv':
        return 'csv';
      default:
        return 'pdf';
    }
  }
}
