/**
 * 辩论统计组件
 * 展示辩论生成次数和质量评分统计
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DebateGenerationCountData,
  DebateQualityScoreData,
} from '@/types/stats';

interface DebateStatsProps {
  timeRange?: string;
  status?: string;
  granularity?: string;
  minConfidence?: number;
  maxConfidence?: number;
}

interface DebateStatsData {
  generationCount: DebateGenerationCountData | null;
  qualityScore: DebateQualityScoreData | null;
  loading: boolean;
  error: string | null;
}

/**
 * 辩论统计组件
 */
export function DebateStats(props: DebateStatsProps) {
  const { timeRange, status, granularity, minConfidence, maxConfidence } =
    props;
  const [data, setData] = useState<DebateStatsData>({
    generationCount: null,
    qualityScore: null,
    loading: true,
    error: null,
  });

  const fetchDebateStats = useCallback(async () => {
    try {
      setData({
        generationCount: null,
        qualityScore: null,
        loading: true,
        error: null,
      });

      const params = new URLSearchParams();
      if (timeRange) {
        params.append('timeRange', timeRange);
      }
      if (status) {
        params.append('status', status);
      }
      if (granularity) {
        params.append('granularity', granularity);
      }
      if (minConfidence !== undefined) {
        params.append('minConfidence', minConfidence.toString());
      }
      if (maxConfidence !== undefined) {
        params.append('maxConfidence', maxConfidence.toString());
      }

      const [generationResponse, qualityResponse] = await Promise.all([
        fetch(`/api/stats/debates/generation-count?${params.toString()}`),
        fetch(`/api/stats/debates/quality-score?${params.toString()}`),
      ]);

      if (!generationResponse.ok || !qualityResponse.ok) {
        throw new Error('获取统计数据失败');
      }

      const generationData = await generationResponse.json();
      const qualityData = await qualityResponse.json();

      setData({
        generationCount: generationData.data,
        qualityScore: qualityData.data,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('获取辩论统计失败:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '获取统计数据失败',
      }));
    }
  }, [timeRange, status, granularity, minConfidence, maxConfidence]);

  useEffect(() => {
    fetchDebateStats();
  }, [fetchDebateStats]);

  if (data.loading) {
    return <div className='p-4'>加载中...</div>;
  }

  if (data.error) {
    return <div className='p-4 text-red-500'>{data.error}</div>;
  }

  return (
    <div className='space-y-6'>
      {data.generationCount && (
        <GenerationCountSection data={data.generationCount} />
      )}
      {data.qualityScore && <QualityScoreSection data={data.qualityScore} />}
    </div>
  );
}

/**
 * 辩论生成次数部分
 */
function GenerationCountSection({ data }: { data: DebateGenerationCountData }) {
  return (
    <div className='rounded-lg border bg-white p-6'>
      <h3 className='mb-4 text-lg font-semibold'>辩论生成统计</h3>

      <div className='mb-6 grid grid-cols-4 gap-4'>
        <div className='rounded bg-blue-50 p-4'>
          <div className='text-sm text-gray-600'>总辩论数</div>
          <div className='text-2xl font-bold text-blue-600'>
            {data.summary.totalDebates}
          </div>
        </div>
        <div className='rounded bg-green-50 p-4'>
          <div className='text-sm text-gray-600'>总论点数</div>
          <div className='text-2xl font-bold text-green-600'>
            {data.summary.totalArguments}
          </div>
        </div>
        <div className='rounded bg-purple-50 p-4'>
          <div className='text-sm text-gray-600'>平均论点数</div>
          <div className='text-2xl font-bold text-purple-600'>
            {data.summary.averageArgumentsPerDebate}
          </div>
        </div>
        <div className='rounded bg-yellow-50 p-4'>
          <div className='text-sm text-gray-600'>增长率</div>
          <div className='text-2xl font-bold text-yellow-600'>
            {data.summary.growthRate > 0 ? '+' : ''}
            {data.summary.growthRate}%
          </div>
        </div>
      </div>

      <div className='space-y-2'>
        <h4 className='mb-3 text-md font-medium'>生成趋势</h4>
        {data.trend.map((item, index) => (
          <div
            key={index}
            className='flex items-center py-2 border-b last:border-b-0'
          >
            <div className='w-24 text-sm text-gray-600'>{item.date}</div>
            <div className='flex-1 flex justify-between text-sm'>
              <span className='text-gray-600'>辩论: {item.debatesCreated}</span>
              <span className='text-gray-600'>
                论点: {item.argumentsGenerated}
              </span>
              <span className='text-gray-600'>
                平均: {item.averageArgumentsPerDebate.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 辩论质量评分部分
 */
function QualityScoreSection({ data }: { data: DebateQualityScoreData }) {
  return (
    <div className='space-y-6'>
      <div className='rounded-lg border bg-white p-6'>
        <h3 className='mb-4 text-lg font-semibold'>质量评分汇总</h3>

        <div className='mb-6 grid grid-cols-3 gap-4'>
          <div className='rounded bg-blue-50 p-4'>
            <div className='text-sm text-gray-600'>平均评分</div>
            <div className='text-2xl font-bold text-blue-600'>
              {(data.summary.averageScore * 100).toFixed(1)}%
            </div>
          </div>
          <div className='rounded bg-green-50 p-4'>
            <div className='text-sm text-gray-600'>中位数评分</div>
            <div className='text-2xl font-bold text-green-600'>
              {(data.summary.medianScore * 100).toFixed(1)}%
            </div>
          </div>
          <div className='rounded bg-purple-50 p-4'>
            <div className='text-sm text-gray-600'>最高评分</div>
            <div className='text-2xl font-bold text-purple-600'>
              {(data.summary.maxScore * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <div className='mb-6 grid grid-cols-2 gap-4'>
          <div className='rounded bg-yellow-50 p-4'>
            <div className='text-sm text-gray-600'>最低评分</div>
            <div className='text-2xl font-bold text-yellow-600'>
              {(data.summary.minScore * 100).toFixed(1)}%
            </div>
          </div>
          <div className='rounded bg-pink-50 p-4'>
            <div className='text-sm text-gray-600'>
              超过{data.summary.threshold * 100}%阈值
            </div>
            <div className='text-2xl font-bold text-pink-600'>
              {data.summary.scoreAboveThreshold}
            </div>
          </div>
        </div>
      </div>

      <div className='rounded-lg border bg-white p-6'>
        <h4 className='mb-4 text-md font-medium'>质量评分分布</h4>

        <div className='space-y-3'>
          <div className='flex items-center'>
            <div className='flex-1'>
              <div className='mb-1 flex justify-between'>
                <span className='font-medium text-green-600'>优秀</span>
                <span className='text-sm text-gray-600'>
                  {data.distribution.excellent} (
                  {data.distribution.totalCount > 0
                    ? (
                        (data.distribution.excellent /
                          data.distribution.totalCount) *
                        100
                      ).toFixed(1)
                    : '0.0'}
                  %)
                </span>
              </div>
              <div className='h-3 w-full rounded-full bg-gray-200'>
                <div
                  className='h-3 rounded-full bg-green-500'
                  style={{
                    width:
                      data.distribution.totalCount > 0
                        ? `${
                            (data.distribution.excellent /
                              data.distribution.totalCount) *
                            100
                          }%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          </div>

          <div className='flex items-center'>
            <div className='flex-1'>
              <div className='mb-1 flex justify-between'>
                <span className='font-medium text-blue-600'>良好</span>
                <span className='text-sm text-gray-600'>
                  {data.distribution.good} (
                  {data.distribution.totalCount > 0
                    ? (
                        (data.distribution.good /
                          data.distribution.totalCount) *
                        100
                      ).toFixed(1)
                    : '0.0'}
                  %)
                </span>
              </div>
              <div className='h-3 w-full rounded-full bg-gray-200'>
                <div
                  className='h-3 rounded-full bg-blue-500'
                  style={{
                    width:
                      data.distribution.totalCount > 0
                        ? `${
                            (data.distribution.good /
                              data.distribution.totalCount) *
                            100
                          }%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          </div>

          <div className='flex items-center'>
            <div className='flex-1'>
              <div className='mb-1 flex justify-between'>
                <span className='font-medium text-yellow-600'>一般</span>
                <span className='text-sm text-gray-600'>
                  {data.distribution.average} (
                  {data.distribution.totalCount > 0
                    ? (
                        (data.distribution.average /
                          data.distribution.totalCount) *
                        100
                      ).toFixed(1)
                    : '0.0'}
                  %)
                </span>
              </div>
              <div className='h-3 w-full rounded-full bg-gray-200'>
                <div
                  className='h-3 rounded-full bg-yellow-500'
                  style={{
                    width:
                      data.distribution.totalCount > 0
                        ? `${
                            (data.distribution.average /
                              data.distribution.totalCount) *
                            100
                          }%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          </div>

          <div className='flex items-center'>
            <div className='flex-1'>
              <div className='mb-1 flex justify-between'>
                <span className='font-medium text-red-600'>较差</span>
                <span className='text-sm text-gray-600'>
                  {data.distribution.poor} (
                  {data.distribution.totalCount > 0
                    ? (
                        (data.distribution.poor /
                          data.distribution.totalCount) *
                        100
                      ).toFixed(1)
                    : '0.0'}
                  %)
                </span>
              </div>
              <div className='h-3 w-full rounded-full bg-gray-200'>
                <div
                  className='h-3 rounded-full bg-red-500'
                  style={{
                    width:
                      data.distribution.totalCount > 0
                        ? `${
                            (data.distribution.poor /
                              data.distribution.totalCount) *
                            100
                          }%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className='mt-4 rounded bg-gray-50 p-4'>
          <div className='text-sm text-gray-600'>论点总数</div>
          <div className='text-3xl font-bold text-gray-800'>
            {data.distribution.totalCount}
          </div>
        </div>
      </div>

      <div className='rounded-lg border bg-white p-6'>
        <h4 className='mb-4 text-md font-medium'>质量评分趋势</h4>

        <div className='space-y-2'>
          {data.trend.map((item, index) => (
            <div
              key={index}
              className='flex items-center py-2 border-b last:border-b-0'
            >
              <div className='w-24 text-sm text-gray-600'>{item.date}</div>
              <div className='flex-1 flex justify-around text-sm'>
                <span className='text-gray-600'>
                  平均: {(item.averageScore * 100).toFixed(1)}%
                </span>
                <span className='text-gray-600'>
                  最低: {(item.minScore * 100).toFixed(1)}%
                </span>
                <span className='text-gray-600'>
                  最高: {(item.maxScore * 100).toFixed(1)}%
                </span>
                <span className='text-gray-600'>
                  中位: {(item.medianScore * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
