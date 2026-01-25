'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  TemplateVariable,
  TemplateVariableType,
} from '@/types/document-template';

export interface TemplateVariablePickerProps {
  variables: TemplateVariable[];
  onChange: (variables: TemplateVariable[]) => void;
  onInsert?: (variable: TemplateVariable) => void;
  readOnly?: boolean;
}

/**
 * 变量类型选项
 */
const VARIABLE_TYPE_OPTIONS: Array<{
  value: TemplateVariableType;
  label: string;
}> = [
  { value: TemplateVariableType.STRING, label: '字符串' },
  { value: TemplateVariableType.NUMBER, label: '数字' },
  { value: TemplateVariableType.DATE, label: '日期' },
  { value: TemplateVariableType.BOOLEAN, label: '布尔值' },
  { value: TemplateVariableType.TEXT, label: '长文本' },
];

/**
 * 默认空变量
 */
const DEFAULT_VARIABLE: TemplateVariable = {
  name: '',
  type: TemplateVariableType.STRING,
  description: '',
  required: false,
  defaultValue: null,
};

/**
 * 模板变量选择器组件
 * 功能：添加、编辑、删除模板变量
 */
export function TemplateVariablePicker({
  variables,
  onChange,
  onInsert,
  readOnly = false,
}: TemplateVariablePickerProps) {
  const [editingVariable, setEditingVariable] =
    useState<TemplateVariable | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  /**
   * 处理添加变量
   */
  const handleAddVariable = (newVariable: TemplateVariable) => {
    if (!newVariable.name || newVariable.name.trim() === '') {
      return;
    }
    onChange([...variables, { ...newVariable, name: newVariable.name.trim() }]);
    setShowAddForm(false);
    setEditingVariable(null);
  };

  /**
   * 处理更新变量
   */
  const handleUpdateVariable = (
    index: number,
    updatedVariable: TemplateVariable
  ) => {
    const newVariables = [...variables];
    newVariables[index] = {
      ...updatedVariable,
      name: updatedVariable.name.trim(),
    };
    onChange(newVariables);
    setEditingVariable(null);
  };

  /**
   * 处理删除变量
   */
  const handleDeleteVariable = (index: number) => {
    const newVariables = variables.filter((_, i) => i !== index);
    onChange(newVariables);
  };

  /**
   * 处理插入变量
   */
  const handleInsertClick = (variable: TemplateVariable) => {
    if (onInsert) {
      onInsert(variable);
    }
  };

  return (
    <div className='space-y-3'>
      {/* 变量列表 */}
      {variables.length === 0 ? (
        <div className='rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900'>
          <p className='text-sm text-zinc-500 dark:text-zinc-400'>
            暂无变量，点击下方按钮添加
          </p>
        </div>
      ) : (
        <div className='space-y-2'>
          {variables.map(variable => (
            <VariableItem
              key={`${variable.name}-${variables.indexOf(variable)}`}
              variable={variable}
              onEdit={() => setEditingVariable({ ...variable })}
              onDelete={() => handleDeleteVariable(variables.indexOf(variable))}
              onInsert={() => handleInsertClick(variable)}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      {/* 添加变量按钮 */}
      {!readOnly && (
        <div className='flex gap-2'>
          {!showAddForm ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => {
                setShowAddForm(true);
                setEditingVariable({ ...DEFAULT_VARIABLE });
              }}
            >
              + 添加变量
            </Button>
          ) : (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => {
                setShowAddForm(false);
                setEditingVariable(null);
              }}
            >
              取消添加
            </Button>
          )}
        </div>
      )}

      {/* 添加/编辑表单 */}
      {editingVariable && (
        <VariableForm
          variable={editingVariable}
          onSave={newVariable => {
            const existingIndex = variables.findIndex(
              v => v.name === editingVariable.name
            );
            if (existingIndex >= 0) {
              handleUpdateVariable(existingIndex, newVariable);
            } else {
              handleAddVariable(newVariable);
            }
          }}
          onCancel={() => {
            setShowAddForm(false);
            setEditingVariable(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * 变量项组件
 */
interface VariableItemProps {
  variable: TemplateVariable;
  onEdit: () => void;
  onDelete: () => void;
  onInsert: () => void;
  readOnly: boolean;
}

function VariableItem({
  variable,
  onEdit,
  onDelete,
  onInsert,
  readOnly,
}: VariableItemProps) {
  return (
    <div className='flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950'>
      <div className='flex-1'>
        <div className='flex items-center gap-2'>
          <span className='font-medium text-zinc-900 dark:text-zinc-100'>
            {'{' + variable.name + '}'}
          </span>
          <Badge variant='outline' className='text-xs'>
            {VARIABLE_TYPE_OPTIONS.find(opt => opt.value === variable.type)
              ?.label || variable.type}
          </Badge>
          {variable.required && (
            <Badge className='bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'>
              必填
            </Badge>
          )}
        </div>
        <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
          {variable.description || '暂无描述'}
        </p>
      </div>
      {!readOnly && (
        <div className='flex gap-1'>
          {onInsert && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={onInsert}
              title='插入变量'
            >
              插入
            </Button>
          )}
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={onEdit}
            title='编辑变量'
          >
            编辑
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={onDelete}
            title='删除变量'
            className='text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950'
          >
            删除
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * 变量表单组件
 */
interface VariableFormProps {
  variable: TemplateVariable;
  onSave: (variable: TemplateVariable) => void;
  onCancel: () => void;
}

function VariableForm({ variable, onSave, onCancel }: VariableFormProps) {
  const [name, setName] = useState(variable.name);
  const [type, setType] = useState(variable.type);
  const [description, setDescription] = useState(variable.description);
  const [required, setRequired] = useState(variable.required);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      type,
      description,
      required,
      defaultValue: null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900'
    >
      <div className='grid grid-cols-2 gap-3'>
        <div>
          <Label className='mb-1 block text-sm'>变量名称</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder='例如：clientName'
            required
            className='text-sm'
          />
        </div>
        <div>
          <Label className='mb-1 block text-sm'>变量类型</Label>
          <select
            value={type}
            onChange={e => setType(e.target.value as TemplateVariableType)}
            className='h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950'
          >
            {VARIABLE_TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label className='mb-1 block text-sm'>变量描述</Label>
        <Input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder='例如：客户姓名'
          className='text-sm'
        />
      </div>
      <div className='flex items-center gap-2'>
        <input
          type='checkbox'
          id={`required-${name}`}
          checked={required}
          onChange={e => setRequired(e.target.checked)}
          className='h-4 w-4 rounded border-zinc-300'
        />
        <Label htmlFor={`required-${name}`} className='text-sm'>
          必填字段
        </Label>
      </div>
      <div className='flex justify-end gap-2'>
        <Button type='button' variant='outline' size='sm' onClick={onCancel}>
          取消
        </Button>
        <Button type='submit' size='sm'>
          保存
        </Button>
      </div>
    </form>
  );
}
