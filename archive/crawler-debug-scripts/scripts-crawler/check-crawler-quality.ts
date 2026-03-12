/**
 * 采集任务完成质量检查脚本
 * 检查采集数据的完整性、一致性和质量指标
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface QualityMetrics {
  totalArticles: number;
  byDataSource: Record<string, number>;
  byStatus: Record<string, number>;
  bySyncStatus: Record<string, number>;
  completenessMetrics: {
    hasFullText: number;
    hasSourceId: number;
    hasArticleNumber: number;
    hasEffectiveDate: number;
  };
  contentQuality: {
    shortContent: number; // 内容过短
    longContent: number; // 内容较长
    averageLength: number;
  };
  syncStatus: {
    synced: number;
    pending: number;
    needUpdate: number;
    failed: number;
  };
}

async function checkCrawlerQuality(): Promise<void> {
  console.log('============================================================');
  console.log('采集任务完成质量检查');
  console.log('============================================================\n');

  // 1. 基础统计
  const totalArticles = await prisma.lawArticle.count();
  console.log(`📊 总法条数量: ${totalArticles}`);

  // 2. 按数据源统计
  const bySource = await prisma.lawArticle.groupBy({
    by: ['dataSource'],
    _count: { id: true },
  });
  console.log('\n📁 按数据源统计:');
  bySource.forEach(s => {
    console.log(`   ${s.dataSource}: ${s._count.id} 条`);
  });

  // 3. 按状态统计
  const byStatus = await prisma.lawArticle.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  console.log('\n📋 按状态统计:');
  byStatus.forEach(s => {
    console.log(`   ${s.status}: ${s._count.id} 条`);
  });

  // 4. 按同步状态统计
  const bySyncStatus = await prisma.lawArticle.groupBy({
    by: ['syncStatus'],
    _count: { id: true },
  });
  console.log('\n🔄 按同步状态统计:');
  bySyncStatus.forEach(s => {
    console.log(`   ${s.syncStatus}: ${s._count.id} 条`);
  });

  // 5. 数据完整性检查
  console.log('\n============================================================');
  console.log('数据完整性检查');
  console.log('============================================================\n');

  const hasFullText = await prisma.lawArticle.count({
    where: {
      fullText: {
        not: '',
      },
    },
  });
  console.log(
    `✅ 有完整内容的法条: ${hasFullText} (${((hasFullText / totalArticles) * 100).toFixed(2)}%)`
  );

  const hasSourceId = await prisma.lawArticle.count({
    where: {
      sourceId: { not: null },
    },
  });
  console.log(
    `🔗 有源ID的法条: ${hasSourceId} (${((hasSourceId / totalArticles) * 100).toFixed(2)}%)`
  );

  const hasArticleNumber = await prisma.lawArticle.count({
    where: {
      articleNumber: { not: '' },
    },
  });
  console.log(
    `🏷️  有法条编号的法条: ${hasArticleNumber} (${((hasArticleNumber / totalArticles) * 100).toFixed(2)}%)`
  );

  const hasEffectiveDate = await prisma.lawArticle.count({
    where: {
      effectiveDate: { not: new Date('1970-01-01T00:00:00Z') },
    },
  });
  console.log(
    `📅 有效日期已设置的法条: ${hasEffectiveDate} (${((hasEffectiveDate / totalArticles) * 100).toFixed(2)}%)`
  );

  // 6. 内容质量检查
  console.log('\n============================================================');
  console.log('内容质量检查');
  console.log('============================================================\n');

  const articles = await prisma.lawArticle.findMany({
    select: { fullText: true },
    take: 1000,
  });

  let shortContent = 0;
  let longContent = 0;
  let totalLength = 0;

  articles.forEach(a => {
    const length = a.fullText?.length || 0;
    totalLength += length;
    if (length < 50) {
      shortContent++;
    } else if (length > 5000) {
      longContent++;
    }
  });

  const avgLength = totalLength / articles.length;
  console.log(`📏 平均内容长度: ${avgLength.toFixed(2)} 字符`);
  console.log(`⚠️  短内容 (< 50字符): ${shortContent} 条`);
  console.log(`✅ 长内容 (> 5000字符): ${longContent} 条`);

  // 7. 同步状态分析
  console.log('\n============================================================');
  console.log('同步状态分析');
  console.log('============================================================\n');

  const synced = await prisma.lawArticle.count({
    where: { syncStatus: 'SYNCED' },
  });
  const pending = await prisma.lawArticle.count({
    where: { syncStatus: 'PENDING' },
  });
  const needUpdate = await prisma.lawArticle.count({
    where: { syncStatus: 'NEED_UPDATE' },
  });
  const failed = await prisma.lawArticle.count({
    where: { syncStatus: 'FAILED' },
  });

  console.log(
    `🔄 已同步 (SYNCED): ${synced} 条 (${((synced / totalArticles) * 100).toFixed(2)}%)`
  );
  console.log(
    `⏳ 待同步 (PENDING): ${pending} 条 (${((pending / totalArticles) * 100).toFixed(2)}%)`
  );
  console.log(
    `📝 需要更新 (NEED_UPDATE): ${needUpdate} 条 (${((needUpdate / totalArticles) * 100).toFixed(2)}%)`
  );
  console.log(
    `❌ 同步失败 (FAILED): ${failed} 条 (${((failed / totalArticles) * 100).toFixed(2)}%)`
  );

  // 8. 采集任务历史
  console.log('\n============================================================');
  console.log('采集任务历史');
  console.log('============================================================\n');

  const tasks = await prisma.systemConfig.findMany({
    where: {
      key: { startsWith: 'crawl_task_' },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  console.log('最近10个采集任务:');
  tasks.forEach(t => {
    const value = t.value as any;
    console.log(
      `  - ${value.source || 'unknown'}: ${value.status} | 成功: ${value.itemsSucceeded || 0} | 失败: ${value.itemsFailed || 0}`
    );
  });

  // 9. 质量评分
  console.log('\n============================================================');
  console.log('质量评分总结');
  console.log('============================================================\n');

  const completenessScore =
    ((hasFullText / totalArticles) * 0.3 +
      (hasSourceId / totalArticles) * 0.2 +
      (hasArticleNumber / totalArticles) * 0.2 +
      (hasEffectiveDate / totalArticles) * 0.3) *
    100;

  const syncScore = (synced / totalArticles) * 100;

  const overallScore = completenessScore * 0.5 + syncScore * 0.5;

  console.log(`📈 完整性评分: ${completenessScore.toFixed(2)}/100`);
  console.log(`🔄 同步评分: ${syncScore.toFixed(2)}/100`);
  console.log(`🏆 综合质量评分: ${overallScore.toFixed(2)}/100`);

  if (overallScore >= 80) {
    console.log('\n✅ 采集质量良好');
  } else if (overallScore >= 60) {
    console.log('\n⚠️  采集质量一般，建议优化');
  } else {
    console.log('\n❌ 采集质量较差，需要重点优化');
  }

  console.log('\n============================================================');
}

async function main() {
  try {
    await checkCrawlerQuality();
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
