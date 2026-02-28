import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(60));
  console.log('数据库状态检查');
  console.log('='.repeat(60));

  // 1. 总数统计
  const total = await prisma.lawArticle.count();
  console.log(`\n[1] 法条总数: ${total}`);

  if (total === 0) {
    console.log('\n⚠️  数据库中没有法条数据！');
    console.log('请先运行数据采集脚本。');
    return;
  }

  // 2. 按分类统计
  const categoryStats = await prisma.lawArticle.groupBy({
    by: ['category'],
    _count: true,
  });

  console.log('\n[2] 按学科分类统计:');
  categoryStats
    .sort((a, b) => b._count - a._count)
    .forEach(stat => {
      const percentage = ((stat._count / total) * 100).toFixed(1);
      console.log(`  ${stat.category.padEnd(25)} ${stat._count.toString().padStart(6)} (${percentage}%)`);
    });

  // 3. 按法律类型统计
  const typeStats = await prisma.lawArticle.groupBy({
    by: ['lawType'],
    _count: true,
  });

  console.log('\n[3] 按法律类型统计:');
  typeStats
    .sort((a, b) => b._count - a._count)
    .forEach(stat => {
      const percentage = ((stat._count / total) * 100).toFixed(1);
      console.log(`  ${stat.lawType.padEnd(25)} ${stat._count.toString().padStart(6)} (${percentage}%)`);
    });

  // 4. 按数据源统计
  const sourceStats = await prisma.lawArticle.groupBy({
    by: ['dataSource'],
    _count: true,
  });

  console.log('\n[4] 按数据源统计:');
  sourceStats.forEach(stat => {
    const percentage = ((stat._count / total) * 100).toFixed(1);
    console.log(`  ${stat.dataSource.padEnd(25)} ${stat._count.toString().padStart(6)} (${percentage}%)`);
  });

  // 5. OTHER 分类详情
  const otherCount = categoryStats.find(s => s.category === 'OTHER')?._count || 0;
  if (otherCount > 0) {
    console.log(`\n[5] OTHER 分类详情 (共 ${otherCount} 条):`);

    // 抽样显示 OTHER 分类的法律名称
    const otherSamples = await prisma.lawArticle.findMany({
      where: { category: 'OTHER' },
      select: { lawName: true, lawType: true },
      take: 10,
    });

    console.log('  样本（前10条）:');
    otherSamples.forEach((sample, i) => {
      console.log(`    ${i + 1}. [${sample.lawType}] ${sample.lawName.substring(0, 50)}`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
