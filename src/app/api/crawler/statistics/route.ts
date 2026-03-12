/**
 * 采集数据统计 API (安全增强版)
 *
 * 安全措施：
 * - 身份验证：仅允许已登录用户
 * - 速率限制：防止统计 API 被滥用
 * - 数据脱敏：不返回敏感配置信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { crawlTaskManager } from '@/lib/crawler/crawl-task-manager';
import { logger } from '@/lib/logger';

// 速率限制存储
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 分钟
const RATE_LIMIT_MAX_REQUESTS = 30; // 每分钟最多 30 次请求

/**
 * 检查速率限制
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * 获取客户端 IP
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request: NextRequest) {
  try {
    // 1. 速率限制检查
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
          },
        }
      );
    }

    // 2. 身份验证
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: '未认证，请先登录' }, { status: 401 });
    }

    // 3. 获取统计数据
    const statistics = await crawlTaskManager.getSourceStatistics();
    const sourceConfig = await crawlTaskManager.getSourceConfig();

    // 4. 脱敏处理：过滤敏感信息
    const sanitizedSources = sourceConfig.map(source => ({
      source: source.source,
      totalArticles: source.totalArticles,
      validArticles: source.validArticles,
      // 不返回敏感字段如 API 密钥、内部路径等
    }));

    // 5. 记录访问日志
    logger.info('爬虫统计数据查询', {
      userId: session.user.id,
      role: session.user.role,
      ip: clientIP,
    });

    return NextResponse.json({
      success: true,
      data: {
        statistics,
        sources: sanitizedSources,
        summary: {
          totalArticles: statistics.reduce(
            (sum, s) => sum + s.totalArticles,
            0
          ),
          totalValid: statistics.reduce((sum, s) => sum + s.validArticles, 0),
          dataSources: statistics.length,
        },
      },
    });
  } catch (error) {
    logger.error('获取统计数据失败:', error);
    return NextResponse.json({ error: '获取统计数据失败' }, { status: 500 });
  }
}
