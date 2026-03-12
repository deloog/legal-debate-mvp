import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.contractTemplate.count();
  const withContent = await prisma.contractTemplate.count({
    where: {
      content: {
        not: ''
      }
    }
  });
  const withFullText = await prisma.contractTemplate.count({
    where: {
      fullText: {
        not: ''
      }
    }
  });
  
  console.log('=== 合同模板统计 ===');
  console.log(`总数: ${total}`);
  console.log(`有content: ${withContent}`);
  console.log(`有fullText: ${withFullText}`);
  
  // 显示前10个
  const templates = await prisma.contractTemplate.findMany({
    take: 10,
    select: { name: true, category: true, source: true }
  });
  console.log('\n前10个合同:');
  templates.forEach((t, i) => console.log(`${i+1}. [${t.category}] ${t.name}`));
  
  await prisma.$disconnect();
}

main();
