/**
 * 导入已下载的最高法指导性案例 JSON 数据
 *
 * 数据源：C:/Users/deloo/Downloads/guiding-cases/guiding-cases/all_guiding_cases_full.json
 * 覆盖：第40-47批（237号-267号），共25条
 *
 * relevant_laws 格式：交替出现法律名和条号
 *   ["《中华人民共和国刑法》", "《第358条第1款》", ...]
 *
 * 运行：npx ts-node --project scripts/tsconfig.json scripts/import-data/import-downloaded-guiding-cases.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// eslint-disable-next-line no-console
const log = (msg: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

const prisma = new PrismaClient();

// ── 噪音过滤 ──────────────────────────────────────────────────────────
const NOISE_PATTERNS = [
  '法律声明', '联系我们', '使用帮助', '版权所有', '最高人民法院 版权',
];

// 法律名称规范化映射（处理常见的别称/简称）
const LAW_NAME_ALIASES: Record<string, string> = {
  '中华人民共和国劳动合同法': '中华人民共和国劳动合同法',
  '最高人民法院关于适用《中华人民共和国民事诉讼法》的解释':
    '最高人民法院关于适用《中华人民共和国民事诉讼法》的解释',
  '最高人民法院关于适用〈中华人民共和国民事诉讼法〉的解释':
    '最高人民法院关于适用《中华人民共和国民事诉讼法》的解释',
};

function normalizeLawName(name: string): string {
  const cleaned = name.replace(/（.*?）$/, '').trim();
  return LAW_NAME_ALIASES[cleaned] ?? cleaned;
}

// ── 阿拉伯数字 → 中文数字转换（数据集用阿拉伯，DB用中文）──────────
const CN = ['零','一','二','三','四','五','六','七','八','九'];

function arabicToChinese(n: number): string {
  if (n < 10) return CN[n];
  if (n < 20) return '十' + (n % 10 > 0 ? CN[n % 10] : '');
  if (n < 100) { const t=Math.floor(n/10), o=n%10; return CN[t]+'十'+(o>0?CN[o]:''); }
  if (n < 1000) {
    const h=Math.floor(n/100), r=n%100;
    const base=CN[h]+'百';
    if (r===0) return base;
    if (r<10) return base+'零'+CN[r];
    const t=Math.floor(r/10), o=r%10;
    return base+CN[t]+'十'+(o>0?CN[o]:'');
  }
  // 千位（民法典最多到第1260条）
  const th=Math.floor(n/1000), r=n%1000;
  const base=CN[th]+'千';
  if (r===0) return base;
  if (r<10) return base+'零'+CN[r];
  if (r<100) { const t=Math.floor(r/10), o=r%10; return base+'零'+CN[t]+'十'+(o>0?CN[o]:''); }
  const h=Math.floor(r/100), r2=r%100;
  const mid=CN[h]+'百';
  if (r2===0) return base+mid;
  if (r2<10) return base+mid+'零'+CN[r2];
  const t=Math.floor(r2/10), o=r2%10;
  return base+mid+CN[t]+'十'+(o>0?CN[o]:'');
}

function toChineseArticleNumber(arabicStr: string): string {
  const m = arabicStr.match(/第(\d+)条/);
  if (!m) return arabicStr;
  return `第${arabicToChinese(parseInt(m[1], 10))}条`;
}

// ── relevant_laws 解析 ────────────────────────────────────────────────
// 格式：["《法律A》", "《第68条、第358条第1款》", ...]（阿拉伯数字条号）
// 法律名和条号交替，需要配对并转换为中文数字

interface ArticleRef {
  lawName: string;
  articleNumber: string;
}

function parseRelevantLaws(laws: string[] | null | undefined): ArticleRef[] {
  if (!Array.isArray(laws) || laws.length === 0) return [];

  const result: ArticleRef[] = [];
  const seen = new Set<string>();
  let currentLaw: string | null = null;

  for (const raw of laws) {
    const clean = raw.replace(/^《|》$/g, '').trim();

    // 过滤噪音
    if (NOISE_PATTERNS.some(n => clean.includes(n))) continue;

    // 判断是法律名还是条号
    const isLawName =
      (clean.includes('中华人民共和国') ||
       clean.includes('最高人民法院') ||
       clean.includes('最高人民检察院')) &&
      !clean.match(/^第\d/) &&
      !clean.startsWith('（');

    if (isLawName) {
      currentLaw = normalizeLawName(clean);
    } else if (currentLaw) {
      // 提取阿拉伯数字格式"第N条"，转为中文
      const arabicMatches = clean.match(/第\d+条/g) ?? [];
      for (const rawArticle of arabicMatches) {
        const articleNumber = toChineseArticleNumber(rawArticle);
        const key = `${currentLaw}::${articleNumber}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ lawName: currentLaw, articleNumber });
        }
      }
      // 也匹配中文数字格式（兼容）
      const cnMatches = clean.match(/第[一二三四五六七八九十百千零]+条/g) ?? [];
      for (const articleNumber of cnMatches) {
        const key = `${currentLaw}::${articleNumber}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ lawName: currentLaw, articleNumber });
        }
      }
    }
  }

  return result;
}

// ── 数据库法条索引（支持模糊匹配） ──────────────────────────────────
async function buildArticleIndex(): Promise<Map<string, string>> {
  const articles = await prisma.lawArticle.findMany({
    where: { status: 'VALID' },
    select: { id: true, lawName: true, articleNumber: true, effectiveDate: true },
    orderBy: { effectiveDate: 'desc' },
  });

  const map = new Map<string, string>();
  for (const a of articles) {
    const key = `${a.lawName}::${a.articleNumber}`;
    if (!map.has(key)) map.set(key, a.id);
  }

  // 额外建立简称索引（用法律名最后8个字+条号）
  const shortMap = new Map<string, string[]>();
  for (const a of articles) {
    const shortKey = `${a.lawName.slice(-8)}::${a.articleNumber}`;
    const existing = shortMap.get(shortKey) ?? [];
    existing.push(a.id);
    shortMap.set(shortKey, existing);
  }

  log(`  法条索引：${map.size} 条精确，${shortMap.size} 条简称`);
  return map;
}

function lookupArticle(
  lawName: string,
  articleNumber: string,
  index: Map<string, string>
): string | null {
  // 精确匹配
  const exact = index.get(`${lawName}::${articleNumber}`);
  if (exact) return exact;

  // 尝试"中华人民共和国X"和"X"互换
  const withPrefix = `中华人民共和国${lawName}`;
  const withPrefixMatch = index.get(`${withPrefix}::${articleNumber}`);
  if (withPrefixMatch) return withPrefixMatch;

  // 后缀匹配（法律名最后6-10字）
  for (const suffix of [8, 10, 12]) {
    const shortLaw = lawName.slice(-suffix);
    for (const [key, id] of index) {
      if (key.includes(shortLaw) && key.endsWith(`::${articleNumber}`)) {
        return id;
      }
    }
  }

  return null;
}

// ── 内联认识论重计算 ──────────────────────────────────────────────────
async function recomputeEpistemicForArticles(articleIds: string[]): Promise<void> {
  const COURT_LEVEL_WEIGHT: Record<string, number> = {
    SUPREME: 2.5, JUDICIAL_INTERP: 2.8, HIGH: 1.8, INTERMEDIATE: 1.2, BASIC: 0.8, UNKNOWN: 1.0,
  };
  const DECAY = 0.78, ALPHA = 0.20, POOL_ENTRY = 0.40, POOL_EXIT = 0.15;
  const PROVINCES = ['北京','天津','上海','重庆','河北','山西','辽宁','吉林','黑龙江','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','海南','四川','贵州','云南','陕西','甘肃','青海','内蒙古','广西','西藏','宁夏','新疆'];
  const SUPPORT_PATTERNS = [/依据.{0,20}(认定|支持)/, /符合.{0,15}规定/, /适用.{0,10}(本条|该条)/, /应予(支持|认可)/];
  const REBUTTAL_PATTERNS = [
    { weight: 0.85, patterns: [/不(适用|符合|满足|成立|构成)/, /已(废止|失效|撤销)/, /驳回/] },
    { weight: 0.5,  patterns: [/仅(适用|限于)/, /除非|前提是/, /限于|只有当/] },
    { weight: 0.65, patterns: [/特别法|优先(于|适用)/, /竞合|冲突/] },
    { weight: 0.25, patterns: [/难以(认定|支持)/, /尚(存争议|无定论)/] },
  ];

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

  for (const articleId of articleIds) {
    const curArt = await prisma.lawArticle.findUnique({ where: { id: articleId }, select: { lawName: true, articleNumber: true } });
    const allVersionIds = curArt
      ? await prisma.lawArticle.findMany({ where: { lawName: curArt.lawName, articleNumber: curArt.articleNumber }, select: { id: true } }).then(r => r.map(x => x.id))
      : [articleId];

    const [refs, histRefs] = await Promise.all([
      prisma.legalReference.findMany({
        where: { articleId, status: 'VALID', NOT: { metadata: { path: ['aiGenerated'], equals: true } } },
        include: { case: { select: { id: true, court: true, createdAt: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.historicalCaseArticleRef.findMany({ where: { lawArticleId: { in: allVersionIds } } }),
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
  }
}

// ── 主流程 ────────────────────────────────────────────────────────────
async function main() {
  const dataPath = 'C:/Users/deloo/Downloads/guiding-cases/guiding-cases/all_guiding_cases_full.json';

  if (!fs.existsSync(dataPath)) {
    log(`文件不存在：${dataPath}`);
    process.exit(1);
  }

  const cases = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as Array<{
    case_no: string;
    title: string;
    batch: number;
    publish_date: string;
    relevant_laws: string[];
  }>;

  log(`=== 导入已下载指导性案例（第40-47批）===`);
  log(`共 ${cases.length} 个案例`);

  log('\n加载法条索引...');
  const articleIndex = await buildArticleIndex();

  log('\n开始解析并写入 HistoricalCaseArticleRef...');

  let writtenTotal = 0, noMatchCount = 0;
  const affectedArticleIds = new Set<string>();

  for (const c of cases) {
    const articles = parseRelevantLaws(c.relevant_laws);
    const year = parseInt(c.publish_date.slice(0, 4), 10);
    const matchedIds: string[] = [];
    const unmatchedRefs: string[] = [];

    for (const art of articles) {
      const id = lookupArticle(art.lawName, art.articleNumber, articleIndex);
      if (id) {
        matchedIds.push(id);
        affectedArticleIds.add(id);
      } else {
        unmatchedRefs.push(`${art.lawName.slice(-8)}${art.articleNumber}`);
      }
    }

    if (matchedIds.length === 0) {
      log(`  ⚠ ${c.case_no}「${c.title.slice(0, 20)}」— 无匹配法条`);
      if (unmatchedRefs.length > 0) log(`    未匹配：${unmatchedRefs.join(', ')}`);
      noMatchCount++;
      continue;
    }

    // 写入（SUPREME_GUIDING 来源，全国有效）
    for (const articleId of matchedIds) {
      try {
        await prisma.historicalCaseArticleRef.upsert({
          where: {
            lawArticleId_jurisdiction_courtLevel: {
              lawArticleId: articleId,
              jurisdiction: '全国',
              courtLevel: 'SUPREME',
            },
          },
          update: {
            caseCount: { increment: 1 },
            applicabilitySignal: 0.95,
            dataSource: 'SUPREME_GUIDING',
            updatedAt: new Date(),
          },
          create: {
            lawArticleId: articleId,
            dataSource: 'SUPREME_GUIDING',
            jurisdiction: '全国',
            courtLevel: 'SUPREME',
            caseCount: 1,
            applicabilitySignal: 0.95,
          },
        });
        writtenTotal++;
      } catch (e) {
        log(`  错误 ${c.case_no}: ${e}`);
      }
    }

    const matchInfo = unmatchedRefs.length > 0 ? ` [未匹配: ${unmatchedRefs.join(', ')}]` : '';
    log(`  ✓ ${c.case_no} 第${c.batch}批 ${year}年「${c.title.slice(0, 22)}」→ ${matchedIds.length} 条法条${matchInfo}`);
  }

  log(`\n写入完成：${writtenTotal} 条，无匹配案例：${noMatchCount} 个`);
  log(`受影响法条：${affectedArticleIds.size} 条`);

  const total = await prisma.historicalCaseArticleRef.count({ where: { dataSource: 'SUPREME_GUIDING' } });
  log(`数据库 SUPREME_GUIDING 总记录：${total} 条`);

  log('\n重新计算认识论状态...');
  await recomputeEpistemicForArticles(Array.from(affectedArticleIds));

  // 最终状态分布
  const dist = await prisma.lawArticleEpistemicState.groupBy({ by: ['profile'], _count: { id: true } });
  log('\n最终认识论状态分布：');
  dist.forEach(d => log(`  ${d.profile}: ${d._count.id} 条`));

  log('\n完成！');
}

main()
  .catch(err => { log(`FATAL: ${err}`); process.exit(1); })
  .finally(() => prisma.$disconnect());
