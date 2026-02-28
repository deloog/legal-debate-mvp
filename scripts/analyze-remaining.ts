/**
 * 分析剩余 OTHER 记录的脚本
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 统计剩余 OTHER 记录
  const count = await prisma.lawArticle.count({
    where: { category: 'OTHER' as any },
  });
  console.log('剩余 OTHER 记录:', count);

  // 随机抽取 100 条查看规律
  const total = await prisma.lawArticle.count({
    where: { category: 'OTHER' as any },
  });
  const skip = Math.max(0, Math.floor(Math.random() * (total - 100)));

  const samples = await prisma.lawArticle.findMany({
    where: { category: 'OTHER' as any },
    select: { lawName: true },
    take: 100,
    skip: skip,
  });

  console.log('\n抽样记录 (前50条):');
  samples.slice(0, 50).forEach((s, i) => {
    console.log(`${i + 1}. ${s.lawName}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
