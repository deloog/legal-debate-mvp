/**
 * CAIL2018 → HistoricalCaseArticleRef 认识论聚合导入脚本
 *
 * 目的：将2.67M条刑事裁判文书数据聚合为法条认识论证据，
 *       按 (lawArticleId, jurisdiction, courtLevel) 三元组聚合，
 *       避免逐条存储500万行，支撑 CaseEpistemicContributor 的 Layer 3 来源独立性计算。
 *
 * 处理文件（~2.49M行）：
 *   - first_stage/train.json      (1,710,856 行)
 *   - restData/rest_data.json     (748,203 行)
 *   - final_test.json             (35,922 行)
 *
 * 运行方式：
 *   npx ts-node --project scripts/tsconfig.json scripts/import-data/import-cail2018-epistemic.ts [--data-dir <路径>]
 *
 * 参数：
 *   --data-dir   CAIL2018 数据集根目录，默认：C:/Users/deloo/Downloads/CAIL2018_ALL_DATA/final_all_data
 *   --dry-run    只统计，不写入数据库
 *   --clear      先清除现有 CAIL2018 数据再重新导入
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { PrismaClient } from '@prisma/client';

const log = (msg: string) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

const prisma = new PrismaClient();

// ──────────────────────────────────────────────────────────
// 阿拉伯数字 → 中文数字（用于 CAIL2018 文章号转换）
// CAIL2018 使用 "264"，数据库存储 "第二百六十四条"
// ──────────────────────────────────────────────────────────
const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function arabicToChineseNumeral(n: number): string {
  if (n < 1 || n > 9999) return String(n);
  if (n < 10) return CN_DIGITS[n];
  // 10–19: 十, 十一, ..., 十九 （不说"一十"）
  if (n < 20) return '十' + (n % 10 > 0 ? CN_DIGITS[n % 10] : '');
  // 20–99
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return CN_DIGITS[t] + '十' + (o > 0 ? CN_DIGITS[o] : '');
  }
  // 100–999
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const base = CN_DIGITS[h] + '百';
    if (rem === 0) return base;
    if (rem < 10) return base + '零' + CN_DIGITS[rem];
    const t = Math.floor(rem / 10);
    const o = rem % 10;
    return base + CN_DIGITS[t] + '十' + (o > 0 ? CN_DIGITS[o] : '');
  }
  // 1000–9999（刑法条文不到这个数，但保险起见）
  const th = Math.floor(n / 1000);
  const rem = n % 1000;
  const base = CN_DIGITS[th] + '千';
  if (rem === 0) return base;
  if (rem < 100) return base + '零' + arabicToChineseNumeral(rem);
  const h = Math.floor(rem / 100);
  const rem2 = rem % 100;
  const mid = CN_DIGITS[h] + '百';
  if (rem2 === 0) return base + mid;
  if (rem2 < 10) return base + mid + '零' + CN_DIGITS[rem2];
  const t2 = Math.floor(rem2 / 10);
  const o2 = rem2 % 10;
  return base + mid + CN_DIGITS[t2] + '十' + (o2 > 0 ? CN_DIGITS[o2] : '');
}

/** CAIL2018 文章号 → 数据库 articleNumber，如 "264" → "第二百六十四条" */
function toArticleNumber(arabicStr: string | number): string {
  const n = typeof arabicStr === 'string' ? parseInt(arabicStr, 10) : arabicStr;
  if (isNaN(n) || n < 1) return '';
  return `第${arabicToChineseNumeral(n)}条`;
}

// ──────────────────────────────────────────────────────────
// 从裁判文书 fact 字段提取法院信息
// ──────────────────────────────────────────────────────────
const PROVINCES = [
  '北京',
  '天津',
  '上海',
  '重庆',
  '河北',
  '山西',
  '辽宁',
  '吉林',
  '黑龙江',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '山东',
  '河南',
  '湖北',
  '湖南',
  '广东',
  '海南',
  '四川',
  '贵州',
  '云南',
  '陕西',
  '甘肃',
  '青海',
  '内蒙古',
  '广西',
  '西藏',
  '宁夏',
  '新疆',
];

// 省份别名映射（处理带"省"/"市"等后缀的写法）
const PROVINCE_ALIASES: Record<string, string> = {
  北京市: '北京',
  天津市: '天津',
  上海市: '上海',
  重庆市: '重庆',
};

function extractProvince(text: string): string {
  // 先检查明确的别名
  for (const [alias, prov] of Object.entries(PROVINCE_ALIASES)) {
    if (text.includes(alias)) return prov;
  }
  for (const prov of PROVINCES) {
    if (text.includes(prov)) return prov;
  }
  return 'UNKNOWN';
}

type CourtLevel = 'SUPREME' | 'HIGH' | 'INTERMEDIATE' | 'BASIC' | 'UNKNOWN';

interface CourtInfo {
  jurisdiction: string;
  courtLevel: CourtLevel;
}

function extractCourtInfo(fact: string): CourtInfo {
  // 只取前200字做快速匹配（减少搜索范围）
  const head = fact.slice(0, 300);

  // 1. 最高人民法院
  if (/最高人民法院/.test(head)) {
    return { jurisdiction: '全国', courtLevel: 'SUPREME' };
  }

  // 2. 高级人民法院 → HIGH
  const highMatch = head.match(/(.{2,10})高级人民法院/);
  if (highMatch) {
    return {
      jurisdiction: extractProvince(highMatch[1]),
      courtLevel: 'HIGH',
    };
  }

  // 3. 中级人民法院 → INTERMEDIATE
  const midMatch = head.match(/(.{2,15})中级人民法院/);
  if (midMatch) {
    return {
      jurisdiction: extractProvince(midMatch[1]),
      courtLevel: 'INTERMEDIATE',
    };
  }

  // 4. 人民法院（基层）
  const basicMatch = head.match(/(.{2,20})人民法院/);
  if (basicMatch) {
    return {
      jurisdiction: extractProvince(basicMatch[1]),
      courtLevel: 'BASIC',
    };
  }

  // 5. 从检察院推断（常见于 fact 开头）
  const procMatch = head.match(/(.{2,20})人民检察院/);
  if (procMatch) {
    const procName = procMatch[1];
    let courtLevel: CourtLevel = 'BASIC';
    // "X市人民检察院"（不含县/区）→ 中级
    if (/市$/.test(procName) && !/县|区/.test(procName)) {
      courtLevel = 'INTERMEDIATE';
    } else if (/省$/.test(procName) || /高级/.test(procName)) {
      courtLevel = 'HIGH';
    }
    return {
      jurisdiction: extractProvince(procMatch[0]),
      courtLevel,
    };
  }

  return { jurisdiction: 'UNKNOWN', courtLevel: 'UNKNOWN' };
}

// ──────────────────────────────────────────────────────────
// 主导入逻辑
// ──────────────────────────────────────────────────────────

interface _AggKey {
  lawArticleId: string;
  jurisdiction: string;
  courtLevel: string;
}

async function loadArticleIndex(): Promise<Map<string, string>> {
  // 返回 articleNumber → lawArticleId
  const articles = await prisma.lawArticle.findMany({
    where: { lawName: '中华人民共和国刑法' },
    select: { id: true, articleNumber: true },
  });
  const map = new Map<string, string>();
  for (const a of articles) {
    map.set(a.articleNumber, a.id);
  }
  log(`[CAIL2018-Epistemic] 已加载 ${map.size} 条刑法法条索引`);
  return map;
}

async function processFile(
  filePath: string,
  articleIndex: Map<string, string>,
  aggMap: Map<string, number>,
  stats: { total: number; matched: number; skipped: number }
): Promise<void> {
  const stat = fs.statSync(filePath);
  log(
    `[CAIL2018-Epistemic] 处理文件：${path.basename(filePath)} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`
  );

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let fileTotal = 0;
  let fileMatched = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    fileTotal++;
    stats.total++;

    try {
      const record = JSON.parse(trimmed) as {
        fact: string;
        meta: { relevant_articles: (string | number)[] };
      };

      const articles = record.meta?.relevant_articles;
      if (!articles || articles.length === 0) {
        stats.skipped++;
        continue;
      }

      const { jurisdiction, courtLevel } = extractCourtInfo(record.fact ?? '');
      let anyMatched = false;

      for (const rawArticle of articles) {
        const articleNumber = toArticleNumber(rawArticle);
        if (!articleNumber) continue;

        const lawArticleId = articleIndex.get(articleNumber);
        if (!lawArticleId) continue;

        const key = `${lawArticleId}:${jurisdiction}:${courtLevel}`;
        aggMap.set(key, (aggMap.get(key) ?? 0) + 1);
        anyMatched = true;
      }

      if (anyMatched) {
        fileMatched++;
        stats.matched++;
      } else {
        stats.skipped++;
      }
    } catch {
      stats.skipped++;
    }

    if (fileTotal % 200000 === 0) {
      log(
        `[CAIL2018-Epistemic]   进度 ${fileTotal} 行，命中 ${fileMatched} 行，聚合键 ${aggMap.size} 个`
      );
    }
  }

  log(`[CAIL2018-Epistemic] 文件完成：${fileTotal} 行，命中 ${fileMatched} 行`);
}

async function upsertAggregations(
  aggMap: Map<string, number>,
  isDryRun: boolean
): Promise<void> {
  log(`[CAIL2018-Epistemic] 开始写入 ${aggMap.size} 条聚合记录...`);

  if (isDryRun) {
    log('[CAIL2018-Epistemic] --dry-run 模式，跳过写入');
    return;
  }

  const entries = Array.from(aggMap.entries());
  const BATCH_SIZE = 500;
  let written = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);

    // 使用逐条 upsert（确保 @@unique 约束生效）
    await Promise.all(
      batch.map(([key, caseCount]) => {
        const [lawArticleId, jurisdiction, courtLevel] = key.split(':');
        return prisma.historicalCaseArticleRef.upsert({
          where: {
            lawArticleId_jurisdiction_courtLevel: {
              lawArticleId,
              jurisdiction,
              courtLevel,
            },
          },
          update: {
            caseCount: { increment: caseCount },
            updatedAt: new Date(),
          },
          create: {
            lawArticleId,
            jurisdiction,
            courtLevel,
            caseCount,
            dataSource: 'CAIL2018',
            applicabilitySignal: 0.85, // CAIL2018 全为刑事定罪，适用性明确
          },
        });
      })
    );

    written += batch.length;
    if (written % 2000 === 0 || written === entries.length) {
      log(`[CAIL2018-Epistemic] 写入进度：${written} / ${entries.length}`);
    }
  }

  log('[CAIL2018-Epistemic] 全部写入完成');
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isClear = args.includes('--clear');

  const dataDirIdx = args.indexOf('--data-dir');
  const dataDir =
    dataDirIdx !== -1
      ? args[dataDirIdx + 1]
      : 'C:/Users/deloo/Downloads/CAIL2018_ALL_DATA/final_all_data';

  const files = [
    path.join(dataDir, 'first_stage', 'train.json'),
    path.join(dataDir, 'restData', 'rest_data.json'),
    path.join(dataDir, 'final_test.json'),
  ].filter(f => fs.existsSync(f));

  if (files.length === 0) {
    log(
      'ERROR: ' +
        `[CAIL2018-Epistemic] 在 ${dataDir} 下未找到任何数据文件，请用 --data-dir 指定正确路径`
    );
    process.exit(1);
  }

  log(
    `[CAIL2018-Epistemic] 找到 ${files.length} 个文件：${files.map(f => path.basename(f)).join(', ')}`
  );
  if (isDryRun) log('[CAIL2018-Epistemic] 运行模式：dry-run（只统计，不写入）');

  if (isClear && !isDryRun) {
    const deleted = await prisma.historicalCaseArticleRef.deleteMany({
      where: { dataSource: 'CAIL2018' },
    });
    log(`[CAIL2018-Epistemic] 已清除 ${deleted.count} 条旧 CAIL2018 数据`);
  }

  const articleIndex = await loadArticleIndex();

  if (articleIndex.size === 0) {
    log(
      'ERROR: ' + '[CAIL2018-Epistemic] 数据库中没有刑法法条，请先导入法条数据'
    );
    process.exit(1);
  }

  // 内存聚合 Map：key = "lawArticleId:jurisdiction:courtLevel"，value = caseCount
  const aggMap = new Map<string, number>();
  const stats = { total: 0, matched: 0, skipped: 0 };
  const startTime = Date.now();

  for (const filePath of files) {
    await processFile(filePath, articleIndex, aggMap, stats);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`[CAIL2018-Epistemic] 全部文件处理完成（${elapsed}s）：`);
  log(`  总行数：${stats.total}`);
  log(`  命中刑法条文：${stats.matched}`);
  log(`  跳过（无法匹配）：${stats.skipped}`);
  log(`  唯一聚合键：${aggMap.size}`);

  // 统计覆盖的法条数
  const coveredArticles = new Set(
    Array.from(aggMap.keys()).map(k => k.split(':')[0])
  );
  log(`  覆盖法条数：${coveredArticles.size} / ${articleIndex.size}`);

  await upsertAggregations(aggMap, isDryRun);

  log('[CAIL2018-Epistemic] 完成！可运行以下命令触发认识论状态计算：');
  log(
    '  npx ts-node --project scripts/tsconfig.json scripts/compute-epistemic-states.ts'
  );
}

main()
  .catch(err => {
    log(`ERROR: [CAIL2018-Epistemic] 导入失败: ${err}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
