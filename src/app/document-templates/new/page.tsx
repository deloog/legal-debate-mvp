'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TemplateEditor } from '@/components/template/TemplateEditor';
import {
  TemplateVariable,
  DocumentTemplateType,
  DocumentTemplateCategory,
  TemplateStatus,
} from '@/types/document-template';

/**
 * 新建模板页面
 * 功能：创建新的文档模板
 */
export default function NewTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<DocumentTemplateType>(
    DocumentTemplateType.OTHER
  );
  const [category, setCategory] = useState<DocumentTemplateCategory>(
    DocumentTemplateCategory.OTHER
  );
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [isPublic, setIsPublic] = useState(false);

  /**
   * 验证表单
   */
  const validateForm = (): boolean => {
    if (!name.trim()) {
      alert('请输入模板名称');
      return false;
    }
    if (!content.trim()) {
      alert('请输入模板内容');
      return false;
    }
    return true;
  };

  /**
   * 创建模板
   */
  const handleCreate = async (publish: boolean) => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/document-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          type,
          category,
          status: publish ? TemplateStatus.PUBLISHED : TemplateStatus.DRAFT,
          description: description.trim(),
          content,
          variables,
          isPublic,
          isSystem: false,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { message: string };
        throw new Error(error.message || '创建模板失败');
      }

      const result = (await response.json()) as { id: string };
      router.push(`/document-templates/${result.id}`);
    } catch (error) {
      console.error('创建模板失败:', error);
      alert('创建模板失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-4xl items-center justify-between'>
          <Button
            variant='outline'
            onClick={() => router.push('/document-templates')}
          >
            返回列表
          </Button>
          <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
            新建文档模板
          </h1>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-4xl px-6 py-6'>
        <form onSubmit={e => e.preventDefault()}>
          {/* 基本信息 */}
          <Card className='mb-6'>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <Label className='mb-1 block'>
                  模板名称 <span className='text-red-600'>*</span>
                </Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder='例如：民事起诉状模板'
                  required
                />
              </div>

              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div>
                  <Label className='mb-1 block'>文档类型</Label>
                  <select
                    value={type}
                    onChange={e =>
                      setType(e.target.value as DocumentTemplateType)
                    }
                    className='h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950'
                  >
                    {Object.values(DocumentTemplateType).map(t => (
                      <option key={t} value={t}>
                        {getTemplateTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className='mb-1 block'>案件分类</Label>
                  <select
                    value={category}
                    onChange={e =>
                      setCategory(e.target.value as DocumentTemplateCategory)
                    }
                    className='h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950'
                  >
                    {Object.values(DocumentTemplateCategory).map(c => (
                      <option key={c} value={c}>
                        {getCategoryLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label className='mb-1 block'>模板描述</Label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder='简要描述模板的用途和适用场景'
                />
              </div>

              <div className='flex items-center justify-between'>
                <div>
                  <Label className='text-base font-medium'>公开模板</Label>
                  <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                    公开后其他用户可以查看和使用此模板
                  </p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
            </CardContent>
          </Card>

          {/* 模板编辑器 */}
          <Card className='mb-6'>
            <CardHeader>
              <CardTitle>模板内容</CardTitle>
            </CardHeader>
            <CardContent>
              <TemplateEditor
                content={content}
                variables={variables}
                onChange={(newContent, newVariables) => {
                  setContent(newContent);
                  setVariables(newVariables);
                }}
              />
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className='flex justify-end gap-3'>
            <Button
              type='button'
              variant='outline'
              onClick={() => router.push('/document-templates')}
              disabled={saving}
            >
              取消
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={() => handleCreate(false)}
              disabled={saving}
            >
              保存草稿
            </Button>
            <Button
              type='button'
              onClick={() => handleCreate(true)}
              disabled={saving}
            >
              {saving ? '发布中...' : '发布模板'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

/**
 * 获取模板类型标签
 */
function getTemplateTypeLabel(type: DocumentTemplateType): string {
  const labels: Record<DocumentTemplateType, string> = {
    [DocumentTemplateType.INDICTMENT]: '起诉状',
    [DocumentTemplateType.DEFENSE]: '答辩状',
    [DocumentTemplateType.APPEARANCE]: '代理词',
    [DocumentTemplateType.APPEAL]: '上诉状',
    [DocumentTemplateType.OTHER]: '其他',
  };
  return labels[type] || type;
}

/**
 * 获取分类标签
 */
function getCategoryLabel(category: DocumentTemplateCategory): string {
  const labels: Record<DocumentTemplateCategory, string> = {
    [DocumentTemplateCategory.CIVIL]: '民事',
    [DocumentTemplateCategory.CRIMINAL]: '刑事',
    [DocumentTemplateCategory.ADMINISTRATIVE]: '行政',
    [DocumentTemplateCategory.COMMERCIAL]: '商事',
    [DocumentTemplateCategory.LABOR]: '劳动',
    [DocumentTemplateCategory.INTELLECTUAL]: '知识产权',
    [DocumentTemplateCategory.OTHER]: '其他',
  };
  return labels[category] || category;
}
