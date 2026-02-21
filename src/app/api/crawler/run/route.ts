/**
 * 法律法规采集 API
 *
 * POST /api/crawler/run - 启动采集任务
 *   body: { source, crawlType, phase?, options? }
 *   phase: "download" | "parse" | "reparse" | 省略则两阶段都执行
 *
 * GET  /api/crawler/run?source=flk - 获取采集历史
 * GET  /api/crawler/run?source=flk&stats=true - 获取 FLK 下载/解析统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { crawlTaskManager } from '@/lib/crawler/crawl-task-manager';
import { flkCrawler } from '@/lib/crawler/flk-crawler';
// npcCrawler / courtCrawler 已废弃，移至 archive/ 目录
import { DataSource } from '@/lib/crawler/types';
import { logger } from '@/lib/agent/security/logger';

/**
 * 启动采集任务
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, crawlType = 'incremental', phase, options } = body;

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
      return NextResponse.json(
        { error: `不支持的数据源: ${source}` },
        { status: 400 }
      );
    }

    // FLK 数据源支持 phase 参数
    if (source === 'flk' && phase) {
      const validPhases = ['download', 'parse', 'reparse'];
      if (!validPhases.includes(phase)) {
        return NextResponse.json(
          { error: `无效的 phase: ${phase}, 可选: ${validPhases.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const taskId = await crawlTaskManager.createTask({
      source,
      crawlType,
      options,
    });

    // 异步执行
    runCrawler(source, taskId, crawlType, phase);

    const phaseLabel = phase
      ? { download: '下载', parse: '解析', reparse: '重新解析' }[phase]
      : '采集';

    return NextResponse.json({
      success: true,
      taskId,
      message: `已启动 ${source} 数据源的${phaseLabel}任务`,
    });
  } catch (error) {
    logger.error('启动采集任务失败', { error } as never);
    return NextResponse.json({ error: '启动采集任务失败' }, { status: 500 });
  }
}

/**
 * 获取采集历史 / FLK 统计
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') as DataSource | null;
    const stats = searchParams.get('stats');

    // FLK 统计接口
    if (source === 'flk' && stats === 'true') {
      const flkStats = flkCrawler.getStats();
      return NextResponse.json({ success: true, data: flkStats });
    }

    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const history = await crawlTaskManager.getCrawlHistory({
      source: source || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: history,
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
  phase?: string
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
      `采集任务完成: ${source}${phase ? `[${phase}]` : ''}, 创建: ${result.itemsCreated}, 更新: ${result.itemsUpdated}`
    );
  } catch (error) {
    logger.error(`采集任务失败: ${source}`, { error } as never);

    await crawlTaskManager.updateTaskProgress(taskId, {
      status: 'failed',
      errors: [error instanceof Error ? error.message : String(error)],
    });
  }
}
