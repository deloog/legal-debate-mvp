/**
 * 律师绩效分析主组件
 * 展示律师案件量、胜诉率、创收、效率等综合绩效数据
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type LawyerPerformanceData, TimeRange } from '@/types/stats';
import LawyerCaseVolumeChart from './LawyerCaseVolumeChart';
import LawyerSuccessRateChart from './LawyerSuccessRateChart';
import LawyerRevenueChart from './LawyerRevenueChart';
import LawyerEfficiencyChart from './LawyerEfficiencyChart';
import { Loader2, TrendingUp, Users, DollarSign, Clock } from 'lucide-react';

interface LawyerPerformanceProps {
  initialTimeRange?: TimeRange;
}

export default function LawyerPerformance({
  initialTimeRange = TimeRange.LAST_30_DAYS,
}: LawyerPerformanceProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);
  const [sortBy, setSortBy] = useState<
    'caseVolume' | 'successRate' | 'revenue' | 'efficiency'
  >('caseVolume');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LawyerPerformanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, sortBy, sortOrder]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const url = new URL('/api/analytics/lawyers', window.location.origin);
      url.searchParams.set('timeRange', timeRange);
      url.searchParams.set('sortBy', sortBy);
      url.searchParams.set('sortOrder', sortOrder);
      url.searchParams.set('limit', '10');

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 获取律师绩效数据失败`);
      }
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message || '获取律师绩效数据失败');
      }
    } catch (err) {
      setError('网络请求失败，请稍后重试');
      console.error('获取律师绩效数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-100'>
        <Loader2 className='h-8 w-8 animate-spin text-primary' />
        <span className='ml-2 text-muted-foreground'>加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className='w-full'>
        <CardContent className='flex flex-col items-center justify-center min-h-100'>
          <p className='text-red-500 mb-4'>{error}</p>
          <Button onClick={fetchData} variant='outline'>
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className='space-y-6'>
      {/* 控制栏 */}
      <div className='flex flex-wrap items-center gap-4'>
        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium'>时间范围:</label>
          <Select
            value={timeRange}
            onValueChange={(value: string) => setTimeRange(value as TimeRange)}
          >
            <SelectTrigger className='w-45'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TimeRange.LAST_7_DAYS}>最近7天</SelectItem>
              <SelectItem value={TimeRange.LAST_30_DAYS}>最近30天</SelectItem>
              <SelectItem value={TimeRange.LAST_90_DAYS}>最近90天</SelectItem>
              <SelectItem value={TimeRange.THIS_MONTH}>本月</SelectItem>
              <SelectItem value={TimeRange.LAST_MONTH}>上月</SelectItem>
              <SelectItem value={TimeRange.THIS_YEAR}>今年</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium'>排序:</label>
          <Select
            value={sortBy}
            onValueChange={(value: string) =>
              setSortBy(
                value as 'caseVolume' | 'successRate' | 'revenue' | 'efficiency'
              )
            }
          >
            <SelectTrigger className='w-37.5'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='caseVolume'>案件量</SelectItem>
              <SelectItem value='successRate'>胜诉率</SelectItem>
              <SelectItem value='revenue'>创收</SelectItem>
              <SelectItem value='efficiency'>效率</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortOrder}
            onValueChange={(value: string) =>
              setSortOrder(value as 'asc' | 'desc')
            }
          >
            <SelectTrigger className='w-30'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='desc'>降序</SelectItem>
              <SelectItem value='asc'>升序</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={fetchData} variant='outline' size='sm'>
          刷新
        </Button>
      </div>

      {/* 摘要卡片 */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>律师总数</CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {data.summary.totalLawyers}
            </div>
            <p className='text-xs text-muted-foreground'>
              平均每人 {data.summary.averageCasesPerLawyer} 案
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>平均胜诉率</CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {data.summary.averageSuccessRate}%
            </div>
            <p className='text-xs text-muted-foreground'>团队整体表现</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>总创收</CardTitle>
            <DollarSign className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              ¥{data.summary.totalRevenue.toLocaleString()}
            </div>
            <p className='text-xs text-muted-foreground'>统计期间累计</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>平均效率</CardTitle>
            <Clock className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {data.summary.averageEfficiency}天
            </div>
            <p className='text-xs text-muted-foreground'>平均完成时间</p>
          </CardContent>
        </Card>
      </div>

      {/* 图表区域 */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <Card>
          <CardHeader>
            <CardTitle>案件量统计</CardTitle>
          </CardHeader>
          <CardContent>
            <LawyerCaseVolumeChart data={data.caseVolume} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>胜诉率统计</CardTitle>
          </CardHeader>
          <CardContent>
            <LawyerSuccessRateChart data={data.successRate} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>创收统计</CardTitle>
          </CardHeader>
          <CardContent>
            <LawyerRevenueChart data={data.revenue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>效率统计</CardTitle>
          </CardHeader>
          <CardContent>
            <LawyerEfficiencyChart data={data.efficiency} />
          </CardContent>
        </Card>
      </div>

      {/* 数据时间 */}
      <p className='text-xs text-muted-foreground text-center'>
        数据生成时间:{' '}
        {new Date(data.metadata.generatedAt).toLocaleString('zh-CN')}
      </p>
    </div>
  );
}
