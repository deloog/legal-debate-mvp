'use client';

import { useState, useEffect } from 'react';
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
import { ConsultationType } from '@/types/consultation';
import { validateCreateConsultation } from '@/lib/validations/consultation';

/**
 * 案件类型配置接口
 */
interface CaseTypeConfig {
  id: string;
  code: string;
  name: string;
  category: string;
  baseFee: number;
  riskFeeRate: number | null;
  hourlyRate: number | null;
  avgDuration: number | null;
  complexityLevel: number;
  isActive: boolean;
  sortOrder: number;
}

export interface ConsultationFormProps {
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}

export function ConsultationForm({
  onSubmit,
  onCancel,
}: ConsultationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [caseTypes, setCaseTypes] = useState<CaseTypeConfig[]>([]);
  const [isLoadingCaseTypes, setIsLoadingCaseTypes] = useState(true);
  const [caseTypeError, setCaseTypeError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    consultType: ConsultationType.PHONE,
    consultTime: new Date().toISOString().slice(0, 16),
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    clientCompany: '',
    caseType: '',
    caseSummary: '',
    clientDemand: '',
    followUpDate: '',
    followUpNotes: '',
  });

  // 获取案件类型列表
  useEffect(() => {
    async function fetchCaseTypes() {
      try {
        setIsLoadingCaseTypes(true);
        setCaseTypeError(null);
        const response = await fetch('/api/case-type-configs?isActive=true');
        const data = await response.json();

        if (data.success) {
          setCaseTypes(data.data);
        } else {
          setCaseTypeError(data.error?.message || '获取案件类型失败');
        }
      } catch {
        setCaseTypeError('获取案件类型失败，请重试');
      } finally {
        setIsLoadingCaseTypes(false);
      }
    }

    fetchCaseTypes();
  }, []);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = (): boolean => {
    const result = validateCreateConsultation(formData);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/consultations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consultType: formData.consultType,
          consultTime: new Date(formData.consultTime).toISOString(),
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
        }),
      });

      const data = await response.json();

      if (data.success) {
        await onSubmit();
      } else {
        setErrors({ submit: data.error?.message || '创建失败' });
      }
    } catch {
      setErrors({ submit: '网络错误，请重试' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 按大类分组案件类型
  const groupedCaseTypes = caseTypes.reduce<Record<string, CaseTypeConfig[]>>(
    (acc, ct) => {
      if (!acc[ct.category]) {
        acc[ct.category] = [];
      }
      acc[ct.category].push(ct);
      return acc;
    },
    {}
  );

  // 大类标签映射
  const categoryLabels: Record<string, string> = {
    CIVIL: '民事',
    CRIMINAL: '刑事',
    ADMINISTRATIVE: '行政',
    NON_LITIGATION: '非诉',
  };

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle>咨询信息</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className='space-y-4'>
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
              <option value={ConsultationType.PHONE}>电话咨询</option>
              <option value={ConsultationType.VISIT}>来访咨询</option>
              <option value={ConsultationType.ONLINE}>在线咨询</option>
              <option value={ConsultationType.REFERRAL}>转介绍</option>
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
            {isLoadingCaseTypes ? (
              <div className='flex items-center space-x-2'>
                <div className='h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
                <span className='text-sm text-gray-500'>加载中...</span>
              </div>
            ) : caseTypeError ? (
              <div className='text-sm text-red-500'>{caseTypeError}</div>
            ) : (
              <select
                id='caseType'
                value={formData.caseType}
                onChange={e => handleChange('caseType', e.target.value)}
                className='w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>请选择案件类型</option>
                {Object.entries(groupedCaseTypes).map(([category, types]) => (
                  <optgroup
                    key={category}
                    label={categoryLabels[category] || category}
                  >
                    {types.map(ct => (
                      <option key={ct.id} value={ct.code}>
                        {ct.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
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
            onClick={onCancel}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button type='submit' variant='primary' disabled={isSubmitting}>
            {isSubmitting ? '提交中...' : '创建'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
