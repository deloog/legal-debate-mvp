import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('行政法记录内容验证');
  console.log('='.repeat(80));

  const laws = await prisma.lawArticle.findMany({
    where: {
      category: 'ADMINISTRATIVE',
      dataSource: 'flk',
    },
    select: {
      lawName: true,
      fullText: true,
      articleNumber: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\n总记录数: ${laws.length} 条\n`);

  // 按内容长度分类
  const shortContent = laws.filter(l => l.fullText.length < 500);
  const mediumContent = laws.filter(l => l.fullText.length >= 500 && l.fullText.length < 2000);
  const longContent = laws.filter(l => l.fullText.length >= 2000);

  console.log('内容长度分布:');
  console.log('='.repeat(80));
  console.log(`⚠️  短内容 (<500字符): ${shortContent.length} 条`);
  console.log(`📊 中等内容 (500-2000字符): ${mediumContent.length} 条`);
  console.log(`✅ 长内容 (>2000字符): ${longContent.length} 条`);

  // 显示短内容的记录
  if (shortContent.length > 0) {
    console.log('\n⚠️  短内容记录（可能只有目录）:');
    console.log('='.repeat(80));
    shortContent.slice(0, 10).forEach((l, i) => {
      const preview = l.fullText.substring(0, 100);
      console.log(`${i + 1}. ${l.lawName}`);
      console.log(`   长度: ${l.fullText.length} 字符`);
      console.log(`   预览: ${preview}...`);
      console.log();
    });
    if (shortContent.length > 10) {
      console.log(`... 还有 ${shortContent.length - 10} 条短内容记录\n`);
    }
  }

  // 显示长内容的示例
  if (longContent.length > 0) {
    console.log('✅ 长内容记录示例（前3条）:');
    console.log('='.repeat(80));
    longContent.slice(0, 3).forEach((l, i) => {
      const preview = l.fullText.substring(0, 150);
      console.log(`${i + 1}. ${l.lawName}`);
      console.log(`   长度: ${l.fullText.length} 字符`);
      console.log(`   预览: ${preview}...`);
      console.log();
    });
  }

  console.log('='.repeat(80));
  console.log('\n说明:');
  console.log('- 📄 处理页数: 从FLK官网分页获取列表的页数');
  console.log('- 📥 DOCX下载: 成功下载DOCX文件的数量');
  console.log('- 📝 内容解析: 成功保存到数据库的记录数（可能来自API或DOCX）');
  console.log('- 大部分内容来自API的content字段，不是所有都需要下载DOCX');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
