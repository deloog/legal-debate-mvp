/**
 * Toast通知提供器
 * 使用Sonner库实现全局通知功能
 */

'use client';

import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position='top-right'
      expand={true}
      richColors
      closeButton
      toastOptions={{
        style: {
          background: 'white',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
        },
        className: 'shadow-lg',
        duration: 4000,
      }}
    />
  );
}
