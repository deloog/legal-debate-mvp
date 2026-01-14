/**
 * UserStatsCards组件单元测试
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { StatsSummary, StatCard } from '@/components/admin/UserStatsCards';

describe('StatCard', () => {
  it('应该正确渲染卡片标题和值', () => {
    render(<StatCard title='总用户数' value={100} unit='人' />);

    expect(screen.getByText('总用户数')).toBeInTheDocument();
    expect(screen.getByText('100 人')).toBeInTheDocument();
  });

  it('应该显示正增长趋势', () => {
    render(<StatCard title='新增用户' value={50} trend={10.5} />);

    expect(screen.getByText('新增用户')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('+10.5% 增长率')).toBeInTheDocument();
  });

  it('应该显示负增长趋势', () => {
    render(<StatCard title='新增用户' value={50} trend={-5.2} />);

    expect(screen.getByText('-5.2% 增长率')).toBeInTheDocument();
  });

  it('应该自定义trendLabel', () => {
    render(
      <StatCard title='活跃用户' value={30} trend={15} trendLabel='活跃率' />
    );

    expect(screen.getByText('+15.0% 活跃率')).toBeInTheDocument();
  });

  it('当trend未定义时不显示趋势', () => {
    render(<StatCard title='总用户数' value={100} />);

    const trendElement = screen.queryByText('%');
    expect(trendElement).not.toBeInTheDocument();
  });

  it('应该正确格式化大数字', () => {
    render(<StatCard title='总用户数' value={1234567} />);

    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });
});

describe('StatsSummary', () => {
  const defaultProps = {
    totalUsers: 1000,
    newUsers: 100,
    growthRate: 10,
    averageDaily: 3,
  };

  it('应该渲染四个统计卡片', () => {
    render(<StatsSummary {...defaultProps} />);

    expect(screen.getByText('总用户数')).toBeInTheDocument();
    expect(screen.getByText('新增用户')).toBeInTheDocument();
    expect(screen.getByText('日均新增')).toBeInTheDocument();
    expect(screen.getByText('平均登录频率')).toBeInTheDocument();
  });

  it('应该显示总用户数', () => {
    render(<StatsSummary {...defaultProps} />);

    expect(screen.getByText('1,000 人')).toBeInTheDocument();
  });

  it('应该显示新增用户和增长率', () => {
    render(<StatsSummary {...defaultProps} />);

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('+10.0% 增长率')).toBeInTheDocument();
  });

  it('应该显示日均新增用户', () => {
    render(<StatsSummary {...defaultProps} />);

    expect(screen.getByText('3 人')).toBeInTheDocument();
  });

  it('应该显示平均登录频率', () => {
    render(<StatsSummary {...defaultProps} avgLoginFrequency={2.5} />);

    expect(screen.getByText('2.5 次/周')).toBeInTheDocument();
  });

  it('当提供activeUsers和activeRate时显示活跃用户', () => {
    render(
      <StatsSummary {...defaultProps} activeUsers={500} activeRate={50} />
    );

    expect(screen.getByText('活跃用户')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('+50.0% 活跃率')).toBeInTheDocument();
  });

  it('当提供activeUsers时不显示平均登录频率', () => {
    render(
      <StatsSummary
        {...defaultProps}
        activeUsers={500}
        activeRate={50}
        avgLoginFrequency={2.5}
      />
    );

    expect(screen.queryByText('平均登录频率')).not.toBeInTheDocument();
  });

  it('当activeUsers为undefined时显示平均登录频率', () => {
    render(<StatsSummary {...defaultProps} avgLoginFrequency={2.5} />);

    expect(screen.getByText('平均登录频率')).toBeInTheDocument();
    expect(screen.getByText('2.5 次/周')).toBeInTheDocument();
  });

  it('当avgLoginFrequency为undefined时显示0', () => {
    render(<StatsSummary {...defaultProps} />);

    expect(screen.getByText('0 次/周')).toBeInTheDocument();
  });

  it('应该正确处理负增长率', () => {
    render(<StatsSummary {...defaultProps} growthRate={-5} />);

    expect(screen.getByText('-5.0% 增长率')).toBeInTheDocument();
  });

  it('应该正确处理零增长率', () => {
    render(<StatsSummary {...defaultProps} growthRate={0} />);

    expect(screen.getByText('0.0% 增长率')).toBeInTheDocument();
  });

  it('应该正确格式化大数值', () => {
    render(
      <StatsSummary
        totalUsers={1000000}
        newUsers={100000}
        growthRate={20}
        averageDaily={333}
      />
    );

    expect(screen.getByText('1,000,000 人')).toBeInTheDocument();
    expect(screen.getByText('100,000')).toBeInTheDocument();
    expect(screen.getByText('333 人')).toBeInTheDocument();
  });
});
