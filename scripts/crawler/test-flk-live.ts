/**
 * 法律法规采集器 - 简化版测试
 * 使用 API content 字段，无需下载 DOCX
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// API 配置
const API_BASE = 'https://flk.npc.gov.cn';
const API_LIST = `${API_BASE}/law-search/search/list`;
const API_DETAIL = `${API_BASE}/law-search/search/flfgDetails`;

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function randomUA(): string {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url: string, options?: RequestInit): Promise<any> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': randomUA(),
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json;charset=utf-8',
      'Referer': 'https://flk.npc.gov.cn/',
      'Origin': 'https://flk.npc.gov.cn',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function fetchList(typeCode: number, page: number, pageSize: number): Promise<any> {
  const body = {
    searchRange: 1,
    sxrq: [],
    gbrq: [],
    searchType: 2,
    sxx: [],
    gbrqYear: [],
    flfgCodeId: [typeCode],
    zdjgCodeId: [],
    searchContent: '',
    pageNum: page,
    pageSize,
  };

  return fetchJson(API_LIST, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function fetchDetail(bbbs: string): Promise<any> {
  return fetchJson(`${API_DETAIL}?bbbs=${encodeURIComponent(bbbs)}`);
}

// 分类配置
const TYPE_CONFIGS = [
  { code: 100, label: '宪法', flfgFl: 'flfg' },
  { code: 120, label: '民法商法', flfgFl: 'flfg' },
  { code: 130, label: '行政法', flfgFl: 'flfg' },
  { code: 160, label: '刑法', flfgFl: 'flfg' },
  { code: 220, label: '监察法规', flfgFl: 'jcfg' },
  { code: 311, label: '司法解释', flfgFl: 'sfjs' },
];

function getLawType(flfgCodeId: number): string {
  const map: Record<number, string> = {
    100: 'CONSTITUTION',
    101: 'LAW', 102: 'LAW', 110: 'LAW', 120: 'LAW', 130: 'LAW',
    140: 'LAW', 150: 'LAW', 160: 'LAW', 170: 'LAW', 180: 'LAW',
    190: 'LAW', 195: 'LAW', 200: 'LAW',
    201: 'ADMINISTRATIVE_REGULATION', 210: 'ADMINISTRATIVE_REGULATION', 215: 'ADMINISTRATIVE_REGULATION',
    220: 'LAW',
    221: 'LOCAL_REGULATION', 222: 'LOCAL_REGULATION', 230: 'LOCAL_REGULATION',
    260: 'LOCAL_REGULATION', 270: 'LOCAL_REGULATION', 290: 'LOCAL_REGULATION',
    295: 'LOCAL_REGULATION', 300: 'LOCAL_REGULATION', 305: 'LOCAL_REGULATION', 310: 'LOCAL_REGULATION',
    311: 'JUDICIAL_INTERPRETATION', 320: 'JUDICIAL_INTERPRETATION', 330: 'JUDICIAL_INTERPRETATION',
    340: 'JUDICIAL_INTERPRETATION', 350: 'JUDICIAL_INTERPRETATION',
  };
  return map[flfgCodeId] || 'LAW';
}

function getCategory(flfgCodeId: number): string {
  const map: Record<number, string> = {
    100: 'OTHER',
    120: 'CIVIL', 130: 'ADMINISTRATIVE', 140: 'ECONOMIC',
    150: 'OTHER', 160: 'CRIMINAL', 170: 'PROCEDURE',
    180: 'OTHER', 190: 'OTHER', 195: 'OTHER', 200: 'OTHER',
    201: 'ADMINISTRATIVE', 210: 'ADMINISTRATIVE', 215: 'ADMINISTRATIVE',
    220: 'ADMINISTRATIVE',
    221: 'OTHER', 222: 'OTHER', 230: 'OTHER',
    260: 'OTHER', 270: 'OTHER', 290: 'OTHER',
    295: 'OTHER', 300: 'OTHER', 305: 'OTHER', 310: 'OTHER',
    311: 'PROCEDURE', 320: 'PROCEDURE', 330: 'PROCEDURE',
    340: 'PROCEDURE', 350: 'PROCEDURE',
  };
  return map[flfgCodeId] || 'OTHER';
}

function getStatus(sxx: number): string {
  switch (sxx) {
    case 1: return 'REPEALED';
    case 2: return 'AMENDED';
    case 4: return 'DRAFT';
    case 3: default: return 'VALID';
  }
}

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

async function main() {
  console.log('='.repeat(70));
  console.log('法律法规采集器 - 简化版测试');
  console.log('='.repeat(70));
  console.log();

  const outputDir = path.resolve('data/crawled/flk');
  const checkpointPath = path.join(outputDir, 'checkpoint.json');
  fs.mkdirSync(outputDir, { recursive: true });

  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // 加载断点
  let checkpoint = { version: '2.0', items: [], types: {}, startedAt: '', lastUpdatedAt: '', status: 'in_progress' };
  if (fs.existsSync(checkpointPath)) {
    try {
      checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
      console.log(`已加载断点: ${checkpoint.items.length} 条记录\n`);
    } catch (e) {
      console.log('创建新断点\n');
    }
  }

  // 只测试 2 个分类，每类最多 3 条
  const testTypes = TYPE_CONFIGS.slice(0, 2);
  const maxPerType = 3;

  for (const type of testTypes) {
    console.log(`\n>>> ${type.label} (code: ${type.code})`);

    try {
      const response = await fetchList(type.code, 1, maxPerType);

      if (response.code !== 200 || !response.rows) {
        console.log(`  ⚠ API 失败: ${response.msg || '无数据'}`);
        continue;
      }

      console.log(`  共 ${response.total} 条，获取前 ${Math.min(response.rows.length, maxPerType)} 条...`);

      for (const item of response.rows.slice(0, maxPerType)) {
        // 检查是否已存在
        const existing = checkpoint.items.find((i: any) => i.bbbs === item.bbbs);
        if (existing && !existing.error) {
          console.log(`  ✓ ${item.title} (已有)`);
          skippedCount++;
          continue;
        }

        console.log(`  🔄 ${item.title}`);

        try {
          // 获取详情
          const detail = await fetchDetail(item.bbbs);

          if (detail.code !== 200 || !detail.data) {
            throw new Error(detail.msg || '详情获取失败');
          }

          // 提取内容
          let fullText = extractTextFromContent(detail.data.content);
          const hasContent = fullText.length > 100;

          if (!hasContent) {
            console.log(`    ⚠ 无正文内容 (${fullText.length} chars)`);
          } else {
            console.log(`    ✓ 正文: ${fullText.length} chars`);
          }

          // 保存到数据库
          try {
            const lawData = {
              lawName: item.title,
              articleNumber: item.bbbs,
              fullText: fullText || `[元数据] ${item.flxz || ''} - ${item.zdjgName || ''}`,
              lawType: getLawType(item.flfgCodeId) as any,
              category: getCategory(item.flfgCodeId) as any,
              issuingAuthority: item.zdjgName || '未知',
              effectiveDate: new Date(item.sxrq || item.gbrq),
              status: getStatus(item.sxx) as any,
              version: '1.0',
              tags: [item.flxz, type.label].filter(Boolean) as string[],
              searchableText: `${item.title} ${item.zdjgName || ''} ${item.flxz || ''} ${fullText}`.substring(0, 50000),
              dataSource: 'flk',
              sourceId: item.bbbs,
            };

            // upsert 到数据库
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
            createdCount++;
          } catch (dbError) {
            console.log(`    ⚠ 数据库错误: ${dbError}`);
            errorCount++;
          }

          // 更新断点
          const idx = checkpoint.items.findIndex((i: any) => i.bbbs === item.bbbs);
          const itemData = {
            bbbs: item.bbbs,
            title: item.title,
            flfgCodeId: item.flfgCodeId,
            gbrq: item.gbrq,
            sxrq: item.sxrq,
            sxx: item.sxx,
            zdjgName: item.zdjgName,
            flxz: item.flxz,
            downloadedAt: new Date().toISOString(),
            hasContent,
          };

          if (idx >= 0) {
            checkpoint.items[idx] = itemData;
          } else {
            checkpoint.items.push(itemData);
          }

          fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');

          await delay(1000); // 避免请求过快

        } catch (err) {
          console.log(`    ⚠ 处理失败: ${err}`);
          errorCount++;
        }
      }
    } catch (e) {
      console.log(`  ⚠ 异常: ${e}`);
    }
  }

  // 保存断点
  checkpoint.lastUpdatedAt = new Date().toISOString();
  checkpoint.status = 'completed';
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(70));
  console.log('测试完成!');
  console.log('='.repeat(70));
  console.log(`✅ 新建: ${createdCount}`);
  console.log(`⏭ 跳过: ${skippedCount}`);
  console.log(`❌ 错误: ${errorCount}`);
  console.log(`📁 断点: ${checkpointPath}`);
  console.log('='.repeat(70));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
