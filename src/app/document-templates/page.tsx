'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  DocumentTemplateDetail,
  DocumentTemplateType,
  DocumentTemplateCategory,
  TemplateStatus,
} from '@/types/document-template';

interface TemplateListResponse {
  templates: DocumentTemplateDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 模板列表页面
 * 功能：展示模板列表、搜索、筛选、分页
 */
export default function DocumentTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<DocumentTemplateDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const limit = 20;

  /**
   * 获取模板列表
   */
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search) {
        params.append('search', search);
      }
      if (type) {
        params.append('type', type);
      }
      if (status) {
        params.append('status', status);
      }
      if (category) {
        params.append('category', category);
      }

      const response = await fetch(
        `/api/document-templates?${params.toString()}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('获取模板列表失败');
      }

      const data: TemplateListResponse = await response.json();
      setTemplates(data.templates);
      setTotal(data.total);
    } catch (error) {
      console.error('获取模板列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, type, status, category, limit]);

  /**
   * 删除模板
   */
  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('确定要删除这个模板吗？')) {
        return;
      }

      try {
        const response = await fetch(`/api/document-templates/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('删除模板失败');
        }

        await fetchTemplates();
      } catch (error) {
        console.error('删除模板失败:', error);
        alert('删除模板失败');
      }
    },
    [fetchTemplates]
  );

  /**
   * 跳转到模板详情
   */
  const handleView = useCallback(
    (id: string) => {
      router.push(`/document-templates/${id}`);
    },
    [router]
  );

  /**
   * 跳转到编辑模板
   */
  const handleEdit = useCallback(
    (id: string) => {
      router.push(`/document-templates/${id}`);
    },
    [router]
  );

  /**
   * 加载数据
   */
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-7xl items-center justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
              文档模板库
            </h1>
            <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
              管理法律文书模板
            </p>
          </div>
          <Button onClick={() => router.push('/document-templates/new')}>
            + 新建模板
          </Button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        {/* 搜索和筛选 */}
        <Card className='mb-6'>
          <CardContent className='pt-6'>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
              <Input
                placeholder='搜索模板名称...'
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <select
                value={type}
                onChange={e => {
                  setType(e.target.value);
                  setPage(1);
                }}
                className='h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950'
              >
                <option value=''>所有类型</option>
                {Object.values(DocumentTemplateType).map(t => (
                  <option key={t} value={t}>
                    {getTemplateTypeLabel(t)}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={e => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className='h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950'
              >
                <option value=''>所有状态</option>
                {Object.values(TemplateStatus).map(s => (
                  <option key={s} value={s}>
                    {getStatusLabel(s)}
                  </option>
                ))}
              </select>
              <select
                value={category}
                onChange={e => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className='h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950'
              >
                <option value=''>所有分类</option>
                {Object.values(DocumentTemplateCategory).map(c => (
                  <option key={c} value={c}>
                    {getCategoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* 模板列表 */}
        <Suspense fallback={<LoadingSkeleton />}>
          {loading ? (
            <LoadingSkeleton />
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-12'>
                <p className='text-zinc-500 dark:text-zinc-400'>暂无模板</p>
                <Button
                  className='mt-4'
                  onClick={() => router.push('/document-templates/new')}
                >
                  创建第一个模板
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {templates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </Suspense>

        {/* 分页 */}
        {total > limit && (
          <div className='mt-6 flex justify-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              上一页
            </Button>
            <span className='flex items-center px-3 text-sm text-zinc-600 dark:text-zinc-400'>
              第 {page} 页 / 共 {Math.ceil(total / limit)} 页
            </span>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(total / limit)}
            >
              下一页
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * 模板卡片组件
 */
interface TemplateCardProps {
  template: DocumentTemplateDetail;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function TemplateCard({
  template,
  onView,
  onEdit,
  onDelete,
}: TemplateCardProps) {
  return (
    <Card className='hover:shadow-md transition-shadow'>
      <CardHeader>
        <div className='mb-2 flex items-center gap-2'>
          <Badge variant='outline'>{getTemplateTypeLabel(template.type)}</Badge>
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
        <CardTitle className='truncate text-lg'>{template.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className='mb-4 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400'>
          {template.content.substring(0, 100)}
          {template.content.length > 100 ? '...' : ''}
        </p>
        <div className='mb-4 flex flex-wrap gap-2'>
          {template.category && (
            <Badge variant='secondary' className='text-xs'>
              {getCategoryLabel(template.category)}
            </Badge>
          )}
          <Badge variant='secondary' className='text-xs'>
            {getStatusLabel(template.status)}
          </Badge>
          <Badge variant='secondary' className='text-xs'>
            v{template.version}
          </Badge>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            className='flex-1'
            onClick={() => onView(template.id)}
          >
            查看详情
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onEdit(template.id)}
          >
            编辑
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onDelete(template.id)}
            className='text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950'
          >
            删除
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 加载骨架屏
 */
function LoadingSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className='mb-2 flex gap-2'>
              <div className='h-6 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
              <div className='h-6 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
            </div>
            <div className='h-6 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
          </CardHeader>
          <CardContent>
            <div className='mb-4 space-y-2'>
              <div className='h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
              <div className='h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
            </div>
            <div className='mb-4 flex gap-2'>
              <div className='h-6 w-16 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800' />
              <div className='h-6 w-16 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800' />
            </div>
            <div className='flex gap-2'>
              <div className='h-9 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
              <div className='h-9 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
              <div className='h-9 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
            </div>
          </CardContent>
        </Card>
      ))}
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
