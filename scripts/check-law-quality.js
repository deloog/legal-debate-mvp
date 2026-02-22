const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('[法条数据质量检查]');
  console.log('='.repeat(70));

  // 1. 基础统计
  const totalCount = await prisma.lawArticle.count({
    where: { dataSource: 'flk' },
  });
  console.log('\n[1] FLK 数据总数:', totalCount);

  // 2. 按法律类型统计
  const typeStats = await prisma.$queryRaw`
    SELECT law_type, COUNT(*) as count
    FROM law_articles
    WHERE data_source = 'flk'
    GROUP BY law_type
    ORDER BY count DESC
  `;
  console.log('\n[2] 按法律类型统计:');
  typeStats.forEach(s => console.log('   ', s.law_type + ':', s.count, '条'));

  // 3. 按学科分类统计
  const categoryStats = await prisma.$queryRaw`
    SELECT category, COUNT(*) as count
    FROM law_articles
    WHERE data_source = 'flk'
    GROUP BY category
    ORDER BY count DESC
  `;
  console.log('\n[3] 按学科分类统计:');
  categoryStats.forEach(s =>
    console.log('   ', s.category + ':', s.count, '条')
  );

  // 4. 全文长度分布
  const lengthStats = await prisma.$queryRaw`
    SELECT
      CASE
        WHEN LENGTH(full_text) <= 100 THEN '0-100'
        WHEN LENGTH(full_text) <= 500 THEN '101-500'
        WHEN LENGTH(full_text) <= 2000 THEN '501-2000'
        WHEN LENGTH(full_text) <= 10000 THEN '2001-10000'
        ELSE '10000+'
      END as range,
      COUNT(*) as count
    FROM law_articles
    WHERE data_source = 'flk'
    GROUP BY range
  `;
  console.log('\n[4] 全文长度分布:');
  lengthStats.forEach(s =>
    console.log('   ', (s.range + '').padEnd(10), ':', s.count, '条')
  );

  // 5. 随机样本
  console.log('\n[5] 随机样本（5条）:');
  const samples = await prisma.$queryRaw`
    SELECT id, law_name, law_type, category, LENGTH(full_text) as len, issuing_authority
    FROM law_articles
    WHERE data_source = 'flk'
    ORDER BY RANDOM()
    LIMIT 5
  `;
  samples.forEach(s => {
    console.log('   -', s.law_name.substring(0, 50));
    console.log(
      '     类型:',
      s.law_type,
      '| 分类:',
      s.category,
      '| 长度:',
      s.len,
      '字符'
    );
  });

  // 6. 可疑记录
  console.log('\n[6] 可疑记录:');
  const shortCount = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM law_articles
    WHERE data_source = 'flk' AND LENGTH(full_text) <= 50
  `;
  console.log('   全文过短 (<=50字符):', shortCount[0].count, '条');

  const unknownAuth = await prisma.lawArticle.count({
    where: {
      dataSource: 'flk',
      OR: [{ issuingAuthority: '未知' }, { issuingAuthority: '' }],
    },
  });
  console.log('   缺失发布机关:', unknownAuth, '条');

  console.log('\n' + '='.repeat(70));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
