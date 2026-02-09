'use client';

import { useCallback, useEffect, useState } from 'react';

interface DebateDetailProps {
  debateId: string;
}

interface Debate {
  id: string;
  title: string;
  status: string;
  currentRound: number;
  debateConfig: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  case: {
    title: string;
    type: string;
    description: string;
  };
}

interface DebateRound {
  id: string;
  roundNumber: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  arguments: Argument[];
}

interface Argument {
  id: string;
  side: string;
  content: string;
  type: string;
  reasoning: string | null;
  legalBasis: string | null;
  confidence: number | null;
  createdAt: string;
}

export function DebateDetail({ debateId }: DebateDetailProps) {
  const [debate, setDebate] = useState<Debate | null>(null);
  const [rounds, setRounds] = useState<DebateRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<DebateRound | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDebate = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [debateRes, roundsRes] = await Promise.all([
        fetch(`/api/v1/debates/${debateId}`),
        fetch(`/api/v1/debates/${debateId}/rounds`),
      ]);

      if (!debateRes.ok) {
        throw new Error('获取辩论信息失败');
      }

      const debateData: Debate = await debateRes.json();
      setDebate(debateData);

      if (roundsRes.ok) {
        const roundsData: DebateRound[] = await roundsRes.json();
        setRounds(roundsData);
        // 默认选择最新轮次
        if (roundsData.length > 0) {
          setSelectedRound(roundsData[roundsData.length - 1]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载辩论失败');
    } finally {
      setIsLoading(false);
    }
  }, [debateId]);

  useEffect(() => {
    fetchDebate();
  }, [fetchDebate]);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center p-8'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' />
        <span className='ml-3 text-gray-600'>加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className='p-4 bg-red-50 border border-red-200 rounded-lg'>
        <p className='text-red-600'>{error}</p>
        <button
          onClick={fetchDebate}
          className='mt-2 text-sm text-red-700 underline'
        >
          重试
        </button>
      </div>
    );
  }

  if (!debate) {
    return (
      <div className='p-4 bg-yellow-50 border border-yellow-200 rounded-lg'>
        <p className='text-yellow-600'>辩论不存在</p>
      </div>
    );
  }

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      PAUSED: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-green-100 text-green-800',
      ARCHIVED: 'bg-gray-100 text-gray-500',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getRoundStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      PENDING: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const rawConfig = debate.debateConfig;
  let debateConfig: DebateConfig;
  if (
    rawConfig &&
    typeof rawConfig === 'object' &&
    'maxRounds' in rawConfig &&
    'debateMode' in rawConfig
  ) {
    debateConfig = {
      maxRounds: Number(rawConfig.maxRounds) || 3,
      debateMode: String(rawConfig.debateMode) || 'standard',
      aiProvider: String(rawConfig.aiProvider) || 'deepseek',
      enableReview: Boolean(rawConfig.enableReview),
    };
  } else {
    debateConfig = {
      maxRounds: 3,
      debateMode: 'standard',
      aiProvider: 'deepseek',
      enableReview: true,
    };
  }

  return (
    <div className='max-w-4xl mx-auto p-6'>
      {/* 辩论基本信息 */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <div className='flex items-start justify-between mb-4'>
          <div>
            <h1 className='text-2xl font-semibold text-gray-900'>
              {debate.title}
            </h1>
            <p className='text-gray-600 mt-1'>
              案件: {debate.case.title} ({debate.case.type})
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
              debate.status
            )}`}
          >
            {debate.status === 'IN_PROGRESS' && '进行中'}
            {debate.status === 'COMPLETED' && '已完成'}
            {debate.status === 'DRAFT' && '草稿'}
            {debate.status === 'PAUSED' && '已暂停'}
          </span>
        </div>

        {/* 配置信息 */}
        <div className='grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg'>
          <div>
            <p className='text-sm text-gray-500'>轮次</p>
            <p className='font-medium'>
              {debate.currentRound} / {debateConfig.maxRounds}
            </p>
          </div>
          <div>
            <p className='text-sm text-gray-500'>模式</p>
            <p className='font-medium'>
              {debateConfig.debateMode === 'standard' && '标准'}
              {debateConfig.debateMode === 'fast' && '快速'}
              {debateConfig.debateMode === 'detailed' && '详细'}
            </p>
          </div>
          <div>
            <p className='text-sm text-gray-500'>AI提供商</p>
            <p className='font-medium'>
              {debateConfig.aiProvider === 'deepseek' ? 'DeepSeek' : '智谱AI'}
            </p>
          </div>
          <div>
            <p className='text-sm text-gray-500'>AI审查</p>
            <p className='font-medium'>
              {debateConfig.enableReview ? '启用' : '禁用'}
            </p>
          </div>
        </div>

        <div className='mt-4 text-sm text-gray-500'>
          创建时间: {new Date(debate.createdAt).toLocaleString('zh-CN')}
          <span className='mx-2'>|</span>
          更新时间: {new Date(debate.updatedAt).toLocaleString('zh-CN')}
        </div>
      </div>

      {/* 轮次列表 */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <h2 className='text-lg font-semibold mb-4'>辩论轮次</h2>
        {rounds.length === 0 ? (
          <p className='text-gray-500'>暂无轮次</p>
        ) : (
          <div className='flex gap-2 overflow-x-auto pb-2'>
            {rounds.map(round => (
              <button
                key={round.id}
                onClick={() => setSelectedRound(round)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg border transition-colors ${
                  selectedRound?.id === round.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className='font-medium'>第 {round.roundNumber} 轮</div>
                <div
                  className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full ${getRoundStatusColor(
                    round.status
                  )}`}
                >
                  {round.status === 'IN_PROGRESS' && '进行中'}
                  {round.status === 'COMPLETED' && '完成'}
                  {round.status === 'PENDING' && '等待中'}
                  {round.status === 'FAILED' && '失败'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 论点详情 */}
      {selectedRound && (
        <div className='bg-white rounded-lg shadow-md p-6'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-lg font-semibold'>
              第 {selectedRound.roundNumber} 轮论点
            </h2>
            <span className='text-sm text-gray-500'>
              共 {selectedRound.arguments.length} 个论点
            </span>
          </div>

          {selectedRound.arguments.length === 0 ? (
            <p className='text-gray-500 text-center py-8'>该轮次暂无论点</p>
          ) : (
            <div className='space-y-4'>
              {/* 原告论点 */}
              <div className='border-l-4 border-blue-500 pl-4'>
                <h3 className='font-medium text-blue-700 mb-2'>原告论点</h3>
                {selectedRound.arguments
                  .filter(a => a.side === 'PLAINTIFF')
                  .map(arg => (
                    <ArgumentCard key={arg.id} argument={arg} />
                  ))}
              </div>

              {/* 被告论点 */}
              <div className='border-l-4 border-red-500 pl-4'>
                <h3 className='font-medium text-red-700 mb-2'>被告论点</h3>
                {selectedRound.arguments
                  .filter(a => a.side === 'DEFENDANT')
                  .map(arg => (
                    <ArgumentCard key={arg.id} argument={arg} />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ArgumentCardProps {
  argument: Argument;
}

function ArgumentCard({ argument }: ArgumentCardProps) {
  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      MAIN_POINT: '主论点',
      SUPPORTING: '支撑论点',
      REBUTTAL: '反驳',
      EVIDENCE: '证据',
      LEGAL_BASIS: '法律依据',
      CONCLUSION: '结论',
    };
    return labels[type] || type;
  };

  const legalBasis = argument.legalBasis
    ? JSON.parse(argument.legalBasis)
    : null;

  return (
    <div className='p-4 bg-gray-50 rounded-lg mb-3'>
      <div className='flex items-center gap-2 mb-2'>
        <span className='text-xs px-2 py-0.5 bg-gray-200 rounded text-gray-700'>
          {getTypeLabel(argument.type)}
        </span>
        {argument.confidence !== null && (
          <span className='text-xs text-gray-500'>
            置信度: {(argument.confidence * 100).toFixed(0)}%
          </span>
        )}
        <span className='text-xs text-gray-400'>
          {new Date(argument.createdAt).toLocaleString('zh-CN')}
        </span>
      </div>

      <p className='text-gray-800 mb-2'>{argument.content}</p>

      {argument.reasoning && (
        <div className='text-sm text-gray-600 mb-2'>
          <span className='font-medium'>推理:</span> {argument.reasoning}
        </div>
      )}

      {legalBasis && legalBasis.length > 0 && (
        <div className='text-sm text-gray-600'>
          <span className='font-medium'>法律依据:</span>
          <ul className='mt-1 space-y-1'>
            {legalBasis.map((item: Record<string, unknown>, index: number) => (
              <li key={index} className='ml-4 list-disc'>
                {String(item.lawName || '')} {String(item.articleNumber || '')}{' '}
                (相关性: {((Number(item.relevance) || 0) * 100).toFixed(0)}%)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface DebateConfig {
  maxRounds: number;
  debateMode: string;
  aiProvider: string;
  enableReview: boolean;
}
