/**
 * 检查无法修复的法条，尝试其他方式获取日期
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkFailedArticles() {
  console.log('='.repeat(70));
  console.log('检查无法修复的法条');
  console.log('='.repeat(70) + '\n');

  const missingDate = new Date('1970-01-01T00:00:00Z');

  // 获取所有仍然缺失有效日期的法条
  const failedArticles = await prisma.lawArticle.findMany({
    where: {
      effectiveDate: missingDate,
    },
    select: {
      id: true,
      lawName: true,
      fullText: true,
      sourceId: true,
      status: true,
      createdAt: true,
      issuingAuthority: true,
    },
  });

  console.log(`找到 ${failedArticles.length} 条无法修复的法条:\n`);

  for (const article of failedArticles) {
    console.log(`📄 ${article.lawName}`);
    console.log(`   ID: ${article.id}`);
    console.log(`   sourceId: ${article.sourceId || '无'}`);
    console.log(`   status: ${article.status}`);
    console.log(`   issuingAuthority: ${article.issuingAuthority}`);
    console.log(`   createdAt: ${article.createdAt}`);

    // 检查 fullText 长度
    const textLength = article.fullText ? article.fullText.length : 0;
    console.log(`   fullText长度: ${textLength}`);

    // 显示 fullText 开头部分
    if (article.fullText) {
      const preview = article.fullText.substring(0, 300).replace(/\s+/g, ' ');
      console.log(`   内容预览: ${preview}...`);
    }

    // 尝试从标题提取年份
    const yearMatch = article.lawName.match(/(\d{4})年/);
    if (yearMatch) {
      console.log(`   标题中年份: ${yearMatch[1]}`);
    }

    console.log('');
  }

  // 统计失败原因
  console.log('='.repeat(70));
  console.log('失败原因分析');
  console.log('='.repeat(70));

  const noSourceId = failedArticles.filter(a => !a.sourceId).length;
  const noFullText = failedArticles.filter(a => !a.fullText || a.fullText.length < 10).length;
  const noDateInText = failedArticles.filter(a => a.fullText && a.fullText.length >= 10).length;

  console.log(`无 sourceId: ${noSourceId}`);
  console.log(`无 fullText 或内容过短: ${noFullText}`);
  console.log(`有 fullText 但无日期: ${noDateInText}`);
}

async function main() {
  try {
    await checkFailedArticles();
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
