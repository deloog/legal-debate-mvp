/**
 * 使用修复后的 downloadDocx 重新下载并解析失败的记录
 *
 * 关键修复：添加 format=docx 参数
 * 原始 URL: https://flk.npc.gov.cn/law-search/download/pc?bbbs={bbbs}&ossFilePath={path}
 * 修复后 URL: https://flk.npc.gov.cn/law-search/download/pc?format=docx&bbbs={bbbs}&ossFilePath={path}
 */

import { PrismaClient } from '@prisma/client';
import { FLKCrawler } from '../src/lib/crawler/flk-crawler';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('使用修复后的方法重新下载并解析失败的记录');
  console.log('='.repeat(70));
  console.log();

  // 获取所有解析失败的记录
  const allRecords = await prisma.lawArticle.findMany({
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      fullText: true,
      dataSource: true,
    },
  });

  const failedRecords = allRecords.filter(r => {
    const text = r.fullText;
    const hasHeaders = text.includes('题注') || text.includes('第一条\n第二条');
    const isShort = text.length < 500;
    return hasHeaders && isShort && r.dataSource === 'flk';
  });

  console.log(`📋 发现 ${failedRecords.length} 条解析失败的记录`);
  console.log();

  if (failedRecords.length === 0) {
    console.log('✅ 没有需要恢复的记录');
    await prisma.$disconnect();
    return;
  }

  const crawler = new FLKCrawler();
  let successCount = 0;
  let failedCount = 0;
  const failedItems: string[] = [];

  for (let i = 0; i < failedRecords.length; i++) {
    const record = failedRecords[i];
    const progress = `[${i + 1}/${failedRecords.length}]`;

    console.log(`${progress} 正在处理: ${record.lawName}`);

    try {
      // 1. 获取详情（使用修复后的方法）
      const detail = await crawler['fetchDetail'](record.articleNumber);

      if (!detail?.data?.ossFile?.ossWordPath) {
        throw new Error('API 没有返回 DOCX 下载路径');
      }

      // 2. 下载 DOCX（使用修复后的方法）
      const docxBuffer = await crawler['downloadDocx'](
        record.articleNumber,
        detail.data.ossFile.ossWordPath
      );

      console.log(`  下载大小: ${docxBuffer.length} bytes`);

      // 3. 检查文件大小
      if (docxBuffer.length < 100) {
        const responseText = docxBuffer.toString('utf-8');
        if (responseText.startsWith('{"msg"')) {
          throw new Error(`API 返回错误: ${responseText}`);
        }
        throw new Error(`文件过小 (${docxBuffer.length} bytes)`);
      }

      // 4. 解析 DOCX（使用多方法解析）
      const fullText = await crawler['parseDocxFile'](
        docxBuffer,
        record.articleNumber
      );

      if (fullText.length <= 500) {
        throw new Error(`解析的文本过短 (${fullText.length} 字符)`);
      }

      // 5. 更新数据库
      await prisma.lawArticle.update({
        where: { id: record.id },
        data: {
          fullText,
        },
      });

      console.log(`${progress} ✅ 成功 - 新长度: ${fullText.length} 字符`);
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
  console.log('恢复完成');
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

  console.log('✅ 完成！');

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('错误:', error);
  process.exit(1);
});
