/**
 * 短全文记录修复脚本
 *
 * 功能：
 * 1. 统计并查询全文长度较短的记录
 * 2. 尝试通过 FLK API 重新获取详情以修复数据
 * 3. 对无法恢复的记录，标记为 NEED_UPDATE 状态
 *
 * 执行方式：npx tsx scripts/fix-short-fulltext.ts
 */

import { PrismaClient, SyncStatus } from '@prisma/client';
import { flkCrawler } from '../src/lib/crawler/flk-crawler';

const prisma = new PrismaClient();

/** 短全文阈值（字符数） */
const SHORT_TEXT_THRESHOLD = 200;

async function main(): Promise<void> {
  console.log('[fix-short-fulltext] 开始修复短全文记录...');
  console.log(`阈值: ${SHORT_TEXT_THRESHOLD} 字符\n`);

  // 步骤 1：统计 FLK 数据总数
  const totalCount = await prisma.lawArticle.count({
    where: {
      dataSource: 'flk',
    },
  });

  console.log(`[统计] FLK 数据总数: ${totalCount}`);

  // 步骤 2：查询需要修复的记录
  console.log(`\n[查询] 获取需要修复的记录...`);

  // 使用 Prisma 查询短全文记录
  const shortRecords = await prisma.lawArticle.findMany({
    where: {
      dataSource: 'flk',
      OR: [
        { fullText: { equals: '' } },
        { fullText: { equals: ' ' } },
      ],
    },
    take: 100,
    orderBy: { fullText: 'asc' },
  });

  console.log(`[查询] 找到 ${shortRecords.length} 条需要修复的记录`);

  if (shortRecords.length === 0) {
    console.log('\n[完成] 没有需要修复的短全文记录');
    return;
  }

  // 步骤 3：输出样本记录
  console.log('\n[样本] 待修复记录（前5条）:');
  shortRecords.slice(0, 5).forEach((record, i) => {
    console.log(`  ${i + 1}. ${record.lawName}`);
    console.log(`     ID: ${record.sourceId || 'N/A'}`);
    console.log(`     全文长度: ${record.fullText.length} 字符`);
    console.log(`     发布机关: ${record.issuingAuthority}`);
  });

  // 步骤 4：尝试重新获取并修复
  let fixedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  console.log('\n[修复] 开始逐条修复...');

  for (let i = 0; i < shortRecords.length; i++) {
    const record = shortRecords[i];
    console.log(`  [${i + 1}/${shortRecords.length}] ${record.lawName.substring(0, 40)}...`);

    try {
      if (!record.sourceId) {
        console.log(`    - 跳过: 缺少 sourceId`);
        skippedCount++;
        continue;
      }

      // 尝试从 FLK API 获取详情
      const detail = await flkCrawler.fetchDetail(record.sourceId);

      if (detail?.code === 200 && detail.data?.content) {
        // 更新 fullText
        await prisma.lawArticle.update({
          where: { id: record.id },
          data: {
            fullText: detail.data.content,
            syncStatus: SyncStatus.SYNCED,
            lastSyncedAt: new Date(),
          },
        });
        console.log(`    - 成功: 从 API 获取新内容，${detail.data.content.length} 字符`);
        fixedCount++;
      } else {
        // 无法恢复，标记为需要更新
        await prisma.lawArticle.update({
          where: { id: record.id },
          data: { syncStatus: SyncStatus.NEED_UPDATE },
        });
        console.log(`    - 标记为 NEED_UPDATE`);
        skippedCount++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`[${record.lawName}] ${msg}`);
      console.error(`    - 错误: ${msg}`);

      // 标记为需要更新
      await prisma.lawArticle.update({
        where: { id: record.id },
        data: { syncStatus: SyncStatus.NEED_UPDATE },
      });
      skippedCount++;
    }

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 步骤 5：输出统计
  console.log('\n' + '='.repeat(60));
  console.log('[修复统计]');
  console.log(`  总计处理: ${shortRecords.length} 条`);
  console.log(`  成功修复: ${fixedCount} 条`);
  console.log(`  标记跳过: ${skippedCount} 条`);
  console.log('='.repeat(60));

  if (errors.length > 0) {
    console.log('\n[错误详情]');
    errors.slice(0, 5).forEach(e => console.log(`  - ${e}`));
    if (errors.length > 5) {
      console.log(`  ... 共 ${errors.length} 条错误`);
    }
  }

  console.log('\n[建议]');
  console.log('  1. 失败的记录需要人工检查或重新采集');
  console.log('  2. 可运行脚本重新尝试修复标记为 NEED_UPDATE 的记录');
  console.log('  3. 考虑检查 data/crawled/flk/ 目录中的 DOCX 文件是否完整');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
