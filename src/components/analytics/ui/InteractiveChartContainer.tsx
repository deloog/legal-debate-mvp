/**
 * InteractiveChartContainer - 交互式图表容器组件
 * 集成响应式、缩放、拖动和Tooltip功能
 */

'use client';

import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useChartDimensions } from '@/components/analytics/hooks/useResizeObserver';

export interface InteractiveChartConfig {
  enableZoom?: boolean;
  enablePan?: boolean;
  enableTooltip?: boolean;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
}

export interface ChartInteraction {
  zoom: number;
  pan: { x: number; y: number };
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  resetView: () => void;
}

interface InteractiveChartContainerProps {
  children: (
    interaction: ChartInteraction,
    ...args: unknown[]
  ) => React.ReactNode;
  className?: string;
  minDimensions?: {
    width: number;
    height: number;
  };
  maxDimensions?: {
    width: number;
    height: number;
  };
  interactionConfig?: InteractiveChartConfig;
  onZoomChange?: (zoom: number) => void;
  onPanChange?: (pan: { x: number; y: number }) => void;
}

export function InteractiveChartContainer({
  children,
  className,
  minDimensions = { width: 300, height: 200 },
  maxDimensions = { width: 1200, height: 800 },
  interactionConfig = {
    enableZoom: true,
    enablePan: true,
    enableTooltip: true,
    minZoom: 0.5,
    maxZoom: 3,
    zoomStep: 0.1,
  },
  onZoomChange,
  onPanChange,
}: InteractiveChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const transitionEnabledRef = useRef(true);

  useChartDimensions({
    element: containerRef,
    baseWidth: minDimensions.width,
    baseHeight: minDimensions.height,
    maxWidth: maxDimensions.width,
    maxHeight: maxDimensions.height,
  });

  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // 缩放功能
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!interactionConfig.enableZoom) {
      return;
    }

    event.preventDefault();
    const zoomStep = interactionConfig.zoomStep || 0.1;
    const delta = event.deltaY > 0 ? -zoomStep : zoomStep;
    const newZoom = Math.max(
      interactionConfig.minZoom || 0.5,
      Math.min(interactionConfig.maxZoom || 3, zoom + delta)
    );

    setZoom(newZoom);
    onZoomChange?.(newZoom);
  };

  // 拖动功能
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!interactionConfig.enablePan || event.button !== 0) {
      return;
    }

    isDraggingRef.current = true;
    transitionEnabledRef.current = false;
    lastMousePosRef.current = { x: event.clientX, y: event.clientY };
    event.preventDefault();
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !interactionConfig.enablePan) {
      return;
    }

    const deltaX = event.clientX - lastMousePosRef.current.x;
    const deltaY = event.clientY - lastMousePosRef.current.y;

    const newPan = {
      x: pan.x + deltaX,
      y: pan.y + deltaY,
    };

    setPan(newPan);
    onPanChange?.(newPan);
    lastMousePosRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    transitionEnabledRef.current = true;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    transitionEnabledRef.current = true;
  };

  // 重置视图
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    onZoomChange?.(1);
    onPanChange?.({ x: 0, y: 0 });
  };

  const interaction: ChartInteraction = {
    zoom,
    pan,
    setZoom,
    setPan,
    resetView,
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden select-none',
        'cursor-grab active:cursor-grabbing',
        className
      )}
      style={{
        width: '100%',
        height: '100%',
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* 图表内容 */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: 'none',
        }}
      >
        {children(interaction)}
      </div>

      {/* 控制按钮 */}
      {(interactionConfig.enableZoom || interactionConfig.enablePan) && (
        <div
          className={cn(
            'absolute bottom-4 right-4',
            'flex flex-col gap-2',
            'bg-white dark:bg-gray-800',
            'rounded-lg shadow-lg',
            'p-2'
          )}
        >
          {interactionConfig.enableZoom && (
            <>
              <button
                type='button'
                onClick={() => {
                  const newZoom = Math.min(
                    interactionConfig.maxZoom || 3,
                    zoom + (interactionConfig.zoomStep || 0.1)
                  );
                  setZoom(newZoom);
                  onZoomChange?.(newZoom);
                }}
                className='px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-sm'
                aria-label='放大'
              >
                +
              </button>
              <button
                type='button'
                onClick={() => {
                  const newZoom = Math.max(
                    interactionConfig.minZoom || 0.5,
                    zoom - (interactionConfig.zoomStep || 0.1)
                  );
                  setZoom(newZoom);
                  onZoomChange?.(newZoom);
                }}
                className='px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-sm'
                aria-label='缩小'
              >
                -
              </button>
            </>
          )}
          <button
            type='button'
            onClick={resetView}
            className='px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-sm'
            aria-label='重置视图'
          >
            重置
          </button>
        </div>
      )}

      {/* 缩放指示器 */}
      {interactionConfig.enableZoom && zoom !== 1 && (
        <div
          className={cn(
            'absolute top-4 right-4',
            'bg-white dark:bg-gray-800',
            'px-3 py-1 rounded shadow-lg',
            'text-sm text-gray-600 dark:text-gray-400'
          )}
        >
          {(zoom * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}
