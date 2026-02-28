import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 法条数据库全量统计 ===\n');

  // 1. 总数
  const total = await prisma.lawArticle.count();
  console.log(`总记录数: ${total}`);

  // 2. 按数据源分组
  const bySource = await prisma.lawArticle.groupBy({
    by: ['dataSource'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  console.log('\n--- 按数据源 ---');
  for (const s of bySource) {
    console.log(`  ${s.dataSource}: ${s._count.id} 条`);
  }

  // 3. 按 LawType 分组
  const byType = await prisma.lawArticle.groupBy({
    by: ['lawType'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  console.log('\n--- 按法律类型 ---');
  for (const t of byType) {
    console.log(`  ${t.lawType}: ${t._count.id} 条`);
  }

  // 4. 按 Category 分组
  const byCategory = await prisma.lawArticle.groupBy({
    by: ['category'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  console.log('\n--- 按法律分类 ---');
  for (const c of byCategory) {
    console.log(`  ${c.category}: ${c._count.id} 条`);
  }

  // 5. 按 Status 分组
  const byStatus = await prisma.lawArticle.groupBy({
    by: ['status'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  console.log('\n--- 按法律状态 ---');
  for (const s of byStatus) {
    console.log(`  ${s.status}: ${s._count.id} 条`);
  }

  // 6. 按 SyncStatus 分组
  const bySyncStatus = await prisma.lawArticle.groupBy({
    by: ['syncStatus'],
    _count: { id: true },
  });
  console.log('\n--- 按同步状态 ---');
  for (const s of bySyncStatus) {
    console.log(`  ${s.syncStatus}: ${s._count.id} 条`);
  }

  // 7. fullText 为空的记录数
  const emptyFullText = await prisma.lawArticle.count({
    where: { fullText: '' },
  });
  console.log(`\n全文为空的记录数: ${emptyFullText}`);

  // 8. fullText 长度统计（通过聚合）
  const articles = await prisma.lawArticle.findMany({
    select: { fullText: true },
  });
  const lengths = articles.map(a => a.fullText.length);
  const avgLen =
    lengths.length > 0
      ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
      : 0;
  const minLen = lengths.length > 0 ? Math.min(...lengths) : 0;
  const maxLen = lengths.length > 0 ? Math.max(...lengths) : 0;
  console.log(`\n全文长度统计:`);
  console.log(`  最短: ${minLen} 字符`);
  console.log(`  最长: ${maxLen} 字符`);
  console.log(`  平均: ${avgLen} 字符`);

  // 9. 最近同步时间分布
  const recentSync = await prisma.lawArticle.findMany({
    select: { lastSyncedAt: true },
    where: { lastSyncedAt: { not: null } },
    orderBy: { lastSyncedAt: 'desc' },
    take: 1,
  });
  const oldestSync = await prisma.lawArticle.findMany({
    select: { lastSyncedAt: true },
    where: { lastSyncedAt: { not: null } },
    orderBy: { lastSyncedAt: 'asc' },
    take: 1,
  });
  if (recentSync[0])
    console.log(`\n最近同步时间: ${recentSync[0].lastSyncedAt?.toISOString()}`);
  if (oldestSync[0])
    console.log(`最早同步时间: ${oldestSync[0].lastSyncedAt?.toISOString()}`);

  // 10. effectiveDate 分布（按年份）
  const allDates = await prisma.lawArticle.findMany({
    select: { effectiveDate: true },
  });
  const yearCounts: Record<number, number> = {};
  for (const d of allDates) {
    const year = d.effectiveDate.getFullYear();
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  }
  const topYears = Object.entries(yearCounts)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .slice(0, 15);
  console.log('\n--- 按生效年份（最近15年）---');
  for (const [year, count] of topYears) {
    console.log(`  ${year}: ${count} 条`);
  }

  // 11. 发布机构 Top 10
  const byAuthority = await prisma.lawArticle.groupBy({
    by: ['issuingAuthority'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });
  console.log('\n--- 发布机构 Top 10 ---');
  for (const a of byAuthority) {
    console.log(`  ${a.issuingAuthority}: ${a._count.id} 条`);
  }

  // 12. 抽样3条数据（展示字段质量）
  const samples = await prisma.lawArticle.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    select: {
      lawName: true,
      articleNumber: true,
      lawType: true,
      category: true,
      status: true,
      issuingAuthority: true,
      effectiveDate: true,
      dataSource: true,
      fullText: true,
      createdAt: true,
    },
  });
  console.log('\n--- 最新3条样本 ---');
  for (const s of samples) {
    console.log(`  法律名称: ${s.lawName}`);
    console.log(`  条款号: ${s.articleNumber}`);
    console.log(`  类型: ${s.lawType} / 分类: ${s.category}`);
    console.log(`  发布机构: ${s.issuingAuthority}`);
    console.log(`  生效日期: ${s.effectiveDate.toISOString().split('T')[0]}`);
    console.log(`  数据源: ${s.dataSource}`);
    console.log(`  全文前100字: ${s.fullText.slice(0, 100)}`);
    console.log(`  全文长度: ${s.fullText.length} 字符`);
    console.log(`  入库时间: ${s.createdAt.toISOString()}`);
    console.log('  ---');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
