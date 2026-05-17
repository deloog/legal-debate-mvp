'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { InvoiceType } from '@/types/payment';
import { useAuth } from '@/app/providers/AuthProvider';

interface InvoiceApplyFormProps {
  orderId: string;
  orderAmount: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface FormData {
  type: InvoiceType;
  title: string;
  taxNumber: string;
  email: string;
}

interface FormErrors {
  title?: string;
  taxNumber?: string;
  email?: string;
}

/**
 * 发票申请表单组件
 * 支持个人发票和企业发票申请
 */
export function InvoiceApplyForm({
  orderId,
  orderAmount,
  onSuccess,
  onCancel,
}: InvoiceApplyFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    type: InvoiceType.PERSONAL,
    title: '',
    taxNumber: '',
    email: user?.email || '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState(false);

  /**
   * 验证表单数据
   */
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // 企业发票需要验证抬头和税号
    if (formData.type === InvoiceType.ENTERPRISE) {
      if (!formData.title.trim()) {
        newErrors.title = '发票抬头不能为空';
      } else if (formData.title.length > 100) {
        newErrors.title = '发票抬头不能超过100个字符';
      }

      if (!formData.taxNumber.trim()) {
        newErrors.taxNumber = '税号不能为空';
      } else {
        // 验证税号格式（15-20位数字或字母）
        const taxNumberRegex = /^[A-Za-z0-9]{15,20}$/;
        if (!taxNumberRegex.test(formData.taxNumber.trim())) {
          newErrors.taxNumber = '税号格式不正确，应为15-20位数字或字母';
        }
      }
    }

    // 验证邮箱
    if (!formData.email.trim()) {
      newErrors.email = '接收邮箱不能为空';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = '邮箱格式不正确';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);

    // 验证表单
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/invoices/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          type: formData.type,
          title:
            formData.type === InvoiceType.ENTERPRISE
              ? formData.title
              : undefined,
          taxNumber:
            formData.type === InvoiceType.ENTERPRISE
              ? formData.taxNumber
              : undefined,
          email: formData.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '申请发票失败');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '申请发票失败');
      }

      setSuccess(true);
      setError(null);

      // 1.5秒后跳转到成功页面
      setTimeout(() => {
        router.push(`/invoices/apply/success?invoiceId=${result.data.id}`);
        onSuccess?.();
      }, 1500);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '申请发票失败，请稍后重试';
      setError(errorMessage);
      setSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 处理输入变化
   */
  const handleInputChange = (
    field: keyof FormData,
    value: string | InvoiceType
  ): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // 清除该字段的错误
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  /**
   * 处理取消
   */
  const handleCancel = (): void => {
    onCancel?.();
    router.back();
  };

  return (
    <Card className='w-full'>
      <div className='p-6'>
        {/* 页面标题 */}
        <div className='mb-6'>
          <div className='flex items-center space-x-2'>
            <FileText className='h-6 w-6 text-blue-600' />
            <h1 className='text-2xl font-bold text-gray-900'>申请发票</h1>
          </div>
          <p className='mt-2 text-sm text-gray-600'>
            请填写发票信息，发票将在1-3个工作日内开具完成
          </p>
        </div>

        {/* 订单信息 */}
        <div className='mb-6 rounded-md bg-blue-50 p-4'>
          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='font-semibold text-gray-900'>订单编号：</span>
              <span className='text-gray-700'>{orderId}</span>
            </div>
            <div>
              <span className='font-semibold text-gray-900'>开票金额：</span>
              <span className='text-blue-600 font-semibold'>
                ¥{orderAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* 成功提示 */}
        {success && (
          <div className='mb-6 rounded-md bg-green-50 p-4'>
            <div className='flex items-start space-x-2'>
              <CheckCircle2 className='h-5 w-5 text-green-600 mt-0.5' />
              <div className='flex-1'>
                <div className='font-semibold text-green-900'>申请成功</div>
                <div className='mt-1 text-sm text-green-800'>
                  发票申请已提交，正在为您生成中...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className='mb-6 rounded-md bg-red-50 p-4'>
            <div className='flex items-start space-x-2'>
              <AlertCircle className='h-5 w-5 text-red-600 mt-0.5' />
              <div className='flex-1'>
                <div className='font-semibold text-red-900'>申请失败</div>
                <div className='mt-1 text-sm text-red-800'>{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* 表单 */}
        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* 发票类型 */}
          <div className='space-y-2'>
            <Label className='text-base font-semibold'>发票类型</Label>
            <RadioGroup
              value={formData.type}
              onValueChange={value =>
                handleInputChange('type', value as InvoiceType)
              }
              disabled={isLoading}
              className='flex space-x-6'
            >
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='PERSONAL' id='personal' />
                <Label htmlFor='personal' className='cursor-pointer'>
                  个人发票
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='ENTERPRISE' id='enterprise' />
                <Label htmlFor='enterprise' className='cursor-pointer'>
                  企业发票
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 企业发票字段 */}
          {formData.type === InvoiceType.ENTERPRISE && (
            <div className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='title' className='text-base font-semibold'>
                  发票抬头 <span className='text-red-500'>*</span>
                </Label>
                <Input
                  id='title'
                  type='text'
                  value={formData.title}
                  onChange={e => handleInputChange('title', e.target.value)}
                  placeholder='请输入企业名称或单位名称'
                  disabled={isLoading}
                  maxLength={100}
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && (
                  <p className='text-sm text-red-600'>{errors.title}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='taxNumber' className='text-base font-semibold'>
                  税号 <span className='text-red-500'>*</span>
                </Label>
                <Input
                  id='taxNumber'
                  type='text'
                  value={formData.taxNumber}
                  onChange={e => handleInputChange('taxNumber', e.target.value)}
                  placeholder='请输入15-20位税号'
                  disabled={isLoading}
                  maxLength={20}
                  className={errors.taxNumber ? 'border-red-500' : ''}
                />
                {errors.taxNumber && (
                  <p className='text-sm text-red-600'>{errors.taxNumber}</p>
                )}
              </div>
            </div>
          )}

          {/* 接收邮箱 */}
          <div className='space-y-2'>
            <Label htmlFor='email' className='text-base font-semibold'>
              接收邮箱 <span className='text-red-500'>*</span>
            </Label>
            <Input
              id='email'
              type='email'
              value={formData.email}
              onChange={e => handleInputChange('email', e.target.value)}
              placeholder='发票将发送到此邮箱'
              disabled={isLoading}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className='text-sm text-red-600'>{errors.email}</p>
            )}
          </div>

          {/* 提示信息 */}
          <div className='rounded-md bg-gray-50 p-4 text-sm text-gray-600'>
            <div className='font-semibold text-gray-900 mb-2'>温馨提示：</div>
            <ul className='list-inside list-disc space-y-1'>
              <li>发票将在1-3个工作日内开具完成</li>
              <li>发票将以PDF格式发送到您的邮箱</li>
              <li>企业发票需要提供准确的抬头和税号</li>
              <li>如需修改发票信息，请重新申请</li>
            </ul>
          </div>

          {/* 操作按钮 */}
          <div className='flex space-x-3'>
            <Button
              type='button'
              variant='outline'
              onClick={handleCancel}
              disabled={isLoading || success}
              className='flex-1'
            >
              取消
            </Button>
            <Button
              type='submit'
              disabled={isLoading || success}
              className='flex-1'
            >
              {isLoading ? '提交中...' : success ? '已提交' : '提交申请'}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
