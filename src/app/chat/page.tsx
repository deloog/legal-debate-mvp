'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import Link from 'next/link';

const CHAT_INIT_TIMEOUT_MS = 12000;

async function fetchChatJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    CHAT_INIT_TIMEOUT_MS
  );

  try {
    const response = await fetch(input, {
      ...init,
      credentials: init?.credentials ?? 'include',
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error?.message ||
          `无法进入对话工作台（HTTP ${response.status}）`
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('进入对话工作台超时，请刷新页面或重新登录后再试');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function ChatIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const navigating = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (navigating.current) return;
    navigating.current = true;

    const enterChat = async () => {
      // 先尝试拿最近对话，有就进去，没有再创建新对话。
      const listResult = await fetchChatJson<{ data?: { id?: string }[] }>(
        '/api/v1/chat/conversations?limit=1'
      );

      if (!Array.isArray(listResult.data)) {
        throw new Error('对话列表返回异常，请刷新页面后再试');
      }

      const latest = listResult.data[0];
      if (latest?.id) {
        router.replace(`/chat/${latest.id}`);
        return;
      }

      const createResult = await fetchChatJson<{ data?: { id?: string } }>(
        '/api/v1/chat/conversations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '新对话' }),
        }
      );

      if (!createResult.data?.id) {
        throw new Error('新对话创建异常，请刷新页面后再试');
      }

      router.replace(`/chat/${createResult.data.id}`);
    };

    enterChat().catch(error => {
      setError(
        error instanceof Error
          ? error.message
          : '无法进入对话工作台，请重新登录后再试'
      );
      navigating.current = false;
    });
  }, [user, loading, router]);

  return (
    <div className='flex h-screen bg-white'>
      <div className='w-60 bg-slate-900 shrink-0' />
      <div className='flex-1 flex items-center justify-center'>
        <div className='text-center max-w-md px-6'>
          <div className='inline-flex w-12 h-12 rounded-xl bg-slate-900 items-center justify-center mb-5'>
            <span className='text-white text-xl font-bold'>律</span>
          </div>
          {error ? (
            <div className='space-y-4'>
              <p className='text-sm text-slate-700'>{error}</p>
              <div className='flex justify-center gap-3'>
                <button
                  type='button'
                  onClick={() => window.location.reload()}
                  className='rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
                >
                  刷新重试
                </button>
                <Link
                  href='/login'
                  className='rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'
                >
                  重新登录
                </Link>
                <Link
                  href='/qualifications'
                  className='rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'
                >
                  完成认证
                </Link>
              </div>
            </div>
          ) : (
            <div className='flex items-center gap-1.5 justify-center'>
              <span className='w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]' />
              <span className='w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]' />
              <span className='w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce' />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
