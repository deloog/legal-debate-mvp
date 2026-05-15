'use client';

import { useEffect, useState } from 'react';

interface EnterpriseInfo {
  id: string;
  enterpriseName: string;
  creditCode: string;
  legalPerson: string;
  industryType: string;
  status: string;
  submittedAt: string;
  expiresAt: string | null;
  businessLicense?: string | null;
}

export default function EnterpriseCertificationPage() {
  const [enterprise, setEnterprise] = useState<EnterpriseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    enterpriseName: '',
    creditCode: '',
    legalPerson: '',
    industryType: '',
  });

  useEffect(() => {
    void fetchEnterprise();
  }, []);

  async function fetchEnterprise() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/enterprise/me');
      const data = await res.json();
      if (res.ok && data.success) {
        setEnterprise(data.data.enterprise);
      } else {
        setEnterprise(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/enterprise/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || '企业注册失败');
      }
      setSuccess('企业注册成功，等待审核');
      await fetchEnterprise();
    } catch (err) {
      setError(err instanceof Error ? err.message : '企业注册失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/enterprise/qualification/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessLicense: base64 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || '营业执照上传失败');
      }
      setSuccess('营业执照上传成功');
      await fetchEnterprise();
    } catch (err) {
      setError(err instanceof Error ? err.message : '营业执照上传失败');
    }
  }

  return (
    <div className='min-h-screen bg-zinc-50 px-6 py-10'>
      <div className='mx-auto max-w-3xl space-y-6'>
        <div>
          <h1 className='text-2xl font-bold text-zinc-900'>企业认证</h1>
          <p className='mt-1 text-sm text-zinc-500'>
            提交企业信息与营业执照，审核通过后即可使用企业法务工作台。
          </p>
        </div>

        {success && (
          <div className='rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700'>
            {success}
          </div>
        )}
        {error && (
          <div className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        {loading ? (
          <div className='rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500'>
            加载中...
          </div>
        ) : enterprise ? (
          <div className='rounded-lg border border-zinc-200 bg-white p-6 space-y-4'>
            <div className='flex items-center justify-between'>
              <h2 className='text-lg font-semibold text-zinc-900'>
                当前企业认证状态
              </h2>
              <span className='rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700'>
                {enterprise.status}
              </span>
            </div>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm'>
              <div>
                <div className='text-zinc-500'>企业名称</div>
                <div className='font-medium text-zinc-900'>
                  {enterprise.enterpriseName}
                </div>
              </div>
              <div>
                <div className='text-zinc-500'>统一社会信用代码</div>
                <div className='font-medium text-zinc-900'>
                  {enterprise.creditCode}
                </div>
              </div>
              <div>
                <div className='text-zinc-500'>法人代表</div>
                <div className='font-medium text-zinc-900'>
                  {enterprise.legalPerson}
                </div>
              </div>
              <div>
                <div className='text-zinc-500'>行业类型</div>
                <div className='font-medium text-zinc-900'>
                  {enterprise.industryType}
                </div>
              </div>
            </div>
            <div>
              <label className='mb-2 block text-sm font-medium text-zinc-700'>
                更新营业执照
              </label>
              <input type='file' accept='image/*' onChange={handleUpload} />
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className='rounded-lg border border-zinc-200 bg-white p-6 space-y-4'
          >
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <input
                type='text'
                placeholder='企业名称'
                value={form.enterpriseName}
                onChange={e =>
                  setForm(prev => ({ ...prev, enterpriseName: e.target.value }))
                }
                className='rounded-lg border border-zinc-300 px-3 py-2 text-sm'
              />
              <input
                type='text'
                placeholder='统一社会信用代码'
                value={form.creditCode}
                onChange={e =>
                  setForm(prev => ({ ...prev, creditCode: e.target.value }))
                }
                className='rounded-lg border border-zinc-300 px-3 py-2 text-sm'
              />
              <input
                type='text'
                placeholder='法人代表'
                value={form.legalPerson}
                onChange={e =>
                  setForm(prev => ({ ...prev, legalPerson: e.target.value }))
                }
                className='rounded-lg border border-zinc-300 px-3 py-2 text-sm'
              />
              <input
                type='text'
                placeholder='行业类型'
                value={form.industryType}
                onChange={e =>
                  setForm(prev => ({ ...prev, industryType: e.target.value }))
                }
                className='rounded-lg border border-zinc-300 px-3 py-2 text-sm'
              />
            </div>
            <button
              type='submit'
              disabled={submitting}
              className='rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
            >
              {submitting ? '提交中...' : '提交企业认证'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
