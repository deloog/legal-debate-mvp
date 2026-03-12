/**
 * 分析数据差异原因
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 分析数据差异原因...\n');

  try {
    // 1. 检查是否有重复的 lawName + articleNumber 组合
    const duplicates = await prisma.$queryRaw<
      Array<{
        lawName: string;
        articleNumber: string;
        count: bigint;
      }>
    >`
      SELECT
        "lawName",
        "articleNumber",
        COUNT(*) as count
      FROM "LawArticle"
      WHERE "dataSource" = 'npc'
      GROUP BY "lawName", "articleNumber"
      HAVING COUNT(*) > 1
      LIMIT 10
    `;

    console.log('📊 检查是否有重复的 lawName + articleNumber 组合：');
    if (duplicates.length === 0) {
      console.log(
        '   ✅ 没有重复！每个 lawName + articleNumber 组合都是唯一的\n'
      );
    } else {
      console.log('   ⚠️  发现重复：');
      duplicates.forEach(d => {
        console.log(`   ${d.lawName} 第${d.articleNumber}条: ${d.count} 次`);
      });
      console.log();
    }

    // 2. 统计实际数据
    const totalArticles = await prisma.lawArticle.count({
      where: { dataSource: 'npc' },
    });

    const uniqueLaws = await prisma.lawArticle.groupBy({
      by: ['lawName'],
      where: { dataSource: 'npc' },
      _count: { id: true },
    });

    console.log('📈 实际存储统计：');
    console.log(`   总条文数: ${totalArticles}`);
    console.log(`   法律总数: ${uniqueLaws.length}`);
    console.log(
      `   平均每部法律: ${Math.round(totalArticles / uniqueLaws.length)} 条\n`
    );

    // 3. 查看条文数最多的法律
    console.log('📋 条文数最多的10部法律：');
    const topLaws = uniqueLaws
      .sort((a, b) => b._count.id - a._count.id)
      .slice(0, 10);

    topLaws.forEach((law, index) => {
      console.log(`   ${index + 1}. ${law.lawName}: ${law._count.id} 条`);
    });
    console.log();

    // 4. 分析可能的原因
    console.log('💡 数据差异分析：');
    console.log('   导入时处理: 976,731 条');
    console.log(`   实际存储: ${totalArticles} 条`);
    console.log(`   差异: ${976731 - totalArticles} 条\n`);

    console.log('🔍 可能的原因：');
    console.log('   1. 同一法律的不同版本（修订版）');
    console.log('   2. 相同条文号但内容不同（历史版本）');
    console.log('   3. SQLite 中的重复记录');
    console.log('   4. 迁移脚本的去重逻辑（lawName + articleNumber）\n');

    // 5. 检查是否有相同法律名称但不同版本
    console.log('🔎 检查是否有相同法律的多个版本：');
    const lawVersions = await prisma.$queryRaw<
      Array<{
        lawName: string;
        count: bigint;
      }>
    >`
      SELECT
        "lawName",
        COUNT(DISTINCT "version") as count
      FROM "LawArticle"
      WHERE "dataSource" = 'npc'
      GROUP BY "lawName"
      HAVING COUNT(DISTINCT "version") > 1
      LIMIT 5
    `;

    if (lawVersions.length === 0) {
      console.log('   ✅ 所有法律都只有一个版本\n');
    } else {
      console.log('   发现多版本法律：');
      lawVersions.forEach(v => {
        console.log(`   ${v.lawName}: ${v.count} 个版本`);
      });
      console.log();
    }

    console.log('✅ 分析完成！');
  } catch (error) {
    console.error('❌ 分析失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
