import { NextRequest, NextResponse } from 'next/server';
import type {
  DashboardData,
  StatCard,
  QuickAction,
  FeatureModule,
  RecentActivity,
} from '@/types/dashboard';

/**
 * GET /api/dashboard
 * 获取Dashboard数据
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    // TODO: 从session获取当前用户ID
    // 模拟数据 - 实际应该从数据库获取
    const stats: StatCard[] = [
      {
        id: 'total-cases',
        title: '案件总数',
        value: 24,
        change: 12,
        changeType: 'increase',
        icon: 'case',
        color: 'blue',
        link: '/cases',
      },
      {
        id: 'total-clients',
        title: '客户总数',
        value: 18,
        change: 5,
        changeType: 'increase',
        icon: 'client',
        color: 'green',
        link: '/clients',
      },
      {
        id: 'pending-tasks',
        title: '待办任务',
        value: 7,
        change: 2,
        changeType: 'decrease',
        icon: 'task',
        color: 'yellow',
        link: '/tasks',
      },
      {
        id: 'today-schedule',
        title: '今日日程',
        value: 3,
        icon: 'schedule',
        color: 'purple',
        link: '/court-schedule',
      },
    ];

    const recentActivities: RecentActivity[] = [
      {
        id: '1',
        type: 'case',
        title: '案件 #CASE-001 状态更新',
        description: '案件已进入庭审阶段',
        time: '2小时前',
        link: '/cases/CASE-001',
      },
      {
        id: '2',
        type: 'client',
        title: '新客户：张某某',
        description: '已创建客户档案',
        time: '5小时前',
        link: '/clients/CLIENT-001',
      },
      {
        id: '3',
        type: 'schedule',
        title: '法庭日程提醒',
        description: '明日10:00 民事案件开庭',
        time: '1天前',
      },
      {
        id: '4',
        type: 'team',
        title: '团队邀请',
        description: '李律师已加入"某某律师事务所"',
        time: '2天前',
      },
    ];

    const data: DashboardData = {
      stats,
      recentActivities,
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('获取Dashboard数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取Dashboard数据失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 获取快速操作列表
 */
export async function getQuickActions(): Promise<QuickAction[]> {
  return [
    {
      id: 'new-case',
      label: '案件管理',
      icon: 'plus',
      href: '/cases',
      color: 'blue',
    },
    {
      id: 'new-client',
      label: '客户管理',
      icon: 'user-plus',
      href: '/clients',
      color: 'green',
    },
    {
      id: 'new-schedule',
      label: '法庭日程',
      icon: 'calendar',
      href: '/court-schedule',
      color: 'purple',
    },
    {
      id: 'new-task',
      label: '待办任务',
      icon: 'check-square',
      href: '/tasks',
      color: 'yellow',
    },
  ];
}

/**
 * 获取功能模块列表
 */
export async function getFeatureModules(): Promise<FeatureModule[]> {
  return [
    {
      id: 'crm',
      title: '客户关系管理',
      description: '管理客户档案、沟通记录、跟进任务',
      icon: 'users',
      href: '/clients',
      badge: 'CRM',
    },
    {
      id: 'case',
      title: '案件管理',
      description: '案件全生命周期管理、时间线、证据管理',
      icon: 'briefcase',
      href: '/cases',
    },
    {
      id: 'team',
      title: '团队协作',
      description: '团队管理、案件共享、内部讨论',
      icon: 'team',
      href: '/teams',
    },
    {
      id: 'schedule',
      title: '法庭日程',
      description: '管理法庭时间、冲突检测、日程提醒',
      icon: 'calendar',
      href: '/court-schedule',
    },
    {
      id: 'debate',
      title: 'AI辩论',
      description: 'AI驱动的智能辩论系统、法条检索',
      icon: 'message-square',
      href: '/debates',
    },
    {
      id: 'tools',
      title: '专业工具',
      description: '文书模板、费用计算、证人管理',
      icon: 'tool',
      href: '/document-templates',
    },
    {
      id: 'analytics',
      title: '数据分析',
      description: '客户分析、案件分析、绩效统计',
      icon: 'bar-chart',
      href: '/dashboard',
    },
    // 系统管理仅对管理员可见，已从首页移除
    // {
    //   id: 'admin',
    //   title: '系统管理',
    //   description: '用户管理、权限配置、系统设置',
    //   icon: 'settings',
    //   href: '/admin',
    //   badge: 'Admin',
    // },
  ];
}
