import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(60));
  console.log('数据库法规统计');
  console.log('='.repeat(60));

  const total = await prisma.lawArticle.count();
  console.log(`\n总数量: ${total} 条\n`);

  const byCategory = await prisma.lawArticle.groupBy({
    by: ['category'],
    _count: true,
  });
  console.log('分类统计:');
  byCategory.forEach(item => {
    console.log(`  ${item.category}: ${item._count} 条`);
  });

  const byType = await prisma.lawArticle.groupBy({
    by: ['lawType'],
    _count: true,
  });
  console.log('\n类型统计:');
  byType.forEach(item => {
    console.log(`  ${item.lawType}: ${item._count} 条`);
  });

  // 检查内容长度
  const allArticles = await prisma.lawArticle.findMany({
    select: {
      id: true,
      lawName: true,
      fullText: true,
    },
  });

  let shortContent = 0;
  let longContent = 0;
  allArticles.forEach(a => {
    if (a.fullText.length < 100) {
      shortContent++;
    } else {
      longContent++;
    }
  });

  console.log(`\n内容少于100字符: ${shortContent} 条`);
  console.log(`内容大于等于100字符: ${longContent} 条`);

  console.log('\n' + '='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
