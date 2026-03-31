import { LawyerFeeCalculationParams } from '@/types/calculation';

interface LawyerFeeFormProps {
  params: LawyerFeeCalculationParams;
  onChange: (params: LawyerFeeCalculationParams) => void;
}

export function LawyerFeeForm({ params, onChange }: LawyerFeeFormProps) {
  const handleChange = (
    field: keyof LawyerFeeCalculationParams,
    value: number | boolean
  ) => {
    onChange({
      ...params,
      [field]: value,
    });
  };

  return (
    <div className='space-y-4'>
      <div>
        <label
          htmlFor='hours'
          className='block text-sm font-medium text-gray-700'
        >
          工作时长 (小时)
        </label>
        <input
          id='hours'
          type='number'
          value={params.hours || 0}
          onChange={e => handleChange('hours', Number(e.target.value))}
          className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
        />
      </div>
      <div>
        <label
          htmlFor='caseAmount'
          className='block text-sm font-medium text-gray-700'
        >
          案件金额 (元)
        </label>
        <input
          id='caseAmount'
          type='number'
          value={params.caseAmount || 0}
          onChange={e => handleChange('caseAmount', Number(e.target.value))}
          className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
        />
      </div>
      {/* 风险代理相关字段可以在这里扩展 */}
    </div>
  );
}
