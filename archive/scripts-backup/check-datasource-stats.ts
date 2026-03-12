import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('============================================================');
  console.log('按数据源统计法规数量');
  console.log('============================================================\n');

  const result = await prisma.lawArticle.groupBy({
    by: ['dataSource'],
    _count: true,
  });

  const table = result.map(r => ({
    dataSource: r.dataSource,
    count: r._count,
  }));

  console.table(table);

  const totalCount = result.reduce((sum, r) => sum + r._count, 0);
  console.log(`\n总计: ${totalCount} 条\n`);

  console.log('============================================================');
}

main()
  .catch(e => {
    console.error('Error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
