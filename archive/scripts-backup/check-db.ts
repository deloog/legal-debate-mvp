import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 数据库中的法规数据统计 ===\n');

  // 按内容长度统计
  const laws = await prisma.lawArticle.findMany({
    orderBy: { fullText: 'desc' },
    take: 20,
    select: {
      lawName: true,
      articleNumber: true,
      fullText: true,
      dataSource: true,
      effectiveDate: true,
    },
  });

  console.log('内容最长的 10 条法规:\n');

  for (const law of laws.slice(0, 10)) {
    const length = law.fullText.length;
    console.log(`📄 ${law.lawName}`);
    console.log(`   编号: ${law.articleNumber}`);
    console.log(`   长度: ${length.toLocaleString()} 字符`);
    console.log(`   来源: ${law.dataSource}`);
    console.log(`   生效: ${law.effectiveDate}`);
    console.log(`   预览: ${law.fullText.substring(0, 80)}...`);
    console.log();
  }

  // 统计
  const total = await prisma.lawArticle.count();
  const withContent = await prisma.lawArticle.count({
    where: { fullText: { gte: 'a'.repeat(100) } },
  });

  console.log('=== 统计 ===');
  console.log(`总法规数: ${total}`);
  console.log(`完整内容 (>100字符): ${withContent}`);
  console.log(`简短内容 (<100字符): ${total - withContent}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
