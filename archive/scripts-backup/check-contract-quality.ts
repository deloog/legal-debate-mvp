import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 统计content长度分布
  const templates = await prisma.contractTemplate.findMany({
    select: {
      name: true,
      category: true,
      content: true,
      fullText: true,
      source: true,
      sourceUrl: true,
    },
  });

  let shortContent = 0; // < 100字符
  let mediumContent = 0; // 100-1000字符
  let longContent = 0; // > 1000字符

  const byCategory: Record<string, number> = {};

  for (const t of templates) {
    const len = t.content?.length || 0;
    if (len < 100) shortContent++;
    else if (len < 1000) mediumContent++;
    else longContent++;

    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
  }

  console.log('=== 合同内容质量统计 ===');
  console.log(`总数: ${templates.length}`);
  console.log(`\n内容长度分布:`);
  console.log(`  短内容 (<100字符): ${shortContent}`);
  console.log(`  中等内容 (100-1000字符): ${mediumContent}`);
  console.log(`  长内容 (>1000字符): ${longContent}`);

  console.log(`\n分类分布:`);
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));

  // 显示几个长内容的例子
  console.log(`\n=== 完整合同示例 ===`);
  const longTemplates = templates
    .filter(t => (t.content?.length || 0) > 500)
    .slice(0, 3);

  for (const t of longTemplates) {
    console.log(`\n[${t.category}] ${t.name}`);
    console.log(`  来源: ${t.source}`);
    console.log(`  内容长度: ${t.content?.length || 0} 字符`);
    console.log(`  内容预览: ${t.content?.slice(0, 200)}...`);
  }

  await prisma.$disconnect();
}

main();
