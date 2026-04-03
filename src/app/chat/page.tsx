'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';

export default function ChatIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className='flex h-screen items-center justify-center bg-gray-50'>
        <div className='h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent' />
      </div>
    );
  }

  return (
    <div className='flex h-screen items-center justify-center bg-gray-50'>
      <div className='text-center'>
        <div className='h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent mx-auto mb-3' />
        <p className='text-sm text-gray-500'>正在准备对话...</p>
      </div>
    </div>
  );
}
