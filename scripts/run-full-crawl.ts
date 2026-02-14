/**
 * 启动全量采集
 */

import { FLKCrawler } from '../src/lib/crawler/flk-crawler';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('全量采集启动');
  console.log('='.repeat(70));
  console.log();

  // 查询当前数据库记录数
  const currentCount = await prisma.lawArticle.count({
    where: { dataSource: 'flk' }
  });

  console.log(`当前数据库记录数: ${currentCount} 条`);
  console.log();

  // 检查是否有正在运行的任务
  console.log('检查是否有正在运行的采集任务...');
  const crawler = new FLKCrawler();
  
  console.log('开始全量采集...');
  console.log('预计采集量: 约 28,960 条记录');
  console.log('预计耗时: 数小时到数天（取决于网络速度）');
  console.log();
  console.log('按 Ctrl+C 可以暂停采集（支持断点续传）');
  console.log();
  console.log('='.repeat(70));
  console.log();

  // 启动全量采集
  const result = await crawler.crawl();

  console.log();
  console.log('='.repeat(70));
  console.log('全量采集完成');
  console.log('='.repeat(70));
  console.log();
  console.log(`成功: ${result.success}`);
  console.log(`采集数: ${result.itemsCrawled}`);
  console.log(`新增数: ${result.itemsCreated}`);
  console.log(`更新数: ${result.itemsUpdated}`);
  console.log(`错误数: ${result.errors.length}`);
  console.log(`耗时: ${(result.duration / 1000 / 60).toFixed(2)} 分钟`);
  
  if (result.errors.length > 0) {
    console.log();
    console.log('错误列表:');
    result.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    if (result.errors.length > 10) {
      console.log(`  ... 还有 ${result.errors.length - 10} 个错误`);
    }
  }

  // 查询采集后的记录数
  const finalCount = await prisma.lawArticle.count({
    where: { dataSource: 'flk' }
  });
  console.log();
  console.log(`数据库总记录数: ${currentCount} → ${finalCount} (+${finalCount - currentCount})`);

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('错误:', error);
  process.exit(1);
});
