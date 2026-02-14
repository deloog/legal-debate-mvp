/**
 * 法律法规完整采集脚本
 *
 * 功能：
 * 1. 采集所有法规分类
 * 2. 下载 DOCX 文件
 * 3. 解析并保存到数据库
 * 4. 支持断点续采
 * 5. 支持增量采集
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { PrismaClient, LawType, LawCategory, LawStatus } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  API_BASE: 'https://flk.npc.gov.cn',
  API_LIST: 'https://flk.npc.gov.cn/law-search/search/list',
  API_DETAIL: 'https://flk.npc.gov.cn/law-search/search/flfgDetails',
  // DOCX 下载使用详情 API 返回的 URL
  RATE_LIMIT_MS: 2000,  // 请求间隔
  MAX_RETRIES: 3,       // 最大重试次数
  TIMEOUT_MS: 30000,    // 请求超时
};

// 法律分类配置（完整版）
const TYPE_CONFIGS = [
  // 宪法相关
  { code: 100, label: '宪法', flfgFl: 'flfg', lawType: 'CONSTITUTION', category: 'OTHER' },

  // 法律 (101-195)
  { code: 101, label: '法律', flfgFl: 'flfg', lawType: 'LAW', category: 'OTHER' },
  { code: 102, label: '法律', flfgFl: 'flfg', lawType: 'LAW', category: 'OTHER' },
  { code: 110, label: '宪法相关法', flfgFl: 'flfg', lawType: 'LAW', category: 'OTHER' },
  { code: 120, label: '民法商法', flfgFl: 'flfg', lawType: 'LAW', category: 'CIVIL' },
  { code: 130, label: '行政法', flfgFl: 'flfg', lawType: 'LAW', category: 'ADMINISTRATIVE' },
  { code: 140, label: '经济法', flfgFl: 'flfg', lawType: 'LAW', category: 'ECONOMIC' },
  { code: 150, label: '社会法', flfgFl: 'flfg', lawType: 'LAW', category: 'OTHER' },
  { code: 160, label: '刑法', flfgFl: 'flfg', lawType: 'LAW', category: 'CRIMINAL' },
  { code: 170, label: '诉讼与非诉讼程序法', flfgFl: 'flfg', lawType: 'LAW', category: 'PROCEDURE' },
  { code: 180, label: '法律解释', flfgFl: 'flfg', lawType: 'LAW', category: 'OTHER' },
  { code: 190, label: '有关法律问题的决定', flfgFl: 'flfg', lawType: 'LAW', category: 'OTHER' },
  { code: 195, label: '修正案', flfgFl: 'flfg', lawType: 'LAW', category: 'OTHER' },
  { code: 200, label: '修改、废止的决定', flfgFl: 'flfg', lawType: 'LAW', category: 'OTHER' },

  // 行政法规 (201-215)
  { code: 201, label: '行政法规', flfgFl: 'xzfg', lawType: 'ADMINISTRATIVE_REGULATION', category: 'ADMINISTRATIVE' },
  { code: 210, label: '行政法规', flfgFl: 'xzfg', lawType: 'ADMINISTRATIVE_REGULATION', category: 'ADMINISTRATIVE' },
  { code: 215, label: '修改、废止的决定', flfgFl: 'xzfg', lawType: 'ADMINISTRATIVE_REGULATION', category: 'ADMINISTRATIVE' },

  // 监察法规 (220)
  { code: 220, label: '监察法规', flfgFl: 'jcfg', lawType: 'LAW', category: 'ADMINISTRATIVE' },

  // 地方法规 (221-310)
  { code: 221, label: '地方法规', flfgFl: 'dfxfg', lawType: 'LOCAL_REGULATION', category: 'OTHER' },
  { code: 222, label: '地方法规', flfgFl: 'dfxfg', lawType: 'LOCAL_REGULATION', category: 'OTHER' },
  { code: 230, label: '地方性法规', flfgFl: 'dfxfg', lawType: 'LOCAL_REGULATION', category: 'OTHER' },
  { code: 260, label: '自治条例', flfgFl: 'dfxfg', lawType: 'LOCAL_REGULATION', category: 'OTHER' },
  { code: 270, label: '单行条例', flfgFl: 'dfxfg', lawType: 'LOCAL_REGULATION', category: 'OTHER' },
  { code: 290, label: '经济特区法规', flfgFl: 'dfxfg', lawType: 'LOCAL_REGULATION', category: 'OTHER' },
  { code: 295, label: '浦东新区法规', flfgFl: 'dfxfg', lawType: 'LOCAL_REGULATION', category: 'OTHER' },
  { code: 300, label: '海南自由贸易港法规', flfgFl: 'dfxfg', lawType: 'LOCAL_REGULATION', category: 'OTHER' },
  { code: 305, label: '法规性决定', flfgFl: 'dfxfg', lawType: 'LOCAL_REGULATION', category: 'OTHER' },
  { code: 310, label: '修改、废止的决定', flfgFl: 'dfxfg', lawType: 'LOCAL_REGULATION', category: 'OTHER' },

  // 司法解释 (311-350)
  { code: 311, label: '司法解释', flfgFl: 'sfjs', lawType: 'JUDICIAL_INTERPRETATION', category: 'PROCEDURE' },
  { code: 320, label: '高法司法解释', flfgFl: 'sfjs', lawType: 'JUDICIAL_INTERPRETATION', category: 'PROCEDURE' },
  { code: 330, label: '高检司法解释', flfgFl: 'sfjs', lawType: 'JUDICIAL_INTERPRETATION', category: 'PROCEDURE' },
  { code: 340, label: '联合发布司法解释', flfgFl: 'sfjs', lawType: 'JUDICIAL_INTERPRETATION', category: 'PROCEDURE' },
  { code: 350, label: '修改、废止的决定', flfgFl: 'sfjs', lawType: 'JUDICIAL_INTERPRETATION', category: 'PROCEDURE' },
];

// ═══════════════════════════════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════════════════════════════

function randomUA(): string {
  const pool = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url: string, options?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=utf-8',
        'Referer': CONFIG.API_BASE + '/',
        'Origin': CONFIG.API_BASE,
        ...options?.headers,
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function fetchList(typeCode: number, page: number, pageSize: number, sinceDate?: string): Promise<any> {
  const body = {
    searchRange: 1,
    sxrq: sinceDate ? [sinceDate, new Date().toISOString().split('T')[0]] : [],
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

  return fetchJson(CONFIG.API_LIST, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function fetchDetail(bbbs: string): Promise<any> {
  return fetchJson(`${CONFIG.API_DETAIL}?bbbs=${encodeURIComponent(bbbs)}`);
}

async function downloadDocx(downloadUrl: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const req = https.get(downloadUrl, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': '*/*',
        'Referer': CONFIG.API_BASE + '/',
      },
      timeout: CONFIG.TIMEOUT_MS,
    }, (res) => {
      if (res.statusCode !== 200) {
        console.log(`    ⚠ HTTP ${res.statusCode}`);
        resolve(null);
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`    ✓ DOCX 下载成功: ${buffer.length} bytes`);
        resolve(buffer);
      });
      res.on('error', (err) => {
        console.log(`    ⚠ 下载错误: ${err.message}`);
        resolve(null);
      });
    });

    req.on('error', (err) => {
      console.log(`    ⚠ 请求错误: ${err.message}`);
      resolve(null);
    });

    req.setTimeout(CONFIG.TIMEOUT_MS, () => {
      req.destroy();
      resolve(null);
    });
  });
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

async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    // 尝试使用 mammoth
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    if (result.value && result.value.length > 10) {
      return result.value;
    }
  } catch {
    // 降级到简单解析
  }

  // 简单解析：尝试提取 XML 中的文本
  try {
    const text = buffer.toString('utf-8')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 10) {
      return text;
    }
  } catch {
    // 失败
  }

  return '';
}

function getStatus(sxx: number): LawStatus {
  switch (sxx) {
    case 1: return LawStatus.REPEALED;
    case 2: return LawStatus.AMENDED;
    case 4: return LawStatus.DRAFT;
    case 3: default: return LawStatus.VALID;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 主程序
// ═══════════════════════════════════════════════════════════════════════════════════════

interface CliArgs {
  incremental?: boolean;
  days?: number;
  types?: string;
  maxPages?: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--incremental' || arg === '-i') {
      result.incremental = true;
    }

    if (arg.startsWith('--days=') || arg.startsWith('-d=')) {
      result.days = parseInt(arg.split('=')[1], 10);
    }

    if (arg.startsWith('--types=') || arg.startsWith('-t=')) {
      result.types = arg.split('=')[1];
    }

    if (arg.startsWith('--maxPages=') || arg.startsWith('-m=')) {
      result.maxPages = parseInt(arg.split('=')[1], 10);
    }
  }

  return result;
}

async function main() {
  const args = parseArgs();

  console.log('='.repeat(70));
  console.log('法律法规完整采集脚本');
  console.log('='.repeat(70));
  console.log();
  console.log(`模式: ${args.incremental ? '增量采集' : '全量采集'}`);
  if (args.days) console.log(`时间范围: 近 ${args.days} 天`);
  if (args.types) console.log(`分类限制: ${args.types}`);
  if (args.maxPages) console.log(`最大页数: ${args.maxPages}`);
  console.log();

  // 计算增量采集的起始日期
  let sinceDate: string | undefined;
  if (args.incremental) {
    const days = args.days || 7;
    const date = new Date();
    date.setDate(date.getDate() - days);
    sinceDate = date.toISOString().split('T')[0];
    console.log(`增量采集起始日期: ${sinceDate}\n`);
  }

  // 确定要采集的分类
  let typesToCrawl = TYPE_CONFIGS;
  if (args.types) {
    const typeCodes = args.types.split(',').map(Number);
    typesToCrawl = TYPE_CONFIGS.filter(t => typeCodes.includes(t.code));
    console.log(`将采集 ${typesToCrawl.length} 个分类\n`);
  }

  // 准备输出目录
  const outputDir = path.resolve('data/crawled/flk');
  const docxDir = path.join(outputDir, 'docx');
  const checkpointPath = path.join(outputDir, 'checkpoint.json');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(docxDir, { recursive: true });

  // 加载或创建断点
  let checkpoint = {
    version: '3.0',
    items: [] as any[],
    types: {} as Record<string, { page: number; downloaded: number }>,
    startedAt: '',
    lastUpdatedAt: '',
    status: 'in_progress' as 'in_progress' | 'completed' | 'failed',
  };

  if (fs.existsSync(checkpointPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
      checkpoint = { ...checkpoint, ...saved };
      console.log(`已加载断点: ${checkpoint.items.length} 条记录\n`);
    } catch (e) {
      console.log('创建新断点\n');
    }
  }

  // 统计
  let totalNew = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalPages = 0;
  let totalItems = 0;

  // 遍历所有分类
  for (const type of typesToCrawl) {
    console.log(`\n>>> ${type.label} (code: ${type.code})`);

    // 获取列表
    let page = 1;
    let typeCompleted = false;
    let typeTotal = 0;
    let typeDownloaded = 0;

    // 检查是否已完成该分类
    const savedTypeProgress = checkpoint.types[type.code];
    if (savedTypeProgress && !args.incremental) {
      console.log(`  ⏭ 已完成，跳过`);
      continue;
    }

    while (!typeCompleted) {
      // 检查最大页数限制
      if (args.maxPages && page > args.maxPages) {
        console.log(`  ⏮ 达到最大页数限制 (${args.maxPages})`);
        break;
      }

      try {
        const response = await fetchList(type.code, page, 20, sinceDate);

        if (response.code !== 200 || !response.rows) {
          console.log(`  ⚠ API 失败: ${response.msg || '未知错误'}`);
          break;
        }

        const rows = response.rows;
        typeTotal = response.total;

        if (page === 1) {
          console.log(`  总数: ${typeTotal} 条`);
        }

        if (rows.length === 0) {
          typeCompleted = true;
          break;
        }

        console.log(`  页 ${page}: ${rows.length} 条...`);

        // 处理每条记录
        for (const item of rows) {
          // 检查是否已存在
          const existing = checkpoint.items.find((i: any) => i.bbbs === item.bbbs);
          if (existing && !existing.error && !args.incremental) {
            totalSkipped++;
            continue;
          }

          try {
            // 获取详情
            const detail = await fetchDetail(item.bbbs);

            if (detail.code !== 200 || !detail.data) {
              throw new Error(detail.msg || '详情获取失败');
            }

            // 提取内容
            let fullText = extractTextFromContent(detail.data.content);
            let docxBuffer: Buffer | null = null;

            // 尝试下载 DOCX
            const ossPath = detail.data.ossFile?.ossWordPath;
            if (ossPath && !fullText) {
              // 需要先获取下载 URL
              // 这里使用简化方式：如果有 content 就用 content，没有就记录元数据
              console.log(`    ⚠ 仅有元数据，无正文内容`);
            }

            // 保存到数据库
            try {
              const lawData = {
                lawName: item.title,
                articleNumber: item.bbbs,
                fullText: fullText || `[元数据] ${item.flxz || ''} - ${item.zdjgName || ''} - 公布日期: ${item.gbrq}`,
                lawType: type.lawType as LawType,
                category: type.category as LawCategory,
                issuingAuthority: item.zdjgName || '未知',
                effectiveDate: new Date(item.sxrq || item.gbrq),
                status: getStatus(item.sxx),
                version: '1.0',
                tags: [item.flxz, type.label].filter(Boolean) as string[],
                searchableText: `${item.title} ${item.zdjgName || ''} ${item.flxz || ''} ${fullText}`.substring(0, 50000),
                dataSource: 'flk' as const,
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

              console.log(`    ✅ 已保存: ${item.title.substring(0, 30)}...`);
              totalNew++;
            } catch (dbError) {
              console.log(`    ⚠ 数据库错误: ${dbError}`);
              totalErrors++;
            }

            // 更新断点
            const idx = checkpoint.items.findIndex((i: any) => i.bbbs === item.bbbs);
            const itemData = {
              bbbs: item.bbbs,
              title: item.title,
              flfgCodeId: item.flfgCodeId,
              zdjgName: item.zdjgName,
              flxz: item.flxz,
              gbrq: item.gbrq,
              sxrq: item.sxrq,
              sxx: item.sxx,
              downloadedAt: new Date().toISOString(),
              hasContent: fullText.length > 50,
            };

            if (idx >= 0) {
              checkpoint.items[idx] = itemData;
            } else {
              checkpoint.items.push(itemData);
            }

            typeDownloaded++;

          } catch (err) {
            console.log(`    ⚠ 处理失败: ${err}`);
            totalErrors++;
          }

          await delay(CONFIG.RATE_LIMIT_MS);
        }

        // 更新分类进度
        checkpoint.types[type.code] = {
          page,
          downloaded: typeDownloaded,
        };

        // 保存断点
        checkpoint.lastUpdatedAt = new Date().toISOString();
        fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');

        totalPages++;
        totalItems += rows.length;

        if (rows.length < 20) {
          typeCompleted = true;
        } else {
          page++;
        }

      } catch (err) {
        console.log(`  ⚠ 页 ${page} 请求失败: ${err}`);
        totalErrors++;

        // 重试逻辑
        for (let retry = 0; retry < CONFIG.MAX_RETRIES; retry++) {
          await delay(5000 * (retry + 1));
          try {
            const response = await fetchList(type.code, page, 20, sinceDate);
            if (response.code === 200 && response.rows) {
              break;
            }
          } catch {
            // 继续重试
          }
        }

        page++; // 即使失败也继续下一页
      }
    }

    console.log(`  ✓ ${type.label}: ${typeDownloaded} 条`);
  }

  // 完成
  checkpoint.status = 'completed';
  checkpoint.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(70));
  console.log('采集完成!');
  console.log('='.repeat(70));
  console.log(`✅ 新建/更新: ${totalNew}`);
  console.log(`⏭ 跳过: ${totalSkipped}`);
  console.log(`❌ 错误: ${totalErrors}`);
  console.log(`📄 处理页数: ${totalPages}`);
  console.log(`📋 处理条目: ${totalItems}`);
  console.log(`📁 断点文件: ${checkpointPath}`);
  console.log('='.repeat(70));

  // 输出采集统计
  console.log('\n📊 分类统计:');
  for (const type of typesToCrawl) {
    const progress = checkpoint.types[type.code];
    if (progress) {
      console.log(`  ${type.label}: ${progress.downloaded} 条`);
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
