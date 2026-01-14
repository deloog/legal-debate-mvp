/**
 * 系统性能统计组件
 * 展示响应时间和错误率统计
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  PerformanceErrorRateData,
  PerformanceResponseTimeData,
} from '@/types/stats';

interface PerformanceStatsProps {
  timeRange?: string;
  granularity?: string;
  provider?: string;
  model?: string;
  errorType?: string;
  includeRecovered?: boolean;
}

interface PerformanceStatsData {
  responseTime: PerformanceResponseTimeData | null;
  errorRate: PerformanceErrorRateData | null;
  loading: boolean;
  error: string | null;
}

/**
 * 系统性能统计组件
 */
export function PerformanceStats(props: PerformanceStatsProps) {
  const {
    timeRange,
    granularity,
    provider,
    model,
    errorType,
    includeRecovered,
  } = props;
  const [data, setData] = useState<PerformanceStatsData>({
    responseTime: null,
    errorRate: null,
    loading: true,
    error: null,
  });

  const fetchPerformanceStats = useCallback(async () => {
    try {
      setData({
        responseTime: null,
        errorRate: null,
        loading: true,
        error: null,
      });

      const params = new URLSearchParams();
      if (timeRange) {
        params.append('timeRange', timeRange);
      }
      if (granularity) {
        params.append('granularity', granularity);
      }
      if (provider) {
        params.append('provider', provider);
      }
      if (model) {
        params.append('model', model);
      }
      if (errorType) {
        params.append('errorType', errorType);
      }
      if (includeRecovered) {
        params.append('includeRecovered', 'true');
      }

      const [responseTimeResponse, errorRateResponse] = await Promise.all([
        fetch(`/api/stats/performance/response-time?${params.toString()}`),
        fetch(`/api/stats/performance/error-rate?${params.toString()}`),
      ]);

      if (!responseTimeResponse.ok || !errorRateResponse.ok) {
        throw new Error('获取统计数据失败');
      }

      const responseTimeData = await responseTimeResponse.json();
      const errorRateData = await errorRateResponse.json();

      setData({
        responseTime: responseTimeData.data,
        errorRate: errorRateData.data,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('获取性能统计失败:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '获取统计数据失败',
      }));
    }
  }, [timeRange, granularity, provider, model, errorType, includeRecovered]);

  useEffect(() => {
    fetchPerformanceStats();
  }, [fetchPerformanceStats]);

  if (data.loading) {
    return <div className='p-4'>加载中...</div>;
  }

  if (data.error) {
    return <div className='p-4 text-red-500'>{data.error}</div>;
  }

  return (
    <div className='space-y-6'>
      {data.responseTime && <ResponseTimeSection data={data.responseTime} />}
      {data.errorRate && <ErrorRateSection data={data.errorRate} />}
    </div>
  );
}

/**
 * 响应时间统计部分
 */
function ResponseTimeSection({ data }: { data: PerformanceResponseTimeData }) {
  return (
    <div className='space-y-6'>
      <div className='rounded-lg border bg-white p-6'>
        <h3 className='mb-4 text-lg font-semibold'>响应时间汇总</h3>

        <div className='mb-6 grid grid-cols-4 gap-4'>
          <div className='rounded bg-blue-50 p-4'>
            <div className='text-sm text-gray-600'>总请求数</div>
            <div className='text-2xl font-bold text-blue-600'>
              {data.summary.totalRequests}
            </div>
          </div>
          <div className='rounded bg-green-50 p-4'>
            <div className='text-sm text-gray-600'>平均响应时间</div>
            <div className='text-2xl font-bold text-green-600'>
              {data.summary.averageResponseTime.toFixed(0)}ms
            </div>
          </div>
          <div className='rounded bg-yellow-50 p-4'>
            <div className='text-sm text-gray-600'>P95响应时间</div>
            <div className='text-2xl font-bold text-yellow-600'>
              {data.summary.p95ResponseTime.toFixed(0)}ms
            </div>
          </div>
          <div className='rounded bg-purple-50 p-4'>
            <div className='text-sm text-gray-600'>P99响应时间</div>
            <div className='text-2xl font-bold text-purple-600'>
              {data.summary.p99ResponseTime.toFixed(0)}ms
            </div>
          </div>
        </div>

        <div className='mb-6 grid grid-cols-2 gap-4'>
          <div className='rounded bg-gray-50 p-4'>
            <div className='text-sm text-gray-600'>最快响应时间</div>
            <div className='text-2xl font-bold text-gray-800'>
              {data.summary.minResponseTime.toFixed(0)}ms
            </div>
          </div>
          <div className='rounded bg-gray-50 p-4'>
            <div className='text-sm text-gray-600'>最慢响应时间</div>
            <div className='text-2xl font-bold text-gray-800'>
              {data.summary.maxResponseTime.toFixed(0)}ms
            </div>
          </div>
        </div>
      </div>

      <div className='rounded-lg border bg-white p-6'>
        <h4 className='mb-4 text-md font-medium'>按服务商统计</h4>

        <div className='space-y-2'>
          {data.byProvider.map((item, index) => (
            <div
              key={index}
              className='flex items-center py-2 border-b last:border-b-0'
            >
              <div className='w-32 text-sm font-medium text-gray-700'>
                {item.provider}
              </div>
              <div className='flex-1 flex justify-around text-sm'>
                <span className='text-gray-600'>
                  请求数: {item.totalRequests}
                </span>
                <span className='text-gray-600'>
                  平均响应: {item.averageResponseTime.toFixed(0)}ms
                </span>
              </div>
            </div>
          ))}
          {data.byProvider.length === 0 && (
            <div className='text-center text-sm text-gray-500'>暂无数据</div>
          )}
        </div>
      </div>

      <div className='rounded-lg border bg-white p-6'>
        <h4 className='mb-4 text-md font-medium'>按模型统计（Top 10）</h4>

        <div className='space-y-2'>
          {data.byModel.map((item, index) => (
            <div
              key={index}
              className='flex items-center py-2 border-b last:border-b-0'
            >
              <div className='w-32 text-sm font-medium text-gray-700'>
                {item.model}
              </div>
              <div className='flex-1 flex justify-around text-sm'>
                <span className='text-gray-600'>
                  请求数: {item.totalRequests}
                </span>
                <span className='text-gray-600'>
                  平均响应: {item.averageResponseTime.toFixed(0)}ms
                </span>
              </div>
            </div>
          ))}
          {data.byModel.length === 0 && (
            <div className='text-center text-sm text-gray-500'>暂无数据</div>
          )}
        </div>
      </div>

      <div className='rounded-lg border bg-white p-6'>
        <h4 className='mb-4 text-md font-medium'>响应时间趋势</h4>

        <div className='space-y-2'>
          {data.trend.map((item, index) => (
            <div
              key={index}
              className='flex items-center py-2 border-b last:border-b-0'
            >
              <div className='w-24 text-sm text-gray-600'>{item.date}</div>
              <div className='flex-1 flex justify-around text-sm'>
                <span className='text-gray-600'>请求: {item.count}</span>
                <span className='text-gray-600'>
                  平均: {item.averageResponseTime.toFixed(0)}ms
                </span>
                <span className='text-gray-600'>
                  P95: {item.p95ResponseTime.toFixed(0)}ms
                </span>
              </div>
            </div>
          ))}
          {data.trend.length === 0 && (
            <div className='text-center text-sm text-gray-500'>暂无数据</div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 错误率统计部分
 */
function ErrorRateSection({ data }: { data: PerformanceErrorRateData }) {
  return (
    <div className='space-y-6'>
      <div className='rounded-lg border bg-white p-6'>
        <h3 className='mb-4 text-lg font-semibold'>错误率汇总</h3>

        <div className='mb-6 grid grid-cols-4 gap-4'>
          <div className='rounded bg-blue-50 p-4'>
            <div className='text-sm text-gray-600'>总请求数</div>
            <div className='text-2xl font-bold text-blue-600'>
              {data.summary.totalRequests}
            </div>
          </div>
          <div className='rounded bg-green-50 p-4'>
            <div className='text-sm text-gray-600'>成功请求数</div>
            <div className='text-2xl font-bold text-green-600'>
              {data.summary.successCount}
            </div>
          </div>
          <div className='rounded bg-red-50 p-4'>
            <div className='text-sm text-gray-600'>错误请求数</div>
            <div className='text-2xl font-bold text-red-600'>
              {data.summary.errorCount}
            </div>
          </div>
          <div className='rounded bg-yellow-50 p-4'>
            <div className='text-sm text-gray-600'>错误率</div>
            <div className='text-2xl font-bold text-yellow-600'>
              {data.summary.errorRate.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className='mb-6 grid grid-cols-2 gap-4'>
          <div className='rounded bg-green-50 p-4'>
            <div className='text-sm text-gray-600'>恢复错误数</div>
            <div className='text-2xl font-bold text-green-600'>
              {data.summary.recoveredCount}
            </div>
          </div>
          <div className='rounded bg-purple-50 p-4'>
            <div className='text-sm text-gray-600'>恢复率</div>
            <div className='text-2xl font-bold text-purple-600'>
              {data.summary.recoveryRate.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      <div className='rounded-lg border bg-white p-6'>
        <h4 className='mb-4 text-md font-medium'>按服务商统计</h4>

        <div className='space-y-2'>
          {data.byProvider.map((item, index) => (
            <div
              key={index}
              className='flex items-center py-2 border-b last:border-b-0'
            >
              <div className='w-32 text-sm font-medium text-gray-700'>
                {item.provider}
              </div>
              <div className='flex-1 flex justify-around text-sm'>
                <span className='text-gray-600'>
                  请求数: {item.totalRequests}
                </span>
                <span className='text-gray-600'>错误数: {item.errorCount}</span>
                <span className='text-gray-600'>
                  错误率: {item.errorRate.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
          {data.byProvider.length === 0 && (
            <div className='text-center text-sm text-gray-500'>暂无数据</div>
          )}
        </div>
      </div>

      <div className='rounded-lg border bg-white p-6'>
        <h4 className='mb-4 text-md font-medium'>按错误类型分布</h4>

        <div className='space-y-3'>
          {data.byErrorType.map((item, index) => (
            <div key={index}>
              <div className='mb-1 flex justify-between'>
                <span className='font-medium text-gray-700'>
                  {item.errorType}
                </span>
                <span className='text-sm text-gray-600'>
                  {item.count} ({item.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className='h-3 w-full rounded-full bg-gray-200'>
                <div
                  className='h-3 rounded-full bg-blue-500'
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              <div className='mt-1 text-xs text-gray-500'>
                已恢复: {item.recovered} ({item.recoveryRate.toFixed(1)}%)
              </div>
            </div>
          ))}
          {data.byErrorType.length === 0 && (
            <div className='text-center text-sm text-gray-500'>暂无数据</div>
          )}
        </div>
      </div>

      <div className='rounded-lg border bg-white p-6'>
        <h4 className='mb-4 text-md font-medium'>按严重程度分布</h4>

        <div className='space-y-3'>
          {data.bySeverity.map((item, index) => {
            const severityColors: Record<string, string> = {
              LOW: 'bg-green-500',
              MEDIUM: 'bg-yellow-500',
              HIGH: 'bg-orange-500',
              CRITICAL: 'bg-red-500',
            };
            return (
              <div key={index}>
                <div className='mb-1 flex justify-between'>
                  <span
                    className={`font-medium text-${
                      {
                        LOW: 'green',
                        MEDIUM: 'yellow',
                        HIGH: 'orange',
                        CRITICAL: 'red',
                      }[item.severity] || 'gray'
                    }-600`}
                  >
                    {item.severity}
                  </span>
                  <span className='text-sm text-gray-600'>
                    {item.count} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className='h-3 w-full rounded-full bg-gray-200'>
                  <div
                    className={`h-3 rounded-full ${severityColors[item.severity] || 'bg-gray-500'}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
          {data.bySeverity.length === 0 && (
            <div className='text-center text-sm text-gray-500'>暂无数据</div>
          )}
        </div>
      </div>

      <div className='rounded-lg border bg-white p-6'>
        <h4 className='mb-4 text-md font-medium'>错误率趋势</h4>

        <div className='space-y-2'>
          {data.trend.map((item, index) => (
            <div
              key={index}
              className='flex items-center py-2 border-b last:border-b-0'
            >
              <div className='w-24 text-sm text-gray-600'>{item.date}</div>
              <div className='flex-1 flex justify-around text-sm'>
                <span className='text-gray-600'>
                  总请求: {item.totalRequests}
                </span>
                <span className='text-gray-600'>成功: {item.successCount}</span>
                <span className='text-gray-600'>失败: {item.errorCount}</span>
                <span className='text-gray-600'>
                  错误率: {item.errorRate.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
          {data.trend.length === 0 && (
            <div className='text-center text-sm text-gray-500'>暂无数据</div>
          )}
        </div>
      </div>
    </div>
  );
}
