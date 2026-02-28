/**
 * 法律法规采集器运行脚本 - 完整版
 * 功能：列表采集 → 详情获取 → DOCX下载 → 解析 → 导出
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { extractRawText } from 'mammoth';

// SSL证书验证跳过
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

// API配置（正确的FLK API）
const API_BASE = 'https://flk.npc.gov.cn';
const API_LIST = `${API_BASE}/law-search/search/list`; // POST列表
const API_DETAIL = `${API_BASE}/law-search/search/flfgDetails`; // GET详情
const OSS_HOST = 'wb.flk.npc.gov.cn';

function randomUA() {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
}

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 获取法规列表（POST请求）
 */
function fetchList(
  typeCode: number,
  page: number,
  pageSize: number
): Promise<any> {
  const body = JSON.stringify({
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
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      API_LIST,
      {
        method: 'POST',
        headers: {
          'User-Agent': randomUA(),
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Origin: API_BASE,
          Referer: `${API_BASE}/`,
        },
        agent: insecureAgent,
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`列表JSON解析失败: ${data.substring(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * 获取法规详情（GET请求）
 */
function fetchDetail(bbbs: string): Promise<any> {
  const url = `${API_DETAIL}?bbbs=${encodeURIComponent(bbbs)}`;

  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: { 'User-Agent': randomUA(), Referer: API_BASE },
          agent: insecureAgent,
        },
        res => {
          let data = '';
          res.on('data', chunk => (data += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`详情JSON解析失败: ${data.substring(0, 200)}`));
            }
          });
        }
      )
      .on('error', reject);
  });
}

/**
 * 从OSS下载DOCX文件
 */
async function downloadDocx(ossPath: string): Promise<Buffer | null> {
  const url = `https://${OSS_HOST}/${ossPath}`;

  return new Promise(resolve => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': randomUA(),
            Accept: '*/*',
            Referer: API_BASE,
          },
          agent: insecureAgent,
          timeout: 30000,
        },
        res => {
          if (res.statusCode !== 200) {
            console.log(`    ⚠ HTTP ${res.statusCode}`);
            resolve(null);
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            console.log(`    ✓ 下载成功: ${buffer.length} bytes`);
            resolve(buffer);
          });
          res.on('error', err => {
            console.log(`    ⚠ 下载错误: ${err.message}`);
            resolve(null);
          });
        }
      )
      .on('error', err => {
        console.log(`    ⚠ 请求错误: ${err.message}`);
        resolve(null);
      })
      .setTimeout(30000, function () {
        this.destroy();
        resolve(null);
      });
  });
}

/**
 * 解析DOCX获取纯文本
 */
async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    console.log(`    ⚠ DOCX解析失败: ${error}`);
    return '';
  }
}

/**
 * 提取API content字段的纯文本
 */
function extractApiContent(content: any): string {
  if (!content) return '';
  const texts: string[] = [];

  function traverse(node: any) {
    if (node.title) texts.push(node.title);
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  }
  traverse(content);
  return texts.join('\n');
}

interface Item {
  bbbs: string;
  title: string;
  flfgCodeId: number;
  gbrq: string;
  sxrq: string;
  sxx: number;
  zdjgName: string;
  flxz: string;
  ossPath?: string;
  content?: string;
  contentLength: number;
  downloadedAt: string;
  downloadStatus: 'pending' | 'success' | 'failed' | 'skipped';
}

interface Checkpoint {
  version: string;
  items: Item[];
  types: Record<string, { page: number; count: number }>;
}

async function main() {
  const outputDir = path.resolve('data/crawled/flk');
  const checkpointPath = path.join(outputDir, 'checkpoint.json');
  const docxDir = path.join(outputDir, 'docx');
  const parsedDir = path.join(outputDir, 'parsed');

  // 创建目录
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(docxDir, { recursive: true });
  fs.mkdirSync(parsedDir, { recursive: true });

  // 加载或创建断点
  let checkpoint: Checkpoint = { version: '3.0', items: [], types: {} };

  try {
    if (fs.existsSync(checkpointPath)) {
      checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
      console.log(`[断点] 加载已有数据: ${checkpoint.items.length} 条`);
    }
  } catch (e) {
    console.log('[断点] 创建新的断点文件');
  }

  const args = process.argv.slice(2);
  const forceRedownload =
    args.includes('--force') || args.includes('--download');
  const forceParse = args.includes('--force') || args.includes('--parse');
  const parseOnly = args.includes('--parse-only');

  console.log('='.repeat(60));
  console.log('法律法规采集器 - 完整版');
  console.log('='.repeat(60));
  console.log(`模式: ${parseOnly ? '仅解析' : '下载+解析'}`);
  console.log(`强制: ${forceRedownload ? '是' : '否'}`);
  console.log('='.repeat(60));

  // 法规类型配置
  const types = [
    { code: 100, label: '宪法' },
    { code: 120, label: '民法商法' },
    { code: 130, label: '行政法' },
    { code: 160, label: '刑法' },
    { code: 220, label: '监察法规' },
    { code: 311, label: '司法解释' },
  ];

  // 阶段1: 采集列表和详情
  if (!parseOnly) {
    console.log('\n📥 阶段1: 采集法规列表和详情...\n');

    for (const t of types) {
      const existing = checkpoint.types[t.code]?.count || 0;

      if (existing > 0 && !forceRedownload) {
        console.log(`[${t.label}] 已有 ${existing} 条详情，跳过列表采集`);
        continue;
      }

      console.log(`\n>>> ${t.label} (code: ${t.code})`);

      try {
        const resp = await fetchList(t.code, 1, 20);
        if (resp.code !== 200 || !resp.rows) {
          console.log(`  ⚠ 失败: ${resp.msg || '无数据'}`);
          continue;
        }

        console.log(`  共 ${resp.total} 条，取前20条...`);

        for (const row of resp.rows) {
          const existingItem = checkpoint.items.find(i => i.bbbs === row.bbbs);

          if (existingItem && !forceRedownload) {
            console.log(`  ✓ ${row.title} (已有)`);
            continue;
          }

          console.log(`  🔄 ${row.title}`);

          // 获取详情
          let ossPath: string | undefined;
          let apiContent = '';

          try {
            const det: any = await fetchDetail(row.bbbs);
            if (det.code === 200 && det.data) {
              ossPath = det.data.ossFile?.ossWordPath;
              if (det.data.content) {
                apiContent = extractApiContent(det.data.content);
              }
              console.log(
                `    ✓ OSS: ${ossPath || '无'} | Content: ${apiContent.length} chars`
              );
            }
          } catch (e) {
            console.log(`    ⚠ 详情获取失败: ${e}`);
          }

          const item: Item = {
            bbbs: row.bbbs,
            title: row.title,
            flfgCodeId: row.flfgCodeId,
            gbrq: row.gbrq,
            sxrq: row.sxrq,
            sxx: row.sxx,
            zdjgName: row.zdjgName,
            flxz: row.flxz,
            ossPath,
            content: apiContent || undefined,
            contentLength: apiContent.length,
            downloadedAt: new Date().toISOString(),
            downloadStatus: 'pending',
          };

          // 更新或添加
          const idx = checkpoint.items.findIndex(i => i.bbbs === row.bbbs);
          if (idx >= 0) {
            checkpoint.items[idx] = item;
          } else {
            checkpoint.items.push(item);
          }

          checkpoint.types[t.code] = {
            page: 1,
            count: checkpoint.items.filter(i => i.flfgCodeId === t.code).length,
          };

          fs.writeFileSync(
            checkpointPath,
            JSON.stringify(checkpoint, null, 2),
            'utf-8'
          );
          await delay(300 + Math.random() * 500);
        }
      } catch (e) {
        console.log(`  ⚠ 异常: ${e}`);
      }
    }
  }

  // 阶段2: 下载DOCX文件
  if (!parseOnly) {
    console.log('\n📥 阶段2: 下载DOCX文件...\n');

    let downloadCount = 0;
    let skipCount = 0;

    for (const item of checkpoint.items) {
      if (item.downloadStatus === 'success' && !forceRedownload) {
        skipCount++;
        continue;
      }

      if (!item.ossPath) {
        item.downloadStatus = 'skipped';
        continue;
      }

      const docxPath = path.join(docxDir, `${item.bbbs}.docx`);

      if (fs.existsSync(docxPath) && !forceRedownload) {
        skipCount++;
        item.downloadStatus = 'success';
        continue;
      }

      console.log(`  ↓ ${item.title}`);

      try {
        const buffer = await downloadDocx(item.ossPath);
        if (buffer && buffer.length > 100) {
          fs.writeFileSync(docxPath, buffer);
          item.downloadStatus = 'success';
          downloadCount++;
        } else {
          item.downloadStatus = 'failed';
        }
      } catch (e) {
        item.downloadStatus = 'failed';
        console.log(`    ⚠ 下载失败: ${e}`);
      }

      fs.writeFileSync(
        checkpointPath,
        JSON.stringify(checkpoint, null, 2),
        'utf-8'
      );
      await delay(500 + Math.random() * 1000);
    }

    console.log(`\n📊 下载完成: ${downloadCount} 成功, ${skipCount} 跳过`);
  }

  // 阶段3: 解析DOCX文件
  console.log('\n📖 阶段3: 解析DOCX文件...\n');

  let parseCount = 0;
  let apiOnlyCount = 0;

  for (const item of checkpoint.items) {
    const docxPath = path.join(docxDir, `${item.bbbs}.docx`);
    const parsedPath = path.join(parsedDir, `${item.bbbs}.txt`);

    // 检查是否已解析
    if (fs.existsSync(parsedPath) && !forceParse) {
      const existingContent = fs.readFileSync(parsedPath, 'utf-8');
      if (existingContent.length > 100) {
        item.content = existingContent;
        item.contentLength = existingContent.length;
        item.downloadStatus = 'success';
        console.log(
          `  ✓ ${item.title} (已解析: ${existingContent.length} chars)`
        );
        parseCount++;
        continue;
      }
    }

    // 解析DOCX
    if (fs.existsSync(docxPath)) {
      console.log(`  🔍 ${item.title}`);

      try {
        const buffer = fs.readFileSync(docxPath);
        const content = await parseDocx(buffer);

        if (content.length > 100) {
          fs.writeFileSync(parsedPath, content);
          item.content = content;
          item.contentLength = content.length;
          item.downloadStatus = 'success';
          console.log(`    ✓ DOCX解析: ${content.length} chars`);
          parseCount++;
        } else if (item.content && item.content.length > 50) {
          console.log(
            `    ⚠ DOCX为空，使用API content: ${item.content.length} chars`
          );
          fs.writeFileSync(parsedPath, item.content);
          apiOnlyCount++;
        } else {
          item.downloadStatus = 'failed';
        }
      } catch (e) {
        item.downloadStatus = 'failed';
        console.log(`    ⚠ 解析失败: ${e}`);
      }
    } else if (item.content && item.content.length > 50) {
      console.log(`  🔍 ${item.title} (使用API content)`);
      fs.writeFileSync(parsedPath, item.content);
      apiOnlyCount++;
    } else {
      item.downloadStatus = 'skipped';
      console.log(`  ⊘ ${item.title} (无内容)`);
    }

    fs.writeFileSync(
      checkpointPath,
      JSON.stringify(checkpoint, null, 2),
      'utf-8'
    );
  }

  // 阶段4: 导出数据
  console.log('\n📦 阶段4: 导出数据...\n');

  const exportData = {
    exportedAt: new Date().toISOString(),
    totalItems: checkpoint.items.length,
    totalContentLength: checkpoint.items.reduce(
      (s, i) => s + (i.contentLength || 0),
      0
    ),
    stats: {
      parsed: parseCount,
      apiOnly: apiOnlyCount,
      failed: checkpoint.items.filter(i => i.downloadStatus === 'failed')
        .length,
      skipped: checkpoint.items.filter(i => i.downloadStatus === 'skipped')
        .length,
    },
    items: checkpoint.items.map(i => ({
      source: 'flk',
      sourceId: i.bbbs,
      title: i.title,
      category: i.flxz,
      categoryCode: i.flfgCodeId,
      issuingAuthority: i.zdjgName,
      publishDate: i.gbrq,
      effectiveDate: i.sxrq,
      status:
        i.sxx === 1
          ? 'repealed'
          : i.sxx === 2
            ? 'amended'
            : i.sxx === 4
              ? 'draft'
              : 'valid',
      content: i.content || '',
      contentLength: i.contentLength || 0,
    })),
  };

  const exportPath = path.join(outputDir, 'export.json');
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');

  // 统计
  const byCategory: Record<string, { c: number; l: number }> = {};
  checkpoint.items.forEach(i => {
    const k = i.flxz;
    if (!byCategory[k]) byCategory[k] = { c: 0, l: 0 };
    byCategory[k].c++;
    byCategory[k].l += i.contentLength || 0;
  });

  console.log('='.repeat(60));
  console.log('采集完成!');
  console.log('='.repeat(60));
  console.log(`总条目: ${exportData.totalItems}`);
  console.log(`总字符: ${exportData.totalContentLength.toLocaleString()}`);
  console.log(`DOCX解析: ${parseCount}`);
  console.log(`API内容: ${apiOnlyCount}`);
  console.log(`失败: ${exportData.stats.failed}`);
  console.log(`跳过: ${exportData.stats.skipped}`);
  console.log('');
  Object.entries(byCategory).forEach(([k, v]) => {
    console.log(`  ${k}: ${v.c} 条, ${v.l.toLocaleString()} 字符`);
  });
  console.log('');
  console.log(`📁 导出文件: ${exportPath}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
