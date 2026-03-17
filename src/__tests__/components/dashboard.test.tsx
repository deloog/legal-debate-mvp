/**
 * Dashboard组件测试
 */

import { render, screen } from '@testing-library/react';
import { StatCard } from '@/components/dashboard/StatCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivities } from '@/components/dashboard/RecentActivities';
import { FeatureModules } from '@/components/dashboard/FeatureModules';
import type {
  StatCard as StatCardType,
  QuickAction as QuickActionType,
  RecentActivity as RecentActivityType,
  FeatureModule as FeatureModuleType,
} from '@/types/dashboard';

describe('StatCard 组件', () => {
  it('应该渲染统计卡片', () => {
    const mockStat: StatCardType = {
      id: 'test-stat',
      title: '测试标题',
      value: 100,
      change: 10,
      changeType: 'increase',
      icon: 'case',
      color: 'blue',
      link: '/test',
    };

    render(<StatCard card={mockStat} />);

    expect(screen.getByText('测试标题')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText(/10%/)).toBeInTheDocument();
  });

  it('应该显示增长箭头', () => {
    const mockStat: StatCardType = {
      id: 'test-stat',
      title: '测试标题',
      value: 100,
      change: 10,
      changeType: 'increase',
      icon: 'case',
      color: 'blue',
    };

    render(<StatCard card={mockStat} />);

    expect(screen.getByText(/10%/)).toBeInTheDocument();
  });

  it('应该显示减少箭头', () => {
    const mockStat: StatCardType = {
      id: 'test-stat',
      title: '测试标题',
      value: 100,
      change: 5,
      changeType: 'decrease',
      icon: 'case',
      color: 'blue',
    };

    render(<StatCard card={mockStat} />);

    expect(screen.getByText(/5%/)).toBeInTheDocument();
  });
});

describe('QuickActions 组件', () => {
  it('应该渲染快速操作按钮', () => {
    const mockActions: QuickActionType[] = [
      {
        id: 'new-case',
        label: '新建案件',
        icon: 'plus',
        href: '/cases/new',
        color: 'blue',
      },
      {
        id: 'new-client',
        label: '新建客户',
        icon: 'user-plus',
        href: '/clients/new',
        color: 'green',
      },
    ];

    render(<QuickActions actions={mockActions} />);

    expect(screen.getByText('快速操作')).toBeInTheDocument();
    expect(screen.getByText('新建案件')).toBeInTheDocument();
    expect(screen.getByText('新建客户')).toBeInTheDocument();
  });

  it('应该渲染空状态', () => {
    render(<QuickActions actions={[]} />);

    expect(screen.getByText('快速操作')).toBeInTheDocument();
  });
});

describe('RecentActivities 组件', () => {
  it('应该渲染近期活动列表', () => {
    const mockActivities: RecentActivityType[] = [
      {
        id: '1',
        type: 'case',
        title: '案件状态更新',
        description: '案件已进入庭审阶段',
        time: '2小时前',
        link: '/cases/1',
      },
      {
        id: '2',
        type: 'client',
        title: '新客户',
        description: '已创建客户档案',
        time: '5小时前',
        link: '/clients/1',
      },
    ];

    render(<RecentActivities activities={mockActivities} />);

    expect(screen.getByText('近期活动')).toBeInTheDocument();
    expect(screen.getByText('案件状态更新')).toBeInTheDocument();
    expect(screen.getByText('新客户')).toBeInTheDocument();
    expect(screen.getByText('案件已进入庭审阶段')).toBeInTheDocument();
    expect(screen.getByText('已创建客户档案')).toBeInTheDocument();
  });

  it('应该渲染空状态', () => {
    render(<RecentActivities activities={[]} />);

    expect(screen.getByText('近期活动')).toBeInTheDocument();
    expect(screen.getByText('暂无近期活动')).toBeInTheDocument();
  });
});

describe('FeatureModules 组件', () => {
  it('应该渲染功能模块卡片', () => {
    const mockModules: FeatureModuleType[] = [
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
    ];

    render(<FeatureModules modules={mockModules} />);

    expect(screen.getByText('客户关系管理')).toBeInTheDocument();
    expect(screen.getByText('案件管理')).toBeInTheDocument();
    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(
      screen.getByText('管理客户档案、沟通记录、跟进任务')
    ).toBeInTheDocument();
  });

  it('应该渲染空状态', () => {
    const { container } = render(<FeatureModules modules={[]} />);

    expect(container.firstChild).toBeTruthy();
  });
});
