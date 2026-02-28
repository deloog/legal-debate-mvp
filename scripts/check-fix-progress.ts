import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('检查分类修正进度...\n');

  const stats = await prisma.lawArticle.groupBy({
    by: ['category'],
    _count: true,
  });

  const total = stats.reduce((sum, s) => sum + s._count, 0);
  const otherCount = stats.find(s => s.category === 'OTHER')?._count || 0;

  console.log('当前分类分布:');
  stats
    .sort((a, b) => b._count - a._count)
    .forEach(stat => {
      const percentage = ((stat._count / total) * 100).toFixed(1);
      console.log(`  ${stat.category.padEnd(25)} ${stat._count.toString().padStart(7)} (${percentage}%)`);
    });

  console.log(`\n总计: ${total} 条`);
  console.log(`OTHER 占比: ${((otherCount / total) * 100).toFixed(1)}%`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
