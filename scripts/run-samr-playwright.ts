/**
 * SAMR合同模板采集运行脚本 - Playwright模式
 * 功能：使用Playwright从真实网站采集合同模板数据
 */

import { getLogger } from '@/lib/crawler/crawler-logger';
import { samrCrawler } from '@/lib/crawler/samr-crawler';

async function main(): Promise<void> {
  const logger = getLogger('SAMR-PlaywrightScript');

  console.log('='.repeat(70));
  console.log('SAMR合同模板采集器 - Playwright模式（真实网站数据）');
  console.log('='.repeat(70));
  console.log();

  // 采集选项 - 使用Playwright
  const options = {
    usePlaywright: true, // 启用Playwright模式
    outputDir: 'data/crawled/samr',
  };

  console.log('采集配置:');
  console.log(`  模式: Playwright（真实网站）`);
  console.log(`  输出目录: ${options.outputDir}`);
  console.log();

  try {
    console.log('开始Phase 1: 下载阶段...');
    console.log();

    // Phase 1: 下载文件
    const downloadResult = await samrCrawler.downloadAll(options);

    console.log('下载阶段结果:');
    console.log(`  成功: ${downloadResult.success ? '是' : '否'}`);
    console.log(`  获取模板数: ${downloadResult.itemsCrawled}`);
    console.log(`  下载文件数: ${downloadResult.itemsCreated}`);
    console.log(`  耗时: ${(downloadResult.duration / 1000).toFixed(2)}秒`);
    console.log();

    if (downloadResult.errors.length > 0) {
      console.log('下载错误列表:');
      downloadResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      console.log();
    }

    console.log('开始Phase 2: 解析阶段...');
    console.log();

    // Phase 2: 解析文件
    const parseResult = await samrCrawler.parseAll({
      outputDir: options.outputDir,
    });

    console.log('解析阶段结果:');
    console.log(`  成功: ${parseResult.success ? '是' : '否'}`);
    console.log(`  处理模板数: ${parseResult.itemsCrawled}`);
    console.log(`  成功解析数: ${parseResult.itemsCreated}`);
    console.log(`  耗时: ${(parseResult.duration / 1000).toFixed(2)}秒`);
    console.log();

    if (parseResult.errors.length > 0) {
      console.log('解析错误列表:');
      parseResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      console.log();
    }

    // 显示错误统计
    const errorStats = samrCrawler.getErrorStats();
    console.log('错误统计:');
    console.log(`  总错误数: ${errorStats.totalErrors}`);
    console.log(`  连续失败: ${errorStats.consecutiveFailures}`);
    console.log(`  恢复尝试: ${errorStats.recoveryAttempts}`);
    if (Object.keys(errorStats.errorsByType).length > 0) {
      console.log('  按类型统计:');
      for (const [type, count] of Object.entries(errorStats.errorsByType)) {
        console.log(`    ${type}: ${count}`);
      }
    }
    console.log();

    logger.info('SAMR Playwright采集完成', { downloadResult, parseResult });
  } catch (error) {
    console.error('采集过程中发生错误:', error);
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('采集完成！');
  console.log('='.repeat(70));
}

main().catch(console.error);
