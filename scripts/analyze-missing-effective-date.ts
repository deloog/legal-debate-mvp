/**
 * 分析缺少有效日期的法条数据
 * 统计分布、来源、并设计修复策略
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AnalysisResult {
  totalArticles: number;
  missingEffectiveDate: number;
  missingPercentage: number;
  byDataSource: Record<string, { total: number; missing: number; percentage: number }>;
  byStatus: Record<string, { total: number; missing: number }>;
  sampleMissingArticles: Array<{
    id: string;
    lawName: string;
    articleNumber: string;
    dataSource: string;
    status: string;
    createdAt: Date;
  }>;
  potentialFixes: {
    fromSourceId: number;
    fromBackupFields: number;
    needManual: number;
  };
}

async function analyzeMissingEffectiveDate(): Promise<AnalysisResult> {
  console.log('='.repeat(70));
  console.log('分析缺少有效日期的法条数据');
  console.log('='.repeat(70) + '\n');

  const result: AnalysisResult = {
    totalArticles: 0,
    missingEffectiveDate: 0,
    missingPercentage: 0,
    byDataSource: {},
    byStatus: {},
    sampleMissingArticles: [],
    potentialFixes: {
      fromSourceId: 0,
      fromBackupFields: 0,
      needManual: 0,
    },
  };

  // 1. 基础统计
  result.totalArticles = await prisma.lawArticle.count();
  console.log(`📊 总法条数量: ${result.totalArticles}`);

  // 2. 统计缺失有效日期的法条
  const missingDate = new Date('1970-01-01T00:00:00Z');
  result.missingEffectiveDate = await prisma.lawArticle.count({
    where: {
      effectiveDate: missingDate,
    },
  });
  result.missingPercentage =
    (result.missingEffectiveDate / result.totalArticles) * 100;

  console.log(`❌ 缺少有效日期的法条: ${result.missingEffectiveDate} (${result.missingPercentage.toFixed(2)}%)`);

  // 3. 按数据源分析
  console.log('\n📁 按数据源统计缺失情况:');
  const bySource = await prisma.lawArticle.groupBy({
    by: ['dataSource'],
    _count: { id: true },
  });

  for (const source of bySource) {
    const sourceTotal = source._count.id;
    const sourceMissing = await prisma.lawArticle.count({
      where: {
        dataSource: source.dataSource,
        effectiveDate: missingDate,
      },
    });
    const sourcePercentage = (sourceMissing / sourceTotal) * 100;

    result.byDataSource[source.dataSource] = {
      total: sourceTotal,
      missing: sourceMissing,
      percentage: sourcePercentage,
    };

    console.log(
      `   ${source.dataSource}: ${sourceMissing}/${sourceTotal} 缺失 (${sourcePercentage.toFixed(2)}%)`
    );
  }

  // 4. 按状态分析
  console.log('\n📋 按状态统计缺失情况:');
  const byStatus = await prisma.lawArticle.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  for (const status of byStatus) {
    const statusTotal = status._count.id;
    const statusMissing = await prisma.lawArticle.count({
      where: {
        status: status.status,
        effectiveDate: missingDate,
      },
    });

    result.byStatus[status.status] = {
      total: statusTotal,
      missing: statusMissing,
    };

    console.log(
      `   ${status.status}: ${statusMissing}/${statusTotal} 缺失`
    );
  }

  // 5. 分析样本数据
  console.log('\n📝 缺失有效日期的法条样本 (前20条):');
  const missingArticles = await prisma.lawArticle.findMany({
    where: {
      effectiveDate: missingDate,
    },
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      dataSource: true,
      status: true,
      createdAt: true,
      sourceId: true,
      fullText: true,
      issuingAuthority: true,
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  for (const article of missingArticles) {
    console.log(`   - [${article.id}] ${article.lawName}`);
    console.log(`     法条编号: ${article.articleNumber}`);
    console.log(`     数据源: ${article.dataSource}, sourceId: ${article.sourceId || '无'}`);
    console.log(`     状态: ${article.status}, 创建时间: ${article.createdAt}`);
    console.log('');

    result.sampleMissingArticles.push({
      id: article.id,
      lawName: article.lawName,
      articleNumber: article.articleNumber,
      dataSource: article.dataSource,
      status: article.status,
      createdAt: article.createdAt,
    });
  }

  // 6. 分析修复可能性
  console.log('\n🔧 修复可能性分析:');

  // 6.1 检查有 sourceId 的缺失法条
  const withSourceId = await prisma.lawArticle.count({
    where: {
      effectiveDate: missingDate,
      sourceId: { not: null },
    },
  });
  result.potentialFixes.fromSourceId = withSourceId;
  console.log(`   有 sourceId 可重新获取: ${withSourceId} 条`);

  // 6.2 检查有 fullText 的缺失法条（可能从正文中提取日期）
  const withFullText = await prisma.lawArticle.count({
    where: {
      effectiveDate: missingDate,
      fullText: { not: '' },
    },
  });
  result.potentialFixes.fromBackupFields = withFullText - withSourceId;
  console.log(`   可从 fullText 推导: ${result.potentialFixes.fromBackupFields} 条`);

  // 6.3 完全缺失数据的
  const needManual = await prisma.lawArticle.count({
    where: {
      effectiveDate: missingDate,
      sourceId: null,
      fullText: '',
    },
  });
  result.potentialFixes.needManual = needManual;
  console.log(`   需要手动处理: ${needManual} 条`);

  // 7. 检查 FLK 数据源特有的信息
  console.log('\n🔍 FLK 数据源详细信息:');
  const flkMissing = await prisma.lawArticle.findMany({
    where: {
      dataSource: 'flk',
      effectiveDate: missingDate,
    },
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      sourceId: true,
      createdAt: true,
    },
    take: 10,
  });

  if (flkMissing.length > 0) {
    console.log(`   FLK 缺失有效日期的法条样本:`);
    for (const article of flkMissing) {
      console.log(`   - ${article.lawName} (sourceId: ${article.sourceId})`);
    }
  } else {
    console.log(`   FLK 数据源没有缺失有效日期的法条`);
  }

  return result;
}

async function generateFixStrategy(result: AnalysisResult): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('修复策略设计');
  console.log('='.repeat(70));

  console.log('\n📋 修复策略:');
  console.log('1. 优先处理有 sourceId 的法条');
  console.log('   - 通过 sourceId 查询 FLK API 获取 sxrq (生效日期) 和 gbrq (公布日期)');
  console.log('   - 如果 sxrq 存在，使用 sxrq');
  console.log('   - 否则使用 gbrq');

  console.log('\n2. 处理只有 fullText 的法条');
  console.log('   - 从 fullText 中正则匹配发布日期');
  console.log('   - 常见格式: "20XX年X月X日公布"、"自20XX年X月X日起施行"');

  console.log('\n3. 特殊处理:');
  console.log('   - 如果法条名称包含修订日期，优先使用');
  console.log('   - 如果有 amendmentHistory，使用最新的修订日期');

  console.log('\n⚠️  回滚策略:');
  console.log('   - 创建备份表或记录修改历史');
  console.log('   - 使用事务确保原子性');
  console.log('   - 记录修改日志');

  // 统计各种情况的数量
  console.log('\n📊 修复工作量预估:');
  console.log(`   可自动修复: ${result.potentialFixes.fromSourceId + result.potentialFixes.fromBackupFields} 条`);
  console.log(`   需手动处理: ${result.potentialFixes.needManual} 条`);
}

async function main() {
  try {
    const result = await analyzeMissingEffectiveDate();
    await generateFixStrategy(result);
    console.log('\n✅ 分析完成');
  } catch (error) {
    console.error('分析失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
