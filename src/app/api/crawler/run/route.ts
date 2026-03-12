/**
 * 法律法规采集 API (安全增强版)
 *
 * POST /api/crawler/run - 启动采集任务
 *   body: { source, crawlType, phase?, options? }
 *   phase: "download" | "parse" | "reparse" | 省略则两阶段都执行
 *
 * GET  /api/crawler/run?source=flk - 获取采集历史
 * GET  /api/crawler/run?source=flk&stats=true - 获取 FLK 下载/解析统计
 *
 * 安全措施：
 * - 身份验证：仅允许已登录用户
 * - 权限控制：仅允许管理员或特定角色
 * - 速率限制：每个 IP 每分钟最多 5 次请求
 * - 并发控制：同时最多运行 2 个爬虫任务
 * - 参数验证：严格验证所有输入参数
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { crawlTaskManager } from '@/lib/crawler/crawl-task-manager';
import { flkCrawler } from '@/lib/crawler/flk-crawler';
import { DataSource } from '@/lib/crawler/types';
import { logger } from '@/lib/agent/security/logger';

// 速率限制存储 (生产环境应使用 Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 分钟
const RATE_LIMIT_MAX_REQUESTS = 5; // 每分钟最多 5 次请求

// 并发控制
const runningTasks = new Set<string>();
const MAX_CONCURRENT_TASKS = 2;

/**
 * 检查速率限制
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    // 新窗口
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
 * 验证输出目录路径（防止路径遍历）
 */
function validateOutputDir(outputDir: string): boolean {
  if (!outputDir) return true;

  // 解析路径
  const resolvedPath = require('path').resolve(outputDir);
  const allowedBase = require('path').resolve('data/crawled');

  // 确保路径在允许的范围内
  if (!resolvedPath.startsWith(allowedBase)) {
    return false;
  }

  // 检查路径遍历字符
  const suspiciousPatterns = [
    '..',
    '~',
    '$',
    '`',
    '|',
    ';',
    '&',
    '<',
    '>',
    '\x00',
  ];

  return !suspiciousPatterns.some(pattern => outputDir.includes(pattern));
}

/**
 * 启动采集任务
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 速率限制检查
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      logger.warn('爬虫 API 速率限制触发', { ip: clientIP });
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

    // 3. 权限检查
    const allowedRoles = ['ADMIN', 'SYSTEM', 'DATA_MANAGER'];
    const userRole = session.user.role as string;
    if (!allowedRoles.includes(userRole)) {
      logger.warn('未授权访问爬虫 API', {
        userId: session.user.id,
        role: userRole,
      });
      return NextResponse.json(
        { error: '权限不足，需要管理员权限' },
        { status: 403 }
      );
    }

    // 4. 并发控制
    if (runningTasks.size >= MAX_CONCURRENT_TASKS) {
      return NextResponse.json(
        {
          error: '系统繁忙，已有其他采集任务在运行',
          runningTasks: Array.from(runningTasks),
        },
        { status: 429 }
      );
    }

    // 5. 解析和验证请求体
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: '无效的 JSON 请求体' },
        { status: 400 }
      );
    }

    const { source, crawlType = 'incremental', phase, options } = body;

    // 6. 验证数据源
    if (!source) {
      return NextResponse.json(
        { error: '缺少必要参数: source' },
        { status: 400 }
      );
    }

    const validSources: DataSource[] = ['flk', 'cail', 'pkulaw', 'wikass'];
    const deprecatedSources = ['npc', 'court'];

    if (deprecatedSources.includes(source)) {
      return NextResponse.json(
        { error: `数据源 ${source} 爬虫已废弃，请使用 flk 数据源` },
        { status: 410 }
      );
    }

    if (!validSources.includes(source)) {
      logger.warn('尝试使用无效数据源', { source, userId: session.user.id });
      return NextResponse.json(
        { error: `不支持的数据源: ${source}` },
        { status: 400 }
      );
    }

    // 7. 验证 phase 参数
    if (phase) {
      const validPhases = ['download', 'parse', 'reparse'];
      if (!validPhases.includes(phase)) {
        return NextResponse.json(
          { error: `无效的 phase: ${phase}, 可选: ${validPhases.join(', ')}` },
          { status: 400 }
        );
      }

      // FLK 数据源支持 phase 参数
      if (source !== 'flk') {
        return NextResponse.json(
          { error: `数据源 ${source} 不支持 phase 参数` },
          { status: 400 }
        );
      }
    }

    // 8. 验证输出目录（防止路径遍历）
    if (options?.outputDir && !validateOutputDir(options.outputDir)) {
      logger.warn('检测到可疑的输出目录', {
        outputDir: options.outputDir,
        userId: session.user.id,
      });
      return NextResponse.json({ error: '无效的输出目录' }, { status: 400 });
    }

    // 9. 创建任务
    const taskId = await crawlTaskManager.createTask({
      source,
      crawlType,
      options,
    });

    // 10. 添加到运行中任务集合
    runningTasks.add(taskId);

    // 11. 异步执行
    runCrawler(source, taskId, crawlType, phase, session.user.id).finally(
      () => {
        runningTasks.delete(taskId);
      }
    );

    // 12. 记录审计日志
    logger.info('爬虫任务已启动', {
      taskId,
      source,
      crawlType,
      phase,
      userId: session.user.id,
      ip: clientIP,
    });

    const phaseLabels: Record<string, string> = {
      download: '下载',
      parse: '解析',
      reparse: '重新解析',
    };
    const phaseLabel = phase ? (phaseLabels[phase] ?? phase) : '采集';

    return NextResponse.json({
      success: true,
      taskId,
      message: `已启动 ${source} 数据源的${phaseLabel}任务`,
      runningTasks: runningTasks.size,
    });
  } catch (error) {
    logger.error('启动采集任务失败', { error } as never);
    return NextResponse.json(
      { error: '启动采集任务失败，请稍后重试' },
      { status: 500 }
    );
  }
}

/**
 * 获取采集历史 / FLK 统计
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 速率限制检查
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        { status: 429 }
      );
    }

    // 2. 身份验证
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: '未认证，请先登录' }, { status: 401 });
    }

    // 3. 权限检查（查询可以放宽到已登录用户）
    const allowedRoles = ['ADMIN', 'SYSTEM', 'DATA_MANAGER', 'USER'];
    const userRole = session.user.role as string;
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') as DataSource | null;
    const stats = searchParams.get('stats');

    // 4. 验证 source 参数
    if (source) {
      const validSources: DataSource[] = ['flk', 'cail', 'pkulaw', 'wikass'];
      if (!validSources.includes(source)) {
        return NextResponse.json(
          { error: `不支持的数据源: ${source}` },
          { status: 400 }
        );
      }
    }

    // FLK 统计接口
    if (source === 'flk' && stats === 'true') {
      // 管理员可以查看详细统计
      const flkStats = flkCrawler.getStats();
      return NextResponse.json({ success: true, data: flkStats });
    }

    // 5. 验证分页参数
    const limitParam = searchParams.get('limit') || '20';
    const offsetParam = searchParams.get('offset') || '0';

    const limit = parseInt(limitParam, 10);
    const offset = parseInt(offsetParam, 10);

    if (isNaN(limit) || isNaN(offset) || limit < 0 || offset < 0) {
      return NextResponse.json({ error: '无效的分页参数' }, { status: 400 });
    }

    // 限制最大返回数量
    const safeLimit = Math.min(limit, 100);

    const history = await crawlTaskManager.getCrawlHistory({
      source: source || undefined,
      limit: safeLimit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: history,
      pagination: {
        limit: safeLimit,
        offset,
      },
    });
  } catch (error) {
    logger.error('获取采集历史失败', { error } as never);
    return NextResponse.json({ error: '获取采集历史失败' }, { status: 500 });
  }
}

/**
 * 执行爬虫
 */
async function runCrawler(
  source: DataSource,
  taskId: string,
  crawlType: string,
  phase: string | undefined,
  userId: string
): Promise<void> {
  try {
    let result;

    if (source === 'flk') {
      // FLK 两阶段模式
      const crawlOptions =
        crawlType === 'incremental'
          ? {
              sinceDate: new Date(Date.now() - 7 * 86400000)
                .toISOString()
                .split('T')[0],
            }
          : undefined;

      switch (phase) {
        case 'download':
          result = await flkCrawler.downloadAll(crawlOptions);
          break;
        case 'parse':
          result = await flkCrawler.parseAll();
          break;
        case 'reparse':
          result = await flkCrawler.reparseFailed();
          break;
        default:
          // 默认: 两阶段都执行
          if (crawlType === 'full') {
            result = await flkCrawler.crawl(crawlOptions);
          } else {
            const since = new Date();
            since.setDate(since.getDate() - 7);
            result = await flkCrawler.incrementalCrawl(since);
          }
      }
    } else {
      throw new Error(`不支持的数据源: ${source}`);
    }

    await crawlTaskManager.completeTask(taskId, {
      itemsProcessed: result.itemsCrawled,
      itemsSucceeded: result.itemsCreated + result.itemsUpdated,
      itemsFailed: result.errors.length,
      errors: result.errors,
    });

    logger.info(
      `采集任务完成: ${source}${phase ? `[${phase}]` : ''}, 创建: ${result.itemsCreated}, 更新: ${result.itemsUpdated}`,
      { taskId, userId }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`采集任务失败: ${source}`, {
      error: errorMessage,
      taskId,
      userId,
    });

    await crawlTaskManager.updateTaskProgress(taskId, {
      status: 'failed',
      errors: [errorMessage],
    });
  }
}
