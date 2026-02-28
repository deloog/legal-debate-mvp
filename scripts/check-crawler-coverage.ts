/**
 * 检查采集器覆盖情况，对比国家法律法规库网站数据
 */

import { PrismaClient } from '@prisma/client';
import { FLKCrawler } from '../src/lib/crawler/flk-crawler';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('采集器覆盖情况检查');
  console.log('='.repeat(70));
  console.log();

  // 国家法律法规库网站显示的数据量
  const websiteData = {
    宪法: 1,
    法律: 716,
    行政法规: 813,
    监察法规: 3,
    地方法规: 26607,
    司法解释: 871,
  };

  console.log('国家法律法规库网站显示的数据量：');
  console.log();
  Object.entries(websiteData).forEach(([category, count]) => {
    console.log(`  ${category}: ${count} 条`);
  });
  console.log();

  // 查询数据库中的实际数据量
  console.log('数据库中的实际数据量：');
  console.log();

  const allRecords = await prisma.lawArticle.findMany({
    select: {
      lawType: true,
      category: true,
      dataSource: true,
    },
  });

  const flkRecords = allRecords.filter(r => r.dataSource === 'flk');

  // 按分类统计
  const categoryStats = new Map<string, number>();
  flkRecords.forEach(r => {
    const category = r.category;
    categoryStats.set(category, (categoryStats.get(category) || 0) + 1);
  });

  // 打印分类统计
  categoryStats.forEach((count, category) => {
    console.log(`  ${category}: ${count} 条`);
  });
  console.log();

  console.log('数据库总计:');
  console.log(`  FLK 数据源: ${flkRecords.length} 条`);
  console.log(`  其他数据源: ${allRecords.length - flkRecords.length} 条`);
  console.log(`  总计: ${allRecords.length} 条`);
  console.log();

  // 按法律类型统计
  console.log('按法律类型统计：');
  console.log();
  const typeStats = new Map<string, number>();
  flkRecords.forEach(r => {
    const lawType = r.lawType;
    typeStats.set(lawType, (typeStats.get(lawType) || 0) + 1);
  });

  typeStats.forEach((count, lawType) => {
    console.log(`  ${lawType}: ${count} 条`);
  });
  console.log();

  // 使用 crawler 获取实际可采集的数据量
  console.log('从 API 获取的各分类总记录数：');
  console.log();

  const { FLK_TYPE_CONFIGS } = await import('../src/lib/crawler/flk-crawler');
  const crawler = new FLKCrawler();

  // 获取每个分类的总记录数
  for (const config of FLK_TYPE_CONFIGS) {
    try {
      const listResponse = await crawler['fetchList'](config.code, 1, 20);
      const totalRecords = listResponse.total;
      const totalPages = Math.ceil(listResponse.total / 20);

      console.log(`  ${config.label} (code: ${config.code}):`);
      console.log(`    总记录数: ${totalRecords}`);
      console.log(`    总页数: ${totalPages}`);
    } catch (error) {
      console.log(
        `  ${config.label} (code: ${config.code}): 获取失败 - ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  console.log();
  console.log('='.repeat(70));
  console.log('说明：');
  console.log('='.repeat(70));
  console.log();
  console.log('1. 增量采集只采集指定日期之后的新数据');
  console.log('2. 如果数据库中已经有大部分数据，增量采集会跳过已下载的记录');
  console.log('3. 地方法规有 26607 条，分布在多个子分类中');
  console.log('4. 需要全量采集才能获取所有数据');
  console.log();

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('错误:', error);
  process.exit(1);
});
