'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { TemplateEditor } from '@/components/template/TemplateEditor';
import {
  DocumentTemplateDetail,
  DocumentTemplateType,
  DocumentTemplateCategory,
  TemplateStatus,
  TemplateVariable,
} from '@/types/document-template';

interface GenerateResponse {
  content: string;
}

/**
 * 模板详情页面
 * 功能：查看模板详情、编辑模板、生成文档
 */
export default function TemplateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<DocumentTemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editVariables, setEditVariables] = useState<TemplateVariable[]>([]);
  const [generateVars, setGenerateVars] = useState<Record<string, string>>({});
  const [generatedDoc, setGeneratedDoc] = useState<string>('');

  /**
   * 获取模板详情
   */
  const fetchTemplate = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/document-templates/${templateId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('获取模板详情失败');
      }

      const data: DocumentTemplateDetail = await response.json();
      setTemplate(data);
      setEditContent(data.content);
      setEditVariables(data.variables);
    } catch (error) {
      console.error('获取模板详情失败:', error);
      alert('获取模板详情失败');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  /**
   * 保存编辑
   */
  const handleSave = async () => {
    try {
      const response = await fetch(`/api/document-templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: editContent,
          variables: editVariables,
        }),
      });

      if (!response.ok) {
        throw new Error('保存模板失败');
      }

      await fetchTemplate();
      setEditing(false);
      alert('保存成功');
    } catch (error) {
      console.error('保存模板失败:', error);
      alert('保存模板失败');
    }
  };

  /**
   * 删除模板
   */
  const handleDelete = async () => {
    if (!confirm('确定要删除这个模板吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/document-templates/${templateId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('删除模板失败');
      }

      router.push('/document-templates');
    } catch (error) {
      console.error('删除模板失败:', error);
      alert('删除模板失败');
    }
  };

  /**
   * 生成文档
   */
  const handleGenerate = async () => {
    try {
      const response = await fetch(
        `/api/document-templates/${templateId}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ variables: generateVars }),
        }
      );

      if (!response.ok) {
        throw new Error('生成文档失败');
      }

      const data: GenerateResponse = await response.json();
      setGeneratedDoc(data.content);
      setShowGenerate(false);
    } catch (error) {
      console.error('生成文档失败:', error);
      alert('生成文档失败');
    }
  };

  /**
   * 加载数据
   */
  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <p className='text-zinc-600 dark:text-zinc-400'>加载中...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <p className='text-zinc-600 dark:text-zinc-400'>模板不存在</p>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-7xl items-center justify-between'>
          <Button
            variant='outline'
            onClick={() => router.push('/document-templates')}
          >
            返回列表
          </Button>
          <div className='flex gap-2'>
            {editing ? (
              <>
                <Button variant='outline' onClick={() => setEditing(false)}>
                  取消
                </Button>
                <Button onClick={handleSave}>保存</Button>
              </>
            ) : (
              <>
                <Button variant='outline' onClick={() => setShowGenerate(true)}>
                  生成文档
                </Button>
                <Button variant='outline' onClick={() => setEditing(true)}>
                  编辑
                </Button>
                {!template.isSystem && (
                  <Button
                    variant='outline'
                    onClick={handleDelete}
                    className='text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950'
                  >
                    删除
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        {editing ? (
          <TemplateEditor
            content={editContent}
            variables={editVariables}
            onChange={(content, variables) => {
              setEditContent(content);
              setEditVariables(variables);
            }}
          />
        ) : (
          <div className='space-y-6'>
            {/* 模板基本信息 */}
            <Card>
              <CardHeader>
                <div className='mb-4 flex items-center gap-2'>
                  <Badge variant='outline'>
                    {getTemplateTypeLabel(template.type)}
                  </Badge>
                  {template.isSystem && (
                    <Badge className='bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'>
                      系统模板
                    </Badge>
                  )}
                  {template.isPublic && (
                    <Badge className='bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'>
                      公开
                    </Badge>
                  )}
                </div>
                <CardTitle className='text-2xl'>{template.name}</CardTitle>
                <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>
                  创建于 {new Date(template.createdAt).toLocaleString('zh-CN')}
                  {template.creatorName && (
                    <>
                      {' · 创建者：'}
                      {template.creatorName}
                    </>
                  )}
                </p>
              </CardHeader>
              <CardContent>
                <div className='mb-4 flex flex-wrap gap-2'>
                  {template.category && (
                    <Badge variant='secondary'>
                      分类：{getCategoryLabel(template.category)}
                    </Badge>
                  )}
                  <Badge variant='secondary'>
                    状态：{getStatusLabel(template.status)}
                  </Badge>
                  <Badge variant='secondary'>版本：v{template.version}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* 模板变量 */}
            {template.variables.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>模板变量</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                    {template.variables.map(variable => (
                      <div
                        key={variable.name}
                        className='rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900'
                      >
                        <div className='mb-2 flex items-center gap-2'>
                          <span className='font-semibold text-zinc-900 dark:text-zinc-100'>
                            {variable.name}
                          </span>
                          <Badge variant='outline' className='text-xs'>
                            {variable.type}
                          </Badge>
                          {variable.required && (
                            <Badge className='bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'>
                              必填
                            </Badge>
                          )}
                        </div>
                        <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                          {variable.description || '暂无描述'}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 模板内容 */}
            <Card>
              <CardHeader>
                <CardTitle>模板内容</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className='overflow-x-auto rounded-lg bg-zinc-100 p-4 font-mono text-sm dark:bg-zinc-900'>
                  {template.content}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* 生成文档对话框 */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className='max-h-150 overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>生成文档</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='max-h-100 space-y-3 overflow-y-auto'>
              {template.variables.map(variable => (
                <div key={variable.name}>
                  <Label>
                    {variable.name}
                    {variable.required && (
                      <span className='ml-1 text-red-600'>*</span>
                    )}
                  </Label>
                  <Input
                    type={
                      variable.type === 'date'
                        ? 'date'
                        : variable.type === 'number'
                          ? 'number'
                          : 'text'
                    }
                    value={generateVars[variable.name] || ''}
                    onChange={e =>
                      setGenerateVars({
                        ...generateVars,
                        [variable.name]: e.target.value,
                      })
                    }
                    required={variable.required}
                    placeholder={
                      variable.description || `请输入${variable.name}`
                    }
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant='outline' onClick={() => setShowGenerate(false)}>
                取消
              </Button>
              <Button onClick={handleGenerate}>生成</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 生成结果对话框 */}
      {generatedDoc && (
        <Dialog
          open={Boolean(generatedDoc)}
          onOpenChange={() => setGeneratedDoc('')}
        >
          <DialogContent className='max-h-150 max-w-3xl overflow-y-auto'>
            <DialogHeader>
              <DialogTitle>生成结果</DialogTitle>
            </DialogHeader>
            <div className='space-y-4'>
              <Textarea
                value={generatedDoc}
                readOnly
                className='min-h-100 font-mono text-sm'
              />
              <DialogFooter>
                <Button
                  variant='outline'
                  onClick={() => {
                    navigator.clipboard.writeText(generatedDoc);
                    alert('已复制到剪贴板');
                  }}
                >
                  复制
                </Button>
                <Button
                  onClick={() => {
                    const blob = new Blob([generatedDoc], {
                      type: 'text/plain',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${template.name}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  下载
                </Button>
                <Button onClick={() => setGeneratedDoc('')}>关闭</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
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

/**
 * 获取状态标签
 */
function getStatusLabel(status: TemplateStatus): string {
  const labels: Record<TemplateStatus, string> = {
    [TemplateStatus.DRAFT]: '草稿',
    [TemplateStatus.PUBLISHED]: '已发布',
    [TemplateStatus.ARCHIVED]: '已归档',
  };
  return labels[status] || status;
}
