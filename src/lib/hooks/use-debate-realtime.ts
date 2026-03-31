'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Debate, DebateRound, Argument, $Enums } from '@prisma/client';
import { DEBATE_API } from '@/lib/constants/api-paths';
import { SSEClient } from '@/lib/debate/stream/sse-client';
import type {
  ArgumentEventData,
  RoundStartEventData,
  CompletedEventData,
  ProgressEventData,
} from '@/lib/debate/stream/types';

/**
 * 轮次状态类型（使用Prisma生成的枚举）
 */
type RoundStatus = $Enums.RoundStatus;

/**
 * 辩论实时数据Hook选项
 */
export interface UseDebateRealtimeOptions {
  debateId: string;
  /** 是否启用实时更新（默认true） */
  enabled?: boolean;
  /** 初始加载完成后的回调 */
  onReady?: () => void;
}

/**
 * 辩论数据完整类型（包含展开的字段）
 */
export interface DebateWithDetails {
  debate: Debate | null;
  rounds: DebateRound[];
  currentRound: DebateRound | null;
  arguments: Argument[];
}

export interface UseDebateRealtimeResult extends DebateWithDetails {
  isLoading: boolean;
  error: string | null;
  /** 手动刷新数据 */
  refresh: () => Promise<void>;
  /** 是否正在监听实时更新 */
  isListening: boolean;
  /** 当前进度（如果有AI生成在进行） */
  progress: number;
  /** 是否正在生成论点 */
  isGenerating: boolean;
}

/**
 * 辩论实时数据Hook
 *
 * 功能：
 * 1. 初始加载完整辩论数据（辩论、轮次、论点）
 * 2. 使用SSE监听实时更新（新论点、新轮次等）
 * 3. 增量更新UI，避免整个页面刷新带来的闪烁
 *
 * 相比定时轮询的优势：
 * - 无需每5秒刷新整个页面，用户体验更流畅
 * - 实时推送，有更新时立即响应
 * - 只更新变化的部分，保持UI稳定
 */
export function useDebateRealtime(
  options: UseDebateRealtimeOptions
): UseDebateRealtimeResult {
  const { debateId, enabled = true, onReady } = options;

  const [debate, setDebate] = useState<Debate | null>(null);
  const [rounds, setRounds] = useState<DebateRound[]>([]);
  const [currentRound, setCurrentRound] = useState<DebateRound | null>(null);
  const [argumentList, setArgumentList] = useState<Argument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // 使用ref保存SSE客户端实例，避免在effect中重复创建
  const sseClientRef = useRef<SSEClient | null>(null);

  // 手动刷新函数
  const refresh = useCallback(async () => {
    if (!debateId) return;

    try {
      setError(null);

      // 并行获取数据
      const [debateRes, roundsRes, argsRes] = await Promise.all([
        fetch(DEBATE_API.detail(debateId)),
        fetch(DEBATE_API.rounds(debateId)),
        fetch(DEBATE_API.arguments(debateId)),
      ]);

      if (!debateRes.ok) {
        throw new Error('获取辩论信息失败');
      }

      const debateResponse = await debateRes.json();
      setDebate(debateResponse.data);

      if (roundsRes.ok) {
        const roundsResponse = await roundsRes.json();
        const roundsData: DebateRound[] = roundsResponse.data || [];
        setRounds(roundsData);

        // 找到当前轮次
        const activeRound = roundsData.find(r => r.status === 'IN_PROGRESS');
        setCurrentRound(activeRound || roundsData[roundsData.length - 1]);
      }

      if (argsRes.ok) {
        const argsResponse = await argsRes.json();
        const argsData: Argument[] = argsResponse.data || [];
        setArgumentList(argsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    }
  }, [debateId]);

  // 初始数据加载
  useEffect(() => {
    if (!debateId) return;

    const loadInitialData = async () => {
      setIsLoading(true);
      await refresh();
      setIsLoading(false);
      onReady?.();
    };

    void loadInitialData();
  }, [debateId, refresh, onReady]);

  // SSE实时监听
  useEffect(() => {
    // 确保 debateId 有效且非空
    if (!enabled || !debateId || debateId.trim() === '' || isLoading) {
      return;
    }

    // 如果已有连接，先断开
    if (sseClientRef.current) {
      sseClientRef.current.disconnect();
      sseClientRef.current = null;
    }

    // 获取当前轮次ID
    const currentRoundId = currentRound?.id || '';

    // 论点事件处理器 - 增量更新论点列表
    const handleArgument = (data: ArgumentEventData) => {
      // 检查论点是否已存在（避免重复）
      setArgumentList(prev => {
        const exists = prev.some(arg => arg.id === data.argumentId);
        if (exists) return prev;

        // 创建新的论点对象
        const newArgument: Argument = {
          id: data.argumentId,
          roundId: data.roundId,
          side: data.side,
          type: data.type,
          content: data.content,
          reasoning: data.reasoning || '',
          legalBasis: JSON.stringify(data.legalBasis || []),
          confidence: data.confidence || 0,
          createdAt: new Date(data.timestamp),
          updatedAt: new Date(data.timestamp),
          caseId: debateId,
          debateId,
          aiProvider: '',
          generationTime: 0,
          logicScore: 0,
          legalScore: 0,
          priority: 'NORMAL',
        } as unknown as Argument;

        return [...prev, newArgument];
      });

      // 标记正在生成
      setIsGenerating(true);
    };

    // 轮次开始事件处理器 - 增量更新轮次列表
    const handleRoundStart = (data: RoundStartEventData) => {
      // 创建新的轮次对象
      const newRound: DebateRound = {
        id: data.roundId,
        debateId: data.debateId,
        roundNumber: data.roundNumber,
        status: 'IN_PROGRESS',
        startedAt: new Date(data.timestamp),
        completedAt: null,
        createdAt: new Date(data.timestamp),
        updatedAt: new Date(data.timestamp),
      } as DebateRound;

      setRounds(prev => {
        const exists = prev.some(r => r.id === data.roundId);
        if (exists) return prev;
        return [...prev, newRound];
      });

      setCurrentRound(newRound);
    };

    // 进度更新处理器
    const handleProgress = (data: ProgressEventData) => {
      setProgress(data.progress);
      if (data.currentStep === 'generating') {
        setIsGenerating(true);
      }
    };

    // 完成事件处理器
    const handleCompleted = (data: CompletedEventData) => {
      setProgress(100);
      setIsGenerating(false);

      // 更新轮次状态
      setRounds(prev =>
        prev.map(r =>
          r.id === data.roundId
            ? {
                ...r,
                status: 'COMPLETED' as RoundStatus,
                completedAt: new Date(data.timestamp),
              }
            : r
        )
      );

      // 更新当前轮次
      setCurrentRound(prev => {
        if (!prev || !data.roundId || prev.id !== data.roundId) return prev;
        return {
          ...prev,
          status: 'COMPLETED' as RoundStatus,
          completedAt: new Date(data.timestamp),
        };
      });
    };

    // 错误处理器
    const handleError = () => {
      setIsGenerating(false);
    };

    // 连接成功处理器
    const handleConnected = () => {
      setIsListening(true);
    };

    // 断开连接处理器
    const handleDisconnected = () => {
      setIsListening(false);
    };

    // 构建完整的 SSE URL（需要绝对路径）
    const sseUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/api/v1/debates/${debateId}/stream`
        : `/api/v1/debates/${debateId}/stream`;

    const client = new SSEClient({
      url: sseUrl,
      debateId,
      roundId: currentRoundId,
      heartbeatInterval: 30000,
      connectionTimeout: 300000,
      maxRetryAttempts: 5,
      enableReconnection: true,
      enableLogging: false,
      onConnected: handleConnected,
      onDisconnected: handleDisconnected,
      onArgument: handleArgument,
      onRoundStart: handleRoundStart,
      onProgress: handleProgress,
      onCompleted: handleCompleted,
      onError: handleError,
    });

    // 建立连接
    client.connect();
    sseClientRef.current = client;

    // 清理函数
    return () => {
      client.disconnect();
      sseClientRef.current = null;
      setIsListening(false);
    };
  }, [debateId, enabled, isLoading, currentRound?.id]);

  return {
    debate,
    rounds,
    currentRound,
    arguments: argumentList,
    isLoading,
    error,
    refresh,
    isListening,
    progress,
    isGenerating,
  };
}
