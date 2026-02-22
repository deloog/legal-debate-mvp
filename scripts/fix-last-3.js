/**
 * 手动修复最后3条特殊格式的法条
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MISSING_DATE = new Date('1970-01-01T00:00:00Z');

async function manualFix() {
  console.log('手动修复最后3条法条...\n');

  // 获取仍然缺失的法条
  const articles = await prisma.lawArticle.findMany({
    where: { effectiveDate: MISSING_DATE },
    select: { id: true, lawName: true, fullText: true },
  });

  for (const article of articles) {
    const text = article.fullText;
    let date = null;

    // 四川省...一九八六年七月十二日
    if (text.includes('一九八六年七月十二日')) {
      date = new Date(1986, 6, 12);
    }
    // 甘南...一九八九年十月一日起施行
    else if (text.includes('一九八九年十月一日起施行')) {
      date = new Date(1989, 9, 1);
    }
    // 三江侗族自治县 - 查看具体日期
    else if (text.includes('一九八九年四月十六日')) {
      date = new Date(1989, 3, 16);
    }

    if (date) {
      await prisma.lawArticle.update({
        where: { id: article.id },
        data: { effectiveDate: date, updatedAt: new Date() },
      });
      console.log(`✅ ${article.lawName}: ${date.toISOString().split('T')[0]}`);
    } else {
      console.log(`❌ ${article.lawName}: 仍无法处理`);
      console.log(
        `   fullText预览: ${text.substring(0, 200).replace(/\s+/g, ' ')}`
      );
    }
  }

  // 最终统计
  const missing = await prisma.lawArticle.count({
    where: { effectiveDate: MISSING_DATE },
  });
  const total = await prisma.lawArticle.count();
  console.log(`\n最终结果: ${missing}/${total} 缺失`);
  console.log(
    `完整性评分: ${(((total - missing) / total) * 100).toFixed(2)}/100`
  );

  if (missing === 0) {
    console.log('\n🎉 所有法条都已修复！完整性评分达到100分！');
  }
}

manualFix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
