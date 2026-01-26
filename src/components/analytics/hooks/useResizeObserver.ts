/**
 * Resize Observer Hook
 * 用于监听容器大小变化，实现响应式图表
 */

import { useState, useEffect, useRef } from 'react';

interface ResizeObserverOptions {
  element?: React.RefObject<Element>;
  enabled?: boolean;
}

interface ResizeObserverSize {
  width: number;
  height: number;
}

export function useResizeObserver({
  element,
  enabled = true,
}: ResizeObserverOptions = {}): ResizeObserverSize | null {
  const [size, setSize] = useState<ResizeObserverSize | null>(null);
  const targetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const targetElement = element?.current || targetRef.current;
    if (!targetElement) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });

    observer.observe(targetElement);

    return () => {
      observer.disconnect();
    };
  }, [element, enabled]);

  return size;
}

/**
 * 用于获取合适的图表尺寸
 */
export function useChartDimensions({
  element,
  enabled = true,
  baseWidth = 400,
  baseHeight = 300,
  minWidth = 200,
  minHeight = 150,
  maxWidth = 800,
  maxHeight = 600,
}: {
  element?: React.RefObject<Element>;
  enabled?: boolean;
  baseWidth?: number;
  baseHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
} = {}) {
  const observedSize = useResizeObserver({ element, enabled });

  const width = Math.min(
    Math.max(observedSize?.width || baseWidth, minWidth),
    maxWidth
  );
  const height = Math.min(
    Math.max(observedSize?.height || baseHeight, minHeight),
    maxHeight
  );

  return { width, height };
}

/**
 * 响应式断点配置
 */
export interface ResponsiveBreakpoints {
  xs: number; // 0px
  sm: number; // 640px
  md: number; // 768px
  lg: number; // 1024px
  xl: number; // 1280px
  '2xl': number; // 1536px
}

export const DEFAULT_BREAKPOINTS: ResponsiveBreakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

/**
 * 获取当前断点
 */
export function useBreakpoint(
  breakpoints: ResponsiveBreakpoints = DEFAULT_BREAKPOINTS
): keyof ResponsiveBreakpoints | null {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<
    keyof ResponsiveBreakpoints | null
  >(null);

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;

      if (width >= breakpoints['2xl']) {
        setCurrentBreakpoint('2xl');
      } else if (width >= breakpoints.xl) {
        setCurrentBreakpoint('xl');
      } else if (width >= breakpoints.lg) {
        setCurrentBreakpoint('lg');
      } else if (width >= breakpoints.md) {
        setCurrentBreakpoint('md');
      } else if (width >= breakpoints.sm) {
        setCurrentBreakpoint('sm');
      } else {
        setCurrentBreakpoint('xs');
      }
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);

    return () => {
      window.removeEventListener('resize', updateBreakpoint);
    };
  }, [breakpoints]);

  return currentBreakpoint;
}

/**
 * 根据断点获取图表配置
 */
export function useResponsiveChartConfig() {
  const breakpoint = useBreakpoint();

  const getConfig = () => {
    switch (breakpoint) {
      case 'xs':
        return {
          baseWidth: 280,
          baseHeight: 200,
          fontSize: 10,
          showLabels: true,
          showValues: false,
          padding: { top: 10, right: 10, bottom: 20, left: 30 },
        };
      case 'sm':
        return {
          baseWidth: 400,
          baseHeight: 250,
          fontSize: 11,
          showLabels: true,
          showValues: false,
          padding: { top: 15, right: 15, bottom: 30, left: 40 },
        };
      case 'md':
        return {
          baseWidth: 500,
          baseHeight: 300,
          fontSize: 12,
          showLabels: true,
          showValues: true,
          padding: { top: 20, right: 20, bottom: 40, left: 50 },
        };
      case 'lg':
      case 'xl':
      case '2xl':
      default:
        return {
          baseWidth: 600,
          baseHeight: 350,
          fontSize: 12,
          showLabels: true,
          showValues: true,
          padding: { top: 20, right: 20, bottom: 40, left: 50 },
        };
    }
  };

  return getConfig();
}
