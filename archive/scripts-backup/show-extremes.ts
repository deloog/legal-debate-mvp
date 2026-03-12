/**
 * 查看最短和最长的记录
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('最短和最长的记录');
  console.log('='.repeat(70));
  console.log();

  // 查看所有记录
  const allRecords = await prisma.lawArticle.findMany({
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      fullText: true,
      dataSource: true,
    },
  });

  // 按内容长度排序
  allRecords.sort((a, b) => a.fullText.length - b.fullText.length);

  // 最短的 15 条
  const shortest = allRecords.slice(0, 15);

  console.log('📏 最短的 15 条记录：');
  console.log();
  shortest.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.lawName}`);
    console.log(`   ID: ${r.articleNumber.substring(0, 30)}...`);
    console.log(`   内容长度: ${r.fullText.length} 字符`);
    console.log(`   内容: ${r.fullText.substring(0, 100)}...`);
    console.log();
  });

  // 最长的 15 条
  const longest = allRecords.slice(-15).reverse();

  console.log('📏 最长的 15 条记录：');
  console.log();
  longest.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.lawName}`);
    console.log(`   ID: ${r.articleNumber.substring(0, 30)}...`);
    console.log(`   内容长度: ${r.fullText.length} 字符`);
    console.log();
  });

  await prisma.$disconnect();
}

main().catch(console.error);
