'use client';

import { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '../ui/card';
import {
  CreateClientInput,
  UpdateClientInput,
  ClientType,
  ClientSource,
  ClientStatus,
} from '../../types/client';

export interface ClientFormProps {
  initialData?: UpdateClientInput;
  userId: string;
  onSubmit: (data: CreateClientInput | UpdateClientInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
}

export function ClientForm({
  initialData,
  userId,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = 'create',
}: ClientFormProps) {
  const initialClientType = useMemo(
    () => initialData?.clientType || ClientType.INDIVIDUAL,
    [initialData?.clientType]
  );
  const initialFormData = useMemo(
    () => ({
      ...initialData,
      clientType: initialClientType,
    }),
    [initialData, initialClientType]
  );

  const [clientType, setClientType] = useState<ClientType>(initialClientType);
  const [formData, setFormData] = useState<UpdateClientInput>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleTagsChange = (value: string) => {
    const tags = value
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
    setFormData(prev => ({ ...prev, tags }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length === 0) {
      newErrors.name = '客户名称不能为空';
    }

    if (formData.email && !isValidEmail(formData.email)) {
      newErrors.email = '邮箱格式不正确';
    }

    if (formData.phone && !isValidPhone(formData.phone)) {
      newErrors.phone = '电话格式不正确';
    }

    if (clientType === ClientType.INDIVIDUAL) {
      if (formData.idCardNumber && !isValidIdCard(formData.idCardNumber)) {
        newErrors.idCardNumber = '身份证号格式不正确';
      }
    }

    if (clientType === ClientType.ENTERPRISE) {
      if (!formData.company || formData.company.trim().length === 0) {
        newErrors.company = '企业名称不能为空';
      }
      if (formData.creditCode && !isValidCreditCode(formData.creditCode)) {
        newErrors.creditCode = '统一社会信用代码格式不正确';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData: CreateClientInput | UpdateClientInput =
      mode === 'create'
        ? {
            ...formData,
            userId,
            clientType,
          }
        : formData;

    await onSubmit(submitData);
  };

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle>{mode === 'create' ? '创建客户' : '编辑客户'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className='space-y-4'>
          {/* 客户类型选择 */}
          <div className='space-y-2'>
            <Label htmlFor='clientType'>客户类型</Label>
            <select
              id='clientType'
              value={clientType}
              onChange={e => {
                const newType = e.target.value as ClientType;
                setClientType(newType);
                handleChange('clientType', newType);
              }}
              className='w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value={ClientType.INDIVIDUAL}>个人客户</option>
              <option value={ClientType.ENTERPRISE}>企业客户</option>
              <option value={ClientType.POTENTIAL}>潜在客户</option>
            </select>
          </div>

          {/* 客户名称 */}
          <div className='space-y-2'>
            <Label htmlFor='name'>
              {clientType === ClientType.ENTERPRISE ? '企业名称' : '客户姓名'}
              <span className='text-red-500'>*</span>
            </Label>
            <Input
              id='name'
              type='text'
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              placeholder='请输入客户名称'
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className='text-sm text-red-500'>{errors.name}</p>
            )}
          </div>

          {/* 个人客户字段 */}
          {clientType === ClientType.INDIVIDUAL && (
            <>
              <div className='space-y-2'>
                <Label htmlFor='gender'>性别</Label>
                <select
                  id='gender'
                  value={formData.gender || ''}
                  onChange={e => handleChange('gender', e.target.value)}
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value=''>请选择</option>
                  <option value='男'>男</option>
                  <option value='女'>女</option>
                </select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='age'>年龄</Label>
                <Input
                  id='age'
                  type='number'
                  value={formData.age || ''}
                  onChange={e =>
                    handleChange(
                      'age',
                      e.target.value
                        ? Number.parseInt(e.target.value, 10)
                        : undefined
                    )
                  }
                  placeholder='请输入年龄'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='idCardNumber'>身份证号</Label>
                <Input
                  id='idCardNumber'
                  type='text'
                  value={formData.idCardNumber || ''}
                  onChange={e => handleChange('idCardNumber', e.target.value)}
                  placeholder='请输入身份证号'
                  className={errors.idCardNumber ? 'border-red-500' : ''}
                />
                {errors.idCardNumber && (
                  <p className='text-sm text-red-500'>{errors.idCardNumber}</p>
                )}
              </div>
            </>
          )}

          {/* 企业客户字段 */}
          {clientType === ClientType.ENTERPRISE && (
            <>
              <div className='space-y-2'>
                <Label htmlFor='company'>
                  企业名称<span className='text-red-500'>*</span>
                </Label>
                <Input
                  id='company'
                  type='text'
                  value={formData.company || ''}
                  onChange={e => handleChange('company', e.target.value)}
                  placeholder='请输入企业名称'
                  className={errors.company ? 'border-red-500' : ''}
                />
                {errors.company && (
                  <p className='text-sm text-red-500'>{errors.company}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='legalRep'>法人代表</Label>
                <Input
                  id='legalRep'
                  type='text'
                  value={formData.legalRep || ''}
                  onChange={e => handleChange('legalRep', e.target.value)}
                  placeholder='请输入法人代表姓名'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='creditCode'>统一社会信用代码</Label>
                <Input
                  id='creditCode'
                  type='text'
                  value={formData.creditCode || ''}
                  onChange={e => handleChange('creditCode', e.target.value)}
                  placeholder='请输入统一社会信用代码'
                  className={errors.creditCode ? 'border-red-500' : ''}
                />
                {errors.creditCode && (
                  <p className='text-sm text-red-500'>{errors.creditCode}</p>
                )}
              </div>
            </>
          )}

          {/* 通用字段 */}
          <div className='space-y-2'>
            <Label htmlFor='phone'>联系电话</Label>
            <Input
              id='phone'
              type='tel'
              value={formData.phone || ''}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder='请输入联系电话'
              className={errors.phone ? 'border-red-500' : ''}
            />
            {errors.phone && (
              <p className='text-sm text-red-500'>{errors.phone}</p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='email'>电子邮箱</Label>
            <Input
              id='email'
              type='email'
              value={formData.email || ''}
              onChange={e => handleChange('email', e.target.value)}
              placeholder='请输入电子邮箱'
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className='text-sm text-red-500'>{errors.email}</p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='profession'>职业</Label>
            <Input
              id='profession'
              type='text'
              value={formData.profession || ''}
              onChange={e => handleChange('profession', e.target.value)}
              placeholder='请输入职业'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='address'>地址</Label>
            <Input
              id='address'
              type='text'
              value={formData.address || ''}
              onChange={e => handleChange('address', e.target.value)}
              placeholder='请输入地址'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='source'>客户来源</Label>
            <select
              id='source'
              value={formData.source || ''}
              onChange={e =>
                handleChange('source', e.target.value as ClientSource)
              }
              className='w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>请选择</option>
              <option value={ClientSource.REFERRAL}>推荐</option>
              <option value={ClientSource.ONLINE}>网络</option>
              <option value={ClientSource.EVENT}>活动</option>
              <option value={ClientSource.ADVERTISING}>广告</option>
              <option value={ClientSource.OTHER}>其他</option>
            </select>
          </div>

          {mode === 'edit' && (
            <div className='space-y-2'>
              <Label htmlFor='status'>客户状态</Label>
              <select
                id='status'
                value={formData.status || ''}
                onChange={e =>
                  handleChange('status', e.target.value as ClientStatus)
                }
                className='w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value={ClientStatus.ACTIVE}>活跃</option>
                <option value={ClientStatus.INACTIVE}>非活跃</option>
                <option value={ClientStatus.LOST}>流失</option>
                <option value={ClientStatus.BLACKLISTED}>黑名单</option>
              </select>
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='tags'>标签</Label>
            <Input
              id='tags'
              type='text'
              value={formData.tags?.join(', ') || ''}
              onChange={e => handleTagsChange(e.target.value)}
              placeholder='请输入标签，用逗号分隔'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='notes'>备注</Label>
            <textarea
              id='notes'
              value={formData.notes || ''}
              onChange={e => handleChange('notes', e.target.value)}
              placeholder='请输入备注信息'
              rows={3}
              className='w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
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
            {isSubmitting ? '提交中...' : mode === 'create' ? '创建' : '保存'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

function isValidIdCard(idCard: string): boolean {
  const idCardRegex =
    /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
  return idCardRegex.test(idCard);
}

function isValidCreditCode(code: string): boolean {
  const creditCodeRegex =
    /^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/;
  return creditCodeRegex.test(code);
}
