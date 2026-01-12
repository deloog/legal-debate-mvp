'use client';

import { useState, useEffect } from 'react';
import { Debate, DebateRound, Argument } from '@prisma/client';

/**
 * 辩论数据Hook
 * 功能：获取辩论详情、轮次和论点数据
 */
export interface DebateData {
  debate: Debate | null;
  rounds: DebateRound[];
  currentRound: DebateRound | null;
  arguments: Argument[];
  isLoading: boolean;
  error: string | null;
}

export interface UseDebateOptions {
  debateId: string;
  refreshInterval?: number;
}

export function useDebate(debateId, refreshInterval = 5000): DebateData {
  const [debate, setDebate] = useState<Debate | null>(null);
  const [rounds, setRounds] = useState<DebateRound[]>([]);
  const [currentRound, setCurrentRound] = useState<DebateRound | null>(null);
  const [argumentList, setArgumentList] = useState<Argument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDebateData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 并行获取辩论、轮次和论点数据
        const [debateRes, roundsRes, argsRes] = await Promise.all([
          fetch(`/api/v1/debates/${debateId}`),
          fetch(`/api/v1/debates/${debateId}/rounds`),
          fetch(`/api/v1/debates/${debateId}/arguments`),
        ]);

        if (!debateRes.ok) {
          throw new Error('获取辩论信息失败');
        }

        const debateData: Debate = await debateRes.json();
        setDebate(debateData);

        if (roundsRes.ok) {
          const roundsData: DebateRound[] = await roundsRes.json();
          setRounds(roundsData);

          // 找到当前轮次（状态为IN_PROGRESS的最新轮次）
          const activeRound = roundsData.find(r => r.status === 'IN_PROGRESS');
          setCurrentRound(activeRound || roundsData[roundsData.length - 1]);
        }

        if (argsRes.ok) {
          const argsData: Argument[] = await argsRes.json();
          setArgumentList(argsData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载数据失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDebateData();

    // 设置定时刷新
    const interval = setInterval(fetchDebateData, refreshInterval);

    return () => {
      clearInterval(interval);
    };
  }, [debateId, refreshInterval]);

  return {
    debate,
    rounds,
    currentRound,
    arguments: argumentList,
    isLoading,
    error,
  };
}

/**
 * 论点分组Hook
 * 功能：将论点按正反方分组
 */
export interface GroupedArguments {
  plaintiff: Argument[];
  defendant: Argument[];
}

export function useGroupedArguments(
  argumentList: Argument[]
): GroupedArguments {
  return argumentList.reduce<GroupedArguments>(
    (acc, arg) => {
      if (arg.side === 'PLAINTIFF') {
        acc.plaintiff.push(arg);
      } else if (arg.side === 'DEFENDANT') {
        acc.defendant.push(arg);
      } else {
        // NEUTRAL或其他类型，默认分配给原告方
        acc.plaintiff.push(arg);
      }
      return acc;
    },
    { plaintiff: [], defendant: [] }
  );
}

/**
 * 轮次筛选论点Hook
 * 功能：根据轮次ID筛选论点
 */
export function useArgumentsByRound(
  argumentList: Argument[],
  roundId: string | null
): Argument[] {
  if (!roundId) return [];
  return argumentList.filter(arg => arg.roundId === roundId);
}
