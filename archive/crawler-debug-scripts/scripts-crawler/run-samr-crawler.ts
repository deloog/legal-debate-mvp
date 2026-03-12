/**
 * SAMR合同模板采集运行脚本
 * 功能：采集合同模板数据并保存到数据库
 */

import { samrCrawler } from '@/lib/crawler/samr-crawler';
import { getLogger } from '@/lib/crawler/crawler-logger';

async function main(): Promise<void> {
  const logger = getLogger('SAMR-RunScript');

  console.log('='.repeat(70));
  console.log('SAMR合同模板采集器 - 运行脚本');
  console.log('='.repeat(70));
  console.log();

  // 采集统计
  const stats = samrCrawler.getStats();
  console.log('模板统计信息:');
  console.log(`  总模板数: ${stats.total}`);
  console.log('  按分类统计:');
  for (const [category, count] of Object.entries(stats.byCategory)) {
    console.log(`    ${category}: ${count}`);
  }
  console.log();

  // 采集选项
  const options = {
    categories: undefined as string[] | undefined,
    maxItems: undefined as number | undefined,
    useRealApi: false, // 由于SAMR网站暂时不可用，使用模拟数据
  };

  console.log('采集配置:');
  console.log(`  使用真实API: ${options.useRealApi}`);
  if (options.categories) {
    console.log(`  分类筛选: ${options.categories.join(', ')}`);
  }
  if (options.maxItems) {
    console.log(`  最大数量: ${options.maxItems}`);
  }
  console.log();

  try {
    console.log('开始采集...');
    console.log();

    const result = await samrCrawler.crawl(options);

    console.log('采集结果:');
    console.log(`  成功: ${result.success ? '是' : '否'}`);
    console.log(`  采集数量: ${result.itemsCrawled}`);
    console.log(`  创建数量: ${result.itemsCreated}`);
    console.log(`  更新数量: ${result.itemsUpdated}`);
    console.log(`  耗时: ${(result.duration / 1000).toFixed(2)}秒`);
    console.log();

    if (result.errors.length > 0) {
      console.log('错误列表:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      console.log();
    }

    // 显示更新后的统计
    const updatedStats = samrCrawler.getStats();
    console.log('更新后的统计信息:');
    console.log(`  总模板数: ${updatedStats.total}`);
    console.log();

    logger.info('SAMR采集完成', result);
  } catch (error) {
    console.error('采集过程中发生错误:', error);
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('采集完成！');
  console.log('='.repeat(70));
}

main().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});
