/**
 * 合规管理服务
 * 数据流：ComplianceRule（规则模板）→ 自动初始化 EnterpriseComplianceCheck（PENDING）
 *         → 企业法务逐条标记 → 统计评分 → 仪表盘/报告
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
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

// =============================================================================
// 内部类型
// =============================================================================

interface ChecklistItemTemplate {
  id: string;
  title: string;
  description?: string;
  priority?: string;
}

interface ChecklistResult {
  itemId: string;
  status: string;
  notes?: string;
  completedDate?: string;
}

export class ComplianceAccessError extends Error {
  constructor(
    public readonly code:
      | 'ENTERPRISE_ACCOUNT_NOT_FOUND'
      | 'ENTERPRISE_NOT_APPROVED',
    message: string,
    public readonly status: 404 | 403
  ) {
    super(message);
    this.name = 'ComplianceAccessError';
  }
}

export class ComplianceRequestError extends Error {
  constructor(
    public readonly code: 'CHECKLIST_NOT_FOUND' | 'CHECK_ITEM_NOT_FOUND',
    message: string,
    public readonly status: 404
  ) {
    super(message);
    this.name = 'ComplianceRequestError';
  }
}

// =============================================================================
// 辅助映射
// =============================================================================

function inferCategory(rule: {
  businessProcesses: string[];
  ruleName: string;
}): ComplianceCategory {
  const procs = rule.businessProcesses.join(' ').toLowerCase();
  const name = rule.ruleName.toLowerCase();
  if (
    procs.includes('labor') ||
    name.includes('劳动') ||
    name.includes('社会保险')
  )
    return ComplianceCategory.LABOR;
  if (
    procs.includes('data') ||
    procs.includes('privacy') ||
    name.includes('数据') ||
    name.includes('网络安全')
  )
    return ComplianceCategory.DATA_PRIVACY;
  if (
    procs.includes('financial') ||
    procs.includes('finance') ||
    name.includes('财务') ||
    name.includes('税务')
  )
    return ComplianceCategory.FINANCIAL;
  if (
    procs.includes('environment') ||
    name.includes('环境') ||
    name.includes('碳排放')
  )
    return ComplianceCategory.ENVIRONMENTAL;
  if (
    procs.includes('operation') ||
    name.includes('运营') ||
    name.includes('知识产权') ||
    name.includes('生产')
  )
    return ComplianceCategory.OPERATIONAL;
  return ComplianceCategory.LEGAL;
}

function mapPriority(p?: string): CompliancePriority {
  switch ((p ?? '').toLowerCase()) {
    case 'critical':
      return CompliancePriority.CRITICAL;
    case 'high':
      return CompliancePriority.HIGH;
    case 'medium':
      return CompliancePriority.MEDIUM;
    default:
      return CompliancePriority.LOW;
  }
}

function mapItemStatus(s?: string): ComplianceCheckStatus {
  switch ((s ?? '').toLowerCase()) {
    case 'passed':
      return ComplianceCheckStatus.PASSED;
    case 'failed':
      return ComplianceCheckStatus.FAILED;
    case 'warning':
      return ComplianceCheckStatus.WARNING;
    default:
      return ComplianceCheckStatus.PENDING;
  }
}

function calcOverallResult(items: ComplianceCheckItem[]): string {
  if (items.some(i => i.status === ComplianceCheckStatus.FAILED))
    return 'NON_COMPLIANT';
  if (items.some(i => i.status === ComplianceCheckStatus.WARNING))
    return 'PARTIAL_COMPLIANT';
  if (items.every(i => i.status === ComplianceCheckStatus.PASSED))
    return 'COMPLIANT';
  return 'PARTIAL_COMPLIANT'; // 部分待检查
}

function getTemplates(rule: {
  id: string;
  checklistItems: unknown[];
  controlPoints: string[];
}): ChecklistItemTemplate[] {
  const items = rule.checklistItems as unknown as ChecklistItemTemplate[];
  if (items.length > 0) return items;
  return rule.controlPoints.map((cp, i) => ({
    id: `${rule.id}-cp-${i}`,
    title: cp,
    description: cp,
    priority: 'medium',
  }));
}

// =============================================================================
// 服务
// =============================================================================

export class ComplianceService {
  // ── 核心：企业合规能力只对已审核通过的企业开放 ─────────────────────────────
  private static async requireEnterprise(userId: string) {
    const enterprise = await prisma.enterpriseAccount.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });

    if (!enterprise) {
      throw new ComplianceAccessError(
        'ENTERPRISE_ACCOUNT_NOT_FOUND',
        '未找到企业账号，请先完成企业认证',
        404
      );
    }

    if (enterprise.status !== 'APPROVED') {
      throw new ComplianceAccessError(
        'ENTERPRISE_NOT_APPROVED',
        '企业认证尚未通过，暂不可使用合规管理功能',
        403
      );
    }

    return enterprise;
  }

  // ── 自动初始化：为企业创建所有尚未有记录的规则的 PENDING 检查 ──────────────
  private static async initializeChecksIfNeeded(
    enterpriseId: string
  ): Promise<void> {
    const [rules, existingChecks] = await Promise.all([
      prisma.complianceRule.findMany({
        where: { status: 'active' },
        select: { id: true, checklistItems: true, controlPoints: true },
      }),
      prisma.enterpriseComplianceCheck.findMany({
        where: { enterpriseId },
        select: { ruleId: true },
      }),
    ]);

    const existingRuleIds = new Set(existingChecks.map(c => c.ruleId));
    const toCreate = rules.filter(r => !existingRuleIds.has(r.id));

    if (toCreate.length === 0) return;

    logger.info(
      `[compliance] 为企业 ${enterpriseId} 初始化 ${toCreate.length} 条合规检查记录`
    );

    await prisma.enterpriseComplianceCheck.createMany({
      data: toCreate.map(rule => {
        const templates = getTemplates(rule);
        const initialResults: ChecklistResult[] = templates.map(t => ({
          itemId: t.id,
          status: 'pending',
        }));
        return {
          enterpriseId,
          ruleId: rule.id,
          checkDate: new Date(),
          checkResult: 'PARTIAL_COMPLIANT' as const,
          checklistResults: initialResults as unknown as never[],
          nonCompliances: [],
        };
      }),
    });
  }

  // ── 获取检查清单 ──────────────────────────────────────────────────────────────
  static async getChecklists(
    userId: string,
    request: GetChecklistRequest = {}
  ): Promise<ComplianceChecklist[]> {
    const enterprise = await this.requireEnterprise(userId);

    // 确保所有规则都有对应的检查记录
    await this.initializeChecksIfNeeded(enterprise.id);

    const rules = await prisma.complianceRule.findMany({
      where: { status: 'active' },
      orderBy: { effectiveDate: 'desc' },
    });

    const checks = await prisma.enterpriseComplianceCheck.findMany({
      where: { enterpriseId: enterprise.id },
      select: { ruleId: true, checkResult: true, checklistResults: true },
    });
    const checkMap = new Map(checks.map(c => [c.ruleId, c]));

    const checklists: ComplianceChecklist[] = [];

    for (const rule of rules) {
      const category = inferCategory(rule);
      if (request.category && category !== request.category) continue;

      const templates = getTemplates(rule);
      const savedCheck = checkMap.get(rule.id);
      const resultsMap = new Map<string, ChecklistResult>(
        (
          (savedCheck?.checklistResults ?? []) as unknown as ChecklistResult[]
        ).map(r => [r.itemId, r])
      );

      const items: ComplianceCheckItem[] = templates
        .map(tmpl => {
          const saved = resultsMap.get(tmpl.id);
          const status = saved
            ? mapItemStatus(saved.status)
            : ComplianceCheckStatus.PENDING;
          if (request.status && status !== request.status)
            return null as unknown as ComplianceCheckItem;
          return {
            id: tmpl.id,
            category,
            title: tmpl.title,
            description: tmpl.description ?? '',
            status,
            priority: mapPriority(tmpl.priority),
            notes: saved?.notes,
            completedDate: saved?.completedDate
              ? new Date(saved.completedDate)
              : undefined,
          };
        })
        .filter(Boolean);

      checklists.push({
        id: rule.id,
        name: rule.ruleName,
        description: rule.description ?? '',
        category,
        items,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
        completionRate: calculateCompletionRate(items),
      });
    }

    return checklists;
  }

  // ── 更新单个检查项 ────────────────────────────────────────────────────────────
  static async updateCheckItem(
    userId: string,
    request: UpdateCheckItemRequest
  ): Promise<ComplianceCheckItem> {
    const enterprise = await this.requireEnterprise(userId);

    const rule = await prisma.complianceRule.findUnique({
      where: { id: request.checklistId },
      select: {
        id: true,
        checklistItems: true,
        controlPoints: true,
        businessProcesses: true,
        ruleName: true,
      },
    });
    if (!rule) {
      throw new ComplianceRequestError(
        'CHECKLIST_NOT_FOUND',
        '检查清单不存在',
        404
      );
    }

    const templates = getTemplates(rule);
    const template = templates.find(t => t.id === request.itemId);
    if (!template) {
      throw new ComplianceRequestError(
        'CHECK_ITEM_NOT_FOUND',
        '检查项不存在',
        404
      );
    }

    const existing = await prisma.enterpriseComplianceCheck.findFirst({
      where: { enterpriseId: enterprise.id, ruleId: rule.id },
    });

    const results: ChecklistResult[] = existing
      ? ((existing.checklistResults as unknown as ChecklistResult[]) ?? [])
      : [];

    const newResult: ChecklistResult = {
      itemId: request.itemId,
      status: request.status,
      notes: request.notes,
      completedDate:
        request.status === ComplianceCheckStatus.PASSED ||
        request.status === ComplianceCheckStatus.FAILED
          ? new Date().toISOString()
          : undefined,
    };

    const idx = results.findIndex(r => r.itemId === request.itemId);
    if (idx >= 0) results[idx] = newResult;
    else results.push(newResult);

    // 重新计算整体结果
    const allItems: ComplianceCheckItem[] = templates.map(t => ({
      id: t.id,
      category: inferCategory(rule),
      title: t.title,
      description: t.description ?? '',
      status: mapItemStatus(results.find(r => r.itemId === t.id)?.status),
      priority: mapPriority(t.priority),
    }));
    const overallResult = calcOverallResult(allItems);

    if (existing) {
      await prisma.enterpriseComplianceCheck.update({
        where: { id: existing.id },
        data: {
          checklistResults: results as unknown as never[],
          checkResult: overallResult as never,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.enterpriseComplianceCheck.create({
        data: {
          enterpriseId: enterprise.id,
          ruleId: rule.id,
          checkDate: new Date(),
          checkResult: overallResult as never,
          checklistResults: results as unknown as never[],
          nonCompliances: [],
        },
      });
    }

    return {
      id: request.itemId,
      category: inferCategory(rule),
      title: template.title,
      description: template.description ?? '',
      status: request.status,
      priority: mapPriority(template.priority),
      notes: request.notes,
      completedDate: newResult.completedDate
        ? new Date(newResult.completedDate)
        : undefined,
    };
  }

  // ── 仪表盘 ────────────────────────────────────────────────────────────────────
  static async getDashboard(userId: string): Promise<ComplianceDashboard> {
    const enterprise = await this.requireEnterprise(userId);

    await this.initializeChecksIfNeeded(enterprise.id);

    const [statistics, issues, trend, upcomingDeadlines, categoryScores] =
      await Promise.all([
        this.calculateStatistics(enterprise.id),
        this.identifyIssues(enterprise.id),
        this.calculateTrend(enterprise.id),
        this.getUpcomingDeadlines(enterprise.id),
        this.calculateCategoryScores(enterprise.id),
      ]);

    return {
      overallScore: this.calculateOverallScore(statistics),
      trend,
      statistics,
      recentIssues: issues.slice(0, 5),
      upcomingDeadlines,
      categoryScores,
    };
  }

  // ── 合规报告 ──────────────────────────────────────────────────────────────────
  static async generateReport(
    userId: string,
    request: GetComplianceReportRequest = {}
  ): Promise<ComplianceReport> {
    const enterprise = await this.requireEnterprise(userId);

    await this.initializeChecksIfNeeded(enterprise.id);

    const [statistics, issues] = await Promise.all([
      this.calculateStatistics(enterprise.id, request),
      this.identifyIssues(enterprise.id),
    ]);

    return {
      id: `report_${Date.now()}`,
      title: '企业合规自查报告',
      reportDate: new Date(),
      period: {
        startDate:
          request.startDate ?? new Date(new Date().getFullYear(), 0, 1),
        endDate: request.endDate ?? new Date(),
      },
      overallScore: this.calculateOverallScore(statistics),
      summary: this.generateSummary(statistics),
      statistics,
      issues,
      recommendations: this.generateRecommendations(issues),
    };
  }

  // ===========================================================================
  // 私有方法（接收 enterpriseId，不再重复查询）
  // ===========================================================================

  private static async calculateStatistics(
    enterpriseId: string,
    _request: GetComplianceReportRequest = {}
  ): Promise<ComplianceStatistics> {
    const byCategory = emptyByCategory();

    const checks = await prisma.enterpriseComplianceCheck.findMany({
      where: { enterpriseId },
      include: {
        rule: { select: { businessProcesses: true, ruleName: true } },
      },
    });

    let totalChecks = 0,
      passedChecks = 0,
      failedChecks = 0,
      warningChecks = 0;

    for (const check of checks) {
      const cat = inferCategory(check.rule);
      const results =
        (check.checklistResults as unknown as ChecklistResult[]) ?? [];
      for (const r of results) {
        totalChecks++;
        byCategory[cat].total++;
        const status = mapItemStatus(r.status);
        if (status === ComplianceCheckStatus.PASSED) {
          passedChecks++;
          byCategory[cat].passed++;
        } else if (status === ComplianceCheckStatus.FAILED) {
          failedChecks++;
          byCategory[cat].failed++;
        } else if (status === ComplianceCheckStatus.WARNING) {
          warningChecks++;
        }
      }
    }

    return {
      totalChecks,
      passedChecks,
      failedChecks,
      warningChecks,
      pendingChecks: totalChecks - passedChecks - failedChecks - warningChecks,
      byCategory,
    };
  }

  private static async identifyIssues(
    enterpriseId: string
  ): Promise<ComplianceIssue[]> {
    const checks = await prisma.enterpriseComplianceCheck.findMany({
      where: {
        enterpriseId,
        checkResult: { in: ['NON_COMPLIANT', 'PARTIAL_COMPLIANT'] },
      },
      include: {
        rule: {
          select: {
            ruleName: true,
            businessProcesses: true,
            checklistItems: true,
            controlPoints: true,
          },
        },
      },
      orderBy: { checkDate: 'desc' },
      take: 20,
    });

    return checks.map((check): ComplianceIssue => {
      const results =
        (check.checklistResults as unknown as ChecklistResult[]) ?? [];
      const failedItems = results.filter(r => r.status === 'failed').length;
      const warningItems = results.filter(r => r.status === 'warning').length;
      const remediationStatus = (check.remediationStatus ?? '').toLowerCase();
      return {
        id: check.id,
        category: inferCategory(check.rule),
        title: `${check.rule.ruleName} 合规问题`,
        description:
          failedItems > 0
            ? `${failedItems} 项未通过，${warningItems} 项警告，请尽快处理`
            : `${warningItems} 项需要关注`,
        severity:
          check.checkResult === 'NON_COMPLIANT'
            ? CompliancePriority.HIGH
            : CompliancePriority.MEDIUM,
        status:
          remediationStatus === 'completed'
            ? 'resolved'
            : remediationStatus === 'in_progress'
              ? 'in_progress'
              : 'open',
        identifiedDate: check.checkDate,
        recommendations: check.remediationPlan
          ? [check.remediationPlan]
          : ['请制定整改计划并按期完成'],
      };
    });
  }

  private static async calculateTrend(
    enterpriseId: string
  ): Promise<'up' | 'down' | 'stable'> {
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 86400000);
    const sixtyDaysAgo = new Date(now - 60 * 86400000);

    const [recentC, recentT, olderC, olderT] = await Promise.all([
      prisma.enterpriseComplianceCheck.count({
        where: {
          enterpriseId,
          checkDate: { gte: thirtyDaysAgo },
          checkResult: 'COMPLIANT',
        },
      }),
      prisma.enterpriseComplianceCheck.count({
        where: { enterpriseId, checkDate: { gte: thirtyDaysAgo } },
      }),
      prisma.enterpriseComplianceCheck.count({
        where: {
          enterpriseId,
          checkDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          checkResult: 'COMPLIANT',
        },
      }),
      prisma.enterpriseComplianceCheck.count({
        where: {
          enterpriseId,
          checkDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
      }),
    ]);

    if (recentT === 0 || olderT === 0) return 'stable';
    const diff = recentC / recentT - olderC / olderT;
    return diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'stable';
  }

  private static async getUpcomingDeadlines(enterpriseId: string) {
    const thirtyDaysLater = new Date(Date.now() + 30 * 86400000);

    const [overdueChecks, expiringRules] = await Promise.all([
      prisma.enterpriseComplianceCheck.findMany({
        where: {
          enterpriseId,
          remediationDeadline: { lte: thirtyDaysLater },
          remediationStatus: { in: ['pending', 'in_progress', 'IN_PROGRESS'] },
        },
        include: { rule: { select: { ruleName: true } } },
        orderBy: { remediationDeadline: 'asc' },
        take: 10,
      }),
      prisma.complianceRule.findMany({
        where: {
          status: 'active',
          expiryDate: { lte: thirtyDaysLater, gte: new Date() },
        },
        orderBy: { expiryDate: 'asc' },
        take: 5,
      }),
    ]);

    return [
      ...overdueChecks.map(c => ({
        id: c.id,
        title: `${c.rule.ruleName} 整改截止`,
        dueDate: c.remediationDeadline!,
        priority: CompliancePriority.HIGH,
      })),
      ...expiringRules.map(r => ({
        id: r.id,
        title: `${r.ruleName} 法规到期`,
        dueDate: r.expiryDate!,
        priority: CompliancePriority.MEDIUM,
      })),
    ]
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 10);
  }

  private static async calculateCategoryScores(
    enterpriseId: string
  ): Promise<Record<ComplianceCategory, number>> {
    const stats = await this.calculateStatistics(enterpriseId);
    const scores = {} as Record<ComplianceCategory, number>;
    for (const cat of Object.values(ComplianceCategory)) {
      const s = stats.byCategory[cat];
      if (s.total === 0) {
        scores[cat] = 0; // 尚未开始检查，显示 0 而非 100
      } else {
        scores[cat] = Math.round(
          Math.max(0, (s.passed / s.total - (s.failed / s.total) * 0.5) * 100)
        );
      }
    }
    return scores;
  }

  private static calculateOverallScore(stats: ComplianceStatistics): number {
    if (stats.totalChecks === 0) return 0;
    const passRate = stats.passedChecks / stats.totalChecks;
    const failPenalty = (stats.failedChecks / stats.totalChecks) * 0.5;
    const warnPenalty = (stats.warningChecks / stats.totalChecks) * 0.2;
    return Math.round(
      Math.max(0, (passRate - failPenalty - warnPenalty) * 100)
    );
  }

  private static generateSummary(stats: ComplianceStatistics): string {
    const { totalChecks, passedChecks, pendingChecks } = stats;
    if (totalChecks === 0) return '暂无合规检查数据。';
    if (pendingChecks === totalChecks)
      return '所有检查项均处于待检查状态，请逐条完成自查并标记结果。';
    const passRate = Math.round((passedChecks / totalChecks) * 100);
    if (passRate >= 90) return '整体合规情况优秀，各项检查基本通过。';
    if (passRate >= 70) return '整体合规情况良好，存在少量需要改进的地方。';
    return '整体合规情况需要改进，建议尽快处理未通过的检查项。';
  }

  private static generateRecommendations(issues: ComplianceIssue[]): string[] {
    const recs: string[] = [];
    if (issues.some(i => i.severity === CompliancePriority.HIGH))
      recs.push('优先处理高优先级合规问题，降低法律风险');
    if (issues.some(i => i.status === 'open'))
      recs.push('尽快启动待处理问题的整改计划，设定明确期限');
    recs.push('建议按季度开展全面合规自查，保持检查结果最新');
    recs.push('加强员工合规培训，提升全员合规意识');
    recs.push('针对未通过项及时咨询专业律师，制定合规改进方案');
    return recs;
  }
}

// =============================================================================
// 工具
// =============================================================================

function emptyByCategory() {
  const r = {} as Record<
    ComplianceCategory,
    { total: number; passed: number; failed: number }
  >;
  for (const cat of Object.values(ComplianceCategory))
    r[cat] = { total: 0, passed: 0, failed: 0 };
  return r;
}
