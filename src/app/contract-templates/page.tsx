/**
 * 合同模板管理页面
 * 用于查看、创建和编辑合同模板
 */
'use client';

import { useState, useEffect } from 'react';
import ContractTemplateEditor from '@/components/contract/ContractTemplateEditor';

interface ContractTemplate {
  id: string;
  name: string;
  code: string;
  category: string;
  content: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: any[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ContractTemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<ContractTemplate | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // 加载模板列表
  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory]);

  async function loadTemplates() {
    try {
      setLoading(true);
      const url =
        filterCategory === 'all'
          ? '/api/contract-templates'
          : `/api/contract-templates?category=${filterCategory}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 加载模板列表失败`);
      }

      const result = await response.json();

      if (result.success) {
        setTemplates(result.data);
      } else {
        setError(result.error?.message || '加载模板列表失败');
      }
    } catch (err) {
      console.error('加载模板列表失败:', err);
      setError('加载模板列表失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  // 创建新模板
  function handleCreateNew() {
    setEditingTemplate(null);
    setShowEditor(true);
  }

  // 编辑模板
  function handleEdit(template: ContractTemplate) {
    setEditingTemplate(template);
    setShowEditor(true);
  }

  // 保存模板
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleSave(content: string, variables: any[]) {
    try {
      const templateData = {
        name: editingTemplate?.name || '新建模板',
        code: editingTemplate?.code || `CUSTOM_${Date.now()}`,
        category: editingTemplate?.category || '自定义',
        content,
        variables,
        isDefault: false,
        isActive: true,
      };

      const url = editingTemplate
        ? `/api/contract-templates/${editingTemplate.id}`
        : '/api/contract-templates';

      const method = editingTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 保存失败`);
      }

      const result = await response.json();

      if (result.success) {
        alert(editingTemplate ? '模板更新成功' : '模板创建成功');
        setShowEditor(false);
        setEditingTemplate(null);
        loadTemplates();
      } else {
        alert(result.error?.message || '保存失败');
      }
    } catch (err) {
      console.error('保存模板失败:', err);
      alert('保存模板失败，请重试');
    }
  }

  // 删除模板
  async function handleDelete(template: ContractTemplate) {
    if (template.isDefault) {
      alert('不能删除默认模板');
      return;
    }

    if (!confirm(`确定要删除模板"${template.name}"吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/contract-templates/${template.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 删除失败`);
      }

      const result = await response.json();

      if (result.success) {
        alert('模板删除成功');
        loadTemplates();
      } else {
        alert(result.error?.message || '删除失败');
      }
    } catch (err) {
      console.error('删除模板失败:', err);
      alert('删除模板失败，请重试');
    }
  }

  // 切换模板状态
  async function toggleTemplateStatus(template: ContractTemplate) {
    try {
      const response = await fetch(`/api/contract-templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...template,
          isActive: !template.isActive,
        }),
      });

      const result = await response.json();

      if (result.success) {
        loadTemplates();
      } else {
        alert(result.error?.message || '更新失败');
      }
    } catch (err) {
      console.error('更新模板状态失败:', err);
      alert('更新模板状态失败，请重试');
    }
  }

  // 获取分类名称
  function getCategoryName(category: string): string {
    const categoryMap: Record<string, string> = {
      委托代理: '委托代理',
      法律顾问: '法律顾问',
      专项服务: '专项服务',
      自定义: '自定义',
    };
    return categoryMap[category] || category;
  }

  if (showEditor) {
    return (
      <div className='min-h-screen bg-gray-50 p-6'>
        <div className='mx-auto max-w-7xl'>
          <div className='mb-6'>
            <h1 className='text-2xl font-bold text-gray-900'>
              {editingTemplate ? '编辑模板' : '创建新模板'}
            </h1>
            <p className='mt-1 text-sm text-gray-500'>
              {editingTemplate
                ? `编辑模板：${editingTemplate.name}`
                : '创建一个新的合同模板'}
            </p>
          </div>

          <ContractTemplateEditor
            initialContent={editingTemplate?.content}
            initialVariables={editingTemplate?.variables}
            onSave={handleSave}
            onCancel={() => {
              setShowEditor(false);
              setEditingTemplate(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='mx-auto max-w-7xl'>
        {/* 页面标题 */}
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>合同模板管理</h1>
            <p className='mt-1 text-sm text-gray-500'>管理和编辑合同模板</p>
          </div>
          <button
            onClick={handleCreateNew}
            className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
          >
            + 创建新模板
          </button>
        </div>

        {/* 筛选器 */}
        <div className='mb-6 rounded-lg bg-white p-4 shadow'>
          <div className='flex items-center gap-4'>
            <label className='text-sm font-medium text-gray-700'>
              分类筛选：
            </label>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className='rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
            >
              <option value='all'>全部</option>
              <option value='委托代理'>委托代理</option>
              <option value='法律顾问'>法律顾问</option>
              <option value='专项服务'>专项服务</option>
              <option value='自定义'>自定义</option>
            </select>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className='mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800'>
            {error}
          </div>
        )}

        {/* 加载状态 */}
        {loading ? (
          <div className='rounded-lg bg-white p-12 text-center shadow'>
            <div className='inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent'></div>
            <p className='mt-4 text-gray-600'>加载中...</p>
          </div>
        ) : (
          /* 模板列表 */
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {templates.map(template => (
              <div
                key={template.id}
                className='rounded-lg bg-white p-6 shadow hover:shadow-lg transition-shadow'
              >
                {/* 模板头部 */}
                <div className='mb-4 flex items-start justify-between'>
                  <div className='flex-1'>
                    <h3 className='text-lg font-semibold text-gray-900'>
                      {template.name}
                    </h3>
                    <p className='mt-1 text-sm text-gray-500'>
                      {getCategoryName(template.category)}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    {template.isDefault && (
                      <span className='inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800'>
                        默认
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        template.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {template.isActive ? '启用' : '禁用'}
                    </span>
                  </div>
                </div>

                {/* 模板信息 */}
                <div className='mb-4 space-y-2 text-sm text-gray-600'>
                  <div className='flex items-center'>
                    <span className='w-20'>模板代码:</span>
                    <span className='font-mono text-xs'>{template.code}</span>
                  </div>
                  <div className='flex items-center'>
                    <span className='w-20'>变量数量:</span>
                    <span>{template.variables?.length || 0} 个</span>
                  </div>
                  <div className='flex items-center'>
                    <span className='w-20'>创建时间:</span>
                    <span>
                      {new Date(template.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className='flex items-center gap-2'>
                  <button
                    onClick={() => handleEdit(template)}
                    className='flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => toggleTemplateStatus(template)}
                    className='flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
                  >
                    {template.isActive ? '禁用' : '启用'}
                  </button>
                  {!template.isDefault && (
                    <button
                      onClick={() => handleDelete(template)}
                      className='rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50'
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {!loading && templates.length === 0 && (
          <div className='rounded-lg bg-white p-12 text-center shadow'>
            <svg
              className='mx-auto h-12 w-12 text-gray-400'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
              />
            </svg>
            <h3 className='mt-4 text-lg font-medium text-gray-900'>暂无模板</h3>
            <p className='mt-2 text-sm text-gray-500'>
              点击&quot;创建新模板&quot;按钮开始创建您的第一个合同模板
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
