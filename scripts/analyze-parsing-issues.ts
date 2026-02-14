/**
 * 分析解析问题
 * 
 * 发现的问题：
 * 1. 短记录（<500字符）的内容格式显示为"题注\n第一条\n第二条..."
 * 2. 这些记录只提取了标题和目录，没有提取完整内容
 * 3. 可能是早期文档（1978-1980年代）的 DOCX 格式不兼容
 * 4. 存在重复的完整法规记录
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('解析问题分析报告');
  console.log('='.repeat(70));
  console.log();

  // 获取所有记录
  const allRecords = await prisma.lawArticle.findMany({
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      fullText: true,
      dataSource: true,
      category: true,
      lawType: true,
    },
  });

  // 1. 识别解析失败的记录
  const failedRecords = allRecords.filter(r => {
    const text = r.fullText;
    // 特征：包含"题注"或"第一条\n第二条\n"但内容很短
    const hasHeaders = text.includes('题注') || text.includes('第一条\n第二条');
    const isShort = text.length < 500;
    return hasHeaders && isShort && r.dataSource === 'flk';
  });

  console.log('🔍 解析失败的记录：');
  console.log();
  console.log(`总数: ${failedRecords.length} 条`);
  console.log();

  failedRecords.slice(0, 20).forEach((record, idx) => {
    console.log(`${idx + 1}. ${record.lawName}`);
    console.log(`   类型: ${record.lawType}`);
    console.log(`   分类: ${record.category}`);
    console.log(`   内容长度: ${record.fullText.length} 字符`);
    console.log(`   内容特征: ${record.fullText.includes('题注') ? '有题注' : '无题注'}, ${record.fullText.includes('第一条\n第二条') ? '有条款列表' : '无条款列表'}`);
    console.log(`   内容预览: ${record.fullText.substring(0, 100)}...`);
    console.log();
  });

  if (failedRecords.length > 20) {
    console.log(`... 还有 ${failedRecords.length - 20} 条\n`);
  }

  // 2. 按类型统计解析失败
  const byType = new Map<string, number>();
  failedRecords.forEach(r => {
    byType.set(r.lawType, (byType.get(r.lawType) || 0) + 1);
  });

  console.log('📊 按类型统计：');
  console.log();
  Array.from(byType.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count} 条`);
    });
  console.log();

  // 3. 按分类统计
  const byCategory = new Map<string, number>();
  failedRecords.forEach(r => {
    byCategory.set(r.category, (byCategory.get(r.category) || 0) + 1);
  });

  console.log('📊 按分类统计：');
  console.log();
  Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`   ${category}: ${count} 条`);
    });
  console.log();

  // 4. 分析内容模式
  console.log('📝 内容模式分析：');
  console.log();

  const withTizhu = failedRecords.filter(r => r.fullText.includes('题注'));
  const withTiaomu = failedRecords.filter(r => r.fullText.includes('第一条\n第二条'));
  const withBoth = failedRecords.filter(r => r.fullText.includes('题注') && r.fullText.includes('第一条\n第二条'));

  console.log(`   包含"题注"的记录: ${withTizhu.length} 条`);
  console.log(`   包含"第一条\n第二条"的记录: ${withTiaomu.length} 条`);
  console.log(`   同时包含两者的记录: ${withBoth.length} 条`);
  console.log();

  // 5. 检查重复的完整记录
  console.log('🔁 重复的完整记录（同一法规名称，内容>1000字符）：');
  console.log();

  const byLawName = new Map<string, typeof allRecords>();
  allRecords.forEach(record => {
    if (record.fullText.length > 1000) {
      const current = byLawName.get(record.lawName) || [];
      current.push(record);
      byLawName.set(record.lawName, current);
    }
  });

  const duplicateLaws = Array.from(byLawName.entries())
    .filter(([_, records]) => records.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  if (duplicateLaws.length === 0) {
    console.log('✅ 没有发现重复的完整记录');
  } else {
    console.log(`⚠️  发现 ${duplicateLaws.length} 部重复的法规：`);
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
  }

  // 6. 总结和建议
  console.log('='.repeat(70));
  console.log('总结和建议');
  console.log('='.repeat(70));
  console.log();

  console.log('1. 解析失败的原因：');
  console.log('   - DOCX 解析器可能无法处理旧格式文档');
  console.log('   - 只提取了段落标题（题注、第一条等），没有提取段落内容');
  console.log('   - 早期文档（1978-1980年代）使用了不同的格式标准');
  console.log();

  console.log('2. 需要处理的记录：');
  console.log(`   - 解析失败的记录: ${failedRecords.length} 条`);
  console.log(`   - 重复的完整记录: ${duplicateLaws.length} 部`);
  console.log();

  console.log('3. 建议的处理方案：');
  console.log();
  console.log('   A. 对于解析失败的记录：');
  console.log('      - 重新下载 DOCX 文件并尝试解析');
  console.log('      - 使用备用解析方法（如纯文本提取）');
  console.log('      - 对于仍然失败的，标记为"需人工处理"');
  console.log();
  console.log('   B. 对于重复的完整记录：');
  console.log('      - 保留内容最完整的版本');
  console.log('      - 删除重复版本');
  console.log();
  console.log('   C. 改进 DOCX 解析器：');
  console.log('      - 增加对旧格式 DOCX 的支持');
  console.log('      - 添加解析结果验证（检测"题注+条款列表"模式）');
  console.log('      - 对于解析失败的情况，尝试多种解析方法');
  console.log();

  console.log('4. 验证标准：');
  console.log('   - 法律、行政法规: >1000 字符');
  console.log('   - 司法解释: >500 字符');
  console.log('   - 决定、决议: >300 字符');
  console.log('   - 批复、答复: >100 字符');
  console.log('   - 办法、规定: >300 字符');
  console.log();

  await prisma.$disconnect();
}

main().catch(console.error);
