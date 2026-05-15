import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Noto_Serif_SC, Noto_Sans_SC } from 'next/font/google';
import { AuthProvider } from './providers/AuthProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { UserModeProvider } from '@/contexts/UserModeContext';
import './globals.css';

// next/font/google 在构建时下载字体并自托管，运行时无需访问 Google
const notoSerifSC = Noto_Serif_SC({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-serif-sc',
  preload: false,
});

const notoSansSC = Noto_Sans_SC({
  weight: ['300', '400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans-sc',
  preload: false,
});

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
    <html
      lang='zh-CN'
      className={`${notoSerifSC.variable} ${notoSansSC.variable}`}
    >
      <body className='font-sans antialiased flex flex-col min-h-screen'>
        <AuthProvider>
          <UserModeProvider>
            <ToastProvider />
            <Suspense fallback={<LoadingFallback />}>
              <div className='flex flex-col min-h-screen'>{children}</div>
            </Suspense>
          </UserModeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
