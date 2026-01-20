'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { MembershipTier, MembershipStatus } from '@/types/membership';

// =============================================================================
// 类型定义
// =============================================================================

interface ExportFormProps {
  onExport: (params: ExportParams) => Promise<void>;
  exporting: boolean;
}

interface ExportParams {
  tier: string;
  status: string;
  format: 'csv' | 'json' | 'excel';
  startDate?: string;
  endDate?: string;
}

// =============================================================================
// 常量定义
// =============================================================================

const TIER_OPTIONS = [
  { value: '', label: '全部等级' },
  { value: MembershipTier.FREE, label: '免费版' },
  { value: MembershipTier.BASIC, label: '基础版' },
  { value: MembershipTier.PROFESSIONAL, label: '专业版' },
  { value: MembershipTier.ENTERPRISE, label: '企业版' },
];

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: MembershipStatus.ACTIVE, label: '生效中' },
  { value: MembershipStatus.EXPIRED, label: '已过期' },
  { value: MembershipStatus.CANCELLED, label: '已取消' },
  { value: MembershipStatus.SUSPENDED, label: '已暂停' },
  { value: MembershipStatus.PENDING, label: '待生效' },
];

const FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV格式', icon: FileSpreadsheet },
  { value: 'json', label: 'JSON格式', icon: FileSpreadsheet },
  { value: 'excel', label: 'Excel格式', icon: FileSpreadsheet },
];

// =============================================================================
// 主组件
// =============================================================================

export function MembershipExportForm({
  onExport,
  exporting,
}: ExportFormProps): React.ReactElement {
  const [params, setParams] = useState<ExportParams>({
    tier: '',
    status: '',
    format: 'csv',
  });

  const handleExport = async (): Promise<void> => {
    await onExport(params);
  };

  return (
    <div className='bg-white rounded-lg shadow p-6'>
      <h2 className='text-xl font-semibold text-gray-900 mb-6'>导出会员数据</h2>

      <div className='space-y-6'>
        {/* 会员等级筛选 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            会员等级
          </label>
          <select
            value={params.tier}
            onChange={e =>
              setParams(prev => ({ ...prev, tier: e.target.value }))
            }
            className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            disabled={exporting}
          >
            {TIER_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 会员状态筛选 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            会员状态
          </label>
          <select
            value={params.status}
            onChange={e =>
              setParams(prev => ({ ...prev, status: e.target.value }))
            }
            className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            disabled={exporting}
          >
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 导出格式选择 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            导出格式
          </label>
          <div className='grid grid-cols-3 gap-3'>
            {FORMAT_OPTIONS.map(option => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type='button'
                  onClick={() =>
                    setParams(prev => ({
                      ...prev,
                      format: option.value as 'csv' | 'json' | 'excel',
                    }))
                  }
                  disabled={exporting}
                  className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-lg transition-colors ${
                    params.format === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <Icon className='h-4 w-4' />
                  <span className='text-sm'>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 时间范围选择 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            时间范围（可选）
          </label>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs text-gray-500 mb-1'>
                开始日期
              </label>
              <input
                type='date'
                value={params.startDate || ''}
                onChange={e =>
                  setParams(prev => ({ ...prev, startDate: e.target.value }))
                }
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                disabled={exporting}
              />
            </div>
            <div>
              <label className='block text-xs text-gray-500 mb-1'>
                结束日期
              </label>
              <input
                type='date'
                value={params.endDate || ''}
                onChange={e =>
                  setParams(prev => ({ ...prev, endDate: e.target.value }))
                }
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                disabled={exporting}
              />
            </div>
          </div>
        </div>

        {/* 导出按钮 */}
        <div>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className='w-full'
          >
            <Download className='h-4 w-4 mr-2' />
            {exporting ? '导出中...' : '开始导出'}
          </Button>
        </div>
      </div>
    </div>
  );
}
