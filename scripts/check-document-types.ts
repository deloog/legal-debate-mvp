/**
 * 检查不同类型文档的特征
 * 
 * 分析：
 * - 司法解释、决定、批复、决议、规定等不同类型文档的内容长度
 * - 早期 DOCX 格式的解析情况
 * - 找出可能的解析失败案例
 */

import { PrismaClient, LawType, LawCategory } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('文档类型特征分析');
  console.log('='.repeat(70));
  console.log();

  // 1. 获取所有记录
  const allRecords = await prisma.lawArticle.findMany({
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      fullText: true,
      dataSource: true,
      lawType: true,
      category: true,
    },
  });

  // 按内容长度排序
  allRecords.sort((a, b) => a.fullText.length - b.fullText.length);

  // 2. 按文档类型分类（通过 lawName 判断）
  const typeKeywords = {
    '司法解释': [
      '解释', '最高人民法院关于', '最高人民检察院关于', 
      '司法解释', '批复', '答复', '复函'
    ],
    '决定': ['决定', '全国人民代表大会关于', '全国人大常委会关于'],
    '批复': ['批复', '答复', '函'],
    '决议': ['决议'],
    '规定': ['规定'],
    '办法': ['办法'],
    '通知': ['通知'],
    '法律': ['法'],
    '行政法规': ['条例', '实施细则'],
  };

  const classifyDocument = (lawName: string): string => {
    for (const [type, keywords] of Object.entries(typeKeywords)) {
      for (const keyword of keywords) {
        if (lawName.includes(keyword)) {
          return type;
        }
      }
    }
    return '其他';
  };

  // 3. 按类型分组
  const byType = new Map<string, typeof allRecords>();
  allRecords.forEach(record => {
    const type = classifyDocument(record.lawName);
    const current = byType.get(type) || [];
    current.push(record);
    byType.set(type, current);
  });

  // 4. 统计各类型的长度分布
  console.log('📊 各类型文档的内容长度分布：');
  console.log();
  console.log(
    '类型'.padEnd(12) + '| 数量'.padStart(6) + 
    '| 最小'.padStart(8) + '| 最大'.padStart(8) + 
    '| 平均'.padStart(8) + '| 中位数'.padStart(8)
  );
  console.log('-'.repeat(70));

  const typeStats: { type: string; count: number; min: number; max: number; avg: number; median: number }[] = [];

  for (const [type, records] of Array.from(byType.entries()).sort((a: [string, any[]], b: [string, any[]]) => b[1].length - a[1].length)) {
    if (!records || records.length === 0) continue;

    const lengths = records.map((r: any) => r.fullText ? r.fullText.length : 0).sort((a: number, b: number) => a - b);
    const min = lengths[0] || 0;
    const max = lengths[lengths - 1] || 0;
    const avg = lengths.length > 0 ? lengths.reduce((a: number, b: number) => a + b, 0) / lengths.length : 0;
    const median = lengths[Math.floor(lengths.length / 2)] || 0;

    typeStats.push({ type, count: records.length, min, max, avg, median });

    console.log(
      `${type.padEnd(12)}| ${records.length.toString().padStart(5)}  | ${min.toString().padStart(7)} | ${max.toString().padStart(7)} | ${Math.round(avg).toString().padStart(7)} | ${median.toString().padStart(7)}`
    );
  }

  console.log();

  // 5. 识别可能解析失败的记录
  console.log('🔍 可能解析失败的记录（内容异常短）：');
  console.log();

  const possiblyFailed = allRecords.filter(r => r.fullText.length < 50 && r.dataSource === 'flk');

  if (possiblyFailed.length === 0) {
    console.log('✅ 没有发现明显解析失败的记录');
  } else {
    console.log(`⚠️  发现 ${possiblyFailed.length} 条可能解析失败的记录：`);
    console.log();
    possiblyFailed.slice(0, 10).forEach((record, idx) => {
      console.log(`${idx + 1}. ${record.lawName}`);
      console.log(`   类型: ${classifyDocument(record.lawName)}`);
      console.log(`   ID: ${record.articleNumber.substring(0, 30)}...`);
      console.log(`   内容: ${record.fullText.substring(0, 80)}...`);
      console.log();
    });

    if (possiblyFailed.length > 10) {
      console.log(`... 还有 ${possiblyFailed.length - 10} 条\n`);
    }
  }


  // 7. 按分类统计
  console.log('� 按分类统计：');
  console.log();

  const byCategory = new Map<string, number>();
  allRecords.forEach(record => {
    byCategory.set(record.category, (byCategory.get(record.category) || 0) + 1);
  });

  console.log('分类'.padEnd(25) + '| 数量');
  console.log('-'.repeat(35));
  Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`${category.padEnd(25)}| ${count}`);
    });

  console.log();

  // 8. 建议
  console.log('='.repeat(70));
  console.log('分析结论和建议：');
  console.log('='.repeat(70));
  console.log();

  console.log('1. 不同类型文档的内容长度特征：');
  typeStats.slice(0, 5).forEach(({ type, min, max, avg, median }) => {
    console.log(`   ${type}: 最小 ${min} 字符, 最大 ${max} 字符, 平均 ${Math.round(avg)} 字符`);
  });
  console.log();

  console.log('2. 建议的验证标准：');
  console.log('   - 法律、行政法规: >1000 字符');
  console.log('   - 司法解释: >500 字符（可能较短）');
  console.log('   - 决定、决议: >300 字符（可能很短）');
  console.log('   - 批复、答复: >100 字符（可能非常短）');
  console.log('   - 规定、办法: >300 字符');
  console.log();

  console.log('3. 早期 DOCX 格式处理：');
  console.log('   - 需要增强 DOCX 解析器以支持旧格式');
  console.log('   - 对于解析失败的情况，尝试备用解析方法');
  console.log('   - 记录解析失败的文档以便后续人工处理');
  console.log();

  console.log('4. 采集策略：');
  console.log('   - 对于早期文档，增加重试次数');
  console.log('   - 记录 DOCX 文件大小和解析结果');
  console.log('   - 对于解析失败但文件下载成功的情况，标记为"需人工处理"');

  await prisma.$disconnect();
}

main().catch(console.error);
