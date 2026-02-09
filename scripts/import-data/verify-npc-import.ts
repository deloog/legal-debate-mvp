/**
 * 验证 NPC 法律数据导入结果
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 验证 NPC 法律数据导入结果...\n');

  try {
    // 1. 统计总数
    const totalCount = await prisma.lawArticle.count({
      where: { dataSource: 'npc' },
    });
    console.log(`📊 总条文数: ${totalCount}\n`);

    // 2. 按法律类型统计
    console.log('📋 按法律类型统计:');
    const byType = await prisma.lawArticle.groupBy({
      by: ['lawType'],
      where: { dataSource: 'npc' },
      _count: { id: true },
    });
    byType.forEach(item => {
      console.log(`   ${item.lawType}: ${item._count.id} 条`);
    });
    console.log();

    // 3. 按分类统计
    console.log('📋 按分类统计:');
    const byCategory = await prisma.lawArticle.groupBy({
      by: ['category'],
      where: { dataSource: 'npc' },
      _count: { id: true },
    });
    byCategory.forEach(item => {
      console.log(`   ${item.category}: ${item._count.id} 条`);
    });
    console.log();

    // 4. 统计法律数量
    const lawCount = await prisma.lawArticle.groupBy({
      by: ['lawName'],
      where: { dataSource: 'npc' },
      _count: { id: true },
    });
    console.log(`📚 法律总数: ${lawCount.length}\n`);

    // 5. 显示前5部法律及其条文数
    console.log('📖 前5部法律及条文数:');
    lawCount.slice(0, 5).forEach(item => {
      console.log(`   ${item.lawName}: ${item._count.id} 条`);
    });
    console.log();

    // 6. 显示示例数据
    const sample = await prisma.lawArticle.findFirst({
      where: { dataSource: 'npc' },
      select: {
        lawName: true,
        articleNumber: true,
        fullText: true,
        lawType: true,
        category: true,
        issuingAuthority: true,
        effectiveDate: true,
        chapterNumber: true,
      },
    });

    if (sample) {
      console.log('📄 示例数据:');
      console.log(`   法律名称: ${sample.lawName}`);
      console.log(`   条文号: ${sample.articleNumber}`);
      console.log(`   法律类型: ${sample.lawType}`);
      console.log(`   分类: ${sample.category}`);
      console.log(`   发布机关: ${sample.issuingAuthority}`);
      console.log(`   生效日期: ${sample.effectiveDate}`);
      console.log(`   章节号: ${sample.chapterNumber || '无'}`);
      console.log(`   条文内容: ${sample.fullText.substring(0, 100)}...`);
    }

    console.log('\n✅ 验证完成！');
  } catch (error) {
    console.error('❌ 验证失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
