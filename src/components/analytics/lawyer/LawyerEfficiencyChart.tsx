/**
 * 律师效率统计图表组件
 */

'use client';

import { type LawyerEfficiencyData } from '@/types/stats';

interface LawyerEfficiencyChartProps {
  data: LawyerEfficiencyData[];
}

const efficiencyRatingConfig = {
  EXCELLENT: { label: '优秀', color: 'bg-green-500' },
  GOOD: { label: '良好', color: 'bg-blue-500' },
  AVERAGE: { label: '一般', color: 'bg-yellow-500' },
  POOR: { label: '需改进', color: 'bg-red-500' },
};

export default function LawyerEfficiencyChart({
  data,
}: LawyerEfficiencyChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className='flex items-center justify-center h-75 text-muted-foreground'>
        暂无数据
      </div>
    );
  }

  const maxDays = Math.max(...data.map(d => d.averageCompletionTime));

  return (
    <div className='space-y-4'>
      <div className='space-y-3'>
        {data.map(lawyer => (
          <div key={lawyer.lawyerId} className='space-y-1'>
            <div className='flex items-center justify-between text-sm'>
              <span
                className='font-medium truncate flex-1 mr-2'
                title={lawyer.lawyerName}
              >
                {lawyer.lawyerName}
              </span>
              <div className='flex items-center gap-2 text-xs'>
                <span className='text-blue-600'>
                  均: {lawyer.averageCompletionTime.toFixed(1)}天
                </span>
                <span className='text-muted-foreground'>
                  中: {lawyer.medianCompletionTime.toFixed(1)}天
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-white ${
                    efficiencyRatingConfig[lawyer.efficiencyRating].color
                  }`}
                >
                  {efficiencyRatingConfig[lawyer.efficiencyRating].label}
                </span>
              </div>
            </div>
            <div className='relative h-2 bg-secondary rounded-full overflow-hidden'>
              <div
                className='absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300'
                style={{
                  width: `${(lawyer.averageCompletionTime / maxDays) * 100}%`,
                }}
              />
            </div>
            <div className='flex items-center justify-between text-xs text-muted-foreground pl-2'>
              <span>最快: {lawyer.fastestCompletionTime.toFixed(1)}天</span>
              <span>最慢: {lawyer.slowestCompletionTime.toFixed(1)}天</span>
              <span>完成: {lawyer.completedCases}案</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
