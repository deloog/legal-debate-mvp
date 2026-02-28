'use client';

import _React, { useState, useEffect } from 'react';
import { SystemConfig } from '@prisma/client';
import { ConfigValueInput } from '@/components/admin/ConfigValueInput';

/**
 * 配置项组件Props
 */
interface ConfigItemProps {
  config: SystemConfig;
  isEditing: boolean;
  editValue: unknown;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onValueChange: (value: unknown) => void;
}

/**
 * 单个配置项组件
 */
export function ConfigItem({
  config,
  isEditing,
  editValue,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onValueChange,
}: ConfigItemProps) {
  const [localValue, setLocalValue] = useState<unknown>(editValue);

  useEffect(() => {
    setLocalValue(editValue);
  }, [editValue]);

  const handleSave = () => {
    onValueChange(localValue);
    onSave();
  };

  return (
    <div className='bg-white rounded-lg border border-gray-200 p-6 hover:shadow-sm transition-shadow'>
      <div className='flex items-start justify-between mb-4'>
        <div className='flex-1'>
          <div className='flex items-center gap-2 mb-1'>
            <h3 className='text-lg font-semibold text-gray-900'>
              {config.key}
            </h3>
            {config.isRequired && (
              <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800'>
                必填
              </span>
            )}
            {config.isPublic && (
              <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800'>
                公开
              </span>
            )}
            <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800'>
              {config.type}
            </span>
          </div>
          <p className='text-sm text-gray-600'>{config.description}</p>
        </div>
        <div className='flex gap-2'>
          {!isEditing ? (
            <>
              <button
                onClick={onEdit}
                className='px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-600 rounded hover:bg-blue-50 transition-colors'
              >
                编辑
              </button>
              {!config.isRequired && (
                <button
                  onClick={onDelete}
                  className='px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-600 rounded hover:bg-red-50 transition-colors'
                >
                  删除
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                className='px-3 py-1 text-sm text-green-600 hover:text-green-800 border border-green-600 rounded hover:bg-green-50 transition-colors'
              >
                保存
              </button>
              <button
                onClick={onCancel}
                className='px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-600 rounded hover:bg-gray-50 transition-colors'
              >
                取消
              </button>
            </>
          )}
        </div>
      </div>

      <div className='bg-gray-50 rounded-lg p-4'>
        <label className='block text-sm font-medium text-gray-700 mb-2'>
          配置值
        </label>
        {isEditing ? (
          <ConfigValueInput
            type={config.type}
            value={localValue}
            onChange={setLocalValue}
          />
        ) : (
          <div className='text-sm font-mono bg-white rounded border border-gray-200 p-3'>
            {formatConfigValue(config.value, config.type)}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 格式化配置值显示
 */
function formatConfigValue(value: unknown, type: string): string {
  switch (type) {
    case 'BOOLEAN':
      return value === true ? '是' : '否';
    case 'ARRAY':
    case 'OBJECT':
      return typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value);
    default:
      return String(value);
  }
}
