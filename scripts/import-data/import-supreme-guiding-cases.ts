/**
 * 最高人民法院指导性案例 → HistoricalCaseArticleRef 导入脚本
 *
 * 读取顺序（自动合并去重）：
 *   1. scripts/data/supreme-guiding-cases-seed.json  （内置种子，~20条已确认案例）
 *   2. scripts/data/supreme-guiding-cases-fetched.json （Playwright 爬虫抓取结果，可选）
 *
 * 导入策略：
 *   - courtLevel: SUPREME（最高法院效力层级权重 2.5×）
 *   - jurisdiction: 全国（全国有效）
 *   - applicabilitySignal: 0.95（指导性案例具有参照适用强制性，高于 CAIL2018 的 0.85）
 *   - caseCount: 1（每个指导案例单独计一，强调来源独立性而非数量）
 *
 * 运行方式：
 *   npx ts-node --project scripts/tsconfig.json scripts/import-data/import-supreme-guiding-cases.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// eslint-disable-next-line no-console
const log = (msg: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

const prisma = new PrismaClient();

interface GuidingCaseArticle {
  lawName: string;
  articleNumber: string;
}

interface GuidingCase {
  caseNumber: string;
  name: string;
  batch: number;
  year: number;
  keyPrinciple: string;
  articles: GuidingCaseArticle[];
  sourceUrl?: string;
}

function loadCaseFile(filePath: string): GuidingCase[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as GuidingCase[];
  } catch (e) {
    log(`  读取失败: ${filePath} — ${e}`);
    return [];
  }
}

function mergeCases(seed: GuidingCase[], fetched: GuidingCase[]): GuidingCase[] {
  const map = new Map<string, GuidingCase>();
  // 种子优先（已人工确认）
  for (const c of seed) map.set(c.caseNumber, c);
  // 爬虫数据补充（不覆盖已有）
  for (const c of fetched) {
    if (!map.has(c.caseNumber) && c.articles.length > 0) {
      map.set(c.caseNumber, c);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const na = parseInt(a.caseNumber.match(/(\d+)/)?.[1] ?? '0', 10);
    const nb = parseInt(b.caseNumber.match(/(\d+)/)?.[1] ?? '0', 10);
    return na - nb;
  });
}

async function buildArticleIndex(): Promise<Map<string, string>> {
  // key: "lawName::articleNumber" → lawArticleId（取最新有效版本）
  const articles = await prisma.lawArticle.findMany({
    where: { status: 'VALID' },
    select: { id: true, lawName: true, articleNumber: true, effectiveDate: true },
    orderBy: { effectiveDate: 'desc' },
  });

  const map = new Map<string, string>();
  for (const a of articles) {
    const key = `${a.lawName}::${a.articleNumber}`;
    // 只取最新版本（已按 effectiveDate desc 排序，第一个即最新）
    if (!map.has(key)) map.set(key, a.id);
  }
  log(`  法条索引已加载：${map.size} 条（${new Set(articles.map(a => a.lawName)).size} 部法律）`);
  return map;
}

async function importCases(cases: GuidingCase[], articleIndex: Map<string, string>): Promise<void> {
  let written = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const c of cases) {
    const matchedArticles = c.articles
      .map(a => {
        const key = `${a.lawName}::${a.articleNumber}`;
        const id = articleIndex.get(key);
        if (!id) {
          // 尝试模糊匹配（部分法律名称可能有差异）
          for (const [k, v] of articleIndex) {
            if (k.includes(a.articleNumber) && k.includes(a.lawName.slice(-4))) {
              return { key, id: v, articleNumber: a.articleNumber, lawName: a.lawName };
            }
          }
          return null;
        }
        return { key, id, articleNumber: a.articleNumber, lawName: a.lawName };
      })
      .filter((x): x is { key: string; id: string; articleNumber: string; lawName: string } => x !== null);

    if (matchedArticles.length === 0) {
      log(`  ⚠ ${c.caseNumber}「${c.name.slice(0, 20)}」— 无法匹配任何法条，跳过`);
      noMatch++;
      continue;
    }

    // 每条匹配的法条写入一条 HistoricalCaseArticleRef
    for (const art of matchedArticles) {
      try {
        await prisma.historicalCaseArticleRef.upsert({
          where: {
            lawArticleId_jurisdiction_courtLevel: {
              lawArticleId: art.id,
              jurisdiction: '全国',
              courtLevel: 'SUPREME',
            },
          },
          update: {
            // 指导案例有多个时累加（不同案例引用同一条文）
            caseCount: { increment: 1 },
            // 指导案例权重高于 CAIL2018，若已存在则保持 0.95
            applicabilitySignal: 0.95,
            dataSource: 'SUPREME_GUIDING',
            updatedAt: new Date(),
          },
          create: {
            lawArticleId: art.id,
            dataSource: 'SUPREME_GUIDING',
            jurisdiction: '全国',
            courtLevel: 'SUPREME',
            caseCount: 1,
            applicabilitySignal: 0.95,
          },
        });
        written++;
      } catch (e) {
        log(`  错误 ${c.caseNumber} ${art.articleNumber}: ${e}`);
        skipped++;
      }
    }

    log(`  ✓ ${c.caseNumber}「${c.name.slice(0, 25)}」→ ${matchedArticles.length} 条法条`);
  }

  log(`\n写入完成：成功 ${written} 条，跳过 ${skipped} 条，无法匹配 ${noMatch} 个案例`);
}

async function main() {
  const dataDir = path.join(__dirname, '..', 'data');
  const seedPath = path.join(dataDir, 'supreme-guiding-cases-seed.json');
  const fetchedPath = path.join(dataDir, 'supreme-guiding-cases-fetched.json');

  log('=== 最高法指导性案例导入 ===');

  const seed = loadCaseFile(seedPath);
  const fetched = loadCaseFile(fetchedPath);

  log(`种子数据：${seed.length} 个案例`);
  log(`爬虫数据：${fetched.length} 个案例`);

  const cases = mergeCases(seed, fetched);
  log(`合并后（去重）：${cases.length} 个案例，共引用 ${cases.reduce((s, c) => s + c.articles.length, 0)} 条法条`);

  if (cases.length === 0) {
    log('无数据可导入。请先运行种子文件检查或 fetch-supreme-guiding-cases.ts');
    process.exit(1);
  }

  log('\n加载法条索引...');
  const articleIndex = await buildArticleIndex();

  log('\n开始写入 HistoricalCaseArticleRef...');
  await importCases(cases, articleIndex);

  // 统计写入结果
  const count = await prisma.historicalCaseArticleRef.count({ where: { dataSource: 'SUPREME_GUIDING' } });
  log(`\n数据库中 SUPREME_GUIDING 记录总数：${count} 条`);

  log('\n触发认识论状态重新计算...');
  // 找出受影响的法条（有最高法级别引用的）
  const affected = await prisma.historicalCaseArticleRef.findMany({
    where: { dataSource: 'SUPREME_GUIDING' },
    select: { lawArticleId: true },
    distinct: ['lawArticleId'],
  });
  log(`  受影响法条：${affected.length} 条，正在重算...`);

  // 内联认识论计算（避免 @/ 路径问题）
  await recomputeEpistemicStates(affected.map(a => a.lawArticleId));

  log('\n完成！最高法指导性案例已成功导入认识论系统。');
}

// ── 内联认识论重计算（复用 compute-epistemic-states.ts 的逻辑）──
async function recomputeEpistemicStates(articleIds: string[]): Promise<void> {
  const COURT_LEVEL_WEIGHT: Record<string, number> = {
    SUPREME: 2.5, JUDICIAL_INTERP: 2.8, HIGH: 1.8, INTERMEDIATE: 1.2, BASIC: 0.8, UNKNOWN: 1.0,
  };
  const DECAY = 0.78, ALPHA = 0.20, POOL_ENTRY = 0.40, POOL_EXIT = 0.15;

  const REBUTTAL_PATTERNS = [
    { weight: 0.85, patterns: [/不(适用|符合|满足|成立|构成)/, /无效|违反|违法/, /已(废止|失效|撤销)/, /不予支持|驳回/] },
    { weight: 0.5,  patterns: [/仅(适用|限于|针对)/, /除非|前提是/, /限于|仅在|只有当/] },
    { weight: 0.65, patterns: [/应(适用|优先适用)/, /特别法|优先(于|适用)/, /竞合|冲突/] },
    { weight: 0.25, patterns: [/难以(认定|支持)/, /值得(商榷|质疑)/, /尚(存争议|无定论)/] },
  ];
  const SUPPORT_PATTERNS = [/依据.{0,20}(认定|支持)/, /符合.{0,15}规定/, /适用.{0,10}(本条|该条)/, /应予(支持|认可)/];
  const PROVINCES = ['北京','天津','上海','重庆','河北','山西','辽宁','吉林','黑龙江','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','海南','四川','贵州','云南','陕西','甘肃','青海','内蒙古','广西','西藏','宁夏','新疆'];

  function detectLevel(c: string | null | undefined) {
    if (!c) return 'UNKNOWN';
    if (c.includes('最高')) return 'SUPREME';
    if (c.includes('高级') || c.includes('高院')) return 'HIGH';
    if (c.includes('中级') || c.includes('中院')) return 'INTERMEDIATE';
    return 'BASIC';
  }
  function extractJuri(c: string | null | undefined) {
    if (!c) return 'UNKNOWN';
    for (const p of PROVINCES) { if (c.includes(p)) return p; }
    return 'UNKNOWN';
  }
  function computeIndep(sources: { level: string; jurisdiction: string }[]) {
    if (!sources.length) return { independence: 0, effectiveCount: 0, jurisdictionCount: 0, courtLevelSpread: 0 };
    const cls = new Map<string, number>();
    for (const s of sources) { const k = `${s.jurisdiction}::${s.level}`; cls.set(k, (cls.get(k) ?? 0) + 1); }
    let eff = 0;
    for (const [, sz] of cls) eff += 1.0 / Math.sqrt(Math.max(1, sz));
    return {
      independence: Math.min(1.0, eff / sources.length),
      effectiveCount: Math.round(eff * 100) / 100,
      jurisdictionCount: new Set(sources.map(s => s.jurisdiction).filter(j => j !== 'UNKNOWN')).size,
      courtLevelSpread: new Set(sources.map(s => s.level).filter(l => l !== 'UNKNOWN')).size,
    };
  }
  function determineProfile(consensus: number, rebuttal: number, inertia: number, inPool: boolean) {
    if (consensus > 0.85 && rebuttal < 0.15) return { profile: 'IRON_CLAD' as const, expressionGuide: '可以确定地说' };
    if (consensus > 0.65 && rebuttal > 0.20) return { profile: 'MAINSTREAM_TROUBLED' as const, expressionGuide: '目前仍倾向于认为' };
    if (inPool && consensus > 0.35 && consensus <= 0.65) return { profile: 'CANDIDATE_POOL' as const, expressionGuide: '目前无法确定' };
    if (rebuttal > 0.70 || consensus < 0.35) return { profile: 'FADING' as const, expressionGuide: '现在倾向于认为这一解释存在争议' };
    return { profile: 'UNCERTAIN' as const, expressionGuide: '目前没有足够案例数据来判断法院在类似情形下是否一致适用该条文，但本案所涉事实较适用该条文，具体适用须以法院裁量为准' };
  }

  let done = 0;
  for (const articleId of articleIds) {
    const [refs, histRefs] = await Promise.all([
      prisma.legalReference.findMany({
        where: { articleId, status: 'VALID', NOT: { metadata: { path: ['aiGenerated'], equals: true } } },
        include: { case: { select: { id: true, court: true, createdAt: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.lawArticle.findUnique({ where: { id: articleId }, select: { lawName: true, articleNumber: true } })
        .then(a => a
          ? prisma.lawArticle.findMany({ where: { lawName: a.lawName, articleNumber: a.articleNumber }, select: { id: true } })
              .then(rows => prisma.historicalCaseArticleRef.findMany({ where: { lawArticleId: { in: rows.map(r => r.id) } } }))
          : prisma.historicalCaseArticleRef.findMany({ where: { lawArticleId: articleId } })
        ),
    ]);

    const liveSrc = refs.map(r => ({ level: detectLevel(r.case?.court), jurisdiction: extractJuri(r.case?.court) }));
    const histSrc = histRefs.map(r => ({ level: r.courtLevel, jurisdiction: r.jurisdiction }));
    const indep = computeIndep([...liveSrc, ...histSrc]);

    let consensus = 0.5, rebuttal = 0.01, inertia = 0.0, inPool = false;
    let poolEntryDate: Date | undefined, poolExitDate: Date | undefined;
    let altStrength = 0.0, minorityCount = 0, lastCaseId: string | undefined;

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      const lw = COURT_LEVEL_WEIGHT[liveSrc[i].level] ?? 1.0;
      const w = Math.min(2.0, lw * indep.independence);
      const alpha = ALPHA * w;
      let maxStr = 0, isReb = false, isSup = false, isComp = false;
      for (const rule of REBUTTAL_PATTERNS) {
        if (rule.patterns.some(p => p.test(ref.content)) && rule.weight > maxStr) { maxStr = rule.weight; isReb = true; }
      }
      isSup = SUPPORT_PATTERNS.some(p => p.test(ref.content));
      isComp = REBUTTAL_PATTERNS[2].patterns.some(p => p.test(ref.content));
      if (maxStr > 0.3 && consensus > 0.75) minorityCount++;
      if (isSup && !isReb) consensus = Math.min(0.98, consensus + alpha * 0.3);
      if (isReb) { rebuttal = Math.min(1.0, rebuttal + alpha * maxStr); consensus = Math.max(0.0, consensus - alpha * 0.7 * maxStr); }
      if (isComp) altStrength = Math.min(1.0, altStrength + alpha * 0.8);
      inertia = maxStr * w + DECAY * inertia;
      const prev = inPool;
      if (inertia > POOL_ENTRY && !inPool) { inPool = true; poolEntryDate = ref.case?.createdAt; }
      else if (inertia < POOL_EXIT && inPool) { inPool = false; poolExitDate = ref.case?.createdAt; }
      if (!prev && inPool) poolEntryDate = ref.case?.createdAt;
      lastCaseId = ref.caseId ?? undefined;
    }

    for (const hist of histRefs) {
      const lw = COURT_LEVEL_WEIGHT[hist.courtLevel] ?? 1.0;
      const sat = Math.min(2.0, Math.log10(1 + hist.caseCount));
      consensus = Math.min(0.98, consensus + ALPHA * lw * 0.5 * hist.applicabilitySignal * sat * 0.1);
    }

    const { profile, expressionGuide } = determineProfile(consensus, rebuttal, inertia, inPool);
    const totalCases = refs.length + histRefs.reduce((s, r) => s + r.caseCount, 0);

    const data = {
      profile, consensusScore: Math.round(consensus * 1000) / 1000,
      challengePressure: Math.round(rebuttal * 1000) / 1000,
      inertia: Math.round(inertia * 1000) / 1000, inCandidatePool: inPool,
      alternativeStrength: Math.round(altStrength * 1000) / 1000,
      sourceIndependence: Math.round(indep.independence * 1000) / 1000,
      effectiveSourceCount: indep.effectiveCount, totalCasesApplied: totalCases,
      jurisdictionCount: indep.jurisdictionCount, courtLevelSpread: indep.courtLevelSpread,
      minorityPressureCount: minorityCount, poolEntryDate, poolExitDate, expressionGuide,
      lastCaseId: lastCaseId ?? null,
    };
    await prisma.lawArticleEpistemicState.upsert({
      where: { lawArticleId: articleId },
      create: { lawArticleId: articleId, ...data },
      update: { ...data, computedAt: new Date() },
    });
    done++;
  }

  log(`  重计算完成：${done} 条法条`);
}

main()
  .catch(err => { log(`FATAL: ${err}`); process.exit(1); })
  .finally(() => prisma.$disconnect());
