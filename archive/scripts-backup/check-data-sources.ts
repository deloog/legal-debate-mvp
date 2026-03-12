/**
 * 检查数据库中的数据源分布
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 检查数据库中的数据源分布...\n');

  try {
    // 1. 按数据源统计
    const sources = await prisma.lawArticle.groupBy({
      by: ['dataSource'],
      _count: { id: true },
    });

    console.log('📊 按数据源统计：');
    sources.forEach(s => {
      console.log(`   ${s.dataSource || '(空)'}: ${s._count.id} 条`);
    });

    // 2. 检查可能的种子数据
    const seedData = await prisma.lawArticle.count({
      where: {
        OR: [
          { dataSource: null },
          { dataSource: 'seed' },
          { dataSource: '' },
          { dataSource: 'local' },
        ],
      },
    });

    console.log(`\n⚠️  可能的种子数据: ${seedData} 条`);

    // 3. 显示种子数据示例
    if (seedData > 0) {
      const samples = await prisma.lawArticle.findMany({
        where: {
          OR: [
            { dataSource: null },
            { dataSource: 'seed' },
            { dataSource: '' },
            { dataSource: 'local' },
          ],
        },
        take: 5,
        select: {
          lawName: true,
          articleNumber: true,
          dataSource: true,
          createdAt: true,
        },
      });

      console.log('\n📄 种子数据示例：');
      samples.forEach(s => {
        console.log(`   ${s.lawName} 第${s.articleNumber}条`);
        console.log(`      来源: ${s.dataSource || '空'}`);
        console.log(`      创建于: ${s.createdAt}`);
      });
    }

    // 4. 检查 NPC 数据
    const npcData = await prisma.lawArticle.count({
      where: { dataSource: 'npc' },
    });

    console.log(`\n✅ NPC 数据: ${npcData} 条`);

    // 5. 按创建时间统计（帮助识别种子数据）
    const oldestNpc = await prisma.lawArticle.findFirst({
      where: { dataSource: 'npc' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    const newestNpc = await prisma.lawArticle.findFirst({
      where: { dataSource: 'npc' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (oldestNpc && newestNpc) {
      console.log(`\nNPC 数据时间范围：`);
      console.log(`   最早: ${oldestNpc.createdAt}`);
      console.log(`   最晚: ${newestNpc.createdAt}`);
    }

    console.log('\n✅ 检查完成！');
  } catch (error) {
    console.error('❌ 检查失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
