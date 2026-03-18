/**
 * CaseAnalytics - 案件分析主组件
 */

'use client';

import _React, { useEffect, useState } from 'react';
import { CaseTypeDistributionChart } from './CaseTypeDistributionChart';
import { CaseSuccessRateChart } from './CaseSuccessRateChart';
import { CaseRevenueChart } from './CaseRevenueChart';
import { CaseEfficiencyTrendChart } from './CaseEfficiencyTrendChart';
import type { CaseAnalyticsData } from '@/types/stats';

export interface CaseAnalyticsProps {
  startDate?: string;
  endDate?: string;
  className?: string;
}

export function CaseAnalytics({
  startDate,
  endDate,
  className,
}: CaseAnalyticsProps) {
  const [data, setData] = useState<CaseAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);

        const response = await fetch(
          `/api/analytics/cases?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error('获取案件分析数据失败');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '未知错误');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className={`case-analytics loading ${className || ''}`}>
        <div className='loading-spinner' />
        <p>加载案件分析数据...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`case-analytics error ${className || ''}`}>
        <div className='error-icon'>⚠️</div>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className='retry-btn'>
          重试
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className={`case-analytics ${className || ''}`}>
      <div className='analytics-header'>
        <h2>案件分析</h2>
        {startDate && endDate && (
          <p className='date-range'>
            {new Date(startDate).toLocaleDateString('zh-CN')} 至{' '}
            {new Date(endDate).toLocaleDateString('zh-CN')}
          </p>
        )}
      </div>

      <div className='analytics-grid'>
        {/* 案件类型分布 */}
        <div className='analytics-card'>
          <CaseTypeDistributionChart data={data.typeDistribution} />
        </div>

        {/* 案件成功率分析 */}
        <div className='analytics-card'>
          <CaseSuccessRateChart data={data.successRate} />
        </div>

        {/* 案件效率趋势 */}
        <div className='analytics-card full-width'>
          <CaseEfficiencyTrendChart data={data.efficiency} />
        </div>

        {/* 案件收益分析 */}
        <div className='analytics-card full-width'>
          <CaseRevenueChart data={data.revenueAnalysis} />
        </div>
      </div>

      {/* 活跃案件概览 */}
      <div className='active-cases-overview'>
        <h3>活跃案件概览</h3>
        <div className='active-cases-grid'>
          <div className='case-metric'>
            <div className='metric-label'>总活跃案件</div>
            <div className='metric-value'>
              {data.activeCasesOverview.totalActiveCases}
            </div>
          </div>
          <div className='case-metric'>
            <div className='metric-label'>平均审理周期</div>
            <div className='metric-value'>
              {data.activeCasesOverview.averageDuration}天
            </div>
          </div>
          <div className='case-metric'>
            <div className='metric-label'>即将到期案件</div>
            <div className='metric-value'>
              {data.activeCasesOverview.expiringSoon}
            </div>
          </div>
          <div className='case-metric'>
            <div className='metric-label'>本月新增</div>
            <div className='metric-value'>
              {data.activeCasesOverview.newThisMonth}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
