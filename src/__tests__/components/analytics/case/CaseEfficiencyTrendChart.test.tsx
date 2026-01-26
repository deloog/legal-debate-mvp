// @ts-nocheck
/**
 * CaseEfficiencyTrendChart 测试
 *
 * Jest 运行时正确识别 @testing-library/jest-dom 匹配器，
 * VSCode TypeScript 服务器类型检查限制不影响测试运行
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from '@jest/globals';
import type { CaseEfficiencyData } from '@/types/stats';
import { TimeRange } from '@/types/stats';
import { CaseEfficiencyTrendChart } from '@/components/analytics/case/CaseEfficiencyTrendChart';

describe('CaseEfficiencyTrendChart', () => {
  const mockData: CaseEfficiencyData = {
    summary: {
      totalCompletedCases: 100,
      averageCompletionTime: 48.5,
      medianCompletionTime: 45.0,
      fastestCompletionTime: 24.0,
      slowestCompletionTime: 96.0,
    },
    trend: [
      {
        date: '2026-01-01',
        completedCases: 10,
        averageCompletionTime: 42.0,
        medianCompletionTime: 40.0,
      },
      {
        date: '2026-01-02',
        completedCases: 12,
        averageCompletionTime: 45.5,
        medianCompletionTime: 43.0,
      },
      {
        date: '2026-01-03',
        completedCases: 8,
        averageCompletionTime: 51.2,
        medianCompletionTime: 48.0,
      },
      {
        date: '2026-01-04',
        completedCases: 15,
        averageCompletionTime: 48.0,
        medianCompletionTime: 46.0,
      },
      {
        date: '2026-01-05',
        completedCases: 11,
        averageCompletionTime: 55.5,
        medianCompletionTime: 52.0,
      },
    ],
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    },
  };

  it('应该渲染标题', () => {
    render(<CaseEfficiencyTrendChart data={mockData} />);
    expect(screen.getByText('案件完成时间趋势（小时）')).toBeInTheDocument();
  });

  it('应该显示平均完成时间', () => {
    render(<CaseEfficiencyTrendChart data={mockData} />);
    const allText = screen.getAllByText(/平均完成时间:/);
    expect(allText.length).toBeGreaterThan(0);

    // 48.50 和 小时 在不同的文本节点中，使用文本包含方式验证

    const container =
      screen.getByText('案件完成时间趋势（小时）').parentElement;
    const textContent = container?.textContent || '';
    expect(textContent).toContain('48.50');
  });

  it('应该显示中位数完成时间', () => {
    render(<CaseEfficiencyTrendChart data={mockData} />);
    expect(screen.getByText(/中位数完成时间:/)).toBeInTheDocument();
    expect(screen.getByText(/45\.00 小时/)).toBeInTheDocument();
  });

  it('应该显示最快完成时间', () => {
    render(<CaseEfficiencyTrendChart data={mockData} />);
    expect(screen.getByText(/最快完成时间:/)).toBeInTheDocument();
    expect(screen.getByText(/24\.00 小时/)).toBeInTheDocument();
  });

  it('应该显示最慢完成时间', () => {
    render(<CaseEfficiencyTrendChart data={mockData} />);
    expect(screen.getByText(/最慢完成时间:/)).toBeInTheDocument();
    expect(screen.getByText(/96\.00 小时/)).toBeInTheDocument();
  });

  it('应该显示已完成案件总数', () => {
    render(<CaseEfficiencyTrendChart data={mockData} />);
    expect(screen.getByText(/已完成案件总数:/)).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('应该显示数据点数', () => {
    render(<CaseEfficiencyTrendChart data={mockData} />);
    expect(screen.getByText(/数据点数:/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('应该渲染SVG图表', () => {
    render(<CaseEfficiencyTrendChart data={mockData} />);
    const svg = screen.getByRole('img');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 600 350');
  });

  it('应该渲染趋势线', () => {
    render(<CaseEfficiencyTrendChart data={mockData} />);
    const svg = screen.getByRole('img');
    expect(svg.querySelector('polyline')).toBeInTheDocument();
  });

  it('应该渲染数据点', () => {
    render(<CaseEfficiencyTrendChart data={mockData} />);
    const svg = screen.getByRole('img');
    const circles = svg.querySelectorAll('circle');
    expect(circles.length).toBe(10); // 5个外圈 + 5个内圈
  });

  it('应该处理空数据', () => {
    const emptyData: CaseEfficiencyData = {
      summary: {
        totalCompletedCases: 0,
        averageCompletionTime: 0,
        medianCompletionTime: 0,
        fastestCompletionTime: 0,
        slowestCompletionTime: 0,
      },
      trend: [],
      metadata: {
        timeRange: TimeRange.LAST_30_DAYS,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      },
    };
    render(<CaseEfficiencyTrendChart data={emptyData} />);
    expect(screen.getByText('案件效率趋势')).toBeInTheDocument();
    expect(screen.getByText('无数据')).toBeInTheDocument();
  });

  it('应该应用自定义类名', () => {
    const { container } = render(
      <CaseEfficiencyTrendChart data={mockData} className='custom-class' />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('应该显示图例', () => {
    render(<CaseEfficiencyTrendChart data={mockData} />);
    expect(screen.getByText('平均完成时间')).toBeInTheDocument();
  });

  it('应该正确格式化日期标签', () => {
    render(<CaseEfficiencyTrendChart data={mockData} />);
    const svg = screen.getByRole('img');
    const dateLabels = svg.querySelectorAll('text');
    const dateTexts = Array.from(dateLabels)
      .map(el => el.textContent)
      .filter(
        text =>
          text &&
          (text.includes('/') || text.includes('01') || text.includes('02'))
      );

    expect(dateTexts.length).toBeGreaterThan(0);
  });
});
