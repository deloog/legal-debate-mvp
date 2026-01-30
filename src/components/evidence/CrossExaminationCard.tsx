/**
 * 质证预判卡片组件
 *
 * 功能：
 * - 显示风险等级（低/中/高）
 * - 展示对方可能的质证意见
 * - 显示每种意见的可能性
 * - 展示应对建议
 * - 支持补充证据建议
 * - 可展开/收起详细信息
 * - 支持刷新重新预判
 */

'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CrossExaminationResult } from '@/lib/evidence/cross-examination-service';

/**
 * 组件属性
 */
export interface CrossExaminationCardProps {
  /**
   * 证据名称
   */
  evidenceName: string;

  /**
   * 质证预判结果
   */
  result: CrossExaminationResult;

  /**
   * 刷新回调
   */
  onRefresh?: () => void | Promise<void>;

  /**
   * 是否正在加载
   */
  loading?: boolean;
}

/**
 * 获取风险等级标签
 */
function getRiskLabel(risk: 'low' | 'medium' | 'high'): string {
  const labels = {
    low: '低风险',
    medium: '中等风险',
    high: '高风险',
  };
  return labels[risk];
}

/**
 * 获取风险等级颜色
 */
function getRiskColor(risk: 'low' | 'medium' | 'high'): string {
  const colors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800',
  };
  return colors[risk];
}

/**
 * 获取质证类型标签
 */
function getChallengeTypeLabel(
  type: 'authenticity' | 'legality' | 'relevance'
): string {
  const labels = {
    authenticity: '真实性',
    legality: '合法性',
    relevance: '关联性',
  };
  return labels[type];
}

/**
 * 获取质证类型颜色
 */
function getChallengeTypeColor(
  type: 'authenticity' | 'legality' | 'relevance'
): string {
  const colors = {
    authenticity: 'bg-blue-100 text-blue-800',
    legality: 'bg-purple-100 text-purple-800',
    relevance: 'bg-orange-100 text-orange-800',
  };
  return colors[type];
}

/**
 * 质证预判卡片组件
 */
export function CrossExaminationCard({
  evidenceName,
  result,
  onRefresh,
  loading = false,
}: CrossExaminationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * 处理刷新
   */
  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * 切换展开状态
   */
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  const isLoading = loading || refreshing;

  return (
    <Card className='w-full'>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='flex-1'>
            <CardTitle className='text-lg'>
              质证风险预判 - {evidenceName}
            </CardTitle>
            <div className='mt-2 flex items-center gap-2'>
              <span className='text-sm text-gray-600'>风险等级：</span>
              <Badge className={getRiskColor(result.overallRisk)}>
                {getRiskLabel(result.overallRisk)}
              </Badge>
            </div>
          </div>
          {onRefresh && (
            <Button
              variant='outline'
              size='sm'
              onClick={handleRefresh}
              disabled={isLoading}
              aria-label='刷新'
            >
              {isLoading ? '分析中...' : '重新预判'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className='py-8 text-center text-gray-500'>
            <div className='mb-2'>分析中...</div>
            <div className='text-sm'>正在预判对方可能的质证意见</div>
          </div>
        ) : (
          <>
            {/* 风险说明 */}
            {result.riskNote && (
              <div className='mb-4 rounded-md bg-gray-50 p-3'>
                <p className='text-sm text-gray-700'>{result.riskNote}</p>
              </div>
            )}

            {/* 质证意见列表 */}
            <div className='space-y-4'>
              <div>
                <h4 className='mb-3 font-medium text-gray-900'>
                  对方可能的质证意见：
                </h4>
                {result.possibleChallenges.length === 0 ? (
                  <p className='text-sm text-gray-500'>暂无质证意见</p>
                ) : (
                  <div className='space-y-3'>
                    {result.possibleChallenges.map((challenge, index) => (
                      <div
                        key={index}
                        className='rounded-lg border border-gray-200 p-4'
                      >
                        <div className='mb-2 flex items-center justify-between'>
                          <Badge
                            className={getChallengeTypeColor(challenge.type)}
                          >
                            {getChallengeTypeLabel(challenge.type)}质证
                          </Badge>
                          <span className='text-sm font-medium text-gray-700'>
                            可能性：{challenge.likelihood}%
                          </span>
                        </div>
                        <p className='text-sm text-gray-700'>
                          {challenge.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 展开/收起按钮 */}
              {result.responses.length > 0 && (
                <div className='flex justify-center'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={toggleExpanded}
                    aria-label={expanded ? '收起' : '展开'}
                  >
                    {expanded ? '收起应对建议 ▲' : '查看应对建议 ▼'}
                  </Button>
                </div>
              )}

              {/* 应对建议（展开时显示） */}
              {expanded && result.responses.length > 0 && (
                <div className='mt-4 border-t pt-4'>
                  <h4 className='mb-3 font-medium text-gray-900'>应对建议：</h4>
                  <div className='space-y-4'>
                    {result.responses.map((response, index) => (
                      <div key={index} className='rounded-lg bg-blue-50 p-4'>
                        <div className='mb-2'>
                          <span className='text-sm font-medium text-gray-700'>
                            针对：
                          </span>
                          <span className='ml-1 text-sm text-gray-600'>
                            {response.challenge}
                          </span>
                        </div>
                        <div className='mb-2'>
                          <span className='text-sm font-medium text-gray-700'>
                            应对方案：
                          </span>
                          <p className='mt-1 text-sm text-gray-700'>
                            {response.response}
                          </p>
                        </div>
                        {response.supportingEvidence && (
                          <div>
                            <span className='text-sm font-medium text-gray-700'>
                              补充证据建议：
                            </span>
                            <p className='mt-1 text-sm text-blue-700'>
                              {response.supportingEvidence}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
