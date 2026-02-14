/**
 * 检查数据库中法律状态统计
 */

import { PrismaClient, LawStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('当前数据库状态统计:');
  console.log('='.repeat(50));

  const laws = await prisma.lawArticle.groupBy({
    by: ['status'],
    where: { dataSource: 'flk' },
    _count: true,
  });

  laws.forEach(l => {
    console.log(`${l.status}: ${l._count} 条`);
  });

  console.log('='.repeat(50));
  console.log('\n状态说明:');
  console.log('- VALID: 生效中');
  console.log('- REPEALED: 已失效');
  console.log('- AMENDED: 已修正');
  console.log('- DRAFT: 未生效(草稿)');

  const total = laws.reduce((sum, l) => sum + l._count, 0);
  console.log(`\n总计: ${total} 条`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
