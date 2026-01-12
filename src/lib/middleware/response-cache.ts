import { NextResponse } from 'next/server';
import { cache } from '@/lib/cache/manager';
import { CacheNamespace } from '@/lib/cache/types';

/**
 * 响应缓存配置
 */
interface CacheConfig {
  enabled: boolean;
  ttl: number;
  namespace: CacheNamespace;
  bypassMethods: string[];
  bypassHeaders: string[];
  varyHeaders: string[];
}

/**
 * 默认缓存配置
 */
const defaultConfig: CacheConfig = {
  enabled: true,
  ttl: 300, // 5分钟
  namespace: CacheNamespace.API_RESPONSE,
  bypassMethods: ['POST', 'PUT', 'DELETE', 'PATCH'],
  bypassHeaders: ['authorization'],
  varyHeaders: ['accept', 'accept-language'],
};

/**
 * 缓存键生成器
 */
function generateCacheKey(
  url: string,
  method: string,
  body?: string,
  headers?: Record<string, string>
): string {
  const parts = [method.toUpperCase(), url];

  // 添加查询参数
  const urlObj = new URL(url);
  if (urlObj.search) {
    parts.push(urlObj.search);
  }

  // 添加请求体（仅用于POST的幂等操作）
  if (body && body.length < 1000) {
    parts.push(body.substring(0, 200));
  }

  // 添加Vary头
  if (headers) {
    const varyParts = defaultConfig.varyHeaders
      .map(header => headers[header])
      .filter(Boolean);
    if (varyParts.length > 0) {
      parts.push(varyParts.join(','));
    }
  }

  // 生成哈希
  const key = parts.join('|');
  return Buffer.from(key).toString('base64').replace(/[+/=]/g, '');
}

/**
 * 检查是否应该缓存此请求
 */
function shouldCacheRequest(
  config: CacheConfig,
  method: string,
  headers: Headers
): boolean {
  // 检查是否启用缓存
  if (!config.enabled) {
    return false;
  }

  // 检查方法
  if (config.bypassMethods.includes(method.toUpperCase())) {
    return false;
  }

  // 检查特定头
  for (const header of config.bypassHeaders) {
    if (headers.has(header)) {
      return false;
    }
  }

  // 检查Cache-Control头
  const cacheControl = headers.get('Cache-Control');
  if (
    cacheControl?.includes('no-cache') ||
    cacheControl?.includes('no-store')
  ) {
    return false;
  }

  return true;
}

/**
 * 设置缓存响应头
 */
function setCacheHeaders(
  response: NextResponse,
  ttl: number,
  hit: boolean
): NextResponse {
  // 设置Cache-Control头
  const cacheControl = hit
    ? `public, max-age=${ttl}, must-revalidate`
    : `public, max-age=${ttl}`;

  response.headers.set('Cache-Control', cacheControl);

  // 设置ETag（如果可用）
  if (!response.headers.has('ETag')) {
    const etag = Buffer.from(Date.now().toString()).toString('base64');
    response.headers.set('ETag', etag);
  }

  // 设置X-Cache头
  response.headers.set('X-Cache', hit ? 'HIT' : 'MISS');

  return response;
}

/**
 * 响应缓存中间件工厂
 */
export function createResponseCacheMiddleware(config?: Partial<CacheConfig>) {
  const finalConfig = { ...defaultConfig, ...config };

  return async function responseCacheMiddleware(
    request: Request
  ): Promise<NextResponse | undefined> {
    const url = request.url;
    const method = request.method;

    // 检查是否应该缓存
    if (!shouldCacheRequest(finalConfig, method, request.headers)) {
      return undefined; // 继续处理请求
    }

    try {
      // 生成缓存键
      const cacheKey = generateCacheKey(url, method);

      // 尝试从缓存获取
      const cached = await cache.get<string>(cacheKey, {
        namespace: finalConfig.namespace,
      });

      if (cached) {
        const response = NextResponse.json(JSON.parse(cached));
        return setCacheHeaders(response, finalConfig.ttl, true);
      }

      // 缓存未命中，继续处理
      return undefined;
    } catch (error) {
      console.error('缓存中间件错误:', error);
      // 缓存失败时继续处理请求
      return undefined;
    }
  };
}

/**
 * 缓存响应包装器
 * 在API处理完成后缓存响应
 */
export async function cacheResponse(
  request: Request,
  response: NextResponse,
  config?: Partial<CacheConfig>
): Promise<void> {
  const finalConfig = { ...defaultConfig, ...config };

  // 检查是否应该缓存
  if (!shouldCacheRequest(finalConfig, request.method, request.headers)) {
    return;
  }

  // 检查响应状态码
  const status = response.status;
  if (status < 200 || status >= 300) {
    return; // 只缓存成功响应
  }

  try {
    // 生成缓存键
    const cacheKey = generateCacheKey(request.url, request.method);

    // 获取响应体
    const body = await response.json();

    // 缓存响应
    await cache.set(cacheKey, JSON.stringify(body), {
      namespace: finalConfig.namespace,
      ttl: finalConfig.ttl,
    });
  } catch (error) {
    console.error('缓存响应错误:', error);
  }
}

/**
 * 清除API缓存
 * 用于数据更新时清除相关缓存
 */
export async function clearApiCache(
  pattern?: string,
  namespace: CacheNamespace = CacheNamespace.API_RESPONSE
): Promise<number> {
  try {
    // Redis支持模式匹配删除
    const redis = await import('@/lib/cache/redis').then(m => m.redis);
    const keyPattern = `${namespace}:${pattern || '*'}`;
    const keys = await redis.keys(keyPattern);

    if (keys.length > 0) {
      const deleted = await redis.del(...keys);
      return deleted;
    }

    return 0;
  } catch (error) {
    console.error('清除缓存失败:', error);
    return 0;
  }
}

/**
 * 预定义的缓存配置
 */
export const cacheConfigs = {
  // 法条检索 - 高频访问，缓存15分钟
  lawArticles: {
    enabled: true,
    ttl: 900,
    namespace: CacheNamespace.API_RESPONSE,
  },

  // 案件列表 - 中频访问，缓存5分钟
  cases: {
    enabled: true,
    ttl: 300,
    namespace: CacheNamespace.API_RESPONSE,
  },

  // 案件详情 - 低频访问，缓存10分钟
  caseDetail: {
    enabled: true,
    ttl: 600,
    namespace: CacheNamespace.API_RESPONSE,
  },

  // 辩论数据 - 低频访问，缓存10分钟
  debate: {
    enabled: true,
    ttl: 600,
    namespace: CacheNamespace.API_RESPONSE,
  },

  // 法条适用性分析 - 计算密集，缓存20分钟
  applicability: {
    enabled: true,
    ttl: 1200,
    namespace: CacheNamespace.API_RESPONSE,
  },
};

export type { CacheConfig };
