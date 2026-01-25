import React from 'react';
import { TravelExpenseCalculationParams } from '@/types/calculation';

interface TravelExpenseFormProps {
  params: TravelExpenseCalculationParams;
  onChange: (params: TravelExpenseCalculationParams) => void;
}

export function TravelExpenseForm({
  params,
  onChange,
}: TravelExpenseFormProps) {
  const handleChange = (
    field: keyof TravelExpenseCalculationParams,
    value: number
  ) => {
    onChange({
      ...params,
      [field]: value,
    });
  };

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-4'>
        <div>
          <label
            htmlFor='days'
            className='block text-sm font-medium text-gray-700'
          >
            出差天数
          </label>
          <input
            id='days'
            type='number'
            value={params.days}
            onChange={e => handleChange('days', Number(e.target.value))}
            className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
          />
        </div>
        <div>
          <label
            htmlFor='peopleCount'
            className='block text-sm font-medium text-gray-700'
          >
            人数
          </label>
          <input
            id='peopleCount'
            type='number'
            value={params.peopleCount}
            onChange={e => handleChange('peopleCount', Number(e.target.value))}
            className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
          />
        </div>
      </div>
      {/* 实际费用输入可以在这里扩展 */}
    </div>
  );
}
