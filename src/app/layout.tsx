import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { AuthProvider } from './providers/AuthProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { UserModeProvider } from '@/contexts/UserModeContext';
import './globals.css';

// 注意：由于网络问题，暂时移除 Google Fonts
// 使用系统字体作为后备方案
// 如果需要 Google Fonts，请确保网络连接正常后取消注释以下代码：
// import { Geist, Geist_Mono } from 'next/font/google';
// const geistSans = Geist({
//   variable: '--font-geist-sans',
//   subsets: ['latin'],
//   display: 'swap',
//   preload: true,
// });
// const geistMono = Geist_Mono({
//   variable: '--font-geist-mono',
//   subsets: ['latin'],
//   display: 'swap',
//   preload: false,
// });

// 使用系统字体变量
const fontVariables = '--font-geist-sans --font-geist-mono';

// 配置元数据优化
export const metadata: Metadata = {
  title: {
    default: 'Legal Debate MVP',
    template: '%s | AI法律辩论系统',
  },
  description: 'AI驱动的法律辩论系统，提供专业的法律文书分析和辩论生成服务',
  keywords: ['法律', '辩论', 'AI', '智能分析', '法律文书'],
  authors: [{ name: 'Legal Debate Team' }],
  creator: 'Legal Debate MVP',
  publisher: 'Legal Debate MVP',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ),
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: '/',
    title: 'Legal Debate MVP',
    description: 'AI驱动的法律辩论系统',
    siteName: 'Legal Debate MVP',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

// 配置视口优化
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};

// 加载状态组件
function LoadingFallback() {
  return (
    <div className='flex min-h-screen items-center justify-center'>
      <div className='text-center'>
        <div className='h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent' />
        <p className='mt-4 text-sm text-gray-600'>加载中...</p>
      </div>
    </div>
  );
}

// 根布局组件
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='zh-CN'>
      <body className='antialiased'>
        {/* 认证提供者 */}
        <AuthProvider>
          {/* 用户模式提供者 */}
          <UserModeProvider>
            {/* Toast通知提供者 */}
            <ToastProvider />
            {/* 使用Suspense实现代码分割和懒加载 */}
            <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
          </UserModeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
