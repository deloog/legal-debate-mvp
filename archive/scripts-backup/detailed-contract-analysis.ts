import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 按来源统计
  const bySource = await prisma.contractTemplate.groupBy({
    by: ['source'],
    _count: { id: true },
  });

  console.log('=== 按来源统计 ===');
  for (const item of bySource) {
    console.log(`${item.source}: ${item._count.id}`);
  }

  // 检查是否有其他数据源
  const allSources = await prisma.contractTemplate.findMany({
    distinct: ['source'],
    select: { source: true },
  });
  console.log(
    '\n所有数据源:',
    allSources.map(s => s.source)
  );

  // 检查 sourceUrl 分布
  const withSourceUrl = await prisma.contractTemplate.count({
    where: { sourceUrl: { not: null } },
  });
  const withoutSourceUrl = await prisma.contractTemplate.count({
    where: { sourceUrl: null },
  });

  console.log(`\n有 sourceUrl: ${withSourceUrl}`);
  console.log(`无 sourceUrl: ${withoutSourceUrl}`);

  // 查看没有 sourceUrl 的合同
  const noUrlContracts = await prisma.contractTemplate.findMany({
    where: { sourceUrl: null },
    select: { name: true, source: true, code: true },
    take: 20,
  });

  console.log('\n=== 无 sourceUrl 的合同（前20）===');
  noUrlContracts.forEach((c, i) => {
    console.log(`${i + 1}. [${c.source}] ${c.code} - ${c.name?.slice(0, 50)}`);
  });

  // 查看 sourceUrl 中包含 samr 的合同数
  const samrUrls = await prisma.contractTemplate.count({
    where: { sourceUrl: { contains: 'samr' } },
  });
  console.log(`\nsourceUrl 包含 'samr': ${samrUrls}`);

  // 查看 sourceUrl 中包含 12315 的合同数
  const cnUrls = await prisma.contractTemplate.count({
    where: { sourceUrl: { contains: '12315' } },
  });
  console.log(`sourceUrl 包含 '12315': ${cnUrls}`);

  // 统计按日期创建
  const recentContracts = await prisma.contractTemplate.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { name: true, createdAt: true, source: true },
  });

  console.log('\n=== 最近创建的合同（前10）===');
  recentContracts.forEach((c, i) => {
    console.log(
      `${i + 1}. ${c.createdAt?.toISOString().slice(0, 10)} [${c.source}] ${c.name?.slice(0, 40)}`
    );
  });

  await prisma.$disconnect();
}

main();
