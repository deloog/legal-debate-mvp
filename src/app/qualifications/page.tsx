'use client';

import { useState, useEffect } from 'react';
import {
  Award,
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Building2,
  CreditCard,
  User,
} from 'lucide-react';

// ── 枚举映射 ────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: '待审核',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    icon: <Clock className='h-5 w-5 text-yellow-500' />,
  },
  UNDER_REVIEW: {
    label: '审核中',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <Clock className='h-5 w-5 text-blue-500' />,
  },
  APPROVED: {
    label: '已认证',
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: <CheckCircle className='h-5 w-5 text-green-500' />,
  },
  REJECTED: {
    label: '已拒绝',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: <XCircle className='h-5 w-5 text-red-500' />,
  },
  EXPIRED: {
    label: '已过期',
    color: 'bg-zinc-50 text-zinc-600 border-zinc-200',
    icon: <AlertCircle className='h-5 w-5 text-zinc-400' />,
  },
};

// ── 类型定义 ────────────────────────────────────────────────
interface Qualification {
  id: string;
  licenseNumber: string;
  fullName: string;
  idCardNumber: string;
  lawFirm: string;
  licensePhoto: string | null;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

interface FormData {
  licenseNumber: string;
  fullName: string;
  idCardNumber: string;
  lawFirm: string;
  licensePhoto: string;
}

// ── 主组件 ────────────────────────────────────────────────
export default function QualificationsPage() {
  const [qualification, setQualification] = useState<Qualification | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    licenseNumber: '',
    fullName: '',
    idCardNumber: '',
    lawFirm: '',
    licensePhoto: '',
  });

  useEffect(() => {
    fetchQualification();
  }, []);

  const fetchQualification = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/qualifications/me');
      const data = await res.json();
      if (data.success) {
        setQualification(data.data?.qualification ?? null);
      }
    } catch {
      setError('获取资质信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/qualifications/photo', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        setForm(prev => ({ ...prev, licensePhoto: data.data.url }));
        setSuccess('证件上传成功');
      } else {
        setError(data.message || '上传失败');
      }
    } catch {
      setError('上传失败，请重试');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.licenseNumber ||
      !form.fullName ||
      !form.idCardNumber ||
      !form.lawFirm
    ) {
      setError('请填写所有必填信息');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/qualifications/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('资质认证申请已提交，请等待审核');
        fetchQualification();
      } else {
        setError(data.message || '提交失败');
      }
    } catch {
      setError('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // ── 渲染当前资质状态 ────────────────────────────────────────────────
  const renderQualificationCard = (q: Qualification) => {
    const config = STATUS_CONFIG[q.status] ?? STATUS_CONFIG.PENDING;
    return (
      <div className={`rounded-xl border-2 p-6 ${config.color}`}>
        <div className='flex items-start justify-between mb-4'>
          <div className='flex items-center gap-3'>
            {config.icon}
            <div>
              <h2 className='text-lg font-semibold'>{config.label}</h2>
              <p className='text-sm opacity-75'>
                提交时间：{new Date(q.submittedAt).toLocaleDateString('zh-CN')}
              </p>
            </div>
          </div>
          {q.status === 'APPROVED' && (
            <Award className='h-8 w-8 text-green-500' />
          )}
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4'>
          <InfoRow
            icon={<User className='h-4 w-4' />}
            label='姓名'
            value={q.fullName}
          />
          <InfoRow
            icon={<CreditCard className='h-4 w-4' />}
            label='执照编号'
            value={q.licenseNumber}
          />
          <InfoRow
            icon={<Building2 className='h-4 w-4' />}
            label='律师事务所'
            value={q.lawFirm}
          />
          {q.reviewedAt && (
            <InfoRow
              icon={<CheckCircle className='h-4 w-4' />}
              label='审核时间'
              value={new Date(q.reviewedAt).toLocaleDateString('zh-CN')}
            />
          )}
        </div>

        {q.reviewNotes && (
          <div className='mt-4 p-3 bg-white/50 rounded-lg'>
            <p className='text-sm font-medium mb-1'>审核意见</p>
            <p className='text-sm'>{q.reviewNotes}</p>
          </div>
        )}

        {(q.status === 'REJECTED' || q.status === 'EXPIRED') && (
          <button
            onClick={() => setQualification(null)}
            className='mt-4 px-4 py-2 bg-white border border-current rounded-lg text-sm font-medium hover:bg-white/80'
          >
            重新申请
          </button>
        )}
      </div>
    );
  };

  // ── 渲染提交表单 ────────────────────────────────────────────────
  const renderForm = () => (
    <form
      onSubmit={handleSubmit}
      className='bg-white rounded-xl border border-zinc-200 p-6 space-y-5'
    >
      <h2 className='text-lg font-semibold text-zinc-900'>提交律师资质认证</h2>
      <p className='text-sm text-zinc-500'>
        请填写真实信息，审核通过后将获得认证标识
      </p>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <FormField label='执业证号' required>
          <input
            type='text'
            placeholder='请输入执照编号'
            value={form.licenseNumber}
            onChange={e =>
              setForm(prev => ({ ...prev, licenseNumber: e.target.value }))
            }
            className='w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </FormField>
        <FormField label='真实姓名' required>
          <input
            type='text'
            placeholder='与证件一致'
            value={form.fullName}
            onChange={e =>
              setForm(prev => ({ ...prev, fullName: e.target.value }))
            }
            className='w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </FormField>
        <FormField label='身份证号' required>
          <input
            type='text'
            placeholder='18位身份证号'
            value={form.idCardNumber}
            onChange={e =>
              setForm(prev => ({ ...prev, idCardNumber: e.target.value }))
            }
            className='w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </FormField>
        <FormField label='执业律师事务所' required>
          <input
            type='text'
            placeholder='全称'
            value={form.lawFirm}
            onChange={e =>
              setForm(prev => ({ ...prev, lawFirm: e.target.value }))
            }
            className='w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </FormField>
      </div>

      <FormField label='执照照片'>
        <label className='flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors'>
          {form.licensePhoto ? (
            <div className='flex items-center gap-2 text-green-600'>
              <CheckCircle className='h-5 w-5' />
              <span className='text-sm font-medium'>已上传</span>
            </div>
          ) : (
            <div className='flex flex-col items-center gap-1 text-zinc-400'>
              <Upload className='h-6 w-6' />
              <span className='text-sm'>点击上传证件照片</span>
              <span className='text-xs'>支持 JPG、PNG，不超过 5MB</span>
            </div>
          )}
          <input
            type='file'
            accept='image/*'
            onChange={handleUpload}
            className='hidden'
          />
        </label>
      </FormField>

      <button
        type='submit'
        disabled={submitting}
        className='w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
      >
        {submitting ? '提交中...' : '提交认证申请'}
      </button>
    </form>
  );

  // ── 主渲染 ────────────────────────────────────────────────
  return (
    <div className='min-h-screen bg-zinc-50'>
      <header className='border-b border-zinc-200 bg-white px-6 py-4'>
        <div className='mx-auto max-w-3xl flex items-center gap-3'>
          <Award className='h-6 w-6 text-blue-600' />
          <h1 className='text-xl font-semibold text-zinc-900'>律师资质认证</h1>
        </div>
      </header>

      <main className='mx-auto max-w-3xl px-6 py-6 space-y-4'>
        {/* 提示消息 */}
        {success && (
          <div className='flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm'>
            <CheckCircle className='h-4 w-4 shrink-0' /> {success}
          </div>
        )}
        {error && (
          <div className='flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm'>
            <XCircle className='h-4 w-4 shrink-0' /> {error}
          </div>
        )}

        {loading ? (
          <div className='bg-white rounded-xl border border-zinc-200 p-8 animate-pulse'>
            <div className='h-5 bg-zinc-200 rounded w-1/2 mb-4' />
            <div className='h-4 bg-zinc-100 rounded w-1/3' />
          </div>
        ) : qualification ? (
          renderQualificationCard(qualification)
        ) : (
          <>
            {/* 说明卡片 */}
            <div className='bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3'>
              <FileText className='h-5 w-5 text-blue-500 shrink-0 mt-0.5' />
              <div className='text-sm text-blue-800'>
                <p className='font-medium mb-1'>关于律师资质认证</p>
                <ul className='list-disc list-inside space-y-0.5 text-blue-700'>
                  <li>认证后可在平台发布专业法律服务</li>
                  <li>系统将在 1-3 个工作日内完成审核</li>
                  <li>请确保填写信息与执照完全一致</li>
                </ul>
              </div>
            </div>
            {renderForm()}
          </>
        )}
      </main>
    </div>
  );
}

// ── 辅助组件 ────────────────────────────────────────────────
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className='flex items-center gap-2'>
      <span className='opacity-60'>{icon}</span>
      <span className='text-xs opacity-60'>{label}：</span>
      <span className='text-sm font-medium'>{value}</span>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className='block text-sm font-medium text-zinc-700 mb-1'>
        {label} {required && <span className='text-red-500'>*</span>}
      </label>
      {children}
    </div>
  );
}
