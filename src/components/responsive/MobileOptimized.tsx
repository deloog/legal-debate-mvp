'use client';

/**
 * 移动端优化组件
 *
 * 提供移动端适配的工具组件和hooks
 */

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from 'react';

/**
 * 屏幕尺寸断点
 */
export const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * 设备类型
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * 响应式上下文
 */
interface ResponsiveContextType {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
}

const ResponsiveContext = createContext<ResponsiveContextType | null>(null);

/**
 * 获取当前断点
 */
function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

/**
 * 获取设备类型
 */
function getDeviceType(width: number): DeviceType {
  if (width < BREAKPOINTS.md) return 'mobile';
  if (width < BREAKPOINTS.lg) return 'tablet';
  return 'desktop';
}

/**
 * 响应式提供者
 */
export function ResponsiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ResponsiveContextType>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    breakpoint: 'lg',
    deviceType: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    orientation: 'landscape',
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const breakpoint = getBreakpoint(width);
      const deviceType = getDeviceType(width);

      setState({
        width,
        height,
        breakpoint,
        deviceType,
        isMobile: deviceType === 'mobile',
        isTablet: deviceType === 'tablet',
        isDesktop: deviceType === 'desktop',
        orientation: width > height ? 'landscape' : 'portrait',
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <ResponsiveContext.Provider value={state}>
      {children}
    </ResponsiveContext.Provider>
  );
}

/**
 * 响应式hook
 */
export function useResponsive() {
  const context = useContext(ResponsiveContext);
  if (!context) {
    // 如果没有 Provider，返回默认值
    return {
      width: typeof window !== 'undefined' ? window.innerWidth : 1024,
      height: typeof window !== 'undefined' ? window.innerHeight : 768,
      breakpoint: 'lg' as Breakpoint,
      deviceType: 'desktop' as DeviceType,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      orientation: 'landscape' as const,
    };
  }
  return context;
}

/**
 * 断点查询hook
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  const { width } = useResponsive();
  return width >= BREAKPOINTS[breakpoint];
}

/**
 * 媒体查询hook
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * 移动端隐藏组件
 */
export function HideOnMobile({ children }: { children: ReactNode }) {
  const { isMobile } = useResponsive();
  if (isMobile) return null;
  return <>{children}</>;
}

/**
 * 仅移动端显示组件
 */
export function ShowOnMobile({ children }: { children: ReactNode }) {
  const { isMobile } = useResponsive();
  if (!isMobile) return null;
  return <>{children}</>;
}

/**
 * 响应式容器
 * 根据屏幕尺寸自动调整padding
 */
export function ResponsiveContainer({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}

/**
 * 移动端底部导航
 */
interface MobileNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
}

export function MobileBottomNav({
  items,
  activeId,
  onItemClick,
}: {
  items: MobileNavItem[];
  activeId?: string;
  onItemClick?: (id: string) => void;
}) {
  const { isMobile } = useResponsive();

  if (!isMobile) return null;

  return (
    <nav className='fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 safe-area-inset-bottom'>
      <div className='flex items-center justify-around h-16 px-2'>
        {items.map(item => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              onClick={() => {
                item.onClick?.();
                onItemClick?.(item.id);
              }}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <div
                className={`${isActive ? 'scale-110' : ''} transition-transform`}
              >
                {item.icon}
              </div>
              <span className='text-xs mt-1 font-medium'>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * 移动端下拉刷新
 */
export function PullToRefresh({
  children,
  onRefresh,
  refreshing = false,
}: {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  refreshing?: boolean;
}) {
  const [pulling, setPulling] = useState(false);
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling) return;
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, (currentY - startY) * 0.5);
      setPullDistance(Math.min(distance, 100));
    },
    [pulling, startY]
  );

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= 60 && !refreshing) {
      await onRefresh();
    }
    setPulling(false);
    setPullDistance(0);
  }, [pullDistance, refreshing, onRefresh]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ transform: `translateY(${pullDistance}px)` }}
      className='transition-transform'
    >
      {/* 刷新指示器 */}
      {pullDistance > 0 && (
        <div
          className='flex items-center justify-center absolute left-0 right-0 -top-12'
          style={{ opacity: pullDistance / 60 }}
        >
          <div
            className={`h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent ${
              refreshing ? 'animate-spin' : ''
            }`}
            style={{
              transform: `rotate(${(pullDistance / 100) * 360}deg)`,
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * 触摸滑动组件
 */
export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
}: {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    setOffset(Math.max(-100, Math.min(100, diff)));
  };

  const handleTouchEnd = () => {
    if (offset > 50) {
      onSwipeRight?.();
    } else if (offset < -50) {
      onSwipeLeft?.();
    }
    setOffset(0);
    setIsSwiping(false);
  };

  return (
    <div className='relative overflow-hidden'>
      {/* 左侧操作区 */}
      {leftAction && (
        <div
          className='absolute left-0 top-0 bottom-0 flex items-center justify-center bg-green-500 text-white'
          style={{ width: Math.max(0, offset) }}
        >
          {leftAction}
        </div>
      )}

      {/* 右侧操作区 */}
      {rightAction && (
        <div
          className='absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-500 text-white'
          style={{ width: Math.max(0, -offset) }}
        >
          {rightAction}
        </div>
      )}

      {/* 内容 */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${offset}px)` }}
        className='transition-transform bg-white dark:bg-zinc-900'
      >
        {children}
      </div>
    </div>
  );
}

/**
 * 移动端安全区域padding
 */
export function SafeAreaView({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`pt-safe-top pb-safe-bottom pl-safe-left pr-safe-right ${className}`}
    >
      {children}
    </div>
  );
}

export default ResponsiveProvider;
