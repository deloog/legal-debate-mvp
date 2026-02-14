/**
 * 恢复仅有元数据的记录
 * 将所有元数据记录通过 DOCX 下载更新为完整内容
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

const prisma = new PrismaClient();

// 随机延迟 2-5 秒
function randomDelay(): Promise<void> {
  const delay = 2000 + Math.random() * 3000;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// 随机 User-Agent
function randomUA(): string {
  const pool = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

// 下载 DOCX 并解析
async function fetchFullText(bbbs: string, retryCount = 0): Promise<{ success: boolean; text?: string; error?: string }> {
  const API_DOWNLOAD = 'https://flk.npc.gov.cn/law-search/download/pc';

  try {
    // 1. 获取下载 URL
    const downloadUrl = `${API_DOWNLOAD}?format=docx&bbbs=${encodeURIComponent(bbbs)}`;
    
    const downloadResponse = await fetch(downloadUrl, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'application/json',
        'Referer': 'https://flk.npc.gov.cn/',
      },
    });

    if (!downloadResponse.ok) {
      throw new Error(`HTTP ${downloadResponse.status}`);
    }

    const downloadData = await downloadResponse.json();
    
    if (downloadData.code !== 200 || !downloadData.data?.url) {
      throw new Error(downloadData.msg || '无法获取下载 URL');
    }

    // 2. 下载文件
    const fileResponse = await fetch(downloadData.data.url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': '*/*',
      },
    });

    if (!fileResponse.ok) {
      throw new Error(`文件下载失败: HTTP ${fileResponse.status}`);
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer());

    // 3. 检查文件类型
    const header = buffer.subarray(0, 4).toString('hex');
    if (header !== '504b0304') {
      throw new Error('不是有效的 DOCX 文件');
    }

    // 4. 解析
    const result = await mammoth.extractRawText({ buffer });
    
    if (!result.value || result.value.length < 100) {
      throw new Error('解析后内容不足100字符');
    }

    return { success: true, text: result.value };

  } catch (error: any) {
    // 重试机制
    if (retryCount < 3) {
      console.log(`    ⚠ 重试 ${retryCount + 1}/3: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 3000 * (retryCount + 1)));
      return fetchFullText(bbbs, retryCount + 1);
    }
    
    return { success: false, error: error.message };
  }
}

async function recoverRecord(law: any): Promise<boolean> {
  console.log(`\n>>> ${law.lawName.substring(0, 40)}...`);
  console.log(`    ID: ${law.articleNumber}`);
  console.log(`    当前内容: ${law.fullText.substring(0, 60)}...`);

  const result = await fetchFullText(law.articleNumber);

  if (result.success && result.text) {
    console.log(`    ✓ 下载成功: ${result.text.length} 字符`);

    try {
      // 更新数据库
      await prisma.lawArticle.update({
        where: { id: law.id },
        data: {
          fullText: result.text,
          searchableText: `${law.lawName} ${law.issuingAuthority} ${result.text}`.substring(0, 50000),
        },
      });

      console.log(`    ✓ 数据库更新成功`);
      return true;

    } catch (error: any) {
      console.log(`    ⚠ 数据库更新失败: ${error.message}`);
      return false;
    }
  } else {
    console.log(`    ❌ 下载失败: ${result.error}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('恢复仅有元数据的记录');
  console.log('='.repeat(70));

  // 找出所有仅有元数据的记录
  const metadataOnlyLaws = await prisma.lawArticle.findMany({
    where: {
      dataSource: 'flk',
      fullText: {
        startsWith: '[元数据]',
      },
    },
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      fullText: true,
      issuingAuthority: true,
    },
  });

  console.log(`\n找到 ${metadataOnlyLaws.length} 条仅有元数据的记录`);
  console.log(`\n开始恢复...`);

  let successCount = 0;
  let failCount = 0;

  for (const law of metadataOnlyLaws) {
    const success = await recoverRecord(law);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // 随机延迟 2-5 秒
    await randomDelay();

    // 每 10 条输出进度
    if ((successCount + failCount) % 10 === 0) {
      console.log(`\n--- 进度: ${successCount + failCount}/${metadataOnlyLaws.length} ---`);
      console.log(`✓ 成功: ${successCount}, ✗ 失败: ${failCount}\n`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('恢复完成!');
  console.log('='.repeat(70));
  console.log(`✓ 成功恢复: ${successCount}/${metadataOnlyLaws.length}`);
  console.log(`✗ 失败: ${failCount}/${metadataOnlyLaws.length}`);
  console.log(`成功率: ${(successCount / metadataOnlyLaws.length * 100).toFixed(1)}%`);
  console.log('='.repeat(70));

  // 如果有失败的，列出失败的记录
  if (failCount > 0) {
    console.log('\n失败的记录:');
    const failedLaws = metadataOnlyLaws.filter(law => {
      return prisma.lawArticle.findUnique({
        where: { id: law.id },
        select: { fullText: true },
      }).then(r => r?.fullText?.startsWith('[元数据]') ?? true);
    });
    
    for (const law of failedLaws) {
      console.log(`  - ${law.lawName} (${law.articleNumber})`);
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
