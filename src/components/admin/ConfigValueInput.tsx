'use client';

import React, { useState } from 'react';
import { ConfigType } from '@prisma/client';

/**
 * 配置值输入组件Props
 */
interface ConfigValueInputProps {
  type: ConfigType;
  value: unknown;
  onChange: (value: unknown) => void;
  validationError?: string | null;
}

/**
 * 配置值输入组件
 */
export function ConfigValueInput({
  type,
  value,
  onChange,
  validationError,
}: ConfigValueInputProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const inputValue = e.target.value;
    let parsedValue: unknown;
    let error: string | null = null;

    switch (type) {
      case 'STRING':
        parsedValue = inputValue;
        break;
      case 'NUMBER':
        const num = Number.parseFloat(inputValue);
        if (Number.isNaN(num)) {
          error = '请输入有效的数字';
        }
        parsedValue = num;
        break;
      case 'BOOLEAN':
        parsedValue = inputValue === 'true';
        break;
      case 'ARRAY':
      case 'OBJECT':
        try {
          parsedValue = JSON.parse(inputValue);
        } catch {
          error = '请输入有效的JSON格式';
          parsedValue = inputValue;
        }
        break;
      default:
        parsedValue = inputValue;
    }

    setLocalError(error);
    onChange(parsedValue);
  };

  const baseClassName =
    'w-full text-sm font-mono rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  if (type === 'BOOLEAN') {
    return (
      <select
        value={String(value)}
        onChange={handleChange}
        className={baseClassName + ' p-2'}
      >
        <option value='true'>是</option>
        <option value='false'>否</option>
      </select>
    );
  }

  if (type === 'STRING' && String(value).length < 100) {
    return (
      <input
        type='text'
        value={String(value)}
        onChange={handleChange}
        className={baseClassName + ' p-2'}
        placeholder='请输入配置值'
      />
    );
  }

  return (
    <div>
      <textarea
        value={
          typeof value === 'object'
            ? JSON.stringify(value, null, 2)
            : String(value)
        }
        onChange={handleChange}
        className={baseClassName + ' p-2 min-h-25'}
        placeholder='请输入配置值'
      />
      {(localError || validationError) && (
        <p className='text-sm text-red-600 mt-1'>
          {localError || validationError}
        </p>
      )}
    </div>
  );
}
