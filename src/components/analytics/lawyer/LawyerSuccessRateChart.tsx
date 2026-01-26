/**
 * 律师胜诉率统计图表组件
 */

'use client';

import { type LawyerSuccessRateData } from '@/types/stats';

interface LawyerSuccessRateChartProps {
  data: LawyerSuccessRateData[];
}

export default function LawyerSuccessRateChart({
  data,
}: LawyerSuccessRateChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className='flex items-center justify-center h-75 text-muted-foreground'>
        暂无数据
      </div>
    );
  }

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
                  {lawyer.successRate.toFixed(1)}%
                </span>
                <span className='text-muted-foreground'>
                  ({lawyer.successfulCases}/{lawyer.totalCases})
                </span>
              </div>
            </div>
            <div className='relative h-2 bg-secondary rounded-full overflow-hidden'>
              <div
                className='absolute left-0 top-0 h-full bg-green-500 transition-all duration-300'
                style={{
                  width: `${lawyer.successRate}%`,
                }}
              />
            </div>
            {lawyer.byType.length > 0 && (
              <div className='pl-2 space-y-1 mt-1'>
                <div className='text-xs text-muted-foreground'>按案件类型:</div>
                {lawyer.byType.map((item, index) => (
                  <div key={index} className='flex items-center gap-2 text-xs'>
                    <span className='w-20 truncate' title={item.type}>
                      {item.type}
                    </span>
                    <div className='flex-1 relative h-1 bg-secondary rounded-full overflow-hidden'>
                      <div
                        className='absolute left-0 top-0 h-full bg-blue-400'
                        style={{
                          width: `${item.successRate}%`,
                        }}
                      />
                    </div>
                    <span className='text-muted-foreground w-12 text-right'>
                      {item.successRate.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
