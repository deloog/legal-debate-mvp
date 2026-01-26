/**
 * useResizeObserver Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import {
  useResizeObserver,
  useChartDimensions,
  useBreakpoint,
} from '@/components/analytics/hooks/useResizeObserver';

describe('useResizeObserver', () => {
  beforeEach(() => {
    // Mock ResizeObserver
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('应该正确初始化状态', () => {
    const { result } = renderHook(() => useResizeObserver());
    expect(result.current).toBeNull();
  });

  it('应该监听元素大小变化', () => {
    const mockElement = document.createElement('div');
    const { result } = renderHook(() =>
      useResizeObserver({ element: { current: mockElement } })
    );

    const resizeObserverInstance = (global.ResizeObserver as jest.Mock).mock
      .calls[0][0];

    act(() => {
      resizeObserverInstance([
        {
          target: mockElement,
          contentRect: { width: 400, height: 300 },
        } as unknown as ResizeObserverEntry,
      ]);
    });

    expect(result.current).toEqual({ width: 400, height: 300 });
  });

  it('应该在enabled=false时不启用监听', () => {
    const { result } = renderHook(() => useResizeObserver({ enabled: false }));

    expect(global.ResizeObserver).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('应该在组件卸载时断开连接', () => {
    const mockDisconnect = jest.fn();
    (global.ResizeObserver as jest.Mock).mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: mockDisconnect,
    }));

    const mockElement = document.createElement('div');
    const { unmount } = renderHook(() =>
      useResizeObserver({ element: { current: mockElement } })
    );

    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});

describe('useChartDimensions', () => {
  it('应该返回默认值', () => {
    const { result } = renderHook(() => useChartDimensions());
    expect(result.current).toEqual({ width: 400, height: 300 });
  });

  it('应该在元素大小变化时更新尺寸', () => {
    const mockElement = document.createElement('div');
    const { result } = renderHook(() =>
      useChartDimensions({ element: { current: mockElement } })
    );

    const resizeObserverInstance = (global.ResizeObserver as jest.Mock).mock
      .calls[0][0];

    act(() => {
      resizeObserverInstance([
        {
          target: mockElement,
          contentRect: { width: 500, height: 250 },
        } as unknown as ResizeObserverEntry,
      ]);
    });

    expect(result.current).toEqual({ width: 500, height: 250 });
  });

  it('应该应用最小和最大限制', () => {
    const mockElement = document.createElement('div');
    const { result } = renderHook(() =>
      useChartDimensions({
        element: { current: mockElement },
        minWidth: 300,
        maxWidth: 600,
        minHeight: 200,
        maxHeight: 400,
      })
    );

    const resizeObserverInstance = (global.ResizeObserver as jest.Mock).mock
      .calls[0][0];

    act(() => {
      resizeObserverInstance([
        {
          target: mockElement,
          contentRect: { width: 1000, height: 800 }, // 超出最大值
        } as unknown as ResizeObserverEntry,
      ]);
    });

    expect(result.current).toEqual({ width: 600, height: 400 });

    act(() => {
      resizeObserverInstance([
        {
          target: mockElement,
          contentRect: { width: 100, height: 50 }, // 小于最小值
        } as unknown as ResizeObserverEntry,
      ]);
    });

    expect(result.current).toEqual({ width: 300, height: 200 });
  });
});

describe('useBreakpoint', () => {
  beforeEach(() => {
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('应该正确识别当前断点', () => {
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('lg');
  });

  it('应该在窗口大小变化时更新断点', () => {
    const { result } = renderHook(() => useBreakpoint());

    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        value: 768,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe('md');

    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        value: 640,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe('sm');
  });

  it('应该在组件卸载时移除监听器', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useBreakpoint());

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
  });
});
