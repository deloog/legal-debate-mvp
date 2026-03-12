/**
 * 从 API content 字段恢复失败的记录
 *
 * 问题分析：
 * - 详情 API 返回成功，包含完整的 content 结构
 * - 下载 DOCX 失败，返回 500 错误
 * - 解决方案：直接从 content 字段提取文本
 */

import { PrismaClient } from '@prisma/client';
import { FLKCrawler } from '../src/lib/crawler/flk-crawler';

const prisma = new PrismaClient();

/**
 * 从 API content 提取完整文本
 */
function extractTextFromContent(content: any): string {
  if (!content) return '';

  const lines: string[] = [];

  function traverse(node: any) {
    if (!node) return;

    // 添加标题
    if (node.title) {
      lines.push(node.title);
    }

    // 递归处理子节点
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(content);

  return lines.join('\n');
}

async function main() {
  console.log('='.repeat(70));
  console.log('从 API content 字段恢复失败的记录');
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
      // 获取详情
      const detail = await crawler['fetchDetail'](record.articleNumber);

      if (!detail?.data?.content) {
        throw new Error('API 没有返回 content');
      }

      // 从 content 提取文本
      const extractedText = extractTextFromContent(detail.data.content);

      if (extractedText.length <= 500) {
        throw new Error(`提取的文本过短 (${extractedText.length} 字符)`);
      }

      // 更新数据库
      await prisma.lawArticle.update({
        where: { id: record.id },
        data: {
          fullText: extractedText,
        },
      });

      console.log(`${progress} ✅ 成功 - 新长度: ${extractedText.length} 字符`);
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
      console.log('休息 1 秒...');
      await new Promise(resolve => setTimeout(resolve, 1000));
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
