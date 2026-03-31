import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { AuthProvider } from './providers/AuthProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { UserModeProvider } from '@/contexts/UserModeContext';
import { Footer } from '@/components/layout/Footer';
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

// 配置元数据优化
export const metadata: Metadata = {
  title: {
    default: '律伴AI助手',
    template: '%s | 律伴AI助手',
  },
  description:
    '面向认证律师与企业法务的AI工作平台，提供辩论生成、法条检索、合同风险分析等专业服务',
  keywords: [
    '律伴',
    'AI助手',
    '法律',
    '律师',
    '企业法务',
    '法条检索',
    '合同审查',
  ],
  authors: [{ name: '律伴团队' }],
  creator: '律伴AI助手',
  publisher: '律伴AI助手',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ),
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: '/',
    title: '律伴AI助手',
    description: '面向认证律师与企业法务的AI工作平台',
    siteName: '律伴AI助手',
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
      <body className='antialiased flex flex-col min-h-screen'>
        <AuthProvider>
          <UserModeProvider>
            <ToastProvider />
            <Suspense fallback={<LoadingFallback />}>
              <div className='flex flex-col min-h-screen'>
                {children}
                <Footer />
              </div>
            </Suspense>
          </UserModeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
