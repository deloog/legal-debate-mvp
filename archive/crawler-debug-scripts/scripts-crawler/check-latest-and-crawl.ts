/**
 * 查询最新记录并启动增量采集
 */

import { PrismaClient } from '@prisma/client';
import { FLKCrawler } from '../src/lib/crawler/flk-crawler';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('查询最新记录并启动增量采集');
  console.log('='.repeat(70));
  console.log();

  // 查询最新记录
  const latestRecord = await prisma.lawArticle.findFirst({
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      effectiveDate: true,
      lawName: true,
    },
  });

  if (latestRecord) {
    console.log('最新记录:');
    console.log(`  法规名称: ${latestRecord.lawName}`);
    console.log(`  创建时间: ${latestRecord.createdAt}`);
    console.log(`  生效日期: ${latestRecord.effectiveDate}`);
    console.log();
  } else {
    console.log('数据库中没有记录，将执行全量采集');
    console.log();
  }

  // 启动增量采集（如果没有记录，则执行全量采集）
  const crawler = new FLKCrawler();
  console.log('开始采集...');
  console.log();

  const sinceDate = latestRecord?.effectiveDate
    ? new Date(latestRecord.effectiveDate)
    : undefined;

  const result = await crawler.incrementalCrawl(
    sinceDate || new Date('2020-01-01')
  );

  console.log();
  console.log('='.repeat(70));
  console.log('采集完成');
  console.log('='.repeat(70));
  console.log();
  console.log(`成功: ${result.success}`);
  console.log(`采集数: ${result.itemsCrawled}`);
  console.log(`新增数: ${result.itemsCreated}`);
  console.log(`更新数: ${result.itemsUpdated}`);
  console.log(`错误数: ${result.errors.length}`);
  console.log(`耗时: ${(result.duration / 1000).toFixed(2)} 秒`);

  if (result.errors.length > 0) {
    console.log();
    console.log('错误列表:');
    result.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    if (result.errors.length > 10) {
      console.log(`  ... 还有 ${result.errors.length - 10} 个错误`);
    }
  }

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('错误:', error);
  process.exit(1);
});
