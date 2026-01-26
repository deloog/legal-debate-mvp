/**
 * EnhancedBarChart 测试
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EnhancedBarChart } from '@/components/analytics/charts/EnhancedBarChart';

describe('EnhancedBarChart', () => {
  const mockData = [
    { label: 'A', value: 10 },
    { label: 'B', value: 20 },
    { label: 'C', value: 30 },
  ];

  it('应该渲染图表', () => {
    const { container } = render(<EnhancedBarChart data={mockData} />);
    expect(container.querySelector('.enhanced-bar-chart')).toBeInTheDocument();
  });

  it('应该显示空状态', () => {
    render(<EnhancedBarChart data={[]} />);
    expect(screen.getByText('无数据')).toBeInTheDocument();
  });

  it('应该支持悬停柱子', () => {
    const { container } = render(<EnhancedBarChart data={mockData} />);

    const bars = container.querySelectorAll('.bar-group > rect');
    fireEvent.mouseEnter(bars[0]);

    expect(bars[0]).toBeInTheDocument();
  });

  it('应该支持点击柱子', () => {
    const onBarClick = jest.fn();
    const { container } = render(
      <EnhancedBarChart data={mockData} onBarClick={onBarClick} />
    );

    const bars = container.querySelectorAll('.bar-group > rect');
    fireEvent.click(bars[0]);

    expect(onBarClick).toHaveBeenCalledWith(mockData[0], 0);
  });

  it('应该支持悬停回调', () => {
    const onBarHover = jest.fn();
    const { container } = render(
      <EnhancedBarChart data={mockData} onBarHover={onBarHover} />
    );

    const bars = container.querySelectorAll('.bar-group > rect');
    fireEvent.mouseEnter(bars[0]);

    expect(onBarHover).toHaveBeenCalledWith(mockData[0], 0);
  });

  it('应该支持标签配置', () => {
    const { container } = render(
      <EnhancedBarChart
        data={mockData}
        labelConfig={{ showLabels: true, showValues: true }}
      />
    );

    expect(container.querySelector('text')).toBeInTheDocument();
  });

  it('应该支持自定义颜色', () => {
    const { container } = render(
      <EnhancedBarChart
        data={mockData}
        barColor='#22c55e'
        hoverColor='#16a34a'
      />
    );

    const bars = container.querySelectorAll('.bar-group > rect');
    expect(bars.length).toBe(3);
  });

  it('应该支持自定义类名', () => {
    const { container } = render(
      <EnhancedBarChart data={mockData} className='custom-class' />
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('应该显示坐标轴', () => {
    const { container } = render(<EnhancedBarChart data={mockData} />);

    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});
