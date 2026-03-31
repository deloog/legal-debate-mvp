import {
  LitigationCaseType,
  LitigationFeeCalculationParams,
} from '@/types/calculation';

interface LitigationFeeFormProps {
  params: LitigationFeeCalculationParams;
  onChange: (params: LitigationFeeCalculationParams) => void;
}

export function LitigationFeeForm({
  params,
  onChange,
}: LitigationFeeFormProps) {
  const handleChange = (
    field: keyof LitigationFeeCalculationParams,
    value: unknown
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
          htmlFor='caseType'
          className='block text-sm font-medium text-gray-700'
        >
          案件类型
        </label>
        <select
          id='caseType'
          value={params.caseType}
          onChange={e =>
            handleChange('caseType', e.target.value as LitigationCaseType)
          }
          className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
        >
          <option value={LitigationCaseType.PROPERTY}>财产案件</option>
          <option value={LitigationCaseType.DIVORCE}>离婚案件</option>
          <option value={LitigationCaseType.PERSONAL_RIGHTS}>人格权案件</option>
          <option value={LitigationCaseType.INTELLECTUAL_PROPERTY}>
            知识产权案件
          </option>
          <option value={LitigationCaseType.LABOR_DISPUTE}>劳动争议</option>
          <option value={LitigationCaseType.OTHER}>其他非财产案件</option>
        </select>
      </div>
      <div>
        <label
          htmlFor='amount'
          className='block text-sm font-medium text-gray-700'
        >
          标的金额 (元)
        </label>
        <input
          id='amount'
          type='number'
          value={params.amount || 0}
          onChange={e => handleChange('amount', Number(e.target.value))}
          className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
        />
      </div>
      <div className='flex items-center'>
        <input
          id='isReduced'
          type='checkbox'
          checked={params.isReduced || false}
          onChange={e => handleChange('isReduced', e.target.checked)}
          className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
        />
        <label htmlFor='isReduced' className='ml-2 block text-sm text-gray-900'>
          减半收取 (如简易程序)
        </label>
      </div>
    </div>
  );
}
