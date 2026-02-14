/**
 * 重新解析失败的记录 - 从在线重新下载
 * 
 * 针对 38 条解析失败的记录：
 * - 从国家法律法规库重新下载 DOCX 文件
 * - 使用改进的 DOCX 解析器
 * - 支持旧格式 DOCX
 * - 多方法解析降级
 */

import { PrismaClient, LawType, LawCategory } from '@prisma/client';
import { docxParser } from '../src/lib/crawler/docx-parser';
import { FLKCrawler } from '../src/lib/crawler/flk-crawler';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('重新解析失败的记录（从在线重新下载）');
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

  console.log('⚠️  即将重新解析这些记录');
  console.log('   这将从国家法律法规库重新下载 DOCX 文件并解析');
  console.log();

  let successCount = 0;
  let failedCount = 0;
  const failedItems: string[] = [];

  const crawler = new FLKCrawler();

  for (let i = 0; i < failedRecords.length; i++) {
    const record = failedRecords[i];
    const progress = `[${i + 1}/${failedRecords.length}]`;

    console.log(`${progress} 正在处理: ${record.lawName}`);

    try {
      // 从 articleNumber 提取文档 ID
      const docId = record.articleNumber;

      // 获取详情
      const detail = await crawler['fetchDetail'](docId);
      
      if (!detail?.data?.ossFile?.ossWordPath) {
        throw new Error('无法获取 DOCX 下载路径');
      }

      // 下载 DOCX
      const docxBuffer = await crawler['downloadDocx'](docId, detail.data.ossFile.ossWordPath);

      if (docxBuffer.length < 100) {
        throw new Error(`文件过小 (${docxBuffer.length} bytes)`);
      }

      console.log(`${progress} 下载完成: ${docxBuffer.length} bytes`);

      // 解析
      const doc = await docxParser.parse(docxBuffer, `flk://${docId}`);
      
      if (!doc || !doc.fullText || doc.fullText.length <= 500) {
        throw new Error('解析结果不完整');
      }

      // 更新数据库
      await prisma.lawArticle.update({
        where: { id: record.id },
        data: {
          fullText: doc.fullText,
        },
      });

      console.log(`${progress} ✅ 成功 - 新长度: ${doc.fullText.length} 字符`);
      successCount++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`${progress} ❌ 失败 - ${errorMsg}`);
      failedCount++;
      failedItems.push(`${record.lawName}: ${errorMsg}`);
    }

    console.log();

    // 每 5 条记录休息一下
    if ((i + 1) % 5 === 0) {
      console.log('休息 2 秒...');
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
  console.log('  - 检查国家法律法规库是否有该文件');
  console.log('  - 考虑使用其他解析方法');

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('错误:', error);
  process.exit(1);
});
