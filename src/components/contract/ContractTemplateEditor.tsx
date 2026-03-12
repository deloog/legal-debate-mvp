/**
 * 合同模板编辑器组件
 * 用于创建和编辑合同模板，支持富文本编辑和变量插入
 */
'use client';

import { useState } from 'react';

interface ContractTemplateEditorProps {
  initialContent?: string;
  initialVariables?: TemplateVariable[];
  onSave?: (content: string, variables: TemplateVariable[]) => void;
  onCancel?: () => void;
}

interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select';
  required: boolean;
  options?: string[];
}

export default function ContractTemplateEditor({
  initialContent = '',
  initialVariables = [],
  onSave,
  onCancel,
}: ContractTemplateEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [variables, setVariables] =
    useState<TemplateVariable[]>(initialVariables);
  const [showVariableDialog, setShowVariableDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [newVariable, setNewVariable] = useState<TemplateVariable>({
    name: '',
    label: '',
    type: 'text',
    required: false,
  });

  // 常用变量列表
  const commonVariables: TemplateVariable[] = [
    { name: 'clientName', label: '委托人姓名', type: 'text', required: true },
    { name: 'clientIdNumber', label: '身份证号', type: 'text', required: true },
    { name: 'clientAddress', label: '联系地址', type: 'text', required: false },
    { name: 'clientPhone', label: '联系电话', type: 'text', required: true },
    { name: 'caseType', label: '案件类型', type: 'text', required: true },
    {
      name: 'caseSummary',
      label: '案情简述',
      type: 'textarea',
      required: true,
    },
    { name: 'scope', label: '委托范围', type: 'text', required: true },
    { name: 'totalFee', label: '律师费总额', type: 'number', required: true },
    { name: 'lawFirmName', label: '律所名称', type: 'text', required: true },
    { name: 'lawyerName', label: '承办律师', type: 'text', required: true },
    { name: 'signDate', label: '签约日期', type: 'date', required: true },
  ];

  // 插入变量到内容中
  function insertVariable(variableName: string) {
    const textarea = document.getElementById(
      'template-content'
    ) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const variableTag = `{{${variableName}}}`;

    const newContent =
      content.substring(0, start) + variableTag + content.substring(end);

    setContent(newContent);

    // 设置光标位置
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + variableTag.length,
        start + variableTag.length
      );
    }, 0);
  }

  // 添加常用变量
  function addCommonVariable(variable: TemplateVariable) {
    if (!variables.find(v => v.name === variable.name)) {
      setVariables([...variables, variable]);
    }
    insertVariable(variable.name);
  }

  // 添加自定义变量
  function addCustomVariable() {
    if (!newVariable.name || !newVariable.label) {
      alert('请填写变量名称和标签');
      return;
    }

    if (variables.find(v => v.name === newVariable.name)) {
      alert('变量名称已存在');
      return;
    }

    setVariables([...variables, newVariable]);
    insertVariable(newVariable.name);
    setNewVariable({
      name: '',
      label: '',
      type: 'text',
      required: false,
    });
    setShowVariableDialog(false);
  }

  // 删除变量
  function removeVariable(variableName: string) {
    setVariables(variables.filter(v => v.name !== variableName));
  }

  // 保存模板
  function handleSave() {
    if (!content.trim()) {
      alert('请输入模板内容');
      return;
    }

    if (variables.length === 0) {
      alert('请至少添加一个变量');
      return;
    }

    onSave?.(content, variables);
  }

  // 预览模板
  function renderPreview() {
    let previewContent = content;
    variables.forEach(variable => {
      const placeholder = `[${variable.label}]`;
      previewContent = previewContent.replace(
        new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g'),
        placeholder
      );
    });
    return previewContent;
  }

  return (
    <div className='space-y-6'>
      {/* 工具栏 */}
      <div className='flex items-center justify-between rounded-lg bg-gray-50 p-4'>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => setShowPreview(!showPreview)}
            className='rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
          >
            {showPreview ? '编辑模式' : '预览模式'}
          </button>
          <button
            type='button'
            onClick={() => setShowVariableDialog(true)}
            className='rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
          >
            + 添加变量
          </button>
        </div>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={onCancel}
            className='rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
          >
            取消
          </button>
          <button
            type='button'
            onClick={handleSave}
            className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
          >
            保存模板
          </button>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        {/* 左侧：常用变量 */}
        <div className='rounded-lg bg-white p-4 shadow'>
          <h3 className='mb-3 text-sm font-semibold text-gray-900'>常用变量</h3>
          <div className='space-y-2'>
            {commonVariables.map(variable => (
              <button
                key={variable.name}
                type='button'
                onClick={() => addCommonVariable(variable)}
                className='w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50'
              >
                <div className='font-medium'>{variable.label}</div>
                <div className='text-xs text-gray-500'>
                  {`{{${variable.name}}}`}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 中间：编辑器 */}
        <div className='lg:col-span-2'>
          <div className='rounded-lg bg-white p-6 shadow'>
            <h3 className='mb-4 text-lg font-semibold text-gray-900'>
              {showPreview ? '模板预览' : '模板内容'}
            </h3>

            {showPreview ? (
              <div className='min-h-[500px] whitespace-pre-wrap rounded-lg border border-gray-300 bg-gray-50 p-4 text-sm'>
                {renderPreview()}
              </div>
            ) : (
              <textarea
                id='template-content'
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder='请输入合同模板内容，使用 {{变量名}} 格式插入变量...'
                className='min-h-[500px] w-full rounded-lg border border-gray-300 p-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
              />
            )}

            {/* 使用说明 */}
            <div className='mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800'>
              <p className='font-medium'>使用说明：</p>
              <ul className='mt-2 space-y-1 text-xs'>
                <li>• 点击左侧常用变量可快速插入</li>
                <li>• 使用 {`{{变量名}}`} 格式手动插入变量</li>
                <li>• 点击&quot;预览模式&quot;查看变量替换效果</li>
                <li>• 可以添加自定义变量满足特殊需求</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 已添加的变量列表 */}
      {variables.length > 0 && (
        <div className='rounded-lg bg-white p-6 shadow'>
          <h3 className='mb-4 text-lg font-semibold text-gray-900'>
            已添加的变量 ({variables.length})
          </h3>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3'>
            {variables.map(variable => (
              <div
                key={variable.name}
                className='flex items-center justify-between rounded-lg border border-gray-200 p-3'
              >
                <div className='flex-1'>
                  <div className='font-medium text-gray-900'>
                    {variable.label}
                    {variable.required && (
                      <span className='ml-1 text-red-500'>*</span>
                    )}
                  </div>
                  <div className='text-xs text-gray-500'>
                    {`{{${variable.name}}}`}
                  </div>
                  <div className='mt-1 text-xs text-gray-400'>
                    类型: {variable.type}
                  </div>
                </div>
                <button
                  type='button'
                  onClick={() => removeVariable(variable.name)}
                  className='ml-2 text-red-600 hover:text-red-700'
                >
                  <svg
                    className='h-5 w-5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 添加变量对话框 */}
      {showVariableDialog && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='w-full max-w-md rounded-lg bg-white p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-gray-900'>
              添加自定义变量
            </h3>

            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  变量名称 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={newVariable.name}
                  onChange={e =>
                    setNewVariable({ ...newVariable, name: e.target.value })
                  }
                  placeholder='例如: customField'
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
                <p className='mt-1 text-xs text-gray-500'>
                  只能包含字母、数字和下划线
                </p>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  显示标签 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={newVariable.label}
                  onChange={e =>
                    setNewVariable({ ...newVariable, label: e.target.value })
                  }
                  placeholder='例如: 自定义字段'
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  变量类型
                </label>
                <select
                  value={newVariable.type}
                  onChange={e =>
                    setNewVariable({
                      ...newVariable,
                      type: e.target.value as TemplateVariable['type'],
                    })
                  }
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                >
                  <option value='text'>文本</option>
                  <option value='textarea'>多行文本</option>
                  <option value='number'>数字</option>
                  <option value='date'>日期</option>
                  <option value='select'>下拉选择</option>
                </select>
              </div>

              <div className='flex items-center'>
                <input
                  type='checkbox'
                  checked={newVariable.required}
                  onChange={e =>
                    setNewVariable({
                      ...newVariable,
                      required: e.target.checked,
                    })
                  }
                  className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                />
                <label className='ml-2 text-sm text-gray-700'>必填字段</label>
              </div>
            </div>

            <div className='mt-6 flex justify-end gap-3'>
              <button
                type='button'
                onClick={() => {
                  setShowVariableDialog(false);
                  setNewVariable({
                    name: '',
                    label: '',
                    type: 'text',
                    required: false,
                  });
                }}
                className='rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
              >
                取消
              </button>
              <button
                type='button'
                onClick={addCustomVariable}
                className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
