/**
 * 重新解析失败的记录
 *
 * 针对 38 条解析失败的记录：
 * - 使用改进的 DOCX 解析器
 * - 支持旧格式 DOCX
 * - 多方法解析降级
 */

import { PrismaClient, LawType, LawCategory } from '@prisma/client';
import { docxParser } from '../src/lib/crawler/docx-parser';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('重新解析失败的记录');
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

  // 识别解析失败的记录
  const failedRecords = allRecords.filter(r => {
    const text = r.fullText;
    const hasHeaders = text.includes('题注') || text.includes('第一条\n第二条');
    const isShort = text.length < 500;
    return hasHeaders && isShort && r.dataSource === 'flk';
  });

  console.log(`📋 发现 ${failedRecords.length} 条解析失败的记录`);
  console.log();

  if (failedRecords.length === 0) {
    console.log('✅ 没有需要重新解析的记录');
    await prisma.$disconnect();
    return;
  }

  // 显示前 10 条
  console.log('前 10 条记录：');
  console.log();
  failedRecords.slice(0, 10).forEach((record, idx) => {
    console.log(`${idx + 1}. ${record.lawName}`);
    console.log(`   当前长度: ${record.fullText.length} 字符`);
    console.log();
  });

  if (failedRecords.length > 10) {
    console.log(`... 还有 ${failedRecords.length - 10} 条\n`);
  }

  // 询问是否继续
  console.log('⚠️  即将重新解析这些记录');
  console.log('   这将从国家法律法规库重新下载 DOCX 文件并解析');
  console.log('   按任意键继续，或 Ctrl+C 取消...');
  console.log();

  // 在实际运行时，可以去掉这个确认
  // await new Promise(resolve => process.stdin.once('data', resolve));

  let successCount = 0;
  let failedCount = 0;
  const failedItems: string[] = [];

  for (let i = 0; i < failedRecords.length; i++) {
    const record = failedRecords[i];
    const progress = `[${i + 1}/${failedRecords.length}]`;

    console.log(`${progress} 正在处理: ${record.lawName}`);

    try {
      // 从 articleNumber 提取文档 ID
      // articleNumber 格式: flk-{id}
      const docId = record.articleNumber;

      // 使用 FLK crawler 的 reparseFailed 方法
      // 先确保文件已下载到磁盘
      const { flkCrawler } = await import('../src/lib/crawler/flk-crawler');

      // 使用 crawler-daemon 的重新解析逻辑
      // 直接从磁盘文件重新解析
      const fs = await import('fs');
      const path = await import('path');

      // 检查是否有已下载的 DOCX 文件
      const docxPath = path.join(
        'data',
        'crawled',
        'flk',
        'flfg',
        `${docId}.docx`
      );

      if (!fs.existsSync(docxPath)) {
        throw new Error(`文件不存在: ${docxPath}`);
      }

      // 读取文件
      const buffer = fs.readFileSync(docxPath);

      // 使用改进的解析器解析
      const doc = await docxParser.parse(buffer, `flk://${docId}`);

      if (!doc || !doc.fullText || doc.fullText.length <= 500) {
        throw new Error('解析结果不完整');
      }

      const result = { fullText: doc.fullText };

      if (result && result.fullText && result.fullText.length > 500) {
        // 更新数据库
        await prisma.lawArticle.update({
          where: { id: record.id },
          data: {
            fullText: result.fullText,
          },
        });

        console.log(
          `${progress} ✅ 成功 - 新长度: ${result.fullText.length} 字符`
        );
        successCount++;
      } else {
        console.log(`${progress} ❌ 失败 - 解析结果仍然不完整`);
        failedCount++;
        failedItems.push(record.lawName);
      }
    } catch (error) {
      console.log(`${progress} ❌ 失败 - ${String(error)}`);
      failedCount++;
      failedItems.push(record.lawName);
    }

    console.log();

    // 每 5 条记录休息一下
    if ((i + 1) % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // 输出总结
  console.log('='.repeat(70));
  console.log('重新解析完成');
  console.log('='.repeat(70));
  console.log();
  console.log(`总记录数: ${failedRecords.length}`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${failedCount}`);
  console.log();

  if (failedItems.length > 0) {
    console.log('失败的记录：');
    console.log();
    failedItems.forEach(item => console.log(`  - ${item}`));
    console.log();
  }

  console.log('建议：');
  console.log('  - 对于仍然失败的记录，可能需要人工处理');
  console.log('  - 检查 DOCX 文件是否可以正常下载');
  console.log('  - 考虑使用其他解析方法');

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('错误:', error);
  process.exit(1);
});
