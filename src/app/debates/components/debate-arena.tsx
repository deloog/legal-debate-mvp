'use client';

import { useState } from 'react';
import { DebateRound, Argument } from '@prisma/client';
import { ArgumentColumn } from './argument-column';
import { RoundSelector } from './round-selector';
import { StreamingOutput } from './streaming-output';
import { LawArticleList } from './law-article-list';
import { useArgumentsByRound } from '@/lib/hooks/use-debate';

export interface DebateArenaProps {
  debateId: string;
  rounds: DebateRound[];
  currentRound: DebateRound | null;
  arguments: Argument[];
  onRoundChange: (roundId: string) => void;
}

/**
 * 辩论展示区组件
 * 功能：展示完整的辩论界面，包括轮次选择、正反方论点列和流式输出
 */
export function DebateArena({
  debateId,
  rounds,
  currentRound,
  arguments: argumentsList,
  onRoundChange,
}: DebateArenaProps) {
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(
    currentRound?.id || null
  );

  // 根据选中的轮次筛选论点
  const roundArguments = useArgumentsByRound(argumentsList, selectedRoundId);

  // 处理轮次切换
  const handleRoundChange = (roundId: string) => {
    setSelectedRoundId(roundId);
    onRoundChange(roundId);
  };

  // 同步当前轮次
  if (currentRound && selectedRoundId !== currentRound.id) {
    setSelectedRoundId(currentRound.id);
  }

  return (
    <div className='space-y-6'>
      {/* 轮次选择器 */}
      <RoundSelector
        rounds={rounds}
        currentRoundId={selectedRoundId}
        onRoundChange={handleRoundChange}
      />

      {/* 辩论主展示区 */}
      {selectedRoundId && currentRound && (
        <div className='space-y-4'>
          {/* 流式输出区（正在进行中的轮次） */}
          {currentRound.status === 'IN_PROGRESS' && (
            <div className='space-y-3'>
              <h3 className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
                实时生成
              </h3>
              <StreamingOutput
                content=''
                isStreaming={false}
                side='PLAINTIFF'
                accentColor='blue'
              />
              <StreamingOutput
                content=''
                isStreaming={false}
                side='DEFENDANT'
                accentColor='red'
              />
            </div>
          )}

          {/* 法条推荐列表 */}
          <LawArticleList debateId={debateId} roundId={selectedRoundId} />

          {/* 论点展示区 */}
          <div className='grid gap-6 md:grid-cols-2'>
            {/* 原告方论点列 */}
            <ArgumentColumn
              title='原告方'
              side='PLAINTIFF'
              arguments={roundArguments}
              accentColor='blue'
            />

            {/* 被告方论点列 */}
            <ArgumentColumn
              title='被告方'
              side='DEFENDANT'
              arguments={roundArguments}
              accentColor='red'
            />
          </div>

          {/* 中立方论点列（如果有） */}
          {roundArguments.some(arg => arg.side === 'NEUTRAL') && (
            <ArgumentColumn
              title='中立方'
              side='NEUTRAL'
              arguments={roundArguments}
              accentColor='gray'
            />
          )}
        </div>
      )}

      {/* 无轮次选中时的提示 */}
      {!selectedRoundId && (
        <div className='rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900'>
          <p className='text-sm text-zinc-500 dark:text-zinc-400'>
            请选择一个轮次查看辩论内容
          </p>
        </div>
      )}
    </div>
  );
}
