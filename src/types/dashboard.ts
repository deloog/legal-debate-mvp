/**
 * Dashboard相关类型定义
 */

/**
 * 统计卡片数据
 */
export interface StatCard {
  id: string;
  title: string;
  value: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease';
  icon: string;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
  link?: string;
}

/**
 * 快速操作按钮
 */
export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  href: string;
  color: string;
}

/**
 * 功能模块
 */
export interface FeatureModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  badge?: string;
}

/**
 * 近期活动项
 */
export interface RecentActivity {
  id: string;
  type: 'case' | 'client' | 'team' | 'schedule' | 'reminder';
  title: string;
  description: string;
  time: string;
  link?: string;
}

/**
 * Dashboard数据
 */
export interface DashboardData {
  stats: StatCard[];
  recentActivities: RecentActivity[];
  upcomingSchedule?: UpcomingSchedule;
}

/**
 * 日程信息
 */
export interface UpcomingSchedule {
  title: string;
  date: string;
  time: string;
  type: string;
  caseId?: string;
}

/**
 * 功能分类
 */
export enum FeatureCategory {
  CRM = 'crm',
  CASE = 'case',
  TEAM = 'team',
  TOOLS = 'tools',
  ANALYTICS = 'analytics',
  ADMIN = 'admin',
}

// ============================================================================
// 企业法务工作台类型定义
// ============================================================================

// 风险告警严重程度
export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// 风险告警类型
export type RiskAlertType = 'HIGH_RISK' | 'COMPLIANCE' | 'DEADLINE' | 'OTHER';

// 任务优先级
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// 任务状态
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// 工作台统计数据
export interface DashboardStats {
  pendingReviewContracts: number; // 待审查合同数
  highRiskContracts: number; // 高风险合同数
  complianceScore: number; // 合规评分 (0-100)
  pendingTasks: number; // 待处理任务数
}

// 风险告警
export interface RiskAlert {
  id: string;
  type: RiskAlertType;
  title: string;
  description: string;
  severity: RiskSeverity;
  createdAt: Date;
  relatedId?: string; // 关联的合同或任务ID
}

// 最近审查的合同
export interface RecentContract {
  id: string;
  contractNumber: string;
  clientName: string;
  caseType: string;
  status: string;
  totalFee: number;
  reviewedAt: Date;
}

// 合规状态
export interface ComplianceStatus {
  totalChecks: number; // 总检查项
  passedChecks: number; // 通过的检查项
  failedChecks: number; // 未通过的检查项
  score: number; // 合规评分 (0-100)
}

// 即将到期的任务
export interface UpcomingTask {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  priority: TaskPriority;
  status: TaskStatus;
}

// 企业法务工作台数据
export interface EnterpriseDashboardData {
  stats: DashboardStats;
  riskAlerts: RiskAlert[];
  recentContracts: RecentContract[];
  complianceStatus: ComplianceStatus;
  upcomingTasks: UpcomingTask[];
}

// API响应类型
export interface EnterpriseDashboardResponse {
  success: boolean;
  data?: EnterpriseDashboardData;
  error?: {
    code: string;
    message: string;
  };
}
