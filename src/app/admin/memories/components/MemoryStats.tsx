'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Clock, Database, Zap } from 'lucide-react';

interface MigrationStats {
  summary: {
    workingToHot: {
      completed: number;
      failed: number;
      avgExecutionTime: number;
    };
    hotToCold: {
      completed: number;
      failed: number;
      avgExecutionTime: number;
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
    memoryId?: string;
    compressionRatio?: number;
  }>;
  dailyTrend: Record<string, number>;
}

interface MemoryStatsProps {
  refreshTrigger?: number;
}

export function MemoryStats({ refreshTrigger }: MemoryStatsProps) {
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/memory/migration-stats');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch stats');
      }

      setStats(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center p-8'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='rounded-lg border border-red-200 bg-red-50 p-4 text-red-600'>
        加载统计失败: {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className='rounded-lg border bg-card p-4 text-muted-foreground'>
        暂无统计数据
      </div>
    );
  }

  const { summary, recentMigrations } = stats;

  return (
    <div className='space-y-4'>
      {/* 统计卡片 */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Working → Hot</CardTitle>
            <Zap className='h-4 w-4 text-blue-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {summary.workingToHot.completed}
            </div>
            <p className='text-xs text-muted-foreground'>
              成功 / {summary.workingToHot.failed} 失败
            </p>
            <p className='text-xs text-muted-foreground'>
              平均耗时: {summary.workingToHot.avgExecutionTime}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Hot → Cold</CardTitle>
            <Database className='h-4 w-4 text-purple-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {summary.hotToCold.completed}
            </div>
            <p className='text-xs text-muted-foreground'>
              成功 / {summary.hotToCold.failed} 失败
            </p>
            <p className='text-xs text-muted-foreground'>
              平均耗时: {summary.hotToCold.avgExecutionTime}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>平均压缩比</CardTitle>
            <TrendingUp className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {(summary.compression.avgRatio * 100).toFixed(1)}%
            </div>
            <p className='text-xs text-muted-foreground'>
              最高: {(summary.compression.maxRatio * 100).toFixed(1)}%
            </p>
            <p className='text-xs text-muted-foreground'>
              最低: {(summary.compression.minRatio * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>总迁移次数</CardTitle>
            <Clock className='h-4 w-4 text-orange-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {summary.workingToHot.completed + summary.hotToCold.completed}
            </div>
            <p className='text-xs text-muted-foreground'>最近 7 天</p>
          </CardContent>
        </Card>
      </div>

      {/* 最近迁移记录 */}
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>最近迁移记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            {recentMigrations.slice(0, 5).map(migration => (
              <div
                key={migration.id}
                className='flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0'
              >
                <div className='flex items-center gap-2'>
                  <Badge
                    variant='default'
                    className={
                      migration.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }
                  >
                    {migration.status === 'COMPLETED' ? '成功' : '失败'}
                  </Badge>
                  <span className='text-muted-foreground'>
                    {migration.actionName}
                  </span>
                </div>
                <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                  {migration.compressionRatio && (
                    <span>
                      压缩: {(migration.compressionRatio * 100).toFixed(1)}%
                    </span>
                  )}
                  <span>{migration.executionTime}ms</span>
                  <span>
                    {new Date(migration.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            ))}
            {recentMigrations.length === 0 && (
              <div className='text-sm text-muted-foreground'>暂无迁移记录</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
