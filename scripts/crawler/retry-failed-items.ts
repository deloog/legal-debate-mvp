/**
 * 重试失败的采集记录
 * 从断点文件中读取失败的记录并重新采集
 */

import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 配置
const CONFIG = {
  API_BASE: 'https://flk.npc.gov.cn',
  API_DETAIL: 'https://flk.npc.gov.cn/law-search/search/flfgDetails',
  API_DOWNLOAD: 'https://flk.npc.gov.cn/law-search/download/pc',
  MIN_DELAY_MS: 2000,
  MAX_DELAY_MS: 5000,
  MAX_RETRIES: 5,
  TIMEOUT_MS: 45000,
};

// 随机延迟
function randomDelay(): Promise<void> {
  const delay = CONFIG.MIN_DELAY_MS + Math.random() * (CONFIG.MAX_DELAY_MS - CONFIG.MIN_DELAY_MS);
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

// 获取详情
async function fetchDetail(bbbs: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  try {
    const response = await fetch(`${CONFIG.API_DETAIL}?bbbs=${encodeURIComponent(bbbs)}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'application/json',
        'Referer': CONFIG.API_BASE + '/',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// 获取下载 URL
async function getDownloadUrl(bbbs: string, retryCount = 0): Promise<string | null> {
  const url = `${CONFIG.API_DOWNLOAD}?format=docx&bbbs=${encodeURIComponent(bbbs)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'application/json',
        'Referer': CONFIG.API_BASE + '/',
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
      await new Promise(resolve => setTimeout(resolve, 3000 * (retryCount + 1)));
      return getDownloadUrl(bbbs, retryCount + 1);
    }
    return null;
  }
}

// 下载 DOCX
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
      await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
      return downloadDocx(downloadUrl, retryCount + 1);
    }
    return null;
  }
}

// 解析 DOCX
async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch {
    return '';
  }
}

// 从 API content 提取文本
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

// 重试单个记录
async function retryItem(item: any, typeConfig: any): Promise<boolean> {
  console.log(`\n>>> ${item.title}`);
  console.log(`    ID: ${item.bbbs}`);
  console.log(`    上次失败原因: ${item.error}`);

  try {
    // 获取详情
    const detail = await fetchDetail(item.bbbs);

    if (detail.code !== 200 || !detail.data) {
      throw new Error(detail.msg || '详情获取失败');
    }

    // 1. 尝试从 content 提取
    let fullText = extractTextFromContent(detail.data.content);

    // 2. 如果 content 为空，下载 DOCX
    if (!fullText || fullText.length < 100) {
      let downloadSuccess = false;
      let docxRetryCount = 0;

      while (!downloadSuccess && docxRetryCount < 5) {
        const downloadUrl = await getDownloadUrl(item.bbbs);

        if (downloadUrl) {
          const buffer = await downloadDocx(downloadUrl);

          if (buffer && buffer.length > 1000) {
            const parsedText = await parseDocx(buffer);

            if (parsedText && parsedText.length > 100) {
              fullText = parsedText;
              downloadSuccess = true;
              console.log(`    ✓ DOCX 下载成功: ${buffer.length} bytes, ${parsedText.length} chars`);
            } else {
              console.log(`    ⚠ DOCX 解析失败 (尝试 ${docxRetryCount + 1}/5)`);
            }
          } else {
            console.log(`    ⚠ DOCX 下载失败 (尝试 ${docxRetryCount + 1}/5)`);
          }
        } else {
          console.log(`    ⚠ 获取下载 URL 失败 (尝试 ${docxRetryCount + 1}/5)`);
        }

        docxRetryCount++;
        if (!downloadSuccess) {
          await randomDelay();
        }
      }

      if (!fullText || fullText.length < 100) {
        throw new Error(`重试失败：${docxRetryCount}次重试后仍无法获取完整内容`);
      }
    }

    // 保存到数据库
    const lawData = {
      lawName: item.title,
      articleNumber: item.bbbs,
      fullText,
      lawType: typeConfig.lawType,
      category: typeConfig.category,
      issuingAuthority: item.zdjgName || '未知',
      effectiveDate: new Date(item.sxrq || item.gbrq),
      version: '1.0',
      tags: [item.flxz, typeConfig.label].filter(Boolean),
      searchableText: `${item.title} ${item.zdjgName || ''} ${item.flxz || ''} ${fullText}`.substring(0, 50000),
      dataSource: 'flk',
      sourceId: item.bbbs,
    };

    await prisma.lawArticle.upsert({
      where: {
        lawName_articleNumber: {
          lawName: item.title,
          articleNumber: item.bbbs,
        },
      },
      update: lawData,
      create: lawData,
    });

    console.log(`    ✅ 已保存到数据库`);
    return true;

  } catch (error: any) {
    console.log(`    ❌ 重试失败: ${error.message}`);
    return false;
  }
}

// 解析命令行参数
function parseArgs(): { checkpoint?: string } {
  const args = process.argv.slice(2);
  const result: { checkpoint?: string } = {};

  for (const arg of args) {
    if (arg.startsWith('--checkpoint=')) {
      result.checkpoint = arg.split('=')[1];
    }
  }

  return result;
}

async function main() {
  const args = parseArgs();

  console.log('='.repeat(70));
  console.log('重试失败的采集记录');
  console.log('='.repeat(70));

  // 确定断点文件路径
  const outputDir = path.resolve('data/crawled/flk');
  const checkpointPath = args.checkpoint || path.join(outputDir, 'checkpoint.json');

  if (!fs.existsSync(checkpointPath)) {
    console.log(`\n❌ 断点文件不存在: ${checkpointPath}`);
    console.log('请先运行采集脚本生成失败记录');
    process.exit(1);
  }

  // 读取断点文件
  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));

  if (!checkpoint.failedItems || checkpoint.failedItems.length === 0) {
    console.log('\n✅ 没有失败的记录需要重试');
    process.exit(0);
  }

  console.log(`\n从 ${checkpointPath} 读取到 ${checkpoint.failedItems.length} 条失败记录\n`);

  // 获取所有类型配置（用于数据库保存）
  const TYPE_CONFIGS = [
    { code: 100, label: '宪法', lawType: 'CONSTITUTION', category: 'OTHER' },
    { code: 120, label: '民法商法', lawType: 'LAW', category: 'CIVIL' },
    { code: 130, label: '行政法', lawType: 'LAW', category: 'ADMINISTRATIVE' },
    { code: 140, label: '经济法', lawType: 'LAW', category: 'ECONOMIC' },
    { code: 150, label: '社会法', lawType: 'LAW', category: 'OTHER' },
    { code: 160, label: '刑法', lawType: 'LAW', category: 'CRIMINAL' },
    { code: 170, label: '诉讼与非诉讼程序法', lawType: 'LAW', category: 'PROCEDURE' },
    { code: 201, label: '行政法规', lawType: 'ADMINISTRATIVE_REGULATION', category: 'ADMINISTRATIVE' },
    { code: 311, label: '司法解释', lawType: 'JUDICIAL_INTERPRETATION', category: 'PROCEDURE' },
  ];

  let successCount = 0;
  let failCount = 0;
  const stillFailed: any[] = [];

  // 重试每个失败的记录
  for (const item of checkpoint.failedItems) {
    // 查找对应的类型配置（默认使用第一个）
    const typeConfig = TYPE_CONFIGS[0];

    const success = await retryItem(item, typeConfig);

    if (success) {
      successCount++;
    } else {
      failCount++;
      stillFailed.push(item);
    }

    await randomDelay();

    // 每10条输出进度
    if ((successCount + failCount) % 10 === 0) {
      console.log(`\n--- 进度: ${successCount + failCount}/${checkpoint.failedItems.length} ---`);
      console.log(`✓ 成功: ${successCount}, ✗ 失败: ${failCount}\n`);
    }
  }

  // 更新断点文件
  checkpoint.failedItems = stillFailed;
  checkpoint.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(70));
  console.log('重试完成!');
  console.log('='.repeat(70));
  console.log(`✅ 成功: ${successCount}/${checkpoint.failedItems.length + successCount - stillFailed.length}`);
  console.log(`✗ 仍失败: ${stillFailed.length}`);
  console.log(`成功率: ${successCount / (successCount + failCount) * 100}.toFixed(1)%`);
  console.log(`📁 断点文件已更新: ${checkpointPath}`);

  if (stillFailed.length > 0) {
    console.log('\n仍失败的记录:');
    stillFailed.slice(0, 10).forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.title} (${item.bbbs.substring(0, 8)}...)`);
      console.log(`     失败原因: ${item.error}`);
    });
    if (stillFailed.length > 10) {
      console.log(`  ... 还有 ${stillFailed.length - 10} 条`);
    }
    console.log('\n可以继续运行此脚本重试剩余的失败记录');
  } else {
    console.log('\n🎉 所有失败记录已成功恢复！');
  }

  console.log('='.repeat(70));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
