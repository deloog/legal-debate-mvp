import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 检查所有合同
  const all = await prisma.contractTemplate.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      source: true,
      createdAt: true,
      updatedAt: true,
      isLatest: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('总记录数:', all.length);
  
  // 按创建日期分组
  const byDate: Record<string, number> = {};
  for (const c of all) {
    const date = c.createdAt?.toISOString().slice(0, 10);
    byDate[date] = (byDate[date] || 0) + 1;
  }
  
  console.log('\n按创建日期分布:');
  Object.entries(byDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([date, count]) => console.log(`  ${date}: ${count}`));
  
  // 检查 code 格式
  const codeFormats: Record<string, number> = {};
  for (const c of all) {
    const prefix = c.code?.split('-')[0];
    if (prefix) {
      codeFormats[prefix] = (codeFormats[prefix] || 0) + 1;
    }
  }
  
  console.log('\nCode 前缀分布:');
  Object.entries(codeFormats).forEach(([prefix, count]) => {
    console.log(`  ${prefix}: ${count}`);
  });
  
  // 显示最早的10个合同
  console.log('\n=== 最早的10个合同 ===');
  const earliest = await prisma.contractTemplate.findMany({
    orderBy: { createdAt: 'asc' },
    take: 10,
    select: { name: true, createdAt: true, code: true }
  });
  earliest.forEach((c, i) => {
    console.log(`${i+1}. ${c.createdAt?.toISOString().slice(0,10)} ${c.code} - ${c.name?.slice(0, 40)}`);
  });
  
  await prisma.$disconnect();
}

main();
