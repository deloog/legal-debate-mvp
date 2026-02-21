/** @legacy 优先使用 /api/v1/dashboard，此路由保留以向后兼容 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import type {
  DashboardData,
  StatCard,
  QuickAction,
  FeatureModule,
  RecentActivity,
} from '@/types/dashboard';
import { logger } from '@/lib/logger';

/**
 * GET /api/dashboard
 * 获取Dashboard数据
 */
export async function GET() {
  try {
    // 从session获取当前用户ID
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: '未认证',
        },
        { status: 401 }
      );
    }

    // 从数据库获取统计数据
    const [totalCases, totalClients, pendingTasks, todaySchedules] =
      await Promise.all([
        // 获取案件总数
        prisma.case.count({
          where: {
            userId,
            deletedAt: null,
          },
        }),
        // 获取客户总数
        prisma.client.count({
          where: {
            userId,
            deletedAt: null,
          },
        }),
        // 获取待办任务数
        prisma.task.count({
          where: {
            createdBy: userId,
            status: 'TODO',
            deletedAt: null,
          },
        }),
        // 获取今日日程数
        prisma.courtSchedule.count({
          where: {
            case: {
              userId,
            },
            startTime: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        }),
      ]);

    // 获取最近活动
    const recentCases = await prisma.case.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      take: 2,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    });

    const recentClients = await prisma.client.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    const recentSchedules = await prisma.courtSchedule.findMany({
      where: {
        case: {
          userId,
        },
        startTime: {
          gte: new Date(),
        },
      },
      orderBy: { startTime: 'asc' },
      take: 1,
      select: {
        id: true,
        title: true,
        startTime: true,
      },
    });

    // 构建统计数据
    const stats: StatCard[] = [
      {
        id: 'total-cases',
        title: '案件总数',
        value: totalCases,
        change: 0,
        changeType: 'increase',
        icon: 'case',
        color: 'blue',
        link: '/cases',
      },
      {
        id: 'total-clients',
        title: '客户总数',
        value: totalClients,
        change: 0,
        changeType: 'increase',
        icon: 'client',
        color: 'green',
        link: '/clients',
      },
      {
        id: 'pending-tasks',
        title: '待办任务',
        value: pendingTasks,
        change: 0,
        changeType: 'decrease',
        icon: 'task',
        color: 'yellow',
        link: '/tasks',
      },
      {
        id: 'today-schedule',
        title: '今日日程',
        value: todaySchedules,
        change: 0,
        changeType: 'increase',
        icon: 'schedule',
        color: 'purple',
        link: '/court-schedule',
      },
    ];

    // 构建最近活动
    const activities: RecentActivity[] = [];

    for (const caseItem of recentCases) {
      activities.push({
        id: `case-${caseItem.id}`,
        type: 'case',
        title: `案件 #${caseItem.id} 状态更新`,
        description: `案件状态: ${caseItem.status}`,
        time: getTimeAgo(caseItem.updatedAt),
        link: `/cases/${caseItem.id}`,
      });
    }

    for (const client of recentClients) {
      activities.push({
        id: `client-${client.id}`,
        type: 'client',
        title: `新客户：${client.name}`,
        description: '已创建客户档案',
        time: getTimeAgo(client.createdAt),
        link: `/clients/${client.id}`,
      });
    }

    for (const schedule of recentSchedules) {
      activities.push({
        id: `schedule-${schedule.id}`,
        type: 'schedule',
        title: '法庭日程提醒',
        description: `${schedule.title} - ${formatDateTime(schedule.startTime)}`,
        time: getTimeAgo(schedule.startTime),
      });
    }

    const data: DashboardData = {
      stats,
      recentActivities: activities,
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('获取Dashboard数据失败:', error);
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
 * 格式化相对时间
 */
function getTimeAgo(date: Date | string): string {
  const now = new Date();
  const past = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return '刚刚';
  }
  if (diffMins < 60) {
    return diffMins + '分钟前';
  }
  if (diffHours < 24) {
    return diffHours + '小时前';
  }
  if (diffDays < 7) {
    return diffDays + '天前';
  }
  return past.toLocaleDateString('zh-CN');
}

/**
 * 格式化日期时间
 */
function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
