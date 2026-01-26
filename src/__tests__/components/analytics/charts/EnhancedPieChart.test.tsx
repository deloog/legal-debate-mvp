/**
 * EnhancedPieChart 测试
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EnhancedPieChart } from '@/components/analytics/charts/EnhancedPieChart';

describe('EnhancedPieChart', () => {
  const mockData = [
    { label: 'A', value: 10 },
    { label: 'B', value: 20 },
    { label: 'C', value: 30 },
  ];

  it('应该渲染图表', () => {
    const { container } = render(<EnhancedPieChart data={mockData} />);
    expect(container.querySelector('.enhanced-pie-chart')).toBeInTheDocument();
  });

  it('应该显示空状态', () => {
    render(<EnhancedPieChart data={[]} />);
    expect(screen.getByText('无数据')).toBeInTheDocument();
  });

  it('应该显示图例', () => {
    const { container } = render(
      <EnhancedPieChart data={mockData} showLegend={true} />
    );
    expect(container.querySelector('.chart-legend')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('应该支持点击扇区', () => {
    const onSliceClick = jest.fn();
    const { container } = render(
      <EnhancedPieChart data={mockData} onSliceClick={onSliceClick} />
    );

    const slices = container.querySelectorAll('.pie-slice-group > path');
    fireEvent.click(slices[0]);

    expect(onSliceClick).toHaveBeenCalledWith(mockData[0], 0);
  });

  it('应该支持悬停扇区', () => {
    const onSliceHover = jest.fn();
    const { container } = render(
      <EnhancedPieChart data={mockData} onSliceHover={onSliceHover} />
    );

    const slices = container.querySelectorAll('.pie-slice-group > path');
    fireEvent.mouseEnter(slices[0]);

    expect(onSliceHover).toHaveBeenCalledWith(mockData[0], 0);
  });

  it('应该支持标签配置', () => {
    const { container } = render(
      <EnhancedPieChart data={mockData} showLabels={true} showValues={true} />
    );

    expect(container.querySelector('text')).toBeInTheDocument();
  });

  it('应该支持自定义颜色', () => {
    const customColors = ['#ff0000', '#00ff00', '#0000ff'];
    const { container } = render(
      <EnhancedPieChart data={mockData} colors={customColors} />
    );

    const slices = container.querySelectorAll('.pie-slice-group > path');
    expect(slices.length).toBe(3);
  });

  it('应该支持自定义类名', () => {
    const { container } = render(
      <EnhancedPieChart data={mockData} className='custom-class' />
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('应该显示图例中的百分比', () => {
    const { container } = render(
      <EnhancedPieChart data={mockData} showLegend={true} />
    );
    const legend = container.querySelector('.chart-legend');
    expect(legend?.textContent).toContain('16.7%');
    expect(legend?.textContent).toContain('33.3%');
    expect(legend?.textContent).toContain('50.0%');
  });
});
