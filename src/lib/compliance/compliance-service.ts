/**
 * 合规管理服务
 * 负责合规检查、报告生成和仪表盘数据
 */

import type {
  ComplianceChecklist,
  ComplianceCheckItem,
  ComplianceReport,
  ComplianceDashboard,
  ComplianceStatistics,
  ComplianceIssue,
  GetChecklistRequest,
  UpdateCheckItemRequest,
  GetComplianceReportRequest,
} from '@/types/compliance';
import {
  ComplianceCategory,
  ComplianceCheckStatus,
  CompliancePriority,
  calculateCompletionRate,
} from '@/types/compliance';

/**
 * 合规管理服务类
 */
export class ComplianceService {
  /**
   * 获取合规检查清单
   */
  static async getChecklists(
    request: GetChecklistRequest = {}
  ): Promise<ComplianceChecklist[]> {
    // 模拟数据 - 实际应从数据库获取
    const allChecklists: ComplianceChecklist[] = [
      {
        id: 'checklist-001',
        name: '法律合规检查',
        description: '年度法律合规检查清单',
        category: ComplianceCategory.LEGAL,
        items: this.generateCheckItems(ComplianceCategory.LEGAL, 10),
        createdAt: new Date(),
        updatedAt: new Date(),
        completionRate: 0,
      },
      {
        id: 'checklist-002',
        name: '财务合规检查',
        description: '季度财务合规检查清单',
        category: ComplianceCategory.FINANCIAL,
        items: this.generateCheckItems(ComplianceCategory.FINANCIAL, 8),
        createdAt: new Date(),
        updatedAt: new Date(),
        completionRate: 0,
      },
      {
        id: 'checklist-003',
        name: '运营合规检查',
        description: '月度运营合规检查清单',
        category: ComplianceCategory.OPERATIONAL,
        items: this.generateCheckItems(ComplianceCategory.OPERATIONAL, 12),
        createdAt: new Date(),
        updatedAt: new Date(),
        completionRate: 0,
      },
    ];

    // 计算完成率
    allChecklists.forEach(checklist => {
      checklist.completionRate = calculateCompletionRate(checklist.items);
    });

    // 按类别筛选
    if (request.category) {
      return allChecklists.filter(
        checklist => checklist.category === request.category
      );
    }

    return allChecklists;
  }

  /**
   * 更新检查项
   */
  static async updateCheckItem(
    request: UpdateCheckItemRequest
  ): Promise<ComplianceCheckItem> {
    // 模拟更新 - 实际应更新数据库
    return {
      id: request.itemId,
      category: ComplianceCategory.LEGAL,
      title: '合同审查',
      description: '审查所有合同是否符合法律要求',
      status: request.status,
      priority: CompliancePriority.HIGH,
      notes: request.notes,
    };
  }

  /**
   * 生成合规报告
   */
  static async generateReport(
    request: GetComplianceReportRequest = {}
  ): Promise<ComplianceReport> {
    const statistics = this.calculateStatistics();
    const issues = this.identifyIssues();

    return {
      id: `report_${Date.now()}`,
      title: '合规报告',
      reportDate: new Date(),
      period: {
        startDate: request.startDate || new Date('2024-01-01'),
        endDate: request.endDate || new Date(),
      },
      overallScore: this.calculateOverallScore(statistics),
      summary: this.generateSummary(statistics),
      statistics,
      issues,
      recommendations: this.generateRecommendations(issues),
    };
  }

  /**
   * 获取合规仪表盘数据
   */
  static async getDashboard(): Promise<ComplianceDashboard> {
    const statistics = this.calculateStatistics();
    const issues = this.identifyIssues();

    return {
      overallScore: this.calculateOverallScore(statistics),
      trend: this.calculateTrend(),
      statistics,
      recentIssues: issues.slice(0, 5),
      upcomingDeadlines: this.getUpcomingDeadlines(),
      categoryScores: this.calculateCategoryScores(),
    };
  }

  /**
   * 生成检查项
   */
  private static generateCheckItems(
    category: ComplianceCategory,
    count: number
  ): ComplianceCheckItem[] {
    const items: ComplianceCheckItem[] = [];
    const statuses = [
      ComplianceCheckStatus.PASSED,
      ComplianceCheckStatus.FAILED,
      ComplianceCheckStatus.WARNING,
      ComplianceCheckStatus.PENDING,
    ];

    for (let i = 0; i < count; i++) {
      items.push({
        id: `item_${category}_${i + 1}`,
        category,
        title: `检查项 ${i + 1}`,
        description: `${category} 类别的检查项 ${i + 1}`,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        priority:
          i % 3 === 0
            ? CompliancePriority.HIGH
            : i % 2 === 0
              ? CompliancePriority.MEDIUM
              : CompliancePriority.LOW,
        dueDate: new Date(
          Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000
        ),
      });
    }

    return items;
  }

  /**
   * 计算统计信息
   */
  private static calculateStatistics(): ComplianceStatistics {
    const byCategory: Record<
      ComplianceCategory,
      { total: number; passed: number; failed: number }
    > = {
      [ComplianceCategory.LEGAL]: { total: 10, passed: 8, failed: 2 },
      [ComplianceCategory.FINANCIAL]: { total: 10, passed: 9, failed: 1 },
      [ComplianceCategory.OPERATIONAL]: { total: 10, passed: 7, failed: 3 },
      [ComplianceCategory.DATA_PRIVACY]: { total: 10, passed: 8, failed: 2 },
      [ComplianceCategory.LABOR]: { total: 5, passed: 4, failed: 1 },
      [ComplianceCategory.ENVIRONMENTAL]: { total: 5, passed: 3, failed: 2 },
    };

    let totalChecks = 0;
    let passedChecks = 0;
    let failedChecks = 0;

    Object.values(byCategory).forEach(cat => {
      totalChecks += cat.total;
      passedChecks += cat.passed;
      failedChecks += cat.failed;
    });

    return {
      totalChecks,
      passedChecks,
      failedChecks,
      warningChecks: Math.floor(totalChecks * 0.1),
      pendingChecks: totalChecks - passedChecks - failedChecks,
      byCategory,
    };
  }

  /**
   * 识别合规问题
   */
  private static identifyIssues(): ComplianceIssue[] {
    return [
      {
        id: 'issue-001',
        category: ComplianceCategory.LEGAL,
        title: '合同条款不完整',
        description: '部分合同缺少必要的争议解决条款',
        severity: CompliancePriority.HIGH,
        status: 'open',
        identifiedDate: new Date(),
        recommendations: ['补充争议解决条款', '法务部门审核'],
      },
      {
        id: 'issue-002',
        category: ComplianceCategory.FINANCIAL,
        title: '财务报表延迟',
        description: '月度财务报表提交延迟',
        severity: CompliancePriority.MEDIUM,
        status: 'in_progress',
        identifiedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        recommendations: ['优化报表流程', '增加人员配置'],
      },
    ];
  }

  /**
   * 计算总体评分
   */
  private static calculateOverallScore(
    statistics: ComplianceStatistics
  ): number {
    if (statistics.totalChecks === 0) return 0;

    const passRate = statistics.passedChecks / statistics.totalChecks;
    const failPenalty =
      (statistics.failedChecks / statistics.totalChecks) * 0.5;
    const warningPenalty =
      (statistics.warningChecks / statistics.totalChecks) * 0.2;

    return Math.round((passRate - failPenalty - warningPenalty) * 100);
  }

  /**
   * 生成摘要
   */
  private static generateSummary(statistics: ComplianceStatistics): string {
    const passRate = Math.round(
      (statistics.passedChecks / statistics.totalChecks) * 100
    );

    if (passRate >= 90) {
      return '整体合规情况优秀，各项检查基本通过。';
    } else if (passRate >= 80) {
      return '整体合规情况良好，存在少量需要改进的地方。';
    } else if (passRate >= 70) {
      return '整体合规情况一般，需要重点关注未通过的检查项。';
    } else {
      return '整体合规情况需要改进，建议尽快处理未通过的检查项。';
    }
  }

  /**
   * 生成建议
   */
  private static generateRecommendations(issues: ComplianceIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.length > 0) {
      recommendations.push('优先处理高优先级的合规问题');
      recommendations.push('建立定期合规检查机制');
    }

    recommendations.push('加强员工合规培训');
    recommendations.push('完善合规管理制度');

    return recommendations;
  }

  /**
   * 计算趋势
   */
  private static calculateTrend(): 'up' | 'down' | 'stable' {
    // 模拟趋势计算
    const random = Math.random();
    if (random > 0.6) return 'up';
    if (random < 0.4) return 'down';
    return 'stable';
  }

  /**
   * 获取即将到期的任务
   */
  private static getUpcomingDeadlines(): Array<{
    id: string;
    title: string;
    dueDate: Date;
    priority: CompliancePriority;
  }> {
    return [
      {
        id: 'deadline-001',
        title: '年度合规报告提交',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        priority: CompliancePriority.HIGH,
      },
      {
        id: 'deadline-002',
        title: '季度财务审计',
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        priority: CompliancePriority.MEDIUM,
      },
    ];
  }

  /**
   * 计算类别评分
   */
  private static calculateCategoryScores(): Record<ComplianceCategory, number> {
    return {
      [ComplianceCategory.LEGAL]: 80,
      [ComplianceCategory.FINANCIAL]: 90,
      [ComplianceCategory.OPERATIONAL]: 85,
      [ComplianceCategory.DATA_PRIVACY]: 88,
      [ComplianceCategory.LABOR]: 82,
      [ComplianceCategory.ENVIRONMENTAL]: 75,
    };
  }
}
