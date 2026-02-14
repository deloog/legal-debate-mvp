import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(80));
  console.log('短内容法规详情（内容<100字符）');
  console.log('='.repeat(80));

  const shortArticles = await prisma.lawArticle.findMany({
    where: {
      fullText: {
        lt: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    },
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      lawType: true,
      category: true,
      issuingAuthority: true,
      fullText: true,
      dataSource: true,
    },
    take: 10,
  });

  console.log(`找到 ${shortArticles.length} 条短内容法规（显示前10条）:\n`);

  shortArticles.forEach((article, index) => {
    console.log(`${index + 1}. ${article.lawName}`);
    console.log(`   文号: ${article.articleNumber}`);
    console.log(`   类型: ${article.lawType} | 分类: ${article.category}`);
    console.log(`   数据源: ${article.dataSource}`);
    console.log(`   内容长度: ${article.fullText.length} 字符`);
    console.log(`   内容: ${article.fullText}`);
    console.log();
  });

  console.log('='.repeat(80));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
