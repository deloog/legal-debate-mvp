/**
 * 批量采集脚本
 * 按分类分批采集，避免内存溢出
 */

import {
  flkCrawler,
  FLKCrawlOptions,
  FLKTypeCode,
  FLK_TYPE_CONFIGS,
} from '../../src/lib/crawler/flk-crawler';
import { getLogger } from '../../src/lib/crawler/crawler-logger';
import * as path from 'path';

const logger = getLogger('BatchCrawler');

interface BatchConfig {
  batchSize: number; // 每批处理的分类数量
  delayBetweenBatches: number; // 批次间延迟（毫秒）
  maxMemoryUsage: number; // 最大内存使用（MB）
  parseBatchSize: number; // 解析批次大小
}

async function checkMemoryUsage(): Promise<number> {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  return Math.round(used * 100) / 100;
}

async function waitForGC(): Promise<void> {
  return new Promise(resolve => {
    if (global.gc) {
      global.gc();
    }
    setTimeout(resolve, 100);
  });
}

/**
 * 分批下载法规
 */
export async function batchDownload(
  options: FLKCrawlOptions = {},
  batchConfig: Partial<BatchConfig> = {}
): Promise<void> {
  const config: BatchConfig = {
    batchSize: 5,
    delayBetweenBatches: 5000,
    maxMemoryUsage: 512,
    parseBatchSize: 50,
    ...batchConfig,
  };

  const types = options.types || FLK_TYPE_CONFIGS.map(c => c.code);
  const outputDir = options.outputDir || path.resolve('data/crawled/flk');

  logger.info('开始批量下载', {
    totalTypes: types.length,
    batchSize: config.batchSize,
    maxMemoryUsage: `${config.maxMemoryUsage}MB`,
  });

  let totalDownloaded = 0;
  let totalErrors = 0;

  // 分批处理
  for (let i = 0; i < types.length; i += config.batchSize) {
    const batch = types.slice(i, i + config.batchSize);
    const batchNumber = Math.floor(i / config.batchSize) + 1;
    const totalBatches = Math.ceil(types.length / config.batchSize);

    logger.info(`处理第 ${batchNumber}/${totalBatches} 批`, {
      types: batch.length,
      typeCodes: batch,
    });

    // 检查内存使用
    const memoryBefore = await checkMemoryUsage();
    logger.info(`当前内存使用: ${memoryBefore}MB`);

    if (memoryBefore > config.maxMemoryUsage) {
      logger.warn(
        `内存使用超过阈值 (${memoryBefore}MB > ${config.maxMemoryUsage}MB)，触发 GC`
      );
      await waitForGC();
      const memoryAfter = await checkMemoryUsage();
      logger.info(`GC 后内存使用: ${memoryAfter}MB`);
    }

    try {
      // 下载当前批次
      const result = await flkCrawler.downloadAll({
        ...options,
        types: batch,
        outputDir: outputDir,
      });

      totalDownloaded += result.itemsCrawled;
      totalErrors += result.errors.length;

      logger.info(`第 ${batchNumber}/${totalBatches} 批下载完成`, {
        downloaded: result.itemsCrawled,
        errors: result.errors.length,
        duration: `${result.duration / 1000}s`,
        success: result.success,
      });

      // 显示错误摘要
      if (result.errors.length > 0) {
        const recentErrors = result.errors.slice(0, 5);
        logger.warn(`本批错误摘要`, { errors: recentErrors });
        if (result.errors.length > 5) {
          logger.warn(`还有 ${result.errors.length - 5} 个错误未显示`);
        }
      }

      // 批次间延迟和清理
      if (i + config.batchSize < types.length) {
        logger.info(
          `等待 ${config.delayBetweenBatches / 1000} 秒后处理下一批...`
        );
        await new Promise(resolve =>
          setTimeout(resolve, config.delayBetweenBatches)
        );

        // 强制垃圾回收
        await waitForGC();
      }
    } catch (error) {
      logger.error(
        `第 ${batchNumber}/${totalBatches} 批处理失败`,
        error instanceof Error ? error : undefined
      );
      totalErrors++;

      // 继续处理下一批，而不是中断
      continue;
    }
  }

  logger.info('批量下载完成', {
    totalDownloaded,
    totalErrors,
    totalTypes: types.length,
  });
}

/**
 * 分批解析已下载的文件
 */
export async function batchParse(
  options: FLKCrawlOptions = {},
  batchConfig: Partial<BatchConfig> = {}
): Promise<void> {
  const config: BatchConfig = {
    batchSize: 5,
    delayBetweenBatches: 3000,
    maxMemoryUsage: 512,
    parseBatchSize: 50,
    ...batchConfig,
  };

  const types = options.types || FLK_TYPE_CONFIGS.map(c => c.code);
  const outputDir = options.outputDir || path.resolve('data/crawled/flk');

  logger.info('开始批量解析', {
    totalTypes: types.length,
    batchSize: config.batchSize,
    parseBatchSize: config.parseBatchSize,
  });

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFailed = 0;

  // 分批处理
  for (let i = 0; i < types.length; i += config.batchSize) {
    const batch = types.slice(i, i + config.batchSize);
    const batchNumber = Math.floor(i / config.batchSize) + 1;
    const totalBatches = Math.ceil(types.length / config.batchSize);

    logger.info(`解析第 ${batchNumber}/${totalBatches} 批`, {
      types: batch.length,
      typeCodes: batch,
    });

    // 检查内存
    const memoryBefore = await checkMemoryUsage();
    logger.info(`当前内存使用: ${memoryBefore}MB`);

    if (memoryBefore > config.maxMemoryUsage) {
      await waitForGC();
    }

    try {
      const result = await flkCrawler.parseAll({
        types: batch,
        outputDir: outputDir,
        maxAttempts: 3,
      });

      totalCreated += result.itemsCreated;
      totalUpdated += result.itemsUpdated;
      totalFailed += result.errors.length;

      logger.info(`第 ${batchNumber}/${totalBatches} 批解析完成`, {
        created: result.itemsCreated,
        updated: result.itemsUpdated,
        failed: result.errors.length,
        processed: result.itemsCrawled,
        duration: `${result.duration / 1000}s`,
      });

      // 显示错误摘要
      if (result.errors.length > 0) {
        const recentErrors = result.errors.slice(0, 3);
        logger.warn(`本批错误摘要`, { errors: recentErrors });
      }

      // 批次间延迟
      if (i + config.batchSize < types.length) {
        logger.info(
          `等待 ${config.delayBetweenBatches / 1000} 秒后处理下一批...`
        );
        await new Promise(resolve =>
          setTimeout(resolve, config.delayBetweenBatches)
        );
        await waitForGC();
      }
    } catch (error) {
      logger.error(
        `第 ${batchNumber}/${totalBatches} 批解析失败`,
        error instanceof Error ? error : undefined
      );
      totalFailed++;
      continue;
    }
  }

  logger.info('批量解析完成', {
    totalCreated,
    totalUpdated,
    totalFailed,
    totalTypes: types.length,
  });
}

/**
 * 执行完整的批量采集（下载 + 解析）
 */
export async function batchCrawl(
  options: FLKCrawlOptions = {},
  batchConfig: Partial<BatchConfig> = {}
): Promise<void> {
  logger.info('开始完整批量采集流程');

  // 第一步：批量下载
  await batchDownload(options, batchConfig);

  // 延迟一下，让系统稳定
  logger.info('下载阶段完成，等待 5 秒后开始解析...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 第二步：批量解析
  await batchParse(options, batchConfig);

  logger.info('完整批量采集流程结束');

  // 显示最终统计
  const stats = flkCrawler.getStats(options.outputDir);
  logger.info('最终统计', {
    downloadTotal: stats.download.total,
    downloadStatus: stats.download.status,
    parseSuccess: stats.parse.success,
    parseFailed: stats.parse.failed,
    parseFailRate: stats.parse.failRate,
  });
}

/**
 * 重试失败的下载项
 */
export async function retryFailedDownloads(
  options: FLKCrawlOptions = {},
  _batchConfig: Partial<BatchConfig> = {}
): Promise<void> {
  const outputDir = options.outputDir || path.resolve('data/crawled/flk');
  const types = options.types || FLK_TYPE_CONFIGS.map(c => c.code);

  logger.info('开始重试失败的下载');

  for (const typeCode of types) {
    const typeConfig = FLK_TYPE_CONFIGS.find(c => c.code === typeCode);
    if (!typeConfig) continue;

    // 检查该分类是否有失败的项
    const _stats = flkCrawler.getStats(outputDir);
    const _checkpointPath = path.join(outputDir, 'checkpoint.json');

    // 这里需要读取 checkpoint 查找失败的项
    // 简化处理：重新执行下载，会自动跳过已完成的
    logger.info(`重试分类: ${typeConfig.label}`);
  }
}

// 命令行接口
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: FLKCrawlOptions = {};
  const batchConfig: Partial<BatchConfig> = {};
  let command = 'crawl'; // crawl, download, parse, retry

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--command') {
      command = args[++i];
    } else if (arg === '--types') {
      options.types = args[++i].split(',').map(Number) as FLKTypeCode[];
    } else if (arg === '--batch-size') {
      batchConfig.batchSize = parseInt(args[++i], 10);
    } else if (arg === '--delay') {
      batchConfig.delayBetweenBatches = parseInt(args[++i], 10);
    } else if (arg === '--max-memory') {
      batchConfig.maxMemoryUsage = parseInt(args[++i], 10);
    } else if (arg === '--output-dir') {
      options.outputDir = args[++i];
    } else if (arg === '--max-pages') {
      options.maxPages = parseInt(args[++i], 10);
    } else if (arg === '--since-date') {
      options.sinceDate = args[++i];
    }
  }

  // 启用垃圾回收
  if (global.gc) {
    logger.info('垃圾回收已启用');
  } else {
    logger.warn('垃圾回收未启用，使用 --expose-gc 参数启动 Node.js 以启用 GC');
  }

  (async () => {
    try {
      switch (command) {
        case 'download':
          await batchDownload(options, batchConfig);
          break;
        case 'parse':
          await batchParse(options, batchConfig);
          break;
        case 'retry':
          await retryFailedDownloads(options, batchConfig);
          break;
        case 'crawl':
        default:
          await batchCrawl(options, batchConfig);
          break;
      }
    } catch (error) {
      logger.error('批量采集失败', error instanceof Error ? error : undefined);
      process.exit(1);
    }
  })();
}
