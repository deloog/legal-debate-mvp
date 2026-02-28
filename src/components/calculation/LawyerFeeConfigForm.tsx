import _React, { useState } from 'react';
import { LawyerFeeRateData, BillingMode } from '@/types/calculation';

// 这个组件可以用来展示和编辑律师费配置
// 在Act Mode中，为了演示和确保通过tsc检查，我创建一个简单的组件
export default function LawyerFeeConfigForm() {
  const [config, setConfig] = useState<LawyerFeeRateData>({
    defaultMode: BillingMode.HOURLY,
    hourlyRate: 1500,
    contingencyRate: 0,
    percentageRules: [],
  });

  return (
    <div className='p-4 border rounded'>
      <h3 className='text-lg font-bold mb-4'>律师费配置</h3>
      <div className='space-y-4'>
        <div>
          <label className='block text-sm font-medium'>默认计费模式</label>
          <select
            value={config.defaultMode}
            onChange={e =>
              setConfig({
                ...config,
                defaultMode: e.target.value as BillingMode,
              })
            }
            className='mt-1 block w-full rounded-md border-gray-300'
          >
            <option value={BillingMode.HOURLY}>计时收费</option>
            <option value={BillingMode.FIXED}>固定收费</option>
            <option value={BillingMode.PERCENTAGE}>按比例收费</option>
            <option value={BillingMode.CONTINGENCY}>风险代理</option>
          </select>
        </div>

        <div>
          <label className='block text-sm font-medium'>
            小时费率 (元/小时)
          </label>
          <input
            type='number'
            value={config.hourlyRate}
            onChange={e =>
              setConfig({ ...config, hourlyRate: Number(e.target.value) })
            }
            className='mt-1 block w-full rounded-md border-gray-300'
          />
        </div>

        <div>
          <label className='block text-sm font-medium'>风险代理比例 (%)</label>
          <input
            type='number'
            value={config.contingencyRate}
            onChange={e =>
              setConfig({ ...config, contingencyRate: Number(e.target.value) })
            }
            className='mt-1 block w-full rounded-md border-gray-300'
          />
        </div>
      </div>
    </div>
  );
}
