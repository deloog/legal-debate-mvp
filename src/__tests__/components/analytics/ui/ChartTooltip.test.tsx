/**
 * ChartTooltip Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  ChartTooltip,
  SimpleTooltip,
  type TooltipData,
} from '@/components/analytics/ui/ChartTooltip';

describe('ChartTooltip', () => {
  const mockData: TooltipData[] = [
    { label: '客户A', value: 150, color: '#3b82f6', description: '高价值客户' },
    {
      label: '客户B',
      value: 85,
      color: '#10b981',
      description: '中等价值客户',
    },
  ];

  const mockPosition = { x: 100, y: 200 };

  it('应该渲染Tooltip当visible=true且有数据时', () => {
    render(
      <ChartTooltip data={mockData} position={mockPosition} visible={true} />
    );

    expect(screen.getByText('客户A')).toBeInTheDocument();
    expect(screen.getByText('客户B')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('应该渲染描述信息', () => {
    render(
      <ChartTooltip data={mockData} position={mockPosition} visible={true} />
    );

    expect(screen.getByText('高价值客户')).toBeInTheDocument();
    expect(screen.getByText('中等价值客户')).toBeInTheDocument();
  });

  it('应该在visible=false时隐藏', () => {
    render(
      <ChartTooltip data={mockData} position={mockPosition} visible={false} />
    );

    expect(screen.queryByText('客户A')).not.toBeInTheDocument();
  });

  it('应该在data为空时隐藏', () => {
    render(<ChartTooltip data={[]} position={mockPosition} visible={true} />);

    expect(screen.queryByText('客户A')).not.toBeInTheDocument();
  });

  it('应该正确设置位置', () => {
    const { container } = render(
      <ChartTooltip data={mockData} position={mockPosition} visible={true} />
    );

    const tooltip = container.firstElementChild as HTMLElement;
    expect(tooltip.style.left).toBe('110px'); // x + 10
    expect(tooltip.style.top).toBe('190px'); // y - 10
  });

  it('应该应用自定义类名', () => {
    const { container } = render(
      <ChartTooltip
        data={mockData}
        position={mockPosition}
        visible={true}
        className='custom-tooltip'
      />
    );

    expect(container.firstElementChild).toHaveClass('custom-tooltip');
  });
});

describe('SimpleTooltip', () => {
  const mockPosition = { x: 100, y: 200 };

  it('应该渲染简单的Tooltip内容', () => {
    render(
      <SimpleTooltip
        content='测试内容'
        position={mockPosition}
        visible={true}
      />
    );

    expect(screen.getByText('测试内容')).toBeInTheDocument();
  });

  it('应该渲染数字内容', () => {
    render(
      <SimpleTooltip content={123} position={mockPosition} visible={true} />
    );

    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('应该在visible=false时隐藏', () => {
    render(
      <SimpleTooltip
        content='测试内容'
        position={mockPosition}
        visible={false}
      />
    );

    expect(screen.queryByText('测试内容')).not.toBeInTheDocument();
  });

  it('应该正确设置位置', () => {
    const { container } = render(
      <SimpleTooltip
        content='测试内容'
        position={mockPosition}
        visible={true}
      />
    );

    const tooltip = container.firstElementChild as HTMLElement;
    expect(tooltip.style.left).toBe('105px'); // x + 5
    expect(tooltip.style.top).toBe('195px'); // y - 5
  });

  it('应该应用自定义类名', () => {
    const { container } = render(
      <SimpleTooltip
        content='测试内容'
        position={mockPosition}
        visible={true}
        className='custom-simple-tooltip'
      />
    );

    expect(container.firstElementChild).toHaveClass('custom-simple-tooltip');
  });

  it('应该渲染箭头', () => {
    const { container } = render(
      <SimpleTooltip
        content='测试内容'
        position={mockPosition}
        visible={true}
      />
    );

    const arrow = container.querySelector('.w-1.h-1.bg-gray-800');
    expect(arrow).toBeInTheDocument();
  });
});
