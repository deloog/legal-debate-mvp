/**
 * 证人表单组件
 * 用于创建和编辑证人信息
 */

'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  type WitnessDetail,
  type CreateWitnessInput,
  type WitnessStatus,
  isValidWitnessStatus,
  WITNESS_STATUS_LABELS,
} from '@/types/witness';

/**
 * 证人表单组件属性
 */
interface WitnessFormProps {
  caseId: string;
  witness?: WitnessDetail | null;
  onSubmit: (data: CreateWitnessInput | WitnessDetail) => void;
  onCancel: () => void;
  canManage: boolean;
}

/**
 * 表单数据类型
 */
interface FormData {
  name: string;
  phone: string;
  address: string;
  relationship: string;
  testimony: string;
  courtScheduleId: string;
  status: WitnessStatus;
}

/**
 * 表单错误类型
 */
interface FormErrors {
  name?: string;
  phone?: string;
  address?: string;
  relationship?: string;
  testimony?: string;
  courtScheduleId?: string;
  status?: string;
}

export function WitnessForm({
  caseId,
  witness,
  onSubmit,
  onCancel,
  canManage,
}: WitnessFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: witness?.name || '',
    phone: witness?.phone || '',
    address: witness?.address || '',
    relationship: witness?.relationship || '',
    testimony: witness?.testimony || '',
    courtScheduleId: witness?.courtScheduleId || '',
    status: (witness?.status as WitnessStatus) || 'NEED_CONTACT',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 表单字段变更处理
  const handleFieldChange = useCallback(
    (field: keyof FormData, value: string | WitnessStatus): void => {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));

      // 清除对应字段的错误
      if (errors[field]) {
        setErrors(prev => ({
          ...prev,
          [field]: undefined,
        }));
      }
    },
    [errors]
  );

  // 表单验证
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = '证人姓名不能为空';
    } else if (formData.name.length > 200) {
      newErrors.name = '证人姓名不能超过200个字符';
    }

    if (formData.phone && formData.phone.length > 20) {
      newErrors.phone = '电话号码不能超过20个字符';
    }

    if (formData.address && formData.address.length > 500) {
      newErrors.address = '地址不能超过500个字符';
    }

    if (formData.relationship && formData.relationship.length > 200) {
      newErrors.relationship = '关系描述不能超过200个字符';
    }

    if (formData.testimony && formData.testimony.length > 10000) {
      newErrors.testimony = '证词不能超过10000个字符';
    }

    if (formData.status && !isValidWitnessStatus(formData.status)) {
      newErrors.status = '无效的证人状态';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // 提交处理
  const handleSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();

      if (!canManage) {
        return;
      }

      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);

      try {
        const submitData = {
          caseId,
          name: formData.name.trim(),
          phone: formData.phone.trim() || undefined,
          address: formData.address.trim() || undefined,
          relationship: formData.relationship.trim() || undefined,
          testimony: formData.testimony.trim() || undefined,
          courtScheduleId: formData.courtScheduleId.trim() || undefined,
          status: formData.status,
        };

        if (witness) {
          // 更新操作
          onSubmit({
            ...witness,
            ...submitData,
          });
        } else {
          // 创建操作
          onSubmit(submitData);
        }
      } catch (err) {
        console.error('提交表单失败:', err);
        alert('提交失败，请重试');
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, witness, caseId, onSubmit, canManage, validateForm]
  );

  if (!canManage) {
    return (
      <Card>
        <CardContent className='py-8'>
          <div className='text-center text-gray-500'>
            您没有权限管理证人信息
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='max-w-2xl mx-auto'>
      <CardHeader>
        <CardTitle>{witness ? '编辑证人' : '添加证人'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* 基本信息 */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                证人姓名 <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={formData.name}
                onChange={e => handleFieldChange('name', e.target.value)}
                className={`w-full border rounded-md px-3 py-2 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder='请输入证人姓名'
                maxLength={200}
              />
              {errors.name && (
                <p className='text-red-500 text-sm mt-1'>{errors.name}</p>
              )}
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                联系电话
              </label>
              <input
                type='text'
                value={formData.phone}
                onChange={e => handleFieldChange('phone', e.target.value)}
                className={`w-full border rounded-md px-3 py-2 ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder='请输入联系电话'
                maxLength={20}
              />
              {errors.phone && (
                <p className='text-red-500 text-sm mt-1'>{errors.phone}</p>
              )}
            </div>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              联系地址
            </label>
            <input
              type='text'
              value={formData.address}
              onChange={e => handleFieldChange('address', e.target.value)}
              className={`w-full border rounded-md px-3 py-2 ${
                errors.address ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder='请输入联系地址'
              maxLength={500}
            />
            {errors.address && (
              <p className='text-red-500 text-sm mt-1'>{errors.address}</p>
            )}
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              与当事人关系
            </label>
            <input
              type='text'
              value={formData.relationship}
              onChange={e => handleFieldChange('relationship', e.target.value)}
              className={`w-full border rounded-md px-3 py-2 ${
                errors.relationship ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder='例如：朋友、同事、亲属等'
              maxLength={200}
            />
            {errors.relationship && (
              <p className='text-red-500 text-sm mt-1'>{errors.relationship}</p>
            )}
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              证人状态
            </label>
            <select
              value={formData.status}
              onChange={e =>
                handleFieldChange('status', e.target.value as WitnessStatus)
              }
              className={`w-full border rounded-md px-3 py-2 ${
                errors.status ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              {Object.entries(WITNESS_STATUS_LABELS).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
            {errors.status && (
              <p className='text-red-500 text-sm mt-1'>{errors.status}</p>
            )}
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              证词内容
            </label>
            <textarea
              value={formData.testimony}
              onChange={e => handleFieldChange('testimony', e.target.value)}
              className={`w-full border rounded-md px-3 py-2 ${
                errors.testimony ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder='请输入证词内容...'
              rows={6}
              maxLength={10000}
            />
            <div className='text-sm text-gray-500 mt-1'>
              {formData.testimony.length}/10000 字符
            </div>
            {errors.testimony && (
              <p className='text-red-500 text-sm mt-1'>{errors.testimony}</p>
            )}
          </div>

          {/* 操作按钮 */}
          <div className='flex justify-end gap-3 pt-4 border-t'>
            <Button
              type='button'
              variant='outline'
              onClick={onCancel}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? '提交中...' : witness ? '更新' : '创建'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
