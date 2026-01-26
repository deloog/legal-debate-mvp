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
