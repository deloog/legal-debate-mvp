'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';

export default function ChatIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const creating = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (creating.current) return;
    creating.current = true;

    // 自动新建对话并跳转
    fetch('/api/v1/chat/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title: '新对话' }),
    })
      .then(r => r.json())
      .then((data: { data?: { id: string } }) => {
        if (data.data?.id) {
          router.replace(`/chat/${data.data.id}`);
        }
      })
      .catch(() => {
        creating.current = false;
      });
  }, [user, loading, router]);

  return (
    <div className='flex h-screen items-center justify-center bg-gray-50'>
      <div className='text-center'>
        <div className='h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent mx-auto mb-3' />
        <p className='text-sm text-gray-500'>正在准备对话…</p>
      </div>
    </div>
  );
}
