/**
 * 清理种子数据脚本
 *
 * 删除所有非 NPC 来源的法律条文数据
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 清理种子数据...\n');

  try {
    // 1. 统计要删除的数据
    const count = await prisma.lawArticle.count({
      where: {
        dataSource: { not: 'npc' },
      },
    });

    if (count === 0) {
      console.log('✅ 没有需要清理的数据');
      return;
    }

    console.log(`⚠️  将删除 ${count} 条非 NPC 数据`);

    // 显示要删除的数据示例
    const samples = await prisma.lawArticle.findMany({
      where: {
        dataSource: { not: 'npc' },
      },
      take: 5,
      select: {
        lawName: true,
        articleNumber: true,
        dataSource: true,
      },
    });

    console.log('\n📄 要删除的数据示例：');
    samples.forEach(s => {
      console.log(
        `   ${s.lawName} 第${s.articleNumber}条 (来源: ${s.dataSource})`
      );
    });

    console.log('\n⏳ 等待 5 秒后自动执行...');
    console.log('   按 Ctrl+C 取消\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // 2. 删除非 npc 数据
    const result = await prisma.lawArticle.deleteMany({
      where: {
        dataSource: { not: 'npc' },
      },
    });

    console.log(`✅ 已删除 ${result.count} 条数据`);

    // 3. 验证结果
    const remaining = await prisma.lawArticle.count({
      where: {
        dataSource: { not: 'npc' },
      },
    });

    if (remaining === 0) {
      console.log('✅ 清理完成！所有非 NPC 数据已删除');
    } else {
      console.log(`⚠️  还有 ${remaining} 条数据未删除`);
    }
  } catch (error) {
    console.error('❌ 清理失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
