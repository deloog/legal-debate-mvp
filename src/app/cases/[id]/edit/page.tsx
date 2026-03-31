/**
 * 编辑案件页面
 *
 * 预填充当前案件信息，提交后调用 PUT /api/v1/cases/[id]
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface CaseDetail {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  caseNumber: string | null;
  cause: string | null;
  court: string | null;
  plaintiffName: string | null;
  defendantName: string | null;
  amount: string | null;
}

interface FormData {
  title: string;
  description: string;
  type: string;
  status: string;
  caseNumber: string;
  cause: string;
  court: string;
  plaintiffName: string;
  defendantName: string;
  amount: string;
}

const CASE_TYPE_OPTIONS = [
  { value: 'civil', label: '民事案件' },
  { value: 'criminal', label: '刑事案件' },
  { value: 'administrative', label: '行政案件' },
  { value: 'commercial', label: '商事案件' },
  { value: 'labor', label: '劳动案件' },
  { value: 'intellectual', label: '知识产权案件' },
  { value: 'other', label: '其他' },
];

const CASE_STATUS_OPTIONS = [
  { value: 'active', label: '进行中' },
  { value: 'draft', label: '草稿' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
];

export default function CaseEditPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = typeof params?.id === 'string' ? params.id : '';

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    type: 'civil',
    status: 'active',
    caseNumber: '',
    cause: '',
    court: '',
    plaintiffName: '',
    defendantName: '',
    amount: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadCase = useCallback(async () => {
    if (!caseId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/v1/cases/${caseId}`);
      if (!response.ok) throw new Error('加载案件信息失败');
      const json = (await response.json()) as { data: CaseDetail };
      const c = json.data;
      setFormData({
        title: c.title ?? '',
        description: c.description ?? '',
        type: (c.type ?? 'CIVIL').toLowerCase(),
        status: (c.status ?? 'ACTIVE').toLowerCase(),
        caseNumber: c.caseNumber ?? '',
        cause: c.cause ?? '',
        court: c.court ?? '',
        plaintiffName: c.plaintiffName ?? '',
        defendantName: c.defendantName ?? '',
        amount: c.amount ? String(c.amount) : '',
      });
    } catch (err) {
      console.error('加载案件信息失败:', err);
      setLoadError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadCase();
  }, [loadCase]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setSubmitError('案件标题不能为空');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body: Record<string, string | undefined> = {
        title: formData.title.trim() || undefined,
        description: formData.description || undefined,
        type: formData.type || undefined,
        status: formData.status || undefined,
        caseNumber: formData.caseNumber || undefined,
        cause: formData.cause || undefined,
        court: formData.court || undefined,
        plaintiffName: formData.plaintiffName || undefined,
        defendantName: formData.defendantName || undefined,
        amount: formData.amount || undefined,
      };
      // Remove undefined keys
      Object.keys(body).forEach(k => {
        if (body[k] === undefined) delete body[k];
      });

      const response = await fetch(`/api/v1/cases/${caseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(errData.message ?? '保存失败');
      }

      router.push(`/cases/${caseId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-zinc-950'>
        <div className='mx-auto max-w-3xl px-6 py-6'>
          <div className='animate-pulse space-y-4'>
            <div className='h-8 w-1/3 rounded bg-gray-200 dark:bg-zinc-700' />
            <div className='rounded-lg bg-white p-6 dark:bg-zinc-900'>
              <div className='space-y-3'>
                <div className='h-4 w-full rounded bg-gray-200 dark:bg-zinc-700' />
                <div className='h-4 w-2/3 rounded bg-gray-200 dark:bg-zinc-700' />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-zinc-950'>
        <div className='mx-auto max-w-3xl px-6 py-6'>
          <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'>
            <h2 className='mb-2 text-lg font-semibold'>加载失败</h2>
            <p className='mb-4'>{loadError}</p>
            <div className='flex gap-3'>
              <Button onClick={() => void loadCase()}>重试</Button>
              <Button variant='ghost' onClick={() => router.back()}>
                返回
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-zinc-950'>
      <header className='border-b border-gray-200 bg-white px-6 py-4 dark:border-zinc-700 dark:bg-zinc-900'>
        <div className='mx-auto max-w-3xl'>
          <Button
            variant='ghost'
            onClick={() => router.back()}
            className='mb-2 text-sm'
          >
            ← 返回
          </Button>
          <h1 className='text-2xl font-semibold text-gray-900 dark:text-zinc-100'>
            编辑案件
          </h1>
        </div>
      </header>

      <main className='mx-auto max-w-3xl px-6 py-6'>
        <form onSubmit={e => void handleSubmit(e)} className='space-y-6'>
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <label className='block text-sm font-medium mb-1'>
                  案件标题 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  name='title'
                  value={formData.title}
                  onChange={handleChange}
                  className='w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
                  placeholder='请输入案件标题'
                />
              </div>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div>
                  <label className='block text-sm font-medium mb-1'>
                    案件类型
                  </label>
                  <select
                    name='type'
                    value={formData.type}
                    onChange={handleChange}
                    className='w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
                  >
                    {CASE_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-medium mb-1'>
                    案件状态
                  </label>
                  <select
                    name='status'
                    value={formData.status}
                    onChange={handleChange}
                    className='w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
                  >
                    {CASE_STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-medium mb-1'>案号</label>
                  <input
                    type='text'
                    name='caseNumber'
                    value={formData.caseNumber}
                    onChange={handleChange}
                    className='w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
                    placeholder='如：（2024）京0105民初1234号'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium mb-1'>
                    审理法院
                  </label>
                  <input
                    type='text'
                    name='court'
                    value={formData.court}
                    onChange={handleChange}
                    className='w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
                    placeholder='法院名称'
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 当事人信息 */}
          <Card>
            <CardHeader>
              <CardTitle>当事人信息</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div>
                  <label className='block text-sm font-medium mb-1'>
                    原告 / 申请人
                  </label>
                  <input
                    type='text'
                    name='plaintiffName'
                    value={formData.plaintiffName}
                    onChange={handleChange}
                    className='w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
                    placeholder='原告姓名或单位'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium mb-1'>
                    被告 / 被申请人
                  </label>
                  <input
                    type='text'
                    name='defendantName'
                    value={formData.defendantName}
                    onChange={handleChange}
                    className='w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
                    placeholder='被告姓名或单位'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium mb-1'>案由</label>
                  <input
                    type='text'
                    name='cause'
                    value={formData.cause}
                    onChange={handleChange}
                    className='w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
                    placeholder='如：民间借贷纠纷'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium mb-1'>
                    标的金额（元）
                  </label>
                  <input
                    type='number'
                    name='amount'
                    value={formData.amount}
                    onChange={handleChange}
                    className='w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
                    placeholder='仅填数字'
                    min='0'
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 案情描述 */}
          <Card>
            <CardHeader>
              <CardTitle>案情描述</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                name='description'
                value={formData.description}
                onChange={handleChange}
                rows={6}
                className='w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
                placeholder='请输入案件详细描述'
              />
            </CardContent>
          </Card>

          {/* 错误提示 */}
          {submitError && (
            <div className='rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'>
              {submitError}
            </div>
          )}

          {/* 操作按钮 */}
          <div className='flex gap-3'>
            <Button type='submit' variant='primary' disabled={submitting}>
              {submitting ? '保存中...' : '保存修改'}
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={() => router.push(`/cases/${caseId}`)}
            >
              取消
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
