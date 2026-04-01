/**
 * API 版本中间件
 * 提供 API 版本控制、废弃标记和 v1 转发功能
 */

import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// 类型定义
// =============================================================================

export interface ApiVersionConfig {
  version: 'v1' | 'legacy';
  deprecated?: boolean;
  v1Alternative?: string;
  deprecationMessage?: string;
  sunsetDate?: string;
}

export interface ApiVersionResponse extends NextResponse {
  headers: Headers;
}

// =============================================================================
// 常量配置
// =============================================================================

export const API_VERSION_CONFIG = {
  CURRENT: 'v1',
  DEPRECATED: 'legacy',
  SUNSET_DATE: '2026-12-31',

  /**
   * 高频使用路由列表 - 需要创建 v1 别名
   */
  HIGH_FREQUENCY_ROUTES: [
    'cases',
    'debate',
    'users',
    'stats',
    'health',
    'auth',
    'clients',
    'notifications',
    'tasks',
  ],

  /**
   * 高频路由Set - 用于O(1)查找
   */
  get HIGH_FREQUENCY_ROUTES_SET() {
    return new Set(this.HIGH_FREQUENCY_ROUTES);
  },

  /**
   * 根级路由到 v1 的映射
   */
  V1_ALTERNATIVES: {
    '/api/cases': '/api/v1/cases',
    '/api/debate': '/api/v1/debates',
    '/api/users': '/api/v1/users',
    '/api/stats': '/api/v1/dashboard',
    '/api/health': '/api/v1/health',
    '/api/clients': '/api/v1/clients',
    '/api/notifications': '/api/v1/notifications',
    '/api/tasks': '/api/v1/reminders',
  } as Record<string, string>,
};

// =============================================================================
// 废弃标记工具函数
// =============================================================================

/**
 * 为响应添加废弃标记头
 * @param response NextResponse 响应对象
 * @param sunsetDate 废弃日期 (RFC 8594)
 * @param v1Alternative v1 替代路径
 * @param message 废弃说明
 * @returns 添加了废弃标记的响应
 */
export function addDeprecationHeaders(
  response: NextResponse,
  sunsetDate?: string,
  v1Alternative?: string,
  message?: string
): NextResponse {
  // 添加废弃标记头
  response.headers.set('X-Deprecated', 'true');

  // 添加 Sunset 头 (RFC 8594)
  if (sunsetDate) {
    response.headers.set('Sunset', sunsetDate);
  } else {
    response.headers.set('Sunset', API_VERSION_CONFIG.SUNSET_DATE);
  }

  // 添加 Deprecation 头 (draft-ietf-httpapi-deprecation-header)
  if (message) {
    response.headers.set('Deprecation', message);
  } else {
    response.headers.set(
      'Deprecation',
      `This API version is deprecated. Please migrate to ${API_VERSION_CONFIG.CURRENT}.`
    );
  }

  // 添加 Link 头指向 v1 替代 (RFC 8288)
  if (v1Alternative) {
    const links = [
      `<${v1Alternative}>; rel="successor-version"`,
      `<${v1Alternative}>; rel="alternate"`,
    ];
    const existingLink = response.headers.get('Link');
    if (existingLink) {
      response.headers.set('Link', `${existingLink}, ${links.join(', ')}`);
    } else {
      response.headers.set('Link', links.join(', '));
    }
  }

  // 添加缓存控制头，确保废弃标记不被缓存（安全审计建议）
  response.headers.set('Cache-Control', 'no-cache, must-revalidate');

  return response;
}

// =============================================================================
// API 版本包装器
// =============================================================================

/**
 * API 路由处理器类型
 */
type ApiRouteHandler = (
  request: NextRequest,
  context: { params: Record<string, string> }
) => Promise<NextResponse> | NextResponse;

/**
 * 为 API 路由添加版本控制
 * @param handler 原始路由处理器
 * @param config 版本配置
 * @returns 包装后的处理器
 */
export function withApiVersion(
  handler: ApiRouteHandler,
  config: ApiVersionConfig
): ApiRouteHandler {
  return async (
    request: NextRequest,
    context: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    // 执行原始处理器
    const response = await handler(request, context);

    // 如果是废弃版本，添加废弃标记
    if (config.deprecated || config.version === 'legacy') {
      addDeprecationHeaders(
        response,
        config.sunsetDate,
        config.v1Alternative,
        config.deprecationMessage
      );
    }

    // 添加 API 版本头
    response.headers.set('X-API-Version', config.version);

    return response;
  };
}

// =============================================================================
// v1 转发处理器
// =============================================================================

/**
 * 创建 v1 转发处理器
 * 将根级 /api/* 请求转发到 /api/v1/*
 * @param v1Path v1 路径
 * @returns 转发处理器
 */
export function createV1ProxyHandler(v1Path: string): ApiRouteHandler {
  return async (
    request: NextRequest,
    _context: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    // 构建 v1 URL
    const v1Url = new URL(request.url);
    v1Url.pathname = v1Path;

    // 保留原始查询参数
    const originalUrl = new URL(request.url);
    v1Url.search = originalUrl.search;

    // 使用 rewrite 转发到 v1
    const response = NextResponse.rewrite(v1Url);

    // 添加废弃标记（因为原始路径是根级）
    addDeprecationHeaders(
      response,
      API_VERSION_CONFIG.SUNSET_DATE,
      v1Path,
      `This endpoint is deprecated. Please use ${v1Path} instead.`
    );

    return response;
  };
}

// =============================================================================
// 路径匹配缓存（性能优化）
// =============================================================================

const v1AlternativeCache = new Map<string, string | null>();
const MAX_CACHE_SIZE = 1000;

// =============================================================================
// 路径工具函数
// =============================================================================

/**
 * 获取路径的 v1 替代
 * @param pathname 当前路径
 * @returns v1 替代路径或 null
 */
export function getV1Alternative(pathname: string): string | null {
  // 路径验证
  if (!pathname || typeof pathname !== 'string') {
    return null;
  }

  // 缓存查找（性能审计建议）
  if (v1AlternativeCache.has(pathname)) {
    return v1AlternativeCache.get(pathname)!;
  }

  let result: string | null = null;

  // 直接匹配
  if (API_VERSION_CONFIG.V1_ALTERNATIVES[pathname]) {
    result = API_VERSION_CONFIG.V1_ALTERNATIVES[pathname];
  }

  // 移除尾部斜杠匹配
  if (result === null) {
    const pathnameWithoutSlash = pathname.replace(/\/$/, '');
    if (API_VERSION_CONFIG.V1_ALTERNATIVES[pathnameWithoutSlash]) {
      result = API_VERSION_CONFIG.V1_ALTERNATIVES[pathnameWithoutSlash];
    }
  }

  // 通配匹配（如 /api/cases/123 -> /api/v1/cases/123）
  if (result === null) {
    for (const [rootPath, v1Path] of Object.entries(
      API_VERSION_CONFIG.V1_ALTERNATIVES
    )) {
      if (pathname.startsWith(rootPath + '/')) {
        const suffix = pathname.substring(rootPath.length);
        result = v1Path + suffix;
        break;
      }
    }
  }

  // 缓存结果（LRU策略）
  if (v1AlternativeCache.size >= MAX_CACHE_SIZE) {
    // 简单的LRU：删除第一个条目
    const firstKey = v1AlternativeCache.keys().next().value;
    if (firstKey !== undefined) {
      v1AlternativeCache.delete(firstKey);
    }
  }
  v1AlternativeCache.set(pathname, result);

  return result;
}

/**
 * 清除路径匹配缓存
 * 用于测试或配置更新时
 */
export function clearV1AlternativeCache(): void {
  v1AlternativeCache.clear();
}

/**
 * 检查路径是否为根级 API（非 v1）
 * @param pathname 路径名
 * @returns 是否为根级 API
 */
export function isRootLevelApi(pathname: string): boolean {
  // 路径验证（安全审计建议）
  if (!pathname || typeof pathname !== 'string') {
    return false;
  }

  if (!pathname.startsWith('/')) {
    return false;
  }

  // 排除 v1 路径
  if (pathname.startsWith('/api/v1/') || pathname === '/api/v1') {
    return false;
  }

  // 排除 auth 路径（保留根级合理）
  if (pathname.startsWith('/api/auth/')) {
    return false;
  }

  // 检查是否为 /api/* 路径
  return pathname.startsWith('/api/');
}

/**
 * 检查路径是否为高频路由
 * @param pathname 路径名
 * @returns 是否为高频路由
 */
export function isHighFrequencyRoute(pathname: string): boolean {
  // 路径验证
  if (!pathname || typeof pathname !== 'string') {
    return false;
  }

  const route = pathname.replace('/api/', '').split('/')[0];
  // 使用 Set 优化查找效率：O(n) → O(1)
  return API_VERSION_CONFIG.HIGH_FREQUENCY_ROUTES_SET.has(route);
}

// =============================================================================
// Next.js Middleware 适配
// =============================================================================

/**
 * Next.js Middleware 处理器
 * 用于在 middleware.ts 中全局处理 API 版本
 * @param request NextRequest
 * @returns NextResponse 或 null（表示不处理）
 */
export function apiVersionMiddleware(
  request: NextRequest
): NextResponse | null {
  const pathname = request.nextUrl.pathname;

  // 只处理根级 API
  if (!isRootLevelApi(pathname)) {
    return null;
  }

  // 获取 v1 替代路径
  const v1Alternative = getV1Alternative(pathname);

  if (v1Alternative) {
    // 高频路由：转发到 v1
    if (isHighFrequencyRoute(pathname)) {
      const v1Url = new URL(v1Alternative, request.url);
      v1Url.search = request.nextUrl.search;

      const response = NextResponse.rewrite(v1Url);
      addDeprecationHeaders(response, undefined, v1Alternative);
      return response;
    }

    // 其他路由：添加废弃标记但不转发
    const response = NextResponse.next();
    addDeprecationHeaders(response, undefined, v1Alternative);
    return response;
  }

  // 无 v1 替代的路径：仅添加通用废弃标记
  const response = NextResponse.next();
  response.headers.set('X-Deprecated', 'true');
  response.headers.set(
    'Deprecation',
    'This API endpoint is deprecated. Please use /api/v1/* instead.'
  );
  return response;
}
