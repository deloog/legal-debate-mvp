/**
 * 检查重复的法规记录
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 查找民法典相关记录 ===\n');

  const minfaRecords = await prisma.lawArticle.findMany({
    where: {
      lawName: { contains: '民法典' },
    },
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      fullText: true,
      dataSource: true,
    },
  });

  // 手动按内容长度排序
  minfaRecords.sort((a, b) => b.fullText.length - a.fullText.length);

  console.log(`总数: ${minfaRecords.length} 条\n`);

  minfaRecords.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.lawName}`);
    console.log(`   ID: ${r.articleNumber}`);
    console.log(`   数据源: ${r.dataSource}`);
    console.log(`   内容长度: ${r.fullText.length} 字符`);
    console.log(`   内容预览: ${r.fullText.substring(0, 80)}...`);
    console.log();
  });

  console.log('\n=== 统计重复的法规名称 ===\n');

  const allRecords = await prisma.lawArticle.findMany({
    select: {
      lawName: true,
      articleNumber: true,
      fullText: true,
      dataSource: true,
    },
  });

  const lawNameCounts = new Map<string, { count: number; records: any[] }>();

  allRecords.forEach(r => {
    const current = lawNameCounts.get(r.lawName) || { count: 0, records: [] };
    current.count++;
    current.records.push({
      articleNumber: r.articleNumber,
      textLength: r.fullText.length,
      dataSource: r.dataSource,
    });
    lawNameCounts.set(r.lawName, current);
  });

  const duplicateLaws = Array.from(lawNameCounts.entries())
    .filter(([_, data]) => data.count > 1)
    .sort((a, b) => b[1].count - a[1].count);

  console.log(`总数: ${duplicateLaws.length} 部\n`);

  duplicateLaws.slice(0, 30).forEach(([name, data], idx) => {
    console.log(`${idx + 1}. ${name} - ${data.count} 条记录`);
    // 显示最短的记录
    const shortest = data.records.sort(
      (a, b) => a.textLength - b.textLength
    )[0];
    console.log(
      `   最短: ${shortest.textLength} 字符, ID: ${shortest.articleNumber.substring(0, 30)}...`
    );
  });

  console.log(`\n... 还有 ${duplicateLaws.length - 30} 部`);

  await prisma.$disconnect();
}

main().catch(console.error);
