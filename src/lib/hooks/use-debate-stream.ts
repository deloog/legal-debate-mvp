'use client';

/**
 * 辩论流式输出相关Hooks
 *
 * 本模块提供辩论流式输出的React Hooks，主要用于：
 * 1. useDebateStream - 通过SSE接收流式辩论内容，实时显示AI生成的辩论文本
 * 2. useTypewriter - 将长文本以打字机效果逐字显示，提升用户体验
 *
 * @module use-debate-stream
 */

import { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { SSEClient } from '@/lib/debate/stream/sse-client';

export interface StreamMessage {
  id: string;
  event: string;
  data: unknown;
}

export interface UseDebateStreamOptions {
  debateId: string;
  roundId: string | null;
  enabled?: boolean;
  onMessage?: (message: StreamMessage) => void;
  onAIStream?: (content: string, progress: number) => void;
  onError?: (error: Error | unknown) => void;
  onComplete?: () => void;
}

export interface StreamState {
  isStreaming: boolean;
  messages: StreamMessage[];
  accumulatedContent: string;
  error: Error | null;
  progress: number;
  connect: () => void;
  disconnect: () => void;
}

/**
 * 辩论流式输出Hook
 * 功能：通过SSE接收流式辩论内容
 */
export function useDebateStream(options: UseDebateStreamOptions): StreamState {
  const {
    debateId,
    roundId,
    enabled = true,
    onMessage,
    onAIStream,
    onError,
    onComplete,
  } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [accumulatedContent, setAccumulatedContent] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  // 处理SSE消息
  const handleSSEMessage = useCallback(
    (eventType: string, eventData: unknown) => {
      const message: StreamMessage = {
        id: crypto.randomUUID(),
        event: eventType,
        data: eventData,
      };

      setMessages(prev => [...prev, message]);

      if (onMessage) {
        onMessage(message);
      }

      // 处理AI流式内容事件
      if (
        eventType === 'ai_stream' &&
        typeof eventData === 'object' &&
        eventData !== null
      ) {
        const streamData = eventData as { content?: string; progress?: number };
        if (streamData.content) {
          setAccumulatedContent(prev => prev + streamData.content);
        }
        if (typeof streamData.progress === 'number') {
          setProgress(streamData.progress);
        }
        if (onAIStream && streamData.content) {
          onAIStream(streamData.content, streamData.progress || 0);
        }
      }

      // 根据事件类型更新进度
      if (
        eventType === 'progress' &&
        typeof eventData === 'object' &&
        eventData !== null &&
        'progress' in eventData
      ) {
        setProgress((eventData as { progress: number }).progress);
      }

      // 检查是否完成
      if (eventType === 'completed') {
        setIsStreaming(false);
        setProgress(100);
        if (onComplete) {
          onComplete();
        }
      }
    },
    [onMessage, onAIStream, onComplete]
  );

  // 处理SSE错误
  const handleSSEError = useCallback(
    (err: Error | unknown) => {
      console.error('SSE错误:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsStreaming(false);
      if (onError) {
        onError(err);
      }
    },
    [onError]
  );

  // 处理SSE连接关闭
  const handleSSEClose = useCallback(() => {
    console.log('SSE连接已关闭');
    setIsStreaming(false);
  }, []);

  // 连接SSE
  const connect = useCallback(() => {
    if (!enabled || !debateId) {
      return;
    }

    setIsStreaming(true);
    setError(null);
    setProgress(0);

    const client = new SSEClient({
      url: `/api/v1/debates/${debateId}/stream`,
      debateId,
      roundId: roundId || '',
      onConnected: () => {
        console.log('SSE已连接');
        setIsStreaming(true);
      },
      onAIStream: eventData => {
        handleSSEMessage('ai_stream', eventData);
      },
      onArgument: eventData => {
        handleSSEMessage('argument', eventData);
      },
      onProgress: eventData => {
        handleSSEMessage('progress', eventData);
      },
      onCompleted: eventData => {
        handleSSEMessage('completed', eventData);
      },
      onError: eventData => {
        handleSSEError(eventData);
      },
      onDisconnected: () => {
        handleSSEClose();
      },
    });

    client.connect();
    return () => {
      client.disconnect();
    };
  }, [
    debateId,
    roundId,
    enabled,
    handleSSEMessage,
    handleSSEError,
    handleSSEClose,
  ]);

  // 断开连接
  const disconnect = useCallback(() => {
    setIsStreaming(false);
  }, []);

  // 自动连接
  useEffect(() => {
    let disconnectFn: (() => void) | null = null;

    // 使用setTimeout避免在effect中直接调用setState
    const timer = setTimeout(() => {
      if (enabled) {
        disconnectFn = connect();
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      if (disconnectFn) {
        disconnectFn();
      }
    };
  }, [enabled, connect, disconnect]);

  return {
    isStreaming,
    messages,
    accumulatedContent,
    error,
    progress,
    connect,
    disconnect,
  };
}

/**
 * 打字机效果Hook
 * 功能：将长文本逐字显示
 */
export interface TypewriterOptions {
  text: string;
  speed?: number;
  enabled?: boolean;
}

export interface TypewriterResult {
  displayedText: string;
  isComplete: boolean;
}

export function useTypewriter(options: TypewriterOptions): TypewriterResult {
  const { text, speed = 30, enabled = true } = options;
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useLayoutEffect(() => {
    if (!enabled || !text) {
      // 使用 requestAnimationFrame 避免同步 setState 的问题
      requestAnimationFrame(() => {
        setDisplayedText(text);
        setIsComplete(true);
      });
      return;
    }

    // 使用 requestAnimationFrame 延迟 setState 避免同步问题
    const timer = requestAnimationFrame(() => {
      setDisplayedText('');
      setIsComplete(false);
    });

    const interval = setInterval(() => {
      setDisplayedText(prev => {
        if (prev.length < text.length) {
          return text.slice(0, prev.length + 1);
        } else {
          clearInterval(interval);
          setIsComplete(true);
          return prev;
        }
      });
    }, speed);

    return () => {
      cancelAnimationFrame(timer);
      clearInterval(interval);
    };
  }, [text, speed, enabled]);

  return { displayedText, isComplete };
}
