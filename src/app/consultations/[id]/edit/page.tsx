/**
 * 咨询记录编辑页面
 *
 * 功能：
 * 1. 咨询信息编辑
 *    - 修改咨询状态（待处理/跟进中/已转化/已关闭）
 *    - 修改咨询方式（线上/电话/线下）
 *    - 修改咨询时间、咨询人信息
 *    - 修改联系方式（电话、邮箱、单位）
 *    - 修改案件类型、案情摘要
 *    - 修改客户诉求
 * 2. 跟进信息管理
 *    - 设置跟进日期
 *    - 填写跟进备注
 * 3. 表单验证
 *    - 咨询人姓名必填（最多50字符）
 *    - 咨询时间必填
 *    - 案情摘要必填（10-500字符）
 *    - 联系电话格式验证
 *    - 电子邮箱格式验证
 * 4. 数据管理
 *    - 自动加载现有咨询数据
 *    - 检测未保存更改（取消时提示）
 *    - 支持保存修改和取消编辑
 * 5. 删除功能
 *    - 删除咨询记录（需二次确认）
 *    - 删除后返回列表页
 * 6. 错误处理
 *    - 加载失败提示
 *    - 保存失败提示
 *    - 表单验证错误提示
 *
 * @page /consultations/[id]/edit
 */

'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, AlertCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ConsultationType,
  ConsultStatus,
  CONSULTATION_TYPE_LABELS,
  CONSULT_STATUS_LABELS,
} from '@/types/consultation';
import { validateUpdateConsultation } from '@/lib/validations/consultation';

export default function EditConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    consultType: ConsultationType.PHONE,
    consultTime: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    clientCompany: '',
    caseType: '',
    caseSummary: '',
    clientDemand: '',
    followUpDate: '',
    followUpNotes: '',
    status: ConsultStatus.PENDING,
  });

  const [originalData, setOriginalData] = useState<typeof formData | null>(
    null
  );

  // 加载咨询数据
  useEffect(() => {
    const fetchConsultation = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/consultations/${id}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: 获取咨询详情失败`);
        }

        const data = await response.json();

        if (data.success) {
          const consultation = data.data;
          const loadedData = {
            consultType: consultation.consultType,
            consultTime: formatDateTimeLocal(consultation.consultTime),
            clientName: consultation.clientName || '',
            clientPhone: consultation.clientPhone || '',
            clientEmail: consultation.clientEmail || '',
            clientCompany: consultation.clientCompany || '',
            caseType: consultation.caseType || '',
            caseSummary: consultation.caseSummary || '',
            clientDemand: consultation.clientDemand || '',
            followUpDate: consultation.followUpDate
              ? formatDateTimeLocal(consultation.followUpDate)
              : '',
            followUpNotes: consultation.followUpNotes || '',
            status: consultation.status,
          };
          setFormData(loadedData);
          setOriginalData(loadedData);
        } else {
          setError(data.error?.message || '获取咨询详情失败');
        }
      } catch {
        setError('网络错误，请重试');
      } finally {
        setLoading(false);
      }
    };

    fetchConsultation();
  }, [id]);

  // 格式化日期为 datetime-local 格式
  const formatDateTimeLocal = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // 处理表单字段变化
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // 验证表单
  const validateForm = (): boolean => {
    const result = validateUpdateConsultation({
      ...formData,
      consultTime: formData.consultTime
        ? new Date(formData.consultTime)
        : undefined,
      followUpDate: formData.followUpDate
        ? new Date(formData.followUpDate)
        : undefined,
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues?.forEach((issue: unknown) => {
        if (
          issue &&
          typeof issue === 'object' &&
          'path' in issue &&
          'message' in issue
        ) {
          const path = Array.isArray(issue.path)
            ? issue.path[0]
            : String(issue.path);
          newErrors[path as string] = String(issue.message);
        }
      });
      setErrors(newErrors);
      return false;
    }

    return true;
  };

  // 处理保存
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/consultations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consultType: formData.consultType,
          consultTime: formData.consultTime
            ? new Date(formData.consultTime).toISOString()
            : undefined,
          clientName: formData.clientName,
          clientPhone: formData.clientPhone || undefined,
          clientEmail: formData.clientEmail || undefined,
          clientCompany: formData.clientCompany || undefined,
          caseType: formData.caseType || undefined,
          caseSummary: formData.caseSummary,
          clientDemand: formData.clientDemand || undefined,
          followUpDate: formData.followUpDate
            ? new Date(formData.followUpDate).toISOString()
            : undefined,
          followUpNotes: formData.followUpNotes || undefined,
          status: formData.status,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/consultations/${id}`);
      } else {
        setErrors({ submit: data.error?.message || '保存失败' });
      }
    } catch {
      setErrors({ submit: '网络错误，请重试' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理删除
  const handleDelete = async () => {
    if (!confirm('确定要删除此咨询记录吗？此操作无法撤销。')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/consultations/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        router.push('/consultations');
      } else {
        setErrors({ submit: data.error?.message || '删除失败' });
      }
    } catch {
      setErrors({ submit: '网络错误，请重试' });
    } finally {
      setIsDeleting(false);
    }
  };

  // 处理取消
  const handleCancel = () => {
    // 检查是否有未保存的更改
    if (
      originalData &&
      JSON.stringify(formData) !== JSON.stringify(originalData)
    ) {
      if (!confirm('您有未保存的更改，确定要离开吗？')) {
        return;
      }
    }
    router.push(`/consultations/${id}`);
  };

  // 加载状态
  if (loading) {
    return (
      <div className='min-h-screen bg-zinc-50 dark:bg-black'>
        <div className='mx-auto max-w-4xl px-6 py-8'>
          <div className='animate-pulse space-y-6'>
            <div className='h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800' />
            <div className='h-96 rounded-lg bg-zinc-200 dark:bg-zinc-800' />
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className='min-h-screen bg-zinc-50 dark:bg-black'>
        <div className='mx-auto max-w-4xl px-6 py-8'>
          <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20'>
            <AlertCircle className='mx-auto h-12 w-12 text-red-500' />
            <h2 className='mt-4 text-lg font-semibold text-red-800 dark:text-red-200'>
              加载失败
            </h2>
            <p className='mt-2 text-sm text-red-600 dark:text-red-300'>
              {error}
            </p>
            <Link
              href='/consultations'
              className='mt-4 inline-flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50'
            >
              <ArrowLeft className='h-4 w-4' />
              返回列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-4xl items-center justify-between'>
          <div className='flex items-center gap-4'>
            <Link
              href={`/consultations/${id}`}
              className='flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
            >
              <ArrowLeft className='h-4 w-4' />
              返回详情
            </Link>
            <div>
              <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
                编辑咨询
              </h1>
              <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
                修改咨询记录信息
              </p>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className='flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-600 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-900/20'
          >
            <Trash2 className='h-4 w-4' />
            {isDeleting ? '删除中...' : '删除'}
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-4xl px-6 py-8'>
        <Card className='w-full'>
          <CardHeader>
            <CardTitle>咨询信息</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className='space-y-6'>
              {/* 状态选择 */}
              <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900'>
                <Label htmlFor='status' className='text-base font-medium'>
                  咨询状态
                </Label>
                <select
                  id='status'
                  value={formData.status}
                  onChange={e =>
                    handleChange('status', e.target.value as ConsultStatus)
                  }
                  className='mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  {Object.entries(CONSULT_STATUS_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* 咨询方式 */}
              <div className='space-y-2'>
                <Label htmlFor='consultType'>
                  咨询方式<span className='text-red-500'>*</span>
                </Label>
                <select
                  id='consultType'
                  value={formData.consultType}
                  onChange={e => handleChange('consultType', e.target.value)}
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  {Object.entries(CONSULTATION_TYPE_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* 咨询时间 */}
              <div className='space-y-2'>
                <Label htmlFor='consultTime'>
                  咨询时间<span className='text-red-500'>*</span>
                </Label>
                <Input
                  id='consultTime'
                  type='datetime-local'
                  value={formData.consultTime}
                  onChange={e => handleChange('consultTime', e.target.value)}
                  className={errors.consultTime ? 'border-red-500' : ''}
                />
                {errors.consultTime && (
                  <p className='text-sm text-red-500'>{errors.consultTime}</p>
                )}
              </div>

              {/* 咨询人姓名 */}
              <div className='space-y-2'>
                <Label htmlFor='clientName'>
                  咨询人姓名<span className='text-red-500'>*</span>
                </Label>
                <Input
                  id='clientName'
                  type='text'
                  value={formData.clientName}
                  onChange={e => handleChange('clientName', e.target.value)}
                  placeholder='请输入咨询人姓名'
                  maxLength={50}
                  className={errors.clientName ? 'border-red-500' : ''}
                />
                {errors.clientName && (
                  <p className='text-sm text-red-500'>{errors.clientName}</p>
                )}
              </div>

              {/* 联系电话 */}
              <div className='space-y-2'>
                <Label htmlFor='clientPhone'>联系电话</Label>
                <Input
                  id='clientPhone'
                  type='tel'
                  value={formData.clientPhone}
                  onChange={e => handleChange('clientPhone', e.target.value)}
                  placeholder='请输入联系电话'
                  className={errors.clientPhone ? 'border-red-500' : ''}
                />
                {errors.clientPhone && (
                  <p className='text-sm text-red-500'>{errors.clientPhone}</p>
                )}
              </div>

              {/* 电子邮箱 */}
              <div className='space-y-2'>
                <Label htmlFor='clientEmail'>电子邮箱</Label>
                <Input
                  id='clientEmail'
                  type='email'
                  value={formData.clientEmail}
                  onChange={e => handleChange('clientEmail', e.target.value)}
                  placeholder='请输入电子邮箱'
                  className={errors.clientEmail ? 'border-red-500' : ''}
                />
                {errors.clientEmail && (
                  <p className='text-sm text-red-500'>{errors.clientEmail}</p>
                )}
              </div>

              {/* 单位名称 */}
              <div className='space-y-2'>
                <Label htmlFor='clientCompany'>单位名称</Label>
                <Input
                  id='clientCompany'
                  type='text'
                  value={formData.clientCompany}
                  onChange={e => handleChange('clientCompany', e.target.value)}
                  placeholder='请输入单位名称'
                  maxLength={100}
                  className={errors.clientCompany ? 'border-red-500' : ''}
                />
                {errors.clientCompany && (
                  <p className='text-sm text-red-500'>{errors.clientCompany}</p>
                )}
              </div>

              {/* 案件类型 */}
              <div className='space-y-2'>
                <Label htmlFor='caseType'>案件类型</Label>
                <Input
                  id='caseType'
                  type='text'
                  value={formData.caseType}
                  onChange={e => handleChange('caseType', e.target.value)}
                  placeholder='请输入案件类型'
                  maxLength={50}
                  className={errors.caseType ? 'border-red-500' : ''}
                />
                {errors.caseType && (
                  <p className='text-sm text-red-500'>{errors.caseType}</p>
                )}
              </div>

              {/* 案情摘要 */}
              <div className='space-y-2'>
                <Label htmlFor='caseSummary'>
                  案情摘要<span className='text-red-500'>*</span>
                </Label>
                <textarea
                  id='caseSummary'
                  value={formData.caseSummary}
                  onChange={e => handleChange('caseSummary', e.target.value)}
                  placeholder='请详细描述案情（至少10个字符）'
                  rows={5}
                  maxLength={500}
                  className={`w-full rounded-md border px-3 py-2 text-base focus:outline-none focus:ring-2 ${
                    errors.caseSummary
                      ? 'border-red-500 ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                <div className='flex justify-between text-xs text-gray-500'>
                  <span>最少10个字符</span>
                  <span>{formData.caseSummary.length}/500</span>
                </div>
                {errors.caseSummary && (
                  <p className='text-sm text-red-500'>{errors.caseSummary}</p>
                )}
              </div>

              {/* 客户诉求 */}
              <div className='space-y-2'>
                <Label htmlFor='clientDemand'>客户诉求</Label>
                <textarea
                  id='clientDemand'
                  value={formData.clientDemand}
                  onChange={e => handleChange('clientDemand', e.target.value)}
                  placeholder='请描述客户的诉求'
                  rows={3}
                  maxLength={1000}
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
                <div className='text-right text-xs text-gray-500'>
                  {formData.clientDemand.length}/1000
                </div>
              </div>

              {/* 跟进日期 */}
              <div className='space-y-2'>
                <Label htmlFor='followUpDate'>跟进日期</Label>
                <Input
                  id='followUpDate'
                  type='datetime-local'
                  value={formData.followUpDate}
                  onChange={e => handleChange('followUpDate', e.target.value)}
                  className={errors.followUpDate ? 'border-red-500' : ''}
                />
                {errors.followUpDate && (
                  <p className='text-sm text-red-500'>{errors.followUpDate}</p>
                )}
              </div>

              {/* 跟进备注 */}
              <div className='space-y-2'>
                <Label htmlFor='followUpNotes'>跟进备注</Label>
                <textarea
                  id='followUpNotes'
                  value={formData.followUpNotes}
                  onChange={e => handleChange('followUpNotes', e.target.value)}
                  placeholder='请输入跟进备注'
                  rows={3}
                  maxLength={500}
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
                <div className='text-right text-xs text-gray-500'>
                  {formData.followUpNotes.length}/500
                </div>
              </div>

              {/* 提交错误 */}
              {errors.submit && (
                <div className='rounded-md bg-red-50 p-3 text-sm text-red-800'>
                  {errors.submit}
                </div>
              )}
            </CardContent>
            <CardFooter className='flex justify-end space-x-2'>
              <Button
                type='button'
                variant='outline'
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type='submit' variant='primary' disabled={isSubmitting}>
                {isSubmitting ? '保存中...' : '保存'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
