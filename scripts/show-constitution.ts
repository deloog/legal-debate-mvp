import { PrismaClient, _LawStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('宪法分类的详细记录:');
  console.log('='.repeat(80));

  const laws = await prisma.lawArticle.findMany({
    where: {
      dataSource: 'flk',
      articleNumber: {
        startsWith: '2c909fdd678bf17901678bf59', // 宪法的ID前缀
      },
    },
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      fullText: true,
      status: true,
      issuingAuthority: true,
      effectiveDate: true,
    },
    orderBy: { effectiveDate: 'asc' },
  });

  if (laws.length === 0) {
    console.log('没有找到宪法相关记录');
    process.exit(0);
  }

  laws.forEach((l, i) => {
    const statusMap: Record<string, string> = {
      VALID: '生效中',
      REPEALED: '已失效',
      AMENDED: '已修正',
      DRAFT: '未生效',
      EXPIRED: '已过期',
    };
    const statusText = statusMap[l.status] || l.status;

    console.log(`${i + 1}. ${l.lawName}`);
    console.log(`   状态: ${statusText}`);
    console.log(`   发布机构: ${l.issuingAuthority}`);
    console.log(`   生效日期: ${l.effectiveDate.toISOString().split('T')[0]}`);
    console.log(`   内容长度: ${l.fullText.length} 字符`);
    console.log(`   预览: ${l.fullText.substring(0, 150)}...`);
    console.log();
  });

  console.log('='.repeat(80));
  console.log(`总计: ${laws.length} 部宪法相关文件`);
  console.log();
  console.log(
    '说明: 这些是不同历史时期的宪法及宪法修正案，每部都是完整的独立文件。'
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
