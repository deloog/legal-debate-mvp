/**
 * EnhancedFunnelChart 测试
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EnhancedFunnelChart } from '@/components/analytics/charts/EnhancedFunnelChart';

describe('EnhancedFunnelChart', () => {
  const mockData = [
    { label: '阶段1', count: 100, percentage: 100 },
    { label: '阶段2', count: 80, percentage: 80 },
    { label: '阶段3', count: 60, percentage: 60 },
  ];

  it('应该渲染图表', () => {
    const { container } = render(<EnhancedFunnelChart data={mockData} />);
    expect(
      container.querySelector('.enhanced-funnel-chart')
    ).toBeInTheDocument();
  });

  it('应该显示空状态', () => {
    render(<EnhancedFunnelChart data={[]} />);
    expect(screen.getByText('无数据')).toBeInTheDocument();
  });

  it('应该显示图例', () => {
    const { container } = render(
      <EnhancedFunnelChart data={mockData} showLegend={true} />
    );
    const legend = container.querySelector('.chart-legend');
    expect(legend).toBeInTheDocument();
    expect(legend?.textContent).toContain('阶段1');
    expect(legend?.textContent).toContain('阶段2');
    expect(legend?.textContent).toContain('阶段3');
  });

  it('应该支持点击层级', () => {
    const onStageClick = jest.fn();
    const { container } = render(
      <EnhancedFunnelChart data={mockData} onStageClick={onStageClick} />
    );

    const stages = container.querySelectorAll('.funnel-stage-group > path');
    fireEvent.click(stages[0]);

    expect(onStageClick).toHaveBeenCalledWith(mockData[0], 0);
  });

  it('应该支持悬停层级', () => {
    const onStageHover = jest.fn();
    const { container } = render(
      <EnhancedFunnelChart data={mockData} onStageHover={onStageHover} />
    );

    const stages = container.querySelectorAll('.funnel-stage-group > path');
    fireEvent.mouseEnter(stages[0]);

    expect(onStageHover).toHaveBeenCalledWith(mockData[0], 0);
  });

  it('应该支持标签配置', () => {
    const { container } = render(
      <EnhancedFunnelChart
        data={mockData}
        showLabels={true}
        showValues={true}
      />
    );

    expect(container.querySelector('text')).toBeInTheDocument();
  });

  it('应该支持自定义颜色', () => {
    const customColors = ['#ff0000', '#00ff00', '#0000ff'];
    const { container } = render(
      <EnhancedFunnelChart data={mockData} colors={customColors} />
    );

    const stages = container.querySelectorAll('.funnel-stage-group > path');
    expect(stages.length).toBe(3);
  });

  it('应该支持自定义类名', () => {
    const { container } = render(
      <EnhancedFunnelChart data={mockData} className='custom-class' />
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('应该显示图例中的转化率', () => {
    const { container } = render(
      <EnhancedFunnelChart data={mockData} showLegend={true} />
    );
    const legend = container.querySelector('.chart-legend');
    expect(legend?.textContent).toContain('转化率: 80.0%');
    expect(legend?.textContent).toContain('整体转化: 80.0%');
    expect(legend?.textContent).toContain('整体转化: 60.0%');
  });

  it('应该显示图例中的数值', () => {
    const { container } = render(
      <EnhancedFunnelChart data={mockData} showLegend={true} />
    );
    const legend = container.querySelector('.chart-legend');
    expect(legend?.textContent).toContain('数值: 100');
    expect(legend?.textContent).toContain('数值: 80');
    expect(legend?.textContent).toContain('数值: 60');
  });
});
