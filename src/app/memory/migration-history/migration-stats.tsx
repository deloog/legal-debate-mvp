'use client';

import { useEffect, useState } from 'react';

export interface MigrationStatsResponse {
  success: boolean;
  data: {
    summary: {
      workingToHot: {
        completed: number;
        failed: number;
        avgExecutionTime: number;
        totalExecutionTime: number;
      };
      hotToCold: {
        completed: number;
        failed: number;
        avgExecutionTime: number;
        totalExecutionTime: number;
      };
      compression: {
        avgRatio: number;
        maxRatio: number;
        minRatio: number;
      };
    };
    recentMigrations: Array<{
      id: string;
      actionType: string;
      actionName: string;
      status: string;
      executionTime: number;
      createdAt: string;
      memoryId: string;
      compressionRatio?: number;
    }>;
    dailyTrend: Record<string, number>;
    period: string;
  };
}

export function MigrationStats() {
  const [data, setData] = useState<MigrationStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/v1/memory/migration-stats');

        if (!response.ok) {
          throw new Error('获取迁移统计失败');
        }

        const result: MigrationStatsResponse = await response.json();

        if (result.success) {
          setData(result);
        } else {
          throw new Error('未知错误');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '未知错误');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className='flex items-center justify-center p-8'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='p-4 bg-red-50 border border-red-200 rounded-lg'>
        <p className='text-red-800'>{error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { summary, recentMigrations, dailyTrend } = data.data;

  return (
    <div className='space-y-6'>
      <h3 className='text-lg font-semibold text-gray-900'>迁移统计概览</h3>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div className='bg-blue-50 p-4 rounded-lg'>
          <h4 className='text-sm font-medium text-blue-900 mb-2'>
            Working→Hot 迁移
          </h4>
          <div className='space-y-1'>
            <div className='flex justify-between text-sm'>
              <span className='text-blue-700'>成功:</span>
              <span className='font-semibold text-blue-900'>
                {summary.workingToHot.completed}
              </span>
            </div>
            <div className='flex justify-between text-sm'>
              <span className='text-blue-700'>失败:</span>
              <span className='font-semibold text-blue-900'>
                {summary.workingToHot.failed}
              </span>
            </div>
            <div className='flex justify-between text-sm'>
              <span className='text-blue-700'>平均耗时:</span>
              <span className='font-semibold text-blue-900'>
                {summary.workingToHot.avgExecutionTime}ms
              </span>
            </div>
          </div>
        </div>

        <div className='bg-purple-50 p-4 rounded-lg'>
          <h4 className='text-sm font-medium text-purple-900 mb-2'>
            Hot→Cold 归档
          </h4>
          <div className='space-y-1'>
            <div className='flex justify-between text-sm'>
              <span className='text-purple-700'>成功:</span>
              <span className='font-semibold text-purple-900'>
                {summary.hotToCold.completed}
              </span>
            </div>
            <div className='flex justify-between text-sm'>
              <span className='text-purple-700'>失败:</span>
              <span className='font-semibold text-purple-900'>
                {summary.hotToCold.failed}
              </span>
            </div>
            <div className='flex justify-between text-sm'>
              <span className='text-purple-700'>平均耗时:</span>
              <span className='font-semibold text-purple-900'>
                {summary.hotToCold.avgExecutionTime}ms
              </span>
            </div>
          </div>
        </div>

        <div className='bg-green-50 p-4 rounded-lg'>
          <h4 className='text-sm font-medium text-green-900 mb-2'>压缩统计</h4>
          <div className='space-y-1'>
            <div className='flex justify-between text-sm'>
              <span className='text-green-700'>平均压缩比:</span>
              <span className='font-semibold text-green-900'>
                {summary.compression.avgRatio.toFixed(2)}
              </span>
            </div>
            <div className='flex justify-between text-sm'>
              <span className='text-green-700'>最高压缩比:</span>
              <span className='font-semibold text-green-900'>
                {summary.compression.maxRatio.toFixed(2)}
              </span>
            </div>
            <div className='flex justify-between text-sm'>
              <span className='text-green-700'>最低压缩比:</span>
              <span className='font-semibold text-green-900'>
                {summary.compression.minRatio.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {Object.keys(dailyTrend).length > 0 && (
        <div className='bg-gray-50 p-4 rounded-lg'>
          <h4 className='text-sm font-medium text-gray-900 mb-4'>
            最近7天迁移趋势
          </h4>
          <div className='flex items-end space-x-2 h-32'>
            {Object.entries(dailyTrend).map(([date, count]) => (
              <div key={date} className='flex-1 flex flex-col items-center'>
                <div
                  className='w-full bg-blue-500 rounded-t'
                  style={{
                    height: `${Math.max(
                      5,
                      (count / Math.max(...Object.values(dailyTrend))) * 100
                    )}%`,
                  }}
                />
                <span className='text-xs text-gray-600 mt-2'>
                  {new Date(date).getDate()}
                </span>
                <span className='text-xs text-gray-900 font-medium'>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentMigrations.length > 0 && (
        <div className='bg-white border border-gray-200 rounded-lg'>
          <h4 className='text-sm font-medium text-gray-900 p-4 border-b'>
            最近10条迁移记录
          </h4>
          <div className='divide-y divide-gray-200'>
            {recentMigrations.map(migration => (
              <div key={migration.id} className='p-4 hover:bg-gray-50'>
                <div className='flex items-center justify-between'>
                  <div className='flex-1'>
                    <div className='flex items-center space-x-2'>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          migration.actionType === 'MIGRATE_WORKING_TO_HOT'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {migration.actionType === 'MIGRATE_WORKING_TO_HOT'
                          ? 'Working→Hot'
                          : 'Hot→Cold'}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          migration.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {migration.status === 'COMPLETED' ? '成功' : '失败'}
                      </span>
                    </div>
                    <p className='text-xs text-gray-600 mt-1'>
                      {new Date(migration.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  {migration.compressionRatio && (
                    <div className='text-right'>
                      <p className='text-sm text-gray-900'>
                        压缩比: {migration.compressionRatio.toFixed(2)}
                      </p>
                      <p className='text-xs text-gray-600'>
                        {migration.executionTime}ms
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
