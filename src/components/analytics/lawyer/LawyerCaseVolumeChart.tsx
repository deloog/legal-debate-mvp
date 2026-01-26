/**
 * 律师案件量统计图表组件
 */

'use client';

import { type LawyerCaseVolumeData } from '@/types/stats';

interface LawyerCaseVolumeChartProps {
  data: LawyerCaseVolumeData[];
}

export default function LawyerCaseVolumeChart({
  data,
}: LawyerCaseVolumeChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className='flex items-center justify-center h-75 text-muted-foreground'>
        暂无数据
      </div>
    );
  }

  const maxCases = Math.max(...data.map(d => d.totalCases));

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
              <span className='text-muted-foreground text-xs mr-2'>
                {lawyer.lawyerRole}
              </span>
              <div className='flex items-center gap-3 text-xs'>
                <span className='text-blue-600'>总: {lawyer.totalCases}</span>
                <span className='text-green-600'>
                  完成: {lawyer.completedCases}
                </span>
                <span className='text-orange-600'>
                  进行: {lawyer.activeCases}
                </span>
              </div>
            </div>
            <div className='relative h-2 bg-secondary rounded-full overflow-hidden'>
              <div
                className='absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300'
                style={{
                  width: `${(lawyer.totalCases / maxCases) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
