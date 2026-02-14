/**
 * 验证采集数据质量
 * 检查 DOCX 下载是否正常工作
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('采集数据质量验证');
  console.log('='.repeat(70));

  // 获取最新的 10 条记录
  const recentLaws = await prisma.lawArticle.findMany({
    where: {
      dataSource: 'flk',
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
    select: {
      id: true,
      lawName: true,
      fullText: true,
      createdAt: true,
    },
  });

  console.log(`\n最新 ${recentLaws.length} 条记录:\n`);

  let hasFullContent = 0;
  let hasMetadataOnly = 0;

  for (let i = 0; i < recentLaws.length; i++) {
    const law = recentLaws[i];
    const isFullContent = law.fullText.length > 100;
    const isMetadata = law.fullText.startsWith('[元数据]');

    if (isFullContent && !isMetadata) {
      hasFullContent++;
    } else {
      hasMetadataOnly++;
    }

    console.log(`${i + 1}. ${law.lawName.substring(0, 35)}...`);
    console.log(`   创建时间: ${law.createdAt.toISOString().split('T')[0]}`);
    console.log(`   内容长度: ${law.fullText.length} 字符`);
    console.log(`   类型: ${isMetadata ? '⚠ 元数据' : '✓ 完整内容'}`);

    if (!isMetadata && isFullContent) {
      console.log(`   内容预览: ${law.fullText.substring(0, 80)}...`);
    }

    console.log();
  }

  console.log('='.repeat(70));
  console.log('质量统计:');
  console.log(`  ✓ 完整内容: ${hasFullContent} 条`);
  console.log(`  ⚠ 仅有元数据: ${hasMetadataOnly} 条`);
  console.log(`  完整率: ${(hasFullContent / recentLaws.length * 100).toFixed(1)}%`);
  console.log('='.repeat(70));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
