/**
 * 清理条款级别的记录
 *
 * 问题分析：
 * 数据库中存在大量条款级别的记录（articleNumber 是中文条款号，如"第五百零九条"）
 * 这些记录的 content 很短（15-156 字符），数据源是 'local'
 * 完整的法规记录应该有长的 content 和 UUID 格式的 articleNumber
 *
 * 解决方案：
 * 1. 识别条款级记录（articleNumber 匹配中文条款号）
 * 2. 统计这些记录的数量和来源
 * 3. 提供清理选项
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 匹配中文条款号的正则表达式
const ARTICLE_PATTERN = /^第[一二三四五六七八九十百千万零]+[条款章节]/;

function isArticleLevelRecord(articleNumber: string): boolean {
  return ARTICLE_PATTERN.test(articleNumber);
}

async function main() {
  console.log('='.repeat(70));
  console.log('条款级别记录清理工具');
  console.log('='.repeat(70));
  console.log();

  // 1. 查找所有条款级记录
  const allRecords = await prisma.lawArticle.findMany({
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      fullText: true,
      dataSource: true,
      category: true,
      lawType: true,
    },
  });

  const articleRecords = allRecords.filter(r =>
    isArticleLevelRecord(r.articleNumber)
  );

  console.log(`📊 统计结果：`);
  console.log(`   总记录数: ${allRecords.length}`);
  console.log(`   条款级记录: ${articleRecords.length}`);
  console.log(`   完整法规记录: ${allRecords.length - articleRecords.length}`);
  console.log();

  // 2. 按法律名称分组
  const byLawName = new Map<string, typeof articleRecords>();
  articleRecords.forEach(record => {
    const current = byLawName.get(record.lawName) || [];
    current.push(record);
    byLawName.set(record.lawName, current);
  });

  // 3. 显示有条款级记录的法律
  const lawsWithArticles = Array.from(byLawName.entries()).sort(
    (a, b) => b[1].length - a[1].length
  );

  console.log(`📋 有条款级记录的法律（前30部）：`);
  console.log();
  lawsWithArticles.slice(0, 30).forEach(([lawName, records], idx) => {
    console.log(`${idx + 1}. ${lawName}`);
    console.log(`   条款级记录: ${records.length} 条`);
    console.log(`   数据源: ${records[0].dataSource}`);
    console.log(
      `   示例条款: ${records[0].articleNumber} (${records[0].fullText.length} 字符)`
    );
    console.log();
  });

  console.log(`... 还有 ${lawsWithArticles.length - 30} 部\n`);

  // 4. 检查是否有完整的法规记录
  console.log(`🔍 检查是否有对应的完整法规记录：`);
  console.log();

  const hasCompleteRecord: {
    lawName: string;
    hasComplete: boolean;
    articleCount: number;
  }[] = [];

  for (const [lawName, articleRecords] of lawsWithArticles.slice(0, 20)) {
    const completeRecord = allRecords.find(
      r =>
        r.lawName === lawName &&
        !isArticleLevelRecord(r.articleNumber) &&
        r.fullText.length > 1000
    );

    hasCompleteRecord.push({
      lawName,
      hasComplete: !!completeRecord,
      articleCount: articleRecords.length,
    });
  }

  console.log(
    `法律名称                                    | 有完整记录 | 条款数`
  );
  console.log('-'.repeat(70));
  hasCompleteRecord.forEach(({ lawName, hasComplete, articleCount }) => {
    const status = hasComplete ? '✅' : '❌';
    console.log(`${lawName.padEnd(40)} | ${status}         | ${articleCount}`);
  });
  console.log();

  // 5. 统计数据源
  const byDataSource = new Map<string, number>();
  articleRecords.forEach(r => {
    byDataSource.set(r.dataSource, (byDataSource.get(r.dataSource) || 0) + 1);
  });

  console.log(`📊 条款级记录按数据源分布：`);
  console.log();
  Array.from(byDataSource.entries()).forEach(([source, count]) => {
    console.log(`   ${source}: ${count} 条`);
  });
  console.log();

  // 6. 显示一些示例条款
  console.log(`📝 条款级记录示例（前5条）：`);
  console.log();
  articleRecords.slice(0, 5).forEach((record, idx) => {
    console.log(`${idx + 1}. ${record.lawName}`);
    console.log(`   条款: ${record.articleNumber}`);
    console.log(`   内容: ${record.fullText.substring(0, 80)}...`);
    console.log();
  });

  // 7. 建议
  console.log('='.repeat(70));
  console.log('建议：');
  console.log('='.repeat(70));
  console.log();
  console.log('1. 这些条款级记录来自 local 数据源，可能是早期测试或导入的数据');
  console.log('2. 完整的法规应该有较长的内容（>1000 字符）和 UUID 格式的 ID');
  console.log('3. 如果已有完整记录，建议删除条款级记录以避免重复');
  console.log('4. 如果没有完整记录，需要重新采集完整的法规');
  console.log();
  console.log('清理脚本功能（可选，需要手动执行）：');
  console.log('- 删除所有条款级记录（只保留完整法规）');
  console.log('- 或者标记条款级记录为特殊类型');
  console.log();

  await prisma.$disconnect();
}

main().catch(console.error);
