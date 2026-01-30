/**
 * 合规管理类型定义
 * 用于企业法务合规管理功能
 */

// =============================================================================
// 枚举定义
// =============================================================================

/**
 * 合规检查状态
 */
export enum ComplianceCheckStatus {
  PENDING = 'pending', // 待检查
  PASSED = 'passed', // 通过
  FAILED = 'failed', // 未通过
  WARNING = 'warning', // 警告
}

/**
 * 合规类别
 */
export enum ComplianceCategory {
  LEGAL = 'legal', // 法律合规
  FINANCIAL = 'financial', // 财务合规
  OPERATIONAL = 'operational', // 运营合规
  DATA_PRIVACY = 'data_privacy', // 数据隐私
  LABOR = 'labor', // 劳动法合规
  ENVIRONMENTAL = 'environmental', // 环境合规
}

/**
 * 合规优先级
 */
export enum CompliancePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// =============================================================================
// 合规检查清单类型
// =============================================================================

/**
 * 合规检查项
 */
export interface ComplianceCheckItem {
  id: string;
  category: ComplianceCategory;
  title: string;
  description: string;
  status: ComplianceCheckStatus;
  priority: CompliancePriority;
  dueDate?: Date;
  completedDate?: Date;
  assignee?: string;
  notes?: string;
}

/**
 * 合规检查清单
 */
export interface ComplianceChecklist {
  id: string;
  name: string;
  description: string;
  category: ComplianceCategory;
  items: ComplianceCheckItem[];
  createdAt: Date;
  updatedAt: Date;
  completionRate: number; // 完成率 0-100
}

// =============================================================================
// 合规报告类型
// =============================================================================

/**
 * 合规问题
 */
export interface ComplianceIssue {
  id: string;
  category: ComplianceCategory;
  title: string;
  description: string;
  severity: CompliancePriority;
  status: 'open' | 'in_progress' | 'resolved';
  identifiedDate: Date;
  resolvedDate?: Date;
  recommendations: string[];
}

/**
 * 合规报告
 */
export interface ComplianceReport {
  id: string;
  title: string;
  reportDate: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  overallScore: number; // 总体合规评分 0-100
  summary: string;
  statistics: ComplianceStatistics;
  issues: ComplianceIssue[];
  recommendations: string[];
}

/**
 * 合规统计信息
 */
export interface ComplianceStatistics {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  pendingChecks: number;
  byCategory: Record<
    ComplianceCategory,
    {
      total: number;
      passed: number;
      failed: number;
    }
  >;
}

// =============================================================================
// 合规仪表盘类型
// =============================================================================

/**
 * 合规仪表盘数据
 */
export interface ComplianceDashboard {
  overallScore: number; // 总体评分 0-100
  trend: 'up' | 'down' | 'stable'; // 趋势
  statistics: ComplianceStatistics;
  recentIssues: ComplianceIssue[];
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    dueDate: Date;
    priority: CompliancePriority;
  }>;
  categoryScores: Record<ComplianceCategory, number>;
}

// =============================================================================
// API 请求和响应类型
// =============================================================================

/**
 * 获取合规检查清单请求
 */
export interface GetChecklistRequest {
  category?: ComplianceCategory;
  status?: ComplianceCheckStatus;
}

/**
 * 获取合规检查清单响应
 */
export interface GetChecklistResponse {
  success: boolean;
  data?: ComplianceChecklist[];
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 更新检查项请求
 */
export interface UpdateCheckItemRequest {
  checklistId: string;
  itemId: string;
  status: ComplianceCheckStatus;
  notes?: string;
}

/**
 * 更新检查项响应
 */
export interface UpdateCheckItemResponse {
  success: boolean;
  data?: ComplianceCheckItem;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 获取合规报告请求
 */
export interface GetComplianceReportRequest {
  startDate?: Date;
  endDate?: Date;
  category?: ComplianceCategory;
}

/**
 * 获取合规报告响应
 */
export interface GetComplianceReportResponse {
  success: boolean;
  data?: ComplianceReport;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 获取合规仪表盘响应
 */
export interface GetComplianceDashboardResponse {
  success: boolean;
  data?: ComplianceDashboard;
  error?: {
    code: string;
    message: string;
  };
}

// =============================================================================
// 类型守卫函数
// =============================================================================

/**
 * 验证合规检查状态
 */
export function isValidComplianceCheckStatus(
  value: unknown
): value is ComplianceCheckStatus {
  return (
    typeof value === 'string' &&
    Object.values(ComplianceCheckStatus).includes(
      value as ComplianceCheckStatus
    )
  );
}

/**
 * 验证合规类别
 */
export function isValidComplianceCategory(
  value: unknown
): value is ComplianceCategory {
  return (
    typeof value === 'string' &&
    Object.values(ComplianceCategory).includes(value as ComplianceCategory)
  );
}

/**
 * 验证合规优先级
 */
export function isValidCompliancePriority(
  value: unknown
): value is CompliancePriority {
  return (
    typeof value === 'string' &&
    Object.values(CompliancePriority).includes(value as CompliancePriority)
  );
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 获取合规状态标签
 */
export function getComplianceStatusLabel(
  status: ComplianceCheckStatus
): string {
  const labels: Record<ComplianceCheckStatus, string> = {
    [ComplianceCheckStatus.PENDING]: '待检查',
    [ComplianceCheckStatus.PASSED]: '通过',
    [ComplianceCheckStatus.FAILED]: '未通过',
    [ComplianceCheckStatus.WARNING]: '警告',
  };
  return labels[status] || '未知';
}

/**
 * 获取合规类别标签
 */
export function getComplianceCategoryLabel(
  category: ComplianceCategory
): string {
  const labels: Record<ComplianceCategory, string> = {
    [ComplianceCategory.LEGAL]: '法律合规',
    [ComplianceCategory.FINANCIAL]: '财务合规',
    [ComplianceCategory.OPERATIONAL]: '运营合规',
    [ComplianceCategory.DATA_PRIVACY]: '数据隐私',
    [ComplianceCategory.LABOR]: '劳动法合规',
    [ComplianceCategory.ENVIRONMENTAL]: '环境合规',
  };
  return labels[category] || '未知';
}

/**
 * 获取优先级标签
 */
export function getCompliancePriorityLabel(
  priority: CompliancePriority
): string {
  const labels: Record<CompliancePriority, string> = {
    [CompliancePriority.LOW]: '低',
    [CompliancePriority.MEDIUM]: '中',
    [CompliancePriority.HIGH]: '高',
    [CompliancePriority.CRITICAL]: '严重',
  };
  return labels[priority] || '未知';
}

/**
 * 获取状态颜色
 */
export function getComplianceStatusColor(
  status: ComplianceCheckStatus
): string {
  const colors: Record<ComplianceCheckStatus, string> = {
    [ComplianceCheckStatus.PENDING]: '#6b7280', // 灰色
    [ComplianceCheckStatus.PASSED]: '#22c55e', // 绿色
    [ComplianceCheckStatus.FAILED]: '#dc2626', // 红色
    [ComplianceCheckStatus.WARNING]: '#f59e0b', // 橙色
  };
  return colors[status] || '#6b7280';
}

/**
 * 计算完成率
 */
export function calculateCompletionRate(items: ComplianceCheckItem[]): number {
  if (items.length === 0) return 0;

  const completedItems = items.filter(
    item =>
      item.status === ComplianceCheckStatus.PASSED ||
      item.status === ComplianceCheckStatus.FAILED
  );

  return Math.round((completedItems.length / items.length) * 100);
}
