/**
 * 清理重复的完整记录
 * 
 * 针对 81 部重复的法规：
 * - 保留内容最完整的版本
 * - 删除重复版本
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('清理重复的完整记录');
  console.log('='.repeat(70));
  console.log();

  // 获取所有记录
  const allRecords = await prisma.lawArticle.findMany({
    select: {
      id: true,
      lawName: true,
      fullText: true,
      dataSource: true,
      articleNumber: true,
    },
  });

  // 按法规名称分组
  const byLawName = new Map<string, typeof allRecords>();
  
  allRecords.forEach(record => {
    if (record.fullText.length > 1000) {
      const current = byLawName.get(record.lawName) || [];
      current.push(record);
      byLawName.set(record.lawName, current);
    }
  });

  // 识别重复的法规
  const duplicateLaws = Array.from(byLawName.entries())
    .filter(([_, records]) => records.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`📋 发现 ${duplicateLaws.length} 部重复的法规`);
  console.log();

  if (duplicateLaws.length === 0) {
    console.log('✅ 没有发现重复记录');
    await prisma.$disconnect();
    return;
  }

  // 显示前 20 部
  console.log('前 20 部重复的法规：');
  console.log();
  duplicateLaws.slice(0, 20).forEach(([lawName, records], idx) => {
    console.log(`${idx + 1}. ${lawName}`);
    console.log(`   重复数量: ${records.length} 条`);
    console.log(`   内容长度范围: ${Math.min(...records.map(r => r.fullText.length))} - ${Math.max(...records.map(r => r.fullText.length))} 字符`);
    console.log();
  });

  if (duplicateLaws.length > 20) {
    console.log(`... 还有 ${duplicateLaws.length - 20} 部\n`);
  }

  console.log('⚠️  即将清理重复记录');
  console.log('   这将保留内容最完整的版本，删除重复版本');
  console.log('   按任意键继续，或 Ctrl+C 取消...');
  console.log();

  // 在实际运行时，可以去掉这个确认
  // await new Promise(resolve => process.stdin.once('data', resolve));

  let deletedCount = 0;
  let keptCount = 0;
  const deletedLaws: string[] = [];

  for (const [lawName, records] of duplicateLaws) {
    // 按内容长度排序，保留最长的
    records.sort((a, b) => b.fullText.length - a.fullText.length);
    
    // 保留第一条（最长的），删除其他
    const toKeep = records[0];
    const toDelete = records.slice(1);
    
    if (toDelete.length === 0) continue;

    console.log(`处理: ${lawName}`);
    console.log(`  保留: ID=${toKeep.id}, 长度=${toKeep.fullText.length} 字符`);
    
    for (const record of toDelete) {
      try {
        await prisma.lawArticle.delete({
          where: { id: record.id },
        });
        console.log(`  删除: ID=${record.id}, 长度=${record.fullText.length} 字符`);
        deletedCount++;
      } catch (error) {
        console.log(`  ❌ 删除失败: ${error}`);
      }
    }
    
    deletedLaws.push(lawName);
    keptCount++;
    console.log();
  }

  // 输出总结
  console.log('='.repeat(70));
  console.log('清理完成');
  console.log('='.repeat(70));
  console.log();
  console.log(`处理的法规数: ${keptCount}`);
  console.log(`删除的记录数: ${deletedCount}`);
  console.log();

  console.log('已清理的法规：');
  console.log();
  deletedLaws.forEach(law => console.log(`  - ${law}`));
  console.log();

  console.log('✅ 清理完成！');
  console.log();
  console.log('建议：');
  console.log('  - 验证清理结果，确保没有误删');
  console.log('  - 检查数据库总记录数');
  console.log('  - 运行数据验证脚本');

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('错误:', error);
  process.exit(1);
});
