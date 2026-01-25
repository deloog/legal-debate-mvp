'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TemplateVariablePicker } from './TemplateVariablePicker';
import { TemplateVariable } from '@/types/document-template';

export interface TemplateEditorProps {
  content: string;
  variables: TemplateVariable[];
  onChange: (content: string, variables: TemplateVariable[]) => void;
  readOnly?: boolean;
}

/**
 * 模板编辑器组件
 * 功能：编辑模板内容和变量
 */
export function TemplateEditor({
  content,
  variables,
  onChange,
  readOnly = false,
}: TemplateEditorProps) {
  const [localContent, setLocalContent] = useState(content);
  const [localVariables, setLocalVariables] =
    useState<TemplateVariable[]>(variables);

  /**
   * 处理内容变更
   */
  const handleContentChange = (newContent: string) => {
    setLocalContent(newContent);
    onChange(newContent, localVariables);
  };

  /**
   * 处理变量变更
   */
  const handleVariablesChange = (newVariables: TemplateVariable[]) => {
    setLocalVariables(newVariables);
    onChange(localContent, newVariables);
  };

  /**
   * 插入变量到光标位置
   */
  const handleInsertVariable = (variable: TemplateVariable) => {
    const variableText = '{{' + variable.name + '}}';
    const newText = localContent + variableText;
    handleContentChange(newText);
  };

  return (
    <div className='flex flex-col gap-4'>
      {/* 变量配置区 */}
      <div>
        <Label className='mb-2 block text-base font-semibold'>
          模板变量配置
        </Label>
        <TemplateVariablePicker
          variables={localVariables}
          onChange={handleVariablesChange}
          onInsert={handleInsertVariable}
          readOnly={readOnly}
        />
      </div>

      {/* 模板内容编辑区 */}
      <div>
        <Label className='mb-2 block text-base font-semibold'>模板内容</Label>
        <div className='rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950'>
          <Textarea
            value={localContent}
            onChange={e => handleContentChange(e.target.value)}
            readOnly={readOnly}
            placeholder='请输入模板内容，使用 variableName 格式引用变量'
            className='min-h-75 font-mono text-sm'
          />
          <div className='mt-2 flex items-center justify-between'>
            <p className='text-xs text-zinc-500'>
              变量语法：variableName，支持条件语句 if condition /if
            </p>
            {!readOnly && (
              <div className='flex gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    const exampleContent =
                      '尊敬的clientName：\n\n' +
                      '关于caseName一案，现提交documentType。\n\n' +
                      'if isUrgent\n' +
                      '鉴于本案情况紧急，请尽快处理。\n' +
                      '/if\n\n' +
                      '此致\nlawyerName';
                    handleContentChange(exampleContent);
                  }}
                >
                  插入示例模板
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 实时预览 */}
      {!readOnly && localVariables.length > 0 && (
        <div>
          <Label className='mb-2 block text-base font-semibold'>可用变量</Label>
          <div className='flex flex-wrap gap-2'>
            {localVariables.map(variable => (
              <button
                key={variable.name}
                type='button'
                onClick={() => handleInsertVariable(variable)}
                className='rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                title={variable.description}
              >
                {'{' + variable.name + '}'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
