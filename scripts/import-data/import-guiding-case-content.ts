/**
 * 导入最高法指导案例全文到 GuidingCase 表，并建立与法条的多对多关联
 *
 * 数据源：C:/Users/deloo/Downloads/guiding-cases (1)/guiding-cases/guiding_cases_final_v3.json
 *
 * 运行：
 *   npx ts-node --project scripts/tsconfig.json scripts/import-data/import-guiding-case-content.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const log = (msg: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); // eslint-disable-line no-console

const prisma = new PrismaClient();

// ── 数字转换（与 import-all-guiding-cases 保持一致）──────────────────
const CN = ['零','一','二','三','四','五','六','七','八','九'];
function arabicToChinese(n: number): string {
  if (n < 10) return CN[n];
  if (n < 20) return '十' + (n % 10 > 0 ? CN[n % 10] : '');
  if (n < 100) { const t=Math.floor(n/10),o=n%10; return CN[t]+'十'+(o>0?CN[o]:''); }
  if (n < 1000) {
    const h=Math.floor(n/100),r=n%100;
    const base=CN[h]+'百';
    if (r===0) return base;
    if (r<10) return base+'零'+CN[r];
    const t=Math.floor(r/10),o=r%10;
    return base+CN[t]+'十'+(o>0?CN[o]:'');
  }
  const th=Math.floor(n/1000),r=n%1000;
  const base=CN[th]+'千';
  if (r===0) return base;
  if (r<10) return base+'零'+CN[r];
  if (r<100) { const t=Math.floor(r/10),o=r%10; return base+'零'+CN[t]+'十'+(o>0?CN[o]:''); }
  const h=Math.floor(r/100),r2=r%100;
  const mid=CN[h]+'百';
  if (r2===0) return base+mid;
  const t=Math.floor(r2/10),o=r2%10;
  return base+mid+(t>0?CN[t]+'十'+(o>0?CN[o]:''):'零'+CN[o]);
}
function normalizeArticleNumber(raw: string): string {
  const arabicMatch = raw.match(/^第(\d+)条$/);
  if (arabicMatch) return `第${arabicToChinese(parseInt(arabicMatch[1], 10))}条`;
  if (/^第[一二三四五六七八九十百千零]+条$/.test(raw)) return raw;
  return raw;
}

// ── 法条解析（与导入脚本保持一致）────────────────────────────────────
const LAW_ARTICLE_RE = /《([^》]+)》[^第]*?((?:第(?:\d+|[一二三四五六七八九十百千零]+)条[^，。；\n《]*?)+)/g;
const ARTICLE_NUM_RE = /第(?:(\d+)|([一二三四五六七八九十百千零]+))条/g;
const LAW_ARTICLE_BARE_RE = /《([^》]+)》\s*(\d+)\s*条/g;

function normalizeLawName(name: string): string {
  return name.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
}

interface ArticleRef { lawName: string; articleNumber: string; }

function parseRelevantLaws(text: string): ArticleRef[] {
  const result: ArticleRef[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  LAW_ARTICLE_RE.lastIndex = 0;
  while ((match = LAW_ARTICLE_RE.exec(text)) !== null) {
    const lawName = normalizeLawName(match[1]);
    ARTICLE_NUM_RE.lastIndex = 0;
    let artMatch: RegExpExecArray | null;
    while ((artMatch = ARTICLE_NUM_RE.exec(match[2])) !== null) {
      const raw = artMatch[0].match(/^第\S+条/)?.[0] ?? artMatch[0];
      const articleNumber = normalizeArticleNumber(raw.match(/^(第[^第]+条)/)?.[1] ?? raw);
      const key = `${lawName}::${articleNumber}`;
      if (!seen.has(key) && articleNumber.startsWith('第')) { seen.add(key); result.push({ lawName, articleNumber }); }
    }
  }
  LAW_ARTICLE_BARE_RE.lastIndex = 0;
  while ((match = LAW_ARTICLE_BARE_RE.exec(text)) !== null) {
    const lawName = normalizeLawName(match[1]);
    const articleNumber = `第${arabicToChinese(parseInt(match[2], 10))}条`;
    const key = `${lawName}::${articleNumber}`;
    if (!seen.has(key)) { seen.add(key); result.push({ lawName, articleNumber }); }
  }
  return result;
}

// ── 法条 ID 查找（支持废止法律映射）──────────────────────────────────
async function buildLawIndex(): Promise<Map<string, string>> {
  const articles = await prisma.lawArticle.findMany({
    where: { status: { in: ['VALID', 'AMENDED'] } },
    select: { id: true, lawName: true, articleNumber: true },
    orderBy: { status: 'asc' },
  });
  const map = new Map<string, string>();
  for (const a of articles) {
    const key = `${a.lawName}::${a.articleNumber}`;
    if (!map.has(key)) map.set(key, a.id);
  }
  return map;
}

function buildRepealedIndex(index: Map<string, string>): Map<string, string> {
  const mappingPath = path.join(__dirname, '..', 'data', 'repealed-law-mapping.json');
  if (!fs.existsSync(mappingPath)) return new Map();
  const file = JSON.parse(fs.readFileSync(mappingPath, 'utf-8')) as {
    mappings: Array<{ fromLaw: string; aliases: string[]; toLaw: string; articles: Array<{ from: string; to: string | null }> }>;
  };
  const repMap = new Map<string, string>();
  for (const group of file.mappings) {
    for (const art of group.articles) {
      if (!art.to) continue;
      const toId = index.get(`${group.toLaw}::${art.to}`) ?? index.get(`${group.toLaw.replace(/^中华人民共和国/, '')}::${art.to}`);
      if (!toId) continue;
      for (const fromName of [group.fromLaw, ...group.aliases]) {
        repMap.set(`${fromName}::${art.from}`, toId);
        repMap.set(`${fromName.replace(/^中华人民共和国/, '')}::${art.from}`, toId);
      }
    }
  }
  return repMap;
}

function lookupId(lawName: string, articleNumber: string, index: Map<string, string>, repealedIndex: Map<string, string>): string | null {
  const short = lawName.replace(/^中华人民共和国/, '');
  return index.get(`${lawName}::${articleNumber}`)
    ?? index.get(`中华人民共和国${lawName}::${articleNumber}`)
    ?? index.get(`${short}::${articleNumber}`)
    ?? repealedIndex.get(`${lawName}::${articleNumber}`)
    ?? repealedIndex.get(`${short}::${articleNumber}`)
    ?? null;
}

// ── 主流程 ────────────────────────────────────────────────────────────
async function main() {
  const dataPath = 'C:/Users/deloo/Downloads/guiding-cases (1)/guiding-cases/guiding_cases_final_v3.json';
  if (!fs.existsSync(dataPath)) { log(`文件不存在：${dataPath}`); process.exit(1); }

  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as {
    cases: Array<{
      case_no: number | string;
      title: string;
      batch: number;
      publish_date?: string;
      category?: string;
      keywords?: string[] | string;
      holding_points?: string | string[];
      basic_facts?: string;
      judgment_result?: string;
      judgment_reason?: string;
      relevant_laws?: string | string[] | null;
      url?: string;
      source?: string;
    }>;
  };

  // 加载案例覆盖表
  const overridesPath = path.join(__dirname, '..', 'data', 'case-overrides.json');
  const overrides: Record<string, { articles: string[] }> = fs.existsSync(overridesPath)
    ? (JSON.parse(fs.readFileSync(overridesPath, 'utf-8')) as { overrides: Record<string, { articles: string[] }> }).overrides
    : {};

  log(`=== 指导案例全文导入（${rawData.cases.length}条）===`);
  log('加载法条索引...');
  const index = await buildLawIndex();
  const repealedIndex = buildRepealedIndex(index);
  log(`法条索引：${index.size} 条`);

  // 清除旧数据（幂等）
  await prisma.$executeRaw`TRUNCATE TABLE "_GuidingCaseLawArticles"`;
  await prisma.guidingCase.deleteMany();
  log('已清除旧指导案例数据');

  let imported = 0, skipped = 0;

  for (const c of rawData.cases) {
    const caseNo = typeof c.case_no === 'string' ? parseInt(c.case_no, 10) : c.case_no;

    // 裁判要旨：字符串或数组
    const holdingPoints = Array.isArray(c.holding_points)
      ? c.holding_points.join('\n')
      : (c.holding_points ?? '');

    if (!holdingPoints.trim()) { skipped++; continue; }

    // 解析法条关联（同 import-all-guiding-cases 逻辑）
    const rawLaws = overrides[String(caseNo)]
      ? overrides[String(caseNo)].articles.join('\n')
      : Array.isArray(c.relevant_laws)
        ? c.relevant_laws.join('\n')
        : (c.relevant_laws ?? '');

    const refs = parseRelevantLaws(rawLaws);
    const articleIds: string[] = [];
    for (const ref of refs) {
      const id = lookupId(ref.lawName, ref.articleNumber, index, repealedIndex);
      if (id && !articleIds.includes(id)) articleIds.push(id);
    }

    // keywords 归一化为数组
    const keywords: string[] = Array.isArray(c.keywords)
      ? c.keywords
      : typeof c.keywords === 'string' && c.keywords
        ? c.keywords.split(/[/，,]/).map(s => s.trim()).filter(Boolean)
        : [];

    // relevant_laws 存原始文本供展示用
    const relevantLawsText = Array.isArray(c.relevant_laws)
      ? c.relevant_laws.filter(s => !s.includes('版权所有') && !s.includes('法律声明')).join('；')
      : (c.relevant_laws ?? null);

    await prisma.guidingCase.upsert({
      where: { caseNo },
      create: {
        caseNo,
        title: c.title ?? '',
        batch: c.batch ?? 0,
        publishDate: c.publish_date ?? null,
        category: c.category ?? null,
        keywords,
        holdingPoints,
        basicFacts: c.basic_facts ?? null,
        judgmentResult: c.judgment_result ?? null,
        judgmentReason: c.judgment_reason ?? null,
        relevantLaws: relevantLawsText,
        url: c.url ?? null,
        source: c.source ?? null,
        lawArticles: articleIds.length > 0
          ? { connect: articleIds.map(id => ({ id })) }
          : undefined,
      },
      update: {
        title: c.title ?? '',
        batch: c.batch ?? 0,
        publishDate: c.publish_date ?? null,
        category: c.category ?? null,
        keywords,
        holdingPoints,
        basicFacts: c.basic_facts ?? null,
        judgmentResult: c.judgment_result ?? null,
        judgmentReason: c.judgment_reason ?? null,
        relevantLaws: relevantLawsText,
        url: c.url ?? null,
        source: c.source ?? null,
        lawArticles: articleIds.length > 0
          ? { set: articleIds.map(id => ({ id })) }
          : undefined,
      },
    });

    imported++;
    if (imported % 50 === 0) log(`  进度 ${imported}/${rawData.cases.length}`);
  }

  const total = await prisma.guidingCase.count();
  const linked = await prisma.guidingCase.count({ where: { lawArticles: { some: {} } } });
  log(`\n完成：导入 ${imported} 条，跳过 ${skipped} 条（无裁判要旨）`);
  log(`已关联法条：${linked} / ${total} 条`);
}

main()
  .catch(err => { log(`FATAL: ${err}`); process.exit(1); })
  .finally(() => prisma.$disconnect());
