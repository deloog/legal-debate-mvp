'use client';

import { useRouter } from 'next/navigation';
import { ConsultationForm } from './components/consultation-form';

/**
 * 创建咨询页面
 * 功能：提供表单供用户输入咨询信息
 */
export default function CreateConsultationPage() {
  const router = useRouter();

  const handleSubmit = async () => {
    router.push('/consultations');
  };

  const handleCancel = () => {
    router.push('/consultations');
  };

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-7xl items-center justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
              创建咨询
            </h1>
            <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
              录入新的咨询信息
            </p>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-4xl px-6 py-8'>
        <ConsultationForm onSubmit={handleSubmit} onCancel={handleCancel} />
      </main>
    </div>
  );
}
