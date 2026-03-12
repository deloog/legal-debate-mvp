/**
 * 法条数据质量检查脚本
 *
 * 功能：
 * 1. 随机抽取法条记录，检查完整性和质量
 * 2. 输出统计信息
 *
 * 执行方式：npx tsx scripts/check-law-quality.ts
 */

import { PrismaClient, LawCategory } from '@prisma/client';

const prisma = new PrismaClient();

interface LawSample {
  id: string;
  lawName: string;
  lawType: string;
  category: string;
  fullTextLength: number;
  effectiveDate: Date | null;
  issuingAuthority: string;
  status: string;
}

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('[法条数据质量检查]');
  console.log('='.repeat(70));

  // 1. 基础统计
  console.log('\n[1] 基础统计');
  const totalCount = await prisma.lawArticle.count({
    where: { dataSource: 'flk' },
  });
  console.log(`    FLK 数据总数: ${totalCount}`);

  // 2. 按法律类型统计
  console.log('\n[2] 按法律类型统计');
  const typeStats = await prisma.lawArticle.groupBy({
    by: ['lawType'],
    where: { dataSource: 'flk' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  typeStats.forEach(stat => {
    console.log(`    ${stat.lawType}: ${stat._count.id} 条`);
  });

  // 3. 按学科分类统计
  console.log('\n[3] 按学科分类统计');
  const categoryStats = await prisma.lawArticle.groupBy({
    by: ['category'],
    where: { dataSource: 'flk' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  categoryStats.forEach(stat => {
    console.log(`    ${stat.category}: ${stat._count.id} 条`);
  });

  // 4. 全文长度分布
  console.log('\n[4] 全文长度分布');
  const lengthStats = (await prisma.$queryRaw`
    SELECT
      CASE
        WHEN LENGTH(full_text) <= 100 THEN '0-100'
        WHEN LENGTH(full_text) <= 500 THEN '101-500'
        WHEN LENGTH(full_text) <= 2000 THEN '501-2000'
        WHEN LENGTH(full_text) <= 10000 THEN '2001-10000'
        ELSE '10000+'
      END as range,
      COUNT(*) as count
    FROM law_articles
    WHERE data_source = 'flk'
    GROUP BY range
    ORDER BY MIN(LENGTH(full_text))
  `) as Array<{ range: string; count: bigint }>;
  lengthStats.forEach(stat => {
    console.log(`    ${stat.range.padEnd(10)}: ${stat.count} 条`);
  });

  // 5. 随机抽取样本
  console.log('\n[5] 随机样本检查（每类 2 条）');

  const categories = [
    LawCategory.CIVIL,
    LawCategory.CRIMINAL,
    LawCategory.ADMINISTRATIVE,
    LawCategory.ECONOMIC,
    LawCategory.LABOR,
    LawCategory.PROCEDURE,
    LawCategory.OTHER,
  ];

  for (const category of categories) {
    const samples = await prisma.lawArticle.findMany({
      where: {
        dataSource: 'flk',
        category: category,
      },
      take: 2,
      orderBy: { fullText: 'desc' },
    });

    if (samples.length === 0) continue;

    console.log(`\n  【${category}】共 ${samples.length} 条样本:`);
    for (const sample of samples) {
      const textPreview =
        sample.fullText.length > 100
          ? sample.fullText.substring(0, 100) + '...'
          : sample.fullText;
      console.log(`    ─────────────────────────────────────────────────────`);
      console.log(`    名称: ${sample.lawName}`);
      console.log(`    类型: ${sample.lawType} | 分类: ${sample.category}`);
      console.log(`    发布机关: ${sample.issuingAuthority}`);
      console.log(
        `    生效日期: ${sample.effectiveDate?.toISOString().split('T')[0] || 'N/A'}`
      );
      console.log(`    全文长度: ${sample.fullText.length} 字符`);
      console.log(`    状态: ${sample.status}`);
      console.log(`    预览: ${textPreview.replace(/\n/g, ' ')}`);
    }
  }

  // 6. 检查可疑记录
  console.log('\n' + '='.repeat(70));
  console.log('[6] 可疑记录检查');
  console.log('='.repeat(70));

  // 6.1 过短全文（使用原生 SQL）
  const shortRecords = (await prisma.$queryRaw`
    SELECT id, law_name, full_text, law_type, category, issuing_authority, effective_date, status
    FROM law_articles
    WHERE data_source = 'flk'
      AND (LENGTH(full_text) <= 50 OR full_text = '' OR full_text = ' ')
    ORDER BY LENGTH(full_text) ASC
    LIMIT 5
  `) as Array<{
    id: string;
    law_name: string;
    full_text: string;
    law_type: string;
    category: string;
    issuing_authority: string;
    effective_date: Date | null;
    status: string;
  }>;

  console.log(`\n  [6.1] 全文过短记录 (<=50字符): ${shortRecords.length} 条`);
  shortRecords.forEach(rec => {
    console.log(
      `    - ${rec.law_name.substring(0, 40)} (${rec.full_text.length}字符)`
    );
  });

  // 6.2 缺失字段
  const missingAuthority = await prisma.lawArticle.count({
    where: {
      dataSource: 'flk',
      OR: [{ issuingAuthority: { equals: '未知' } }, { issuingAuthority: '' }],
    },
  });
  console.log(`\n  [6.2] 缺失发布机关: ${missingAuthority} 条`);

  // 6.3 无效状态
  const invalidStatus = await prisma.lawArticle.count({
    where: {
      dataSource: 'flk',
      status: { in: ['DRAFT', 'REPEALED'] },
    },
  });
  console.log(`\n  [6.3] 非有效状态(草稿/废止): ${invalidStatus} 条`);

  console.log('\n' + '='.repeat(70));
  console.log('[检查完成]');
  console.log('='.repeat(70));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
