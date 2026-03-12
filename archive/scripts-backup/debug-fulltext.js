/**
 * 直接检查数据库中 fullText 的内容
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkFullText() {
  console.log('='.repeat(70));
  console.log('检查 fullText 内容');
  console.log('='.repeat(70) + '\n');

  // 获取缺失有效日期的法条
  const article = await prisma.lawArticle.findFirst({
    where: {
      effectiveDate: new Date('1970-01-01T00:00:00Z'),
    },
    select: {
      id: true,
      lawName: true,
      fullText: true,
    },
  });

  if (!article) {
    console.log('没有找到缺失有效日期的法条');
    return;
  }

  console.log(`法条: ${article.lawName}`);
  console.log(`ID: ${article.id}`);
  console.log(`\n完整 fullText 内容 (前2000字符):`);
  console.log('='.repeat(70));
  console.log(article.fullText.substring(0, 2000));
  console.log('='.repeat(70));

  // 检查是否有日期模式
  const patterns = [
    /(\d{4})年(\d{1,2})月(\d{1,2})日/g,
    /\((\d{4})年/g,
    /\d{4}年\d{1,2}月\d{1,2}日/g,
  ];

  console.log('\n\n正则匹配测试:');
  for (const pattern of patterns) {
    const matches = article.fullText.match(pattern);
    console.log(`Pattern ${pattern}:`, matches || '无匹配');
  }
}

async function main() {
  try {
    await checkFullText();
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
