/**
 * DOCX 下载和解析脚本
 *
 * 使用正确的下载 API:
 * https://flk.npc.gov.cn/law-search/download/pc?format=docx&bbbs=xxx
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, LawType, LawCategory, LawStatus } from '@prisma/client';

const prisma = new PrismaClient();

const API_BASE = 'https://flk.npc.gov.cn';
const API_LIST = `${API_BASE}/law-search/search/list`;
const API_DETAIL = `${API_BASE}/law-search/search/flfgDetails`;
const API_DOWNLOAD = `${API_BASE}/law-search/download/pc`;

interface LawItem {
  bbbs: string;
  title: string;
  gbrq: string;
  sxrq: string;
  sxx: number;
  zdjgName: string;
  flxz: string;
  flfgCodeId: number;
}

function randomUA(): string {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url: string, options?: RequestInit): Promise<any> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': randomUA(),
      'Accept': 'application/json',
      'Referer': API_BASE + '/',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchList(typeCode: number, page: number, pageSize: number): Promise<any> {
  const body = {
    searchRange: 1, sxrq: [], gbrq: [], searchType: 2, sxx: [],
    gbrqYear: [], flfgCodeId: [typeCode], zdjgCodeId: [],
    searchContent: '', pageNum: page, pageSize,
  };

  return fetchJson(API_LIST, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function fetchDetail(bbbs: string): Promise<any> {
  const url = `${API_DETAIL}?bbbs=${encodeURIComponent(bbbs)}`;
  return fetchJson(url);
}

async function downloadDocx(bbbs: string): Promise<Buffer | null> {
  // 正确的下载 API
  const url = `${API_DOWNLOAD}?format=docx&bbbs=${encodeURIComponent(bbbs)}`;

  console.log(`    📥 ${url.substring(0, 70)}...`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'application/octet-stream, */*',
        'Referer': `https://flk.npc.gov.cn/detail?bbbs=${bbbs}`,
      },
    });

    if (!response.ok) {
      console.log(`    ⚠ HTTP ${response.status}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // 检查是否为有效的 DOCX
    if (buffer.length < 1000) {
      console.log(`    ⚠ 文件太小 (${buffer.length} bytes)，可能无效`);
      return null;
    }

    console.log(`    ✅ 下载成功: ${buffer.length.toLocaleString()} bytes`);
    return buffer;
  } catch (err) {
    console.log(`    ❌ ${err}`);
    return null;
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  // 方法1: 使用 mammoth
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    if (result.value && result.value.length > 100) {
      return result.value;
    }
  } catch {
    // 继续
  }

  // 方法2: 简单文本提取
  try {
    const text = buffer.toString('utf-8')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 100) {
      return text;
    }
  } catch {
    // 失败
  }

  throw new Error('无法解析 DOCX');
}

async function crawlType(typeCode: number, typeLabel: string): Promise<{ success: number; failed: number }> {
  console.log(`\n>>> ${typeLabel} (code: ${typeCode})`);

  let success = 0;
  let failed = 0;
  let page = 1;
  const pageSize = 20;

  while (page <= 5) { // 最多5页测试
    try {
      const response = await fetchList(typeCode, page, pageSize);

      if (response.code !== 200 || !response.rows || response.rows.length === 0) {
        break;
      }

      console.log(`  页 ${page}: ${response.rows.length} 条`);

      for (const item of response.rows) {
        console.log(`  🔄 ${item.title.substring(0, 40)}...`);

        try {
          // 下载 DOCX
          const buffer = await downloadDocx(item.bbbs);

          if (!buffer) {
            failed++;
            continue;
          }

          // 解析
          const text = await parseDocx(buffer);
          console.log(`    📖 ${text.length.toLocaleString()} 字符`);

          // 更新数据库
          const typeConfig = getTypeConfig(typeCode);
          await prisma.lawArticle.upsert({
            where: {
              lawName_articleNumber: {
                lawName: item.title,
                articleNumber: item.bbbs,
              },
            },
            update: {
              fullText: text,
              searchableText: `${item.title} ${text}`.substring(0, 50000),
            },
            create: {
              lawName: item.title,
              articleNumber: item.bbbs,
              fullText: text,
              lawType: typeConfig.lawType,
              category: typeConfig.category,
              issuingAuthority: item.zdjgName || '未知',
              effectiveDate: new Date(item.sxrq || item.gbrq),
              status: item.sxx === 1 ? 'REPEALED' : item.sxx === 2 ? 'AMENDED' : 'VALID',
              version: '1.0',
              tags: [item.flxz, typeLabel].filter(Boolean) as string[],
              searchableText: `${item.title} ${text}`.substring(0, 50000),
              dataSource: 'flk',
              sourceId: item.bbbs,
            },
          });

          console.log(`    ✅ 已保存`);
          success++;

        } catch (err) {
          console.log(`    ❌ ${err}`);
          failed++;
        }

        await delay(2000); // 避免请求过快
      }

      if (response.rows.length < pageSize) break;
      page++;

    } catch (err) {
      console.log(`  ⚠ 页 ${page} 失败: ${err}`);
      break;
    }
  }

  return { success, failed };
}

function getTypeConfig(code: number): { lawType: LawType; category: LawCategory } {
  const configs: Record<number, { lawType: LawType; category: LawCategory }> = {
    100: { lawType: 'CONSTITUTION', category: 'OTHER' },
    101: { lawType: 'LAW', category: 'OTHER' },
    102: { lawType: 'LAW', category: 'OTHER' },
    110: { lawType: 'LAW', category: 'OTHER' },
    120: { lawType: 'LAW', category: 'CIVIL' },
    130: { lawType: 'LAW', category: 'ADMINISTRATIVE' },
    140: { lawType: 'LAW', category: 'ECONOMIC' },
    150: { lawType: 'LAW', category: 'OTHER' },
    160: { lawType: 'LAW', category: 'CRIMINAL' },
    170: { lawType: 'LAW', category: 'PROCEDURE' },
    180: { lawType: 'LAW', category: 'OTHER' },
    190: { lawType: 'LAW', category: 'OTHER' },
    195: { lawType: 'LAW', category: 'OTHER' },
    200: { lawType: 'LAW', category: 'OTHER' },
    201: { lawType: 'ADMINISTRATIVE_REGULATION', category: 'ADMINISTRATIVE' },
    210: { lawType: 'ADMINISTRATIVE_REGULATION', category: 'ADMINISTRATIVE' },
    215: { lawType: 'ADMINISTRATIVE_REGULATION', category: 'ADMINISTRATIVE' },
    220: { lawType: 'LAW', category: 'ADMINISTRATIVE' },
    311: { lawType: 'JUDICIAL_INTERPRETATION', category: 'PROCEDURE' },
  };

  return configs[code] || { lawType: 'LAW', category: 'OTHER' };
}

async function main() {
  console.log('========================================');
  console.log('DOCX 下载和解析 (使用正确 API)');
  console.log('========================================\n');

  const types = [
    { code: 100, label: '宪法' },
    { code: 120, label: '民法商法' },
    { code: 130, label: '行政法' },
    { code: 160, label: '刑法' },
    { code: 311, label: '司法解释' },
  ];

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const type of types) {
    const result = await crawlType(type.code, type.label);
    totalSuccess += result.success;
    totalFailed += result.failed;
  }

  console.log('\n========================================');
  console.log('完成!');
  console.log('========================================');
  console.log(`✅ 成功: ${totalSuccess}`);
  console.log(`❌ 失败: ${totalFailed}`);
  console.log('========================================');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
