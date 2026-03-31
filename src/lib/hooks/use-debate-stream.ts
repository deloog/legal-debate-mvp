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

import {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';
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
  userContext?: string; // 用户本轮补充的理由（传入SSE URL）
  onMessage?: (message: StreamMessage) => void;
  onAIStream?: (content: string, progress: number) => void;
  onLawSearchComplete?: (
    articles: Array<{ lawName: string; articleNumber: string }>
  ) => void;
  onError?: (error: Error | unknown) => void;
  onComplete?: (data?: {
    hasMoreRounds?: boolean;
    isLastRound?: boolean;
    roundNumber?: number;
  }) => void;
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
 *
 * 关键设计：
 * - 使用 clientRef 持有 SSEClient 实例，确保每次 connect/disconnect 操作的是同一个实例，
 *   防止旧 EventSource 连接未关闭导致的内存泄漏和多连接并发问题。
 * - 使用 callbackRef 模式（ref + 无依赖 useCallback）避免内联回调引起的 connect 引用变化，
 *   防止每次父组件 re-render（如 setRawStreamContent）都触发 SSE 断连重建。
 * - 收到 completed / error 事件后主动 disconnect，防止服务端关闭连接触发
 *   EventSource 的 onerror 自动重连，导致重复生成。
 */
export function useDebateStream(options: UseDebateStreamOptions): StreamState {
  const {
    debateId,
    roundId,
    enabled = true,
    userContext,
    onMessage,
    onAIStream,
    onLawSearchComplete,
    onError,
    onComplete,
  } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [accumulatedContent, setAccumulatedContent] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  // 持有当前 SSEClient 实例，确保 cleanup 时关闭正确的连接
  const clientRef = useRef<SSEClient | null>(null);

  // ── 回调 Ref 模式 ──────────────────────────────────────────────────────────
  // 将父组件传入的回调存入 ref，避免内联函数每次 render 产生新引用，
  // 从而防止 handleSSEMessage 的 useCallback deps 变化导致 connect 重建，
  // 进而防止每次状态更新（如流式追加文本）都触发 SSE 断连重建。
  const onMessageRef = useRef(onMessage);
  const onAIStreamRef = useRef(onAIStream);
  const onLawSearchCompleteRef = useRef(onLawSearchComplete);
  const onErrorRef = useRef(onError);
  const onCompleteRef = useRef(onComplete);

  // 每次 render 同步最新回调到 ref，无副作用（无依赖 useEffect 即同步执行）
  useEffect(() => {
    onMessageRef.current = onMessage;
    onAIStreamRef.current = onAIStream;
    onLawSearchCompleteRef.current = onLawSearchComplete;
    onErrorRef.current = onError;
    onCompleteRef.current = onComplete;
  });

  // 处理SSE消息（空依赖数组 → 稳定引用，不会导致 connect 重建）
  const handleSSEMessage = useCallback(
    (eventType: string, eventData: unknown) => {
      const message: StreamMessage = {
        id: crypto.randomUUID(),
        event: eventType,
        data: eventData,
      };

      setMessages(prev => [...prev, message]);

      if (onMessageRef.current) {
        onMessageRef.current(message);
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
        if (onAIStreamRef.current && streamData.content) {
          onAIStreamRef.current(streamData.content, streamData.progress || 0);
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

      // 法条检索完成事件
      if (
        eventType === 'law-search-complete' &&
        typeof eventData === 'object' &&
        eventData !== null
      ) {
        const lawData = eventData as {
          articles?: Array<{ lawName: string; articleNumber: string }>;
        };
        if (onLawSearchCompleteRef.current && lawData.articles) {
          onLawSearchCompleteRef.current(lawData.articles);
        }
      }

      // 检查是否完成
      if (eventType === 'completed') {
        setIsStreaming(false);
        setProgress(100);
        if (onCompleteRef.current) {
          const completedData = eventData as {
            hasMoreRounds?: boolean;
            isLastRound?: boolean;
            roundNumber?: number;
          } | null;
          onCompleteRef.current(completedData ?? undefined);
        }
      }
    },
    [] // 空依赖：通过 ref 访问最新回调，引用永远稳定
  );

  // 处理SSE错误（空依赖数组 → 稳定引用）
  const handleSSEError = useCallback(
    (err: Error | unknown) => {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsStreaming(false);
      if (onErrorRef.current) {
        onErrorRef.current(err);
      }
    },
    [] // 空依赖：通过 ref 访问最新回调
  );

  // 处理SSE连接关闭（空依赖数组 → 稳定引用）
  const handleSSEClose = useCallback(() => {
    setIsStreaming(false);
  }, []);

  // 断开并清理当前 SSE 连接
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // 连接SSE（先断开旧连接，再建立新连接）
  const connect = useCallback(() => {
    if (!enabled || !debateId) return;

    // 断开旧连接，防止 EventSource 泄漏
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }

    setIsStreaming(true);
    setError(null);
    setProgress(0);

    const sseUrl = new URL(
      `/api/v1/debates/${debateId}/stream`,
      window.location.origin
    );
    if (userContext) sseUrl.searchParams.set('userContext', userContext);

    const client = new SSEClient({
      url: sseUrl.toString(),
      debateId,
      roundId: roundId || '',
      onConnected: () => {
        setIsStreaming(true);
      },
      onLawSearchComplete: eventData => {
        handleSSEMessage('law-search-complete', eventData);
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
        // 主动断开，防止服务端关闭连接后 EventSource 触发 onerror 自动重连，
        // 导致对已完成的辩论重复发起生成请求。
        client.disconnect();
        clientRef.current = null;
      },
      onError: eventData => {
        handleSSEError(eventData);
        // 主动断开，防止错误后服务端关闭连接触发重连循环：
        // error → server close → onerror → reconnect → error → ...
        client.disconnect();
        clientRef.current = null;
      },
      onDisconnected: () => {
        handleSSEClose();
      },
    });

    client.connect();
    clientRef.current = client;
  }, [
    debateId,
    roundId,
    enabled,
    userContext,
    handleSSEMessage,
    handleSSEError,
    handleSSEClose,
  ]);

  // 自动连接/断开
  useEffect(() => {
    if (enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      connect();
    } else {
      disconnect();
    }

    return () => {
      // cleanup：组件卸载或 enabled/依赖变化时断开连接
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
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
      requestAnimationFrame(() => {
        setDisplayedText(text);
        setIsComplete(true);
      });
      return;
    }

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
