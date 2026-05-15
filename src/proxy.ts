/**
 * Next.js Proxy (原 Middleware) - 路由保护和权限控制
 * 注意：运行在 Edge Runtime，不能使用 Node.js 模块（如 logger）
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface JwtPayloadLite {
  userId?: string;
  role?: string;
  exp?: number;
}

/**
 * 从 accessToken cookie 或 Authorization 头中轻量解析 JWT payload。
 * 只解码 base64，不验证签名（签名验证由 API 层负责）。
 */
function parseAccessToken(request: NextRequest): JwtPayloadLite | null {
  const token =
    request.cookies.get('accessToken')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(payload)) as JwtPayloadLite;
    if (decoded.exp && decoded.exp * 1000 < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

function isAdminRole(role: string | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

/**
 * 获取允许的 CORS 来源白名单。
 * 读取顺序：
 *   1. 开发环境 localhost 默认值
 *   2. NEXT_PUBLIC_APP_URL（生产域名）
 *   3. ALLOWED_ORIGINS（逗号分隔的额外域名，适用于多域名/staging环境）
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = ['http://localhost:3000', 'http://localhost:3001'];
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',')
      .map(o => o.trim())
      .filter(Boolean)
      .forEach(o => origins.push(o));
  }
  return origins;
}

/**
 * 向响应添加 CORS 头（仅当 origin 在白名单中时）。
 * 同时写入 Vary: Origin，确保 CDN 按来源分别缓存。
 */
function addCorsHeaders(
  response: NextResponse,
  corsOrigin: string | null
): void {
  if (corsOrigin) {
    response.headers.set('Access-Control-Allow-Origin', corsOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Vary', 'Origin');
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const corsOrigin =
    origin && getAllowedOrigins().includes(origin) ? origin : null;

  // ─── CORS 预检请求 ────────────────────────────────────────────────────────
  // OPTIONS 预检必须在鉴权之前处理：浏览器发送预检时不携带凭据，
  // 若被鉴权中间件拦截会返回 401，导致所有跨域请求失败。
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    };
    if (corsOrigin) {
      headers['Access-Control-Allow-Origin'] = corsOrigin;
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Vary'] = 'Origin';
    }
    return new NextResponse(null, { status: 204, headers });
  }

  // 公开路径（无需登录）
  const publicPaths = [
    '/',
    '/login',
    '/register',
    '/setup',
    '/payment/success', // 支付结果页面（无敏感数据）
    '/payment/fail', // 支付失败页面（无敏感数据）
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/oauth', // OAuth 回调端点无需登录（第三方授权回调）
    '/api/health',
    '/api/v1/health', // v1 健康检查也公开
    '/api/version',
    '/api/v1/version',
    '/api/dashboard', // 首页dashboard数据允许匿名访问
    '/api/memberships/tiers', // 会员等级列表允许公开查看
    '/api/payments/wechat/callback', // 微信支付前端跳转回调（浏览器无凭据调用）
    '/api/payments/alipay/callback', // 支付宝前端跳转回调
    '/api/payment/notify', // 微信支付服务端异步通知（微信服务器无凭据回调）
  ];

  const userAllowedPaths = [
    '/qualifications',
    '/enterprise',
    '/api/qualifications/me',
    '/api/qualifications/photo',
    '/api/qualifications/upload',
    '/api/enterprise/register',
    '/api/enterprise/me',
    '/api/enterprise/qualification',
    '/api/enterprise/qualification/upload',
  ];

  // 检查是否是公开路径
  const isPublicPath = publicPaths.some(
    path => pathname === path || pathname.startsWith(`${path}/`)
  );

  // 静态资源直接放行
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js)$/)
  ) {
    const res = NextResponse.next();
    addCorsHeaders(res, corsOrigin);
    return res;
  }

  // 公开路径：已登录用户访问 /login 或 /register → 按角色跳转
  if (isPublicPath) {
    if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
      const payload = parseAccessToken(request);
      if (payload?.userId) {
        const dest = isAdminRole(payload.role) ? '/admin' : '/';
        const res = NextResponse.redirect(new URL(dest, request.url));
        addCorsHeaders(res, corsOrigin);
        return res;
      }
    }
    const res = NextResponse.next();
    addCorsHeaders(res, corsOrigin);
    return res;
  }

  // 非公开路径：需要认证
  const payload = parseAccessToken(request);

  if (!payload?.userId) {
    // API路径返回401 JSON，页面路径重定向到登录页
    if (pathname.startsWith('/api/')) {
      const errorRes = NextResponse.json(
        { success: false, message: '未认证，请先登录', error: 'UNAUTHORIZED' },
        { status: 401 }
      );
      addCorsHeaders(errorRes, corsOrigin);
      return errorRes;
    }

    // 页面路径：重定向到登录页
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 普通用户（USER 角色）：只能访问首页落地页，不能进入工作台或调用业务 API
  if (payload.role === 'USER') {
    if (pathname.startsWith('/api/')) {
      // 放行认证相关接口（刷新 token、登出等），其余业务 API 一律 403
      const isUserAllowedPath = userAllowedPaths.some(
        path => pathname === path || pathname.startsWith(`${path}/`)
      );
      if (!pathname.startsWith('/api/auth/') && !isUserAllowedPath) {
        const errorRes = NextResponse.json(
          {
            success: false,
            message:
              '本平台仅对认证律师及企业法务开放，请联系管理员升级账号权限',
            error: 'FORBIDDEN',
          },
          { status: 403 }
        );
        addCorsHeaders(errorRes, corsOrigin);
        return errorRes;
      }
    } else {
      // 页面路由：重定向回首页（首页会展示"资质受限"提示）
      const isUserAllowedPath = userAllowedPaths.some(
        path => pathname === path || pathname.startsWith(`${path}/`)
      );
      if (!isUserAllowedPath) {
        const res = NextResponse.redirect(new URL('/', request.url));
        addCorsHeaders(res, corsOrigin);
        return res;
      }
    }
  }

  // /admin/* 路由：必须是管理员
  if (pathname.startsWith('/admin') && !isAdminRole(payload.role)) {
    const res = NextResponse.redirect(new URL('/', request.url));
    addCorsHeaders(res, corsOrigin);
    return res;
  }

  // Edge Runtime 不支持 Node.js crypto 模块，无法在此验证 JWT 签名。
  // Token 的签名验证由各 API 路由中的 getAuthUser() 负责（运行在 Node.js runtime）。
  // 此处仅做轻量级 payload 解码，防止完全未认证的请求进入业务逻辑。

  const response = NextResponse.next();

  // 添加 CORS 头（仅当来源在白名单时）
  addCorsHeaders(response, corsOrigin);

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
