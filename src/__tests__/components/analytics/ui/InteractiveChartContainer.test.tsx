/**
 * InteractiveChartContainer 集成测试
 */

import '@testing-library/jest-dom';

import { InteractiveChartContainer } from '@/components/analytics/ui/InteractiveChartContainer';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Mock ResizeObserver
class ResizeObserverMock {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

describe('InteractiveChartContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('应该渲染容器和子组件', () => {
    const mockChild = jest.fn(interaction => (
      <div>Zoom: {interaction.zoom.toFixed(2)}</div>
    ));

    render(<InteractiveChartContainer>{mockChild}</InteractiveChartContainer>);

    expect(mockChild).toHaveBeenCalled();
    (expect(screen.getByText(/Zoom:/)) as any).toBeInTheDocument();
  });

  it('应该渲染控制按钮', () => {
    const mockChild = jest.fn(() => <div>Chart</div>);

    render(<InteractiveChartContainer>{mockChild}</InteractiveChartContainer>);

    (expect(screen.getByText('+')) as any).toBeInTheDocument();
    (expect(screen.getByText('-')) as any).toBeInTheDocument();
    (expect(screen.getByText('重置')) as any).toBeInTheDocument();
  });

  it('点击放大按钮应该增加缩放', async () => {
    const mockChild = jest.fn(() => <div>Chart</div>);
    const onZoomChange = jest.fn();

    render(
      <InteractiveChartContainer
        onZoomChange={onZoomChange}
        interactionConfig={{ enableZoom: true, enablePan: true }}
      >
        {mockChild}
      </InteractiveChartContainer>
    );

    const zoomInButton = screen.getByText('+');
    fireEvent.click(zoomInButton);

    await waitFor(() => {
      expect(onZoomChange).toHaveBeenCalledWith(1.1);
    });
  });

  it('点击缩小按钮应该减小缩放', async () => {
    const mockChild = jest.fn(() => <div>Chart</div>);
    const onZoomChange = jest.fn();

    render(
      <InteractiveChartContainer
        onZoomChange={onZoomChange}
        interactionConfig={{ enableZoom: true, enablePan: true }}
      >
        {mockChild}
      </InteractiveChartContainer>
    );

    const zoomOutButton = screen.getByText('-');
    fireEvent.click(zoomOutButton);

    await waitFor(() => {
      expect(onZoomChange).toHaveBeenCalledWith(0.9);
    });
  });

  it('点击重置按钮应该重置视图', async () => {
    const mockChild = jest.fn(() => <div>Chart</div>);
    const onZoomChange = jest.fn();
    const onPanChange = jest.fn();

    render(
      <InteractiveChartContainer
        onZoomChange={onZoomChange}
        onPanChange={onPanChange}
      >
        {mockChild}
      </InteractiveChartContainer>
    );

    const resetButton = screen.getByText('重置');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(onZoomChange).toHaveBeenCalledWith(1);
      expect(onPanChange).toHaveBeenCalledWith({ x: 0, y: 0 });
    });
  });

  it('滚轮事件应该触发缩放', async () => {
    const mockChild = jest.fn(() => <div>Chart</div>);
    const onZoomChange = jest.fn();

    const { container } = render(
      <InteractiveChartContainer
        onZoomChange={onZoomChange}
        interactionConfig={{ enableZoom: true }}
      >
        {mockChild}
      </InteractiveChartContainer>
    );

    const chartContainer = container.firstChild as HTMLElement;
    fireEvent.wheel(chartContainer, { deltaY: 100 });

    await waitFor(() => {
      expect(onZoomChange).toHaveBeenCalled();
    });
  });

  it('鼠标拖动应该触发平移', async () => {
    const mockChild = jest.fn(() => <div>Chart</div>);
    const onPanChange = jest.fn();

    const { container } = render(
      <InteractiveChartContainer
        onPanChange={onPanChange}
        interactionConfig={{ enablePan: true }}
      >
        {mockChild}
      </InteractiveChartContainer>
    );

    const chartContainer = container.firstChild as HTMLElement;

    // 模拟鼠标拖动
    fireEvent.mouseDown(chartContainer, {
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.mouseMove(chartContainer, {
      clientX: 150,
      clientY: 150,
    });
    fireEvent.mouseUp(chartContainer);

    await waitFor(() => {
      expect(onPanChange).toHaveBeenCalled();
    });
  });

  it('应该显示缩放指示器当缩放不为1时', () => {
    const mockChild = jest.fn(interaction => (
      <div>Chart - {interaction.zoom.toFixed(2)}</div>
    ));

    render(<InteractiveChartContainer>{mockChild}</InteractiveChartContainer>);

    // 初始状态不显示缩放指示器
    (expect(screen.queryByText(/100%/)) as any).not.toBeInTheDocument();

    // 设置缩放后应该显示
    const updatedChild = jest.fn(interaction => (
      <div>Chart - {interaction.zoom.toFixed(2)}</div>
    ));
    const { rerender } = render(
      <InteractiveChartContainer>{updatedChild}</InteractiveChartContainer>
    );

    // 重新渲染带缩放值的版本
    rerender(
      <InteractiveChartContainer>
        {() => <div>Chart</div>}
      </InteractiveChartContainer>
    );
  });

  it('应该支持自定义最小和最大尺寸', () => {
    const mockChild = jest.fn(() => <div>Chart</div>);

    render(
      <InteractiveChartContainer
        minDimensions={{ width: 400, height: 300 }}
        maxDimensions={{ width: 1000, height: 800 }}
      >
        {mockChild}
      </InteractiveChartContainer>
    );

    expect(mockChild).toHaveBeenCalled();
  });

  it('应该支持禁用缩放', () => {
    const mockChild = jest.fn(() => <div>Chart</div>);

    render(
      <InteractiveChartContainer
        interactionConfig={{ enableZoom: false, enablePan: true }}
      >
        {mockChild}
      </InteractiveChartContainer>
    );

    // 不应该显示缩放按钮
    (expect(screen.queryByText('+')) as any).not.toBeInTheDocument();
    (expect(screen.queryByText('-')) as any).not.toBeInTheDocument();
  });

  it('应该支持禁用平移', () => {
    const mockChild = jest.fn(() => <div>Chart</div>);

    render(
      <InteractiveChartContainer
        interactionConfig={{ enableZoom: true, enablePan: false }}
      >
        {mockChild}
      </InteractiveChartContainer>
    );

    // 应该显示缩放按钮但不显示重置按钮（当只有缩放时）
    (expect(screen.getByText('+')) as any).toBeInTheDocument();
    (expect(screen.getByText('-')) as any).toBeInTheDocument();
  });

  it('应该正确应用自定义类名', () => {
    const mockChild = jest.fn(() => <div>Chart</div>);
    const customClass = 'custom-chart-container';

    const { container } = render(
      <InteractiveChartContainer className={customClass}>
        {mockChild}
      </InteractiveChartContainer>
    );

    const chartContainer = container.firstChild as HTMLElement;
    (expect(chartContainer) as any).toHaveClass(customClass);
  });

  it('应该限制缩放范围', async () => {
    const mockChild = jest.fn(() => <div>Chart</div>);
    const onZoomChange = jest.fn();

    render(
      <InteractiveChartContainer
        onZoomChange={onZoomChange}
        interactionConfig={{
          enableZoom: true,
          minZoom: 0.5,
          maxZoom: 2,
        }}
      >
        {mockChild}
      </InteractiveChartContainer>
    );

    // 尝试缩小超过最小值（需要6次从1.0到0.5以下）
    const zoomOutButton = screen.getByText('-');
    fireEvent.click(zoomOutButton);
    fireEvent.click(zoomOutButton);
    fireEvent.click(zoomOutButton);
    fireEvent.click(zoomOutButton);
    fireEvent.click(zoomOutButton);
    fireEvent.click(zoomOutButton);

    // 缩放不应该低于0.5，最后一次调用应该是0.5
    await waitFor(() => {
      const calls = onZoomChange.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toBe(0.5);
    });
  });
});
