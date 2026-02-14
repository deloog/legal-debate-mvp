/**
 * 检查并修复不完整的法规记录
 * 
 * 功能：
 * 1. 查找内容长度不足的记录
 * 2. 尝试重新下载 DOCX 文件
 * 3. 更新数据库中的内容
 */

import { PrismaClient, LawType, LawCategory, LawStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

const prisma = new PrismaClient();

interface IncompleteRecord {
  id: string;
  lawName: string;
  articleNumber: string;
  fullTextLength: number;
  currentContent: string;
  lawType: LawType;
  category: LawCategory;
}

const CONFIG = {
  MIN_CONTENT_LENGTH: 100,  // 最小内容长度（字符）
  API_DETAIL: 'https://flk.npc.gov.cn/law-search/search/flfgDetails',
  API_DOWNLOAD: 'https://flk.npc.gov.cn/law-search/download/pc',
  MAX_RETRIES: 5,
  DELAY_MS: 3000,
};

function randomUA(): string {
  const pool = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取下载 URL
 */
async function getDownloadUrl(bbbs: string, retryCount = 0): Promise<string | null> {
  const url = `${CONFIG.API_DOWNLOAD}?format=docx&bbbs=${encodeURIComponent(bbbs)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'application/json',
        'Referer': 'https://flk.npc.gov.cn/',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    if (json.code !== 200 || !json.data?.url) {
      throw new Error(json.msg || '无法获取下载 URL');
    }

    return json.data.url;
  } catch (error: any) {
    if (retryCount < CONFIG.MAX_RETRIES) {
      await delay(3000 * (retryCount + 1));
      return getDownloadUrl(bbbs, retryCount + 1);
    }
    return null;
  }
}

/**
 * 下载 DOCX 文件
 */
async function downloadDocx(downloadUrl: string, retryCount = 0): Promise<Buffer | null> {
  try {
    const response = await fetch(downloadUrl, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch (error: any) {
    if (retryCount < CONFIG.MAX_RETRIES) {
      await delay(2000 * (retryCount + 1));
      return downloadDocx(downloadUrl, retryCount + 1);
    }
    return null;
  }
}

/**
 * 解析 DOCX 文件
 */
async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch {
    return '';
  }
}

/**
 * 从 API content 提取文本
 */
function extractTextFromContent(content: any): string {
  if (!content) return '';
  const texts: string[] = [];

  function traverse(node: any) {
    if (typeof node === 'string') {
      texts.push(node);
    } else if (node && typeof node === 'object') {
      if (node.title) texts.push(node.title);
      if (node.text) texts.push(node.text);
      if (node.content) traverse(node.content);
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    }
  }

  traverse(content);
  return texts.join('\n').trim();
}

/**
 * 修复单条记录
 */
async function fixRecord(record: IncompleteRecord): Promise<{ success: boolean; contentLength: number; error?: string }> {
  console.log(`\n>>> 修复: ${record.lawName}`);
  console.log(`    ID: ${record.articleNumber}`);
  console.log(`    当前内容: ${record.fullTextLength} 字符`);

  try {
    // 1. 获取详情
    const detailResponse = await fetch(`${CONFIG.API_DETAIL}?bbbs=${encodeURIComponent(record.articleNumber)}`, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'application/json',
        'Referer': 'https://flk.npc.gov.cn/',
      },
    });

    const detail = await detailResponse.json();
    if (detail.code !== 200 || !detail.data) {
      return { success: false, contentLength: record.fullTextLength, error: `API 失败: ${detail.msg}` };
    }

    // 2. 尝试从 content 提取
    let fullText = extractTextFromContent(detail.data.content);

    // 3. 如果 content 为空，下载 DOCX
    if (!fullText || fullText.length < CONFIG.MIN_CONTENT_LENGTH) {
      let downloadSuccess = false;
      let docxRetryCount = 0;

      while (!downloadSuccess && docxRetryCount < CONFIG.MAX_RETRIES) {
        const downloadUrl = await getDownloadUrl(record.articleNumber);

        if (downloadUrl) {
          const buffer = await downloadDocx(downloadUrl);

          if (buffer && buffer.length > 1000) {
            const parsedText = await parseDocx(buffer);

            if (parsedText && parsedText.length >= CONFIG.MIN_CONTENT_LENGTH) {
              fullText = parsedText;
              downloadSuccess = true;
              console.log(`    ✓ DOCX: ${buffer.length} bytes, ${parsedText.length} chars`);
            } else {
              console.log(`    ⚠ DOCX 解析失败 (尝试 ${docxRetryCount + 1}/${CONFIG.MAX_RETRIES})`);
            }
          } else {
            console.log(`    ⚠ DOCX 下载失败 (尝试 ${docxRetryCount + 1}/${CONFIG.MAX_RETRIES})`);
          }
        } else {
          console.log(`    ⚠ 获取下载 URL 失败 (尝试 ${docxRetryCount + 1}/${CONFIG.MAX_RETRIES})`);
        }

        docxRetryCount++;
        if (!downloadSuccess) {
          await delay(CONFIG.DELAY_MS);
        }
      }
    }

    // 4. 检查是否成功获取内容
    if (!fullText || fullText.length < CONFIG.MIN_CONTENT_LENGTH) {
      return { 
        success: false, 
        contentLength: record.fullTextLength, 
        error: '无法获取完整内容' 
      };
    }

    // 5. 更新数据库
    await prisma.lawArticle.update({
      where: { id: record.id },
      data: {
        fullText,
        searchableText: `${record.lawName} ${fullText}`.substring(0, 50000),
      },
    });

    console.log(`    ✅ 已更新: ${fullText.length} 字符`);
    return { success: true, contentLength: fullText.length };

  } catch (error: any) {
    console.log(`    ❌ 修复失败: ${error.message}`);
    return { success: false, contentLength: record.fullTextLength, error: error.message };
  }
}


/**
 * 获取所有不完整记录（带实际内容长度）
 */
async function getAllIncompleteRecords(minLength: number = CONFIG.MIN_CONTENT_LENGTH): Promise<IncompleteRecord[]> {
  const allRecords = await prisma.lawArticle.findMany({
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      fullText: true,
      lawType: true,
      category: true,
      dataSource: true,
    },
  });

  // 筛选内容不完整的记录（不限制数据源）
  return allRecords
    .map(record => ({
      ...record,
      fullTextLength: record.fullText.length,
      currentContent: record.fullText.substring(0, 100),
    }))
    .filter(record => 
      record.fullTextLength < minLength ||
      record.fullText.startsWith('[元数据]') ||
      record.fullText.startsWith('元数据')
    );
}

async function main() {
  console.log('='.repeat(70));
  console.log('检查并修复不完整的法规记录');
  console.log('='.repeat(70));
  console.log(`最小内容长度阈值: ${CONFIG.MIN_CONTENT_LENGTH} 字符\n`);

  // 查找不完整的记录
  const incompleteRecords = await getAllIncompleteRecords(CONFIG.MIN_CONTENT_LENGTH);
  
  console.log(`找到 ${incompleteRecords.length} 条不完整的记录\n`);

  if (incompleteRecords.length === 0) {
    console.log('✅ 所有记录内容完整！');
    return;
  }

  // 按内容长度分组统计
  const lengthGroups = {
    '0-50': 0,
    '51-100': 0,
    '101-500': 0,
    '500+': 0,
  };

  incompleteRecords.forEach(record => {
    if (record.fullTextLength <= 50) lengthGroups['0-50']++;
    else if (record.fullTextLength <= 100) lengthGroups['51-100']++;
    else if (record.fullTextLength <= 500) lengthGroups['101-500']++;
    else lengthGroups['500+']++;
  });

  console.log('内容长度分布:');
  Object.entries(lengthGroups).forEach(([range, count]) => {
    if (count > 0) console.log(`  ${range} 字符: ${count} 条`);
  });

  // 显示前 10 条不完整记录
  console.log('\n前 10 条不完整记录:');
  incompleteRecords.slice(0, 10).forEach((record, idx) => {
    console.log(`  ${idx + 1}. ${record.lawName}`);
    console.log(`     ID: ${record.articleNumber.substring(0, 15)}...`);
    console.log(`     内容: ${record.fullTextLength} 字符`);
    console.log(`     预览: ${record.currentContent}...`);
  });

  if (incompleteRecords.length > 10) {
    console.log(`  ... 还有 ${incompleteRecords.length - 10} 条`);
  }

  // 询问是否继续修复
  console.log('\n' + '='.repeat(70));
  console.log('开始修复...');
  console.log('='.repeat(70) + '\n');

  let successCount = 0;
  let failCount = 0;
  const errors: { record: string; error: string }[] = [];

  // 修复记录
  for (let i = 0; i < incompleteRecords.length; i++) {
    const record = incompleteRecords[i];
    console.log(`\n[${i + 1}/${incompleteRecords.length}]`);

    const result = await fixRecord(record);

    if (result.success) {
      successCount++;
    } else {
      failCount++;
      errors.push({
        record: `${record.lawName} (${record.articleNumber})`,
        error: result.error || '未知错误',
      });
    }

    // 延迟避免被限流
    if (i < incompleteRecords.length - 1) {
      await delay(CONFIG.DELAY_MS);
    }
  }

  // 输出结果
  console.log('\n' + '='.repeat(70));
  console.log('修复完成');
  console.log('='.repeat(70));
  console.log(`✅ 成功修复: ${successCount} 条`);
  console.log(`❌ 修复失败: ${failCount} 条`);
  console.log(`📊 成功率: ${((successCount / incompleteRecords.length) * 100).toFixed(2)}%`);

  if (errors.length > 0) {
    console.log('\n失败记录:');
    errors.slice(0, 10).forEach(({ record, error }) => {
      console.log(`  ⚠ ${record}`);
      console.log(`    原因: ${error}`);
    });

    if (errors.length > 10) {
      console.log(`  ... 还有 ${errors.length - 10} 条`);
    }
  }

  console.log('='.repeat(70));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
