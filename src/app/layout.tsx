import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';

// 配置字体优化：使用display策略优化字体加载
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap', // 使用swap策略，文本立即显示
  preload: true,
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: false, // 等宽字体不预加载，减少首屏加载时间
});

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
    <html
      lang='zh-CN'
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className='antialiased'>
        {/* 使用Suspense实现代码分割和懒加载 */}
        <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
      </body>
    </html>
  );
}
