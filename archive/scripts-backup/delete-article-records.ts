/**
 * 删除条款级记录
 *
 * 识别并删除 articleNumber 是中文条款号的记录
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 匹配中文条款号的正则表达式
const ARTICLE_PATTERN = /^第[一二三四五六七八九十百千万零]+[条款章节]/;

async function main() {
  console.log('='.repeat(70));
  console.log('删除条款级记录');
  console.log('='.repeat(70));
  console.log();

  // 1. 查找所有条款级记录
  const articleRecords = await prisma.lawArticle.findMany({
    where: {
      articleNumber: {
        // 使用正则匹配（Prisma 不直接支持正则，需要用 JS 过滤）
      },
    },
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      fullText: true,
      dataSource: true,
    },
  });

  // 在内存中过滤条款级记录
  const toDelete = articleRecords.filter(r =>
    ARTICLE_PATTERN.test(r.articleNumber)
  );

  console.log(`📊 分析结果：`);
  console.log(`   数据库总记录: ${articleRecords.length}`);
  console.log(`   将删除的条款级记录: ${toDelete.length}`);
  console.log(`   保留的完整记录: ${articleRecords.length - toDelete.length}`);
  console.log();

  if (toDelete.length === 0) {
    console.log('✅ 没有需要删除的记录');
    await prisma.$disconnect();
    return;
  }

  // 2. 显示将删除的记录
  console.log(`📋 将删除的记录（前20条）：`);
  console.log();
  toDelete.slice(0, 20).forEach((record, idx) => {
    console.log(`${idx + 1}. ${record.lawName}`);
    console.log(`   条款: ${record.articleNumber}`);
    console.log(`   内容: ${record.fullText.substring(0, 50)}...`);
    console.log();
  });

  if (toDelete.length > 20) {
    console.log(`... 还有 ${toDelete.length - 20} 条\n`);
  }

  // 3. 按法律名称分组
  const byLawName = new Map<string, number>();
  toDelete.forEach(r => {
    byLawName.set(r.lawName, (byLawName.get(r.lawName) || 0) + 1);
  });

  console.log(`📊 按法律名称统计：`);
  console.log();
  Array.from(byLawName.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      console.log(`   ${name}: ${count} 条`);
    });
  console.log();

  // 4. 删除记录
  console.log('⚠️  即将删除这些条款级记录...');
  console.log();

  // 获取所有 ID
  const idsToDelete = toDelete.map(r => r.id);

  // 批量删除
  const deleteResult = await prisma.lawArticle.deleteMany({
    where: {
      id: {
        in: idsToDelete,
      },
    },
  });

  console.log(`✅ 删除完成！`);
  console.log(`   删除数量: ${deleteResult.count}`);
  console.log();

  // 5. 验证删除结果
  const remainingCount = await prisma.lawArticle.count();
  console.log(`📊 当前数据库状态：`);
  console.log(`   剩余记录: ${remainingCount}`);
  console.log();

  await prisma.$disconnect();
}

main()
  .then(() => {
    console.log('='.repeat(70));
    console.log('✅ 操作完成');
    console.log('='.repeat(70));
  })
  .catch(error => {
    console.error('❌ 删除失败:', error);
    process.exit(1);
  });
