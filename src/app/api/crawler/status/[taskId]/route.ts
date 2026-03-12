/**
 * 采集任务状态查询 API (安全增强版)
 *
 * 安全措施：
 * - 身份验证：仅允许已登录用户
 * - 速率限制：防止状态查询 API 被滥用
 * - 任务 ID 验证：防止非法任务 ID 格式
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { crawlTaskManager } from '@/lib/crawler/crawl-task-manager';
import { logger } from '@/lib/logger';

// 速率限制存储
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 分钟
const RATE_LIMIT_MAX_REQUESTS = 30; // 每分钟最多 30 次请求（比启动 API 宽松）

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

/**
 * 验证任务 ID 格式
 */
function validateTaskId(taskId: string): boolean {
  // 任务 ID 应该符合 crawl_{source}_{timestamp} 格式
  const taskIdPattern = /^crawl_[a-z]+_\d+$/;
  return taskIdPattern.test(taskId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
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
      return NextResponse.json(
        { error: '未认证，请先登录' },
        { status: 401 }
      );
    }

    // 3. 获取并验证 taskId
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { error: '缺少任务 ID' },
        { status: 400 }
      );
    }

    // 4. 验证任务 ID 格式
    if (!validateTaskId(taskId)) {
      logger.warn('检测到非法任务 ID 格式', { taskId, userId: session.user.id });
      return NextResponse.json(
        { error: '无效的任务 ID 格式' },
        { status: 400 }
      );
    }

    // 5. 获取任务状态
    const status = await crawlTaskManager.getTaskStatus(taskId);

    if (!status) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }

    // 6. 返回状态（过滤敏感信息）
    return NextResponse.json({
      success: true,
      data: {
        id: status.id,
        source: status.source,
        status: status.status,
        crawlType: status.crawlType,
        itemsProcessed: status.itemsProcessed,
        itemsSucceeded: status.itemsSucceeded,
        itemsFailed: status.itemsFailed,
        errors: status.errors?.slice(0, 10) || [], // 最多返回 10 条错误
        startedAt: status.startedAt,
        completedAt: status.completedAt,
      },
    });
  } catch (error) {
    logger.error('获取任务状态失败:', error);
    return NextResponse.json(
      { error: '获取任务状态失败' },
      { status: 500 }
    );
  }
}
