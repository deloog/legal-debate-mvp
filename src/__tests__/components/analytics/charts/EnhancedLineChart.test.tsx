/**
 * EnhancedLineChart 测试
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EnhancedLineChart } from '@/components/analytics/charts/EnhancedLineChart';

describe('EnhancedLineChart', () => {
  const mockData = [
    {
      title: '系列1',
      data: [
        { label: '1月', value: 10 },
        { label: '2月', value: 20 },
        { label: '3月', value: 30 },
      ],
      color: '#3b82f6',
    },
    {
      title: '系列2',
      data: [
        { label: '1月', value: 15 },
        { label: '2月', value: 25 },
        { label: '3月', value: 35 },
      ],
      color: '#ef4444',
    },
  ];

  it('应该渲染图表', () => {
    const { container } = render(<EnhancedLineChart data={mockData} />);
    expect(container.querySelector('.enhanced-line-chart')).toBeInTheDocument();
  });

  it('应该显示空状态', () => {
    render(<EnhancedLineChart data={[]} />);
    expect(screen.getByText('无数据')).toBeInTheDocument();
  });

  it('应该显示图例', () => {
    const { container } = render(
      <EnhancedLineChart data={mockData} showLegend={true} />
    );
    expect(container.querySelector('.chart-legend')).toBeInTheDocument();
    expect(screen.getByText('系列1')).toBeInTheDocument();
    expect(screen.getByText('系列2')).toBeInTheDocument();
  });

  it('应该支持点击图例切换系列', () => {
    const onSeriesToggle = jest.fn();
    const { container } = render(
      <EnhancedLineChart data={mockData} onSeriesToggle={onSeriesToggle} />
    );

    const legendItems = container.querySelectorAll('.chart-legend > div');
    fireEvent.click(legendItems[0]);

    expect(onSeriesToggle).toHaveBeenCalledWith(0, false);
  });

  it('应该支持悬停数据点', () => {
    const { container } = render(<EnhancedLineChart data={mockData} />);

    const points = container.querySelectorAll('.line-point');
    fireEvent.mouseEnter(points[0]);

    expect(points[0]).toBeInTheDocument();
  });

  it('应该支持点击数据点', () => {
    const onPointClick = jest.fn();
    const { container } = render(
      <EnhancedLineChart data={mockData} onPointClick={onPointClick} />
    );

    const points = container.querySelectorAll('.line-point');
    fireEvent.click(points[0]);

    expect(onPointClick).toHaveBeenCalledWith(mockData[0].data[0], 0);
  });

  it('应该支持标签配置', () => {
    const { container } = render(
      <EnhancedLineChart
        data={mockData}
        labelConfig={{ showLabels: true, showValues: true }}
      />
    );

    expect(container.querySelector('text')).toBeInTheDocument();
  });

  it('应该支持自定义类名', () => {
    const { container } = render(
      <EnhancedLineChart data={mockData} className='custom-class' />
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
