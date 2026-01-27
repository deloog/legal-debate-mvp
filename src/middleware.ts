/**
 * Next.js Middleware - 路由保护和权限控制
 * 优化目标：安全性增强，防止未授权访问
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径（无需登录）
  const publicPaths = [
    '/',
    '/login',
    '/setup',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/health',
    '/api/version',
    '/api/dashboard', // 首页dashboard数据允许匿名访问
  ];

  // 注意：/api/auth/me 需要认证，不应该在公开路径中

  // 检查是否是公开路径
  const isPublicPath = publicPaths.some(
    path => pathname === path || pathname.startsWith(`${path}/`)
  );

  // 静态资源和API健康检查不需要认证
  if (
    isPublicPath ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // 从cookie或Authorization header获取token
  const accessToken =
    request.cookies.get('accessToken')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  // 调试日志：查看请求中的token
  if (pathname === '/api/auth/me') {
    console.log('[Middleware] /api/auth/me 请求:', {
      hasCookie: !!request.cookies.get('accessToken')?.value,
      hasAuthHeader: !!request.headers.get('authorization'),
      tokenValue: accessToken ? `${accessToken.substring(0, 20)}...` : 'none',
      allCookies: request.cookies.getAll().map(c => c.name),
    });
  }

  if (!accessToken) {
    // API路径返回401 JSON，页面路径重定向到登录页
    if (pathname.startsWith('/api/')) {
      console.log('[Middleware] API请求无token，返回401:', pathname);
      return NextResponse.json(
        { success: false, message: '未认证，请先登录' },
        { status: 401 }
      );
    }

    // 页面路径：重定向到登录页
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Edge Runtime不支持Node.js的crypto模块，无法验证JWT
  // Token验证将在API路由中通过getAuthUser()函数进行（API路由运行在Node.js runtime中）
  // 这里只检查token是否存在，具体验证由API路由负责

  // 调试日志：Token存在，放行到API路由进行验证
  if (pathname === '/api/auth/me') {
    console.log('[Middleware] Token存在，放行到API路由进行验证');
  }

  // 直接放行，让API路由处理token验证和权限检查
  const response = NextResponse.next();

  // 添加安全响应头
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     * - public文件夹中的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)',
  ],
};
