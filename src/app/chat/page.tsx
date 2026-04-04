'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';

export default function ChatIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const navigating = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (navigating.current) return;
    navigating.current = true;

    // 先尝试拿最近对话，有就进去，没有再创建新对话
    fetch('/api/v1/chat/conversations?limit=1', { credentials: 'include' })
      .then(r => r.json())
      .then((data: { data?: { id: string }[] }) => {
        const latest = data.data?.[0];
        if (latest?.id) {
          router.replace(`/chat/${latest.id}`);
          return;
        }
        return fetch('/api/v1/chat/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ title: '新对话' }),
        })
          .then(r => r.json())
          .then((d: { data?: { id: string } }) => {
            if (d.data?.id) router.replace(`/chat/${d.data.id}`);
          });
      })
      .catch(() => {
        navigating.current = false;
      });
  }, [user, loading, router]);

  return (
    <div className='flex h-screen bg-white'>
      <div className='w-60 bg-slate-900 shrink-0' />
      <div className='flex-1 flex items-center justify-center'>
        <div className='text-center'>
          <div className='inline-flex w-12 h-12 rounded-xl bg-slate-900 items-center justify-center mb-5'>
            <span className='text-white text-xl font-bold'>律</span>
          </div>
          <div className='flex items-center gap-1.5 justify-center'>
            <span className='w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]' />
            <span className='w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]' />
            <span className='w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce' />
          </div>
        </div>
      </div>
    </div>
  );
}
