/**
 * 智能轮询 Hook - 用于案件讨论自动更新
 * 相比 WebSocket 更简单，资源消耗更低，适合 MVP 阶段
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseDiscussionPollingOptions {
  /** 轮询间隔（毫秒），默认 30 秒 */
  interval?: number;
  /** 是否启用轮询，默认 true */
  enabled?: boolean;
  /** 页面不可见时是否继续轮询，默认 false */
  pollWhenHidden?: boolean;
}

/**
 * 智能轮询 Hook
 *
 * 特性：
 * - 页面隐藏时自动暂停（节省资源）
 * - 页面重新可见时立即触发一次更新
 * - 用户操作后可手动触发更新
 * - 自动清理，避免内存泄漏
 *
 * @example
 * ```tsx
 * const { triggerUpdate } = useDiscussionPolling({
 *   interval: 30000, // 30秒
 *   enabled: true,
 *   onPoll: async () => {
 *     // 获取最新讨论
 *     await fetchDiscussions();
 *   }
 * });
 *
 * // 用户发送新讨论后立即刷新
 * const handleSendMessage = async () => {
 *   await sendMessage();
 *   triggerUpdate(); // 立即触发更新，不等待定时器
 * };
 * ```
 */
export function useDiscussionPolling(
  onPoll: () => void | Promise<void>,
  options: UseDiscussionPollingOptions = {}
) {
  const {
    interval = 30000, // 默认 30 秒
    enabled = true,
    pollWhenHidden = false,
  } = options;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // 执行轮询
  const executePoll = useCallback(async () => {
    if (isPollingRef.current) return; // 防止重复执行

    isPollingRef.current = true;
    try {
      await onPoll();
    } catch (error) {
      console.error('[Polling] Error during poll:', error);
    } finally {
      isPollingRef.current = false;
    }
  }, [onPoll]);

  // 手动触发更新
  const triggerUpdate = useCallback(() => {
    executePoll();
  }, [executePoll]);

  // 启动轮询
  const startPolling = useCallback(() => {
    if (!enabled) return;

    // 清除旧的定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // 立即执行一次
    executePoll();

    // 启动定时器
    intervalRef.current = setInterval(executePoll, interval);
  }, [enabled, interval, executePoll]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 处理页面可见性变化
  useEffect(() => {
    if (!enabled || pollWhenHidden) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时停止轮询
        stopPolling();
      } else {
        // 页面可见时启动轮询（会立即执行一次）
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, pollWhenHidden, startPolling, stopPolling]);

  // 启动/停止轮询
  useEffect(() => {
    if (enabled) {
      // 如果页面可见或允许隐藏时轮询，则启动
      if (!document.hidden || pollWhenHidden) {
        startPolling();
      }
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, pollWhenHidden, startPolling, stopPolling]);

  return {
    /** 手动触发一次更新（不等待定时器） */
    triggerUpdate,
    /** 停止轮询 */
    stopPolling,
    /** 启动轮询 */
    startPolling,
  };
}
