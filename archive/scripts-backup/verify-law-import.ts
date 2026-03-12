import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyImport() {
  console.log('验证法条数据导入情况...\n');

  try {
    // 统计总数
    const totalCount = await prisma.lawArticle.count();
    console.log(`法条总数: ${totalCount}\n`);

    if (totalCount === 0) {
      console.log('❌ 错误：数据库中没有法条数据！');
      return false;
    }

    // 按类别统计
    const countByCategory = await prisma.lawArticle.groupBy({
      by: ['category'],
      _count: true,
    });

    console.log('按类别统计:');
    for (const item of countByCategory) {
      console.log(`  ${item.category}: ${item._count} 条`);
    }
    console.log('');

    // 获取几条示例数据
    const sampleArticles = await prisma.lawArticle.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    console.log('最新导入的5条法条:');
    for (const article of sampleArticles) {
      console.log(
        `  ✓ ${article.lawName} ${article.articleNumber} (${article.category})`
      );
    }
    console.log('');

    // 验证数据完整性
    const allArticles = await prisma.lawArticle.findMany();
    let completeCount = 0;
    const incompleteFields: string[] = [];

    for (const article of allArticles) {
      if (
        article.lawName &&
        article.articleNumber &&
        article.fullText &&
        article.category &&
        article.subCategory &&
        article.effectiveDate &&
        article.status &&
        article.issuingAuthority &&
        article.jurisdiction &&
        article.searchableText
      ) {
        completeCount++;
      } else {
        const missing = [];
        if (!article.lawName) missing.push('lawName');
        if (!article.articleNumber) missing.push('articleNumber');
        if (!article.fullText) missing.push('fullText');
        if (!article.category) missing.push('category');
        if (!article.subCategory) missing.push('subCategory');
        incompleteFields.push(...missing);
      }
    }

    console.log('数据完整性检查:');
    console.log(`  完整记录数: ${completeCount}/${totalCount}`);
    console.log(
      `  完整率: ${((completeCount / totalCount) * 100).toFixed(1)}%`
    );

    if (incompleteFields.length > 0) {
      console.log(
        `  ⚠️  缺失字段: ${[...new Set(incompleteFields)].join(', ')}`
      );
    }
    console.log('');

    console.log('✅ 验证完成');
    return true;
  } catch (error) {
    console.error('❌ 验证失败:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

verifyImport();
