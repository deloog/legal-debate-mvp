'use client';

import React, { useState } from 'react';
import { SystemConfig } from '@prisma/client';
import { ConfigItem } from '@/components/admin/ConfigItem';
import { ConfigValueInput } from '@/components/admin/ConfigValueInput';
import { UpdateConfigRequest, CreateConfigRequest } from '@/types/config';

/**
 * 配置查看器Props
 */
interface SystemConfigViewerProps {
  configs: SystemConfig[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  onCreate: (config: CreateConfigRequest) => Promise<void>;
  onUpdate: (key: string, data: UpdateConfigRequest) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

/**
 * 系统配置查看器主组件
 */
export function SystemConfigViewer({
  configs,
  loading,
  total,
  page,
  totalPages,
  onRefresh,
  onPageChange,
  onCreate,
  onUpdate,
  onDelete,
}: SystemConfigViewerProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const categories = Array.from(new Set(configs.map(c => c.category))).sort();
  const filteredConfigs = selectedCategory
    ? configs.filter(c => c.category === selectedCategory)
    : configs;

  const handleEdit = (key: string) => {
    const config = configs.find(c => c.key === key);
    if (config) {
      setEditValues({ ...editValues, [key]: config.value });
      setEditingKey(key);
    }
  };

  const handleSave = async () => {
    if (editingKey) {
      await onUpdate(editingKey, { value: editValues[editingKey] });
      setEditingKey(null);
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    const newEditValues = { ...editValues };
    delete newEditValues[editingKey ?? ''];
    setEditValues(newEditValues);
  };

  const handleDelete = async (key: string) => {
    if (window.confirm('确定要删除此配置吗？')) {
      await onDelete(key);
    }
  };

  const handleCreate = async (data: CreateConfigRequest) => {
    await onCreate(data);
    setShowCreateDialog(false);
  };

  return (
    <div className='space-y-4'>
      {/* 工具栏 */}
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className='flex items-center gap-4'>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className='px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
          >
            <option value=''>全部分类</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <span className='text-sm text-gray-600'>共 {total} 条配置</span>
        </div>
        <div className='flex gap-2'>
          <button
            onClick={onRefresh}
            className='px-4 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors'
          >
            刷新
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            className='px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
          >
            新建配置
          </button>
        </div>
      </div>

      {/* 配置列表 */}
      {loading ? (
        <div className='text-center py-8'>
          <div className='text-gray-600'>加载中...</div>
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className='text-center py-8 bg-white rounded-lg border border-gray-200'>
          <p className='text-gray-600'>暂无配置</p>
        </div>
      ) : (
        <div className='space-y-4'>
          {filteredConfigs.map(config => (
            <ConfigItem
              key={config.key}
              config={config}
              isEditing={editingKey === config.key}
              editValue={editValues[config.key]}
              onEdit={() => handleEdit(config.key)}
              onSave={handleSave}
              onCancel={handleCancel}
              onDelete={() => handleDelete(config.key)}
              onValueChange={value =>
                setEditValues({ ...editValues, [config.key]: value })
              }
            />
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className='flex items-center justify-center gap-2 mt-6'>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className='px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            上一页
          </button>
          <span className='text-sm text-gray-600'>
            第 {page} / {totalPages} 页
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className='px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            下一页
          </button>
        </div>
      )}

      {/* 创建配置对话框 */}
      {showCreateDialog && (
        <CreateConfigDialog
          onClose={() => setShowCreateDialog(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  );
}

/**
 * 创建配置对话框Props
 */
interface CreateConfigDialogProps {
  onClose: () => void;
  onSave: (config: CreateConfigRequest) => Promise<void>;
}

/**
 * 创建配置对话框组件
 */
function CreateConfigDialog({ onClose, onSave }: CreateConfigDialogProps) {
  const [formData, setFormData] = useState<CreateConfigRequest>({
    key: '',
    value: '',
    type: 'STRING',
    category: 'general',
    description: '',
    isPublic: false,
    isRequired: false,
    defaultValue: '',
    validationRules: null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const handleChange = (field: keyof CreateConfigRequest, value: unknown) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto'>
        <div className='p-6'>
          <h2 className='text-xl font-bold text-gray-900 mb-4'>新建配置</h2>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                配置键 <span className='text-red-600'>*</span>
              </label>
              <input
                type='text'
                value={formData.key}
                onChange={e => handleChange('key', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                required
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                配置类型 <span className='text-red-600'>*</span>
              </label>
              <select
                value={formData.type}
                onChange={e => handleChange('type', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              >
                <option value='STRING'>STRING</option>
                <option value='NUMBER'>NUMBER</option>
                <option value='BOOLEAN'>BOOLEAN</option>
                <option value='ARRAY'>ARRAY</option>
                <option value='OBJECT'>OBJECT</option>
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                配置分类 <span className='text-red-600'>*</span>
              </label>
              <select
                value={formData.category}
                onChange={e => handleChange('category', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              >
                <option value='general'>general</option>
                <option value='ai'>ai</option>
                <option value='storage'>storage</option>
                <option value='security'>security</option>
                <option value='feature'>feature</option>
                <option value='ui'>ui</option>
                <option value='notification'>notification</option>
                <option value='other'>other</option>
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                配置值 <span className='text-red-600'>*</span>
              </label>
              <ConfigValueInput
                type={formData.type}
                value={formData.value}
                onChange={value => handleChange('value', value)}
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                描述
              </label>
              <textarea
                value={formData.description}
                onChange={e => handleChange('description', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                rows={3}
              />
            </div>

            <div className='flex gap-4'>
              <label className='flex items-center'>
                <input
                  type='checkbox'
                  checked={formData.isPublic}
                  onChange={e => handleChange('isPublic', e.target.checked)}
                  className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                />
                <span className='ml-2 text-sm text-gray-700'>公开配置</span>
              </label>
              <label className='flex items-center'>
                <input
                  type='checkbox'
                  checked={formData.isRequired}
                  onChange={e => handleChange('isRequired', e.target.checked)}
                  className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                />
                <span className='ml-2 text-sm text-gray-700'>必填配置</span>
              </label>
            </div>

            <div className='flex justify-end gap-3 pt-4 border-t'>
              <button
                type='button'
                onClick={onClose}
                className='px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50'
              >
                取消
              </button>
              <button
                type='submit'
                className='px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg'
              >
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
