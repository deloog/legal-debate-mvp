/**
 * 触发全量法条认识论状态计算
 *
 * 使用方法：
 *   npx ts-node --project scripts/tsconfig.json scripts/compute-epistemic-states.ts
 */

// eslint-disable-next-line no-console
const log = (msg: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

import { PrismaClient, EpistemicProfile } from '@prisma/client';

const prisma = new PrismaClient();

// ── 内联必要的常量和辅助函数（scripts 不走 @/ 路径解析）──

const COURT_LEVEL_WEIGHT: Record<string, number> = {
  SUPREME: 2.5, JUDICIAL_INTERP: 2.8, HIGH: 1.8, INTERMEDIATE: 1.2, BASIC: 0.8, UNKNOWN: 1.0,
};
const DECAY = 0.78;
const ALPHA = 0.20;
const POOL_ENTRY_THRESHOLD = 0.40;
const POOL_EXIT_THRESHOLD = 0.15;

const REBUTTAL_PATTERNS: Array<{ weight: number; patterns: RegExp[] }> = [
  { weight: 0.85, patterns: [/不(适用|符合|满足|成立|构成)/, /无效|违反|违法|不合法/, /已(废止|失效|撤销)/, /不予支持|驳回|不予认可/] },
  { weight: 0.5,  patterns: [/仅(适用|限于|针对)/, /除非|前提是|条件是/, /不(一定|必然|当然)适用/, /需结合.{0,15}(具体|实际|情况)/, /限于|仅在|只有当/] },
  { weight: 0.65, patterns: [/应(适用|优先适用|援引)/, /特别法|优先(于|适用)/, /应当(依据|按照|参照)/, /竞合|冲突|优先性/] },
  { weight: 0.25, patterns: [/难以(认定|支持|成立)/, /值得(商榷|探讨|质疑)/, /尚(存争议|无定论|不明确)/, /存在(分歧|争议|不同观点)/] },
];
const SUPPORT_PATTERNS = [/依据.{0,20}(认定|支持|成立)/, /符合.{0,15}规定/, /适用.{0,10}(本条|该条|上述)/, /依法.{0,10}(支持|认可|确认)/, /应予(支持|认可|确认)/];

const PROVINCES = ['北京','天津','上海','重庆','河北','山西','辽宁','吉林','黑龙江','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','海南','四川','贵州','云南','陕西','甘肃','青海','内蒙古','广西','西藏','宁夏','新疆'];

function detectCourtLevel(courtName: string | null | undefined): string {
  if (!courtName) return 'UNKNOWN';
  if (courtName.includes('最高')) return 'SUPREME';
  if (courtName.includes('高级') || courtName.includes('高院')) return 'HIGH';
  if (courtName.includes('中级') || courtName.includes('中院')) return 'INTERMEDIATE';
  if (courtName.includes('基层') || courtName.includes('区') || courtName.includes('县')) return 'BASIC';
  return 'UNKNOWN';
}

function extractJurisdiction(courtName: string | null | undefined): string {
  if (!courtName) return 'UNKNOWN';
  for (const p of PROVINCES) { if (courtName.includes(p)) return p; }
  return 'UNKNOWN';
}

function computeSourceIndependence(sources: Array<{ level: string; jurisdiction: string }>) {
  if (sources.length === 0) return { independence: 0, effectiveCount: 0, jurisdictionCount: 0, courtLevelSpread: 0 };
  const clusters = new Map<string, number>();
  for (const s of sources) {
    const key = `${s.jurisdiction}::${s.level}`;
    clusters.set(key, (clusters.get(key) ?? 0) + 1);
  }
  let effectiveCount = 0;
  for (const [, sz] of clusters) effectiveCount += 1.0 / Math.sqrt(Math.max(1, sz));
  const jurisdictions = new Set(sources.map(s => s.jurisdiction).filter(j => j !== 'UNKNOWN'));
  const levels = new Set(sources.map(s => s.level).filter(l => l !== 'UNKNOWN'));
  return {
    independence: Math.min(1.0, effectiveCount / sources.length),
    effectiveCount: Math.round(effectiveCount * 100) / 100,
    jurisdictionCount: jurisdictions.size,
    courtLevelSpread: levels.size,
  };
}

function determineProfile(consensus: number, rebuttal: number, inertia: number, inPool: boolean): { profile: EpistemicProfile; expressionGuide: string } {
  if (consensus > 0.85 && rebuttal < 0.15) return { profile: 'IRON_CLAD', expressionGuide: '可以确定地说' };
  if (consensus > 0.65 && rebuttal > 0.20) return { profile: 'MAINSTREAM_TROUBLED', expressionGuide: '目前仍倾向于认为' };
  if (inPool && consensus > 0.35 && consensus <= 0.65) return { profile: 'CANDIDATE_POOL', expressionGuide: '目前无法确定' };
  if (rebuttal > 0.70 || consensus < 0.35) return { profile: 'FADING', expressionGuide: '现在倾向于认为这一解释存在争议' };
  return { profile: 'UNCERTAIN', expressionGuide: '目前没有足够案例数据来判断法院在类似情形下是否一致适用该条文，但本案所涉事实较适用该条文，具体适用须以法院裁量为准' };
}

async function computeForArticle(articleId: string): Promise<void> {
  const references = await prisma.legalReference.findMany({
    where: { articleId, status: 'VALID', NOT: { metadata: { path: ['aiGenerated'], equals: true } } },
    include: { case: { select: { id: true, court: true, createdAt: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // 跨版本聚合：同一法条的 CAIL2018/SUPREME_GUIDING 可能分别链接到不同版本 ID
  const curArt = await prisma.lawArticle.findUnique({ where: { id: articleId }, select: { lawName: true, articleNumber: true } });
  const allVersionIds = curArt
    ? await prisma.lawArticle.findMany({ where: { lawName: curArt.lawName, articleNumber: curArt.articleNumber }, select: { id: true } }).then(r => r.map(x => x.id))
    : [articleId];
  const historicalRefs = await prisma.historicalCaseArticleRef.findMany({ where: { lawArticleId: { in: allVersionIds } } });
  const totalHistoricalCases = historicalRefs.reduce((s, r) => s + r.caseCount, 0);

  if (references.length === 0 && historicalRefs.length === 0) {
    await prisma.lawArticleEpistemicState.upsert({
      where: { lawArticleId: articleId },
      create: { lawArticleId: articleId, profile: 'UNCERTAIN', totalCasesApplied: 0 },
      update: { computedAt: new Date() },
    });
    return;
  }

  const liveSources = references.map(r => ({ level: detectCourtLevel(r.case?.court), jurisdiction: extractJurisdiction(r.case?.court) }));
  const histSources = historicalRefs.map(r => ({ level: r.courtLevel, jurisdiction: r.jurisdiction }));
  const indep = computeSourceIndependence([...liveSources, ...histSources]);

  let consensus = 0.5, rebuttal = 0.01, inertia = 0.0, inPool = false;
  let poolEntryDate: Date | undefined, poolExitDate: Date | undefined;
  let alternativeStrength = 0.0, minorityCount = 0;
  let lastCaseId: string | undefined;

  for (let i = 0; i < references.length; i++) {
    const ref = references[i];
    const levelWeight = COURT_LEVEL_WEIGHT[liveSources[i].level] ?? 1.0;
    const w = Math.min(2.0, levelWeight * indep.independence);
    const alpha = ALPHA * w;
    let maxStrength = 0, isRebuttal = false, isSupport = false, isCompReplacement = false;
    for (const rule of REBUTTAL_PATTERNS) {
      if (rule.patterns.some(p => p.test(ref.content)) && rule.weight > maxStrength) { maxStrength = rule.weight; isRebuttal = true; }
    }
    isSupport = SUPPORT_PATTERNS.some(p => p.test(ref.content));
    if (REBUTTAL_PATTERNS[2].patterns.some(p => p.test(ref.content))) isCompReplacement = true;
    if (maxStrength > 0.3 && consensus > 0.75) minorityCount++;
    if (isSupport && !isRebuttal) consensus = Math.min(0.98, consensus + alpha * 0.3);
    if (isRebuttal) { rebuttal = Math.min(1.0, rebuttal + alpha * maxStrength); consensus = Math.max(0.0, consensus - alpha * 0.7 * maxStrength); }
    if (isCompReplacement) alternativeStrength = Math.min(1.0, alternativeStrength + alpha * 0.8);
    inertia = maxStrength * w + DECAY * inertia;
    const prevPool = inPool;
    if (inertia > POOL_ENTRY_THRESHOLD && !inPool) { inPool = true; poolEntryDate = ref.case?.createdAt; }
    else if (inertia < POOL_EXIT_THRESHOLD && inPool) { inPool = false; poolExitDate = ref.case?.createdAt; }
    if (!prevPool && inPool) poolEntryDate = ref.case?.createdAt;
    lastCaseId = ref.caseId ?? undefined;
  }

  for (const hist of historicalRefs) {
    const levelWeight = COURT_LEVEL_WEIGHT[hist.courtLevel] ?? 1.0;
    const caseSaturation = Math.min(2.0, Math.log10(1 + hist.caseCount));
    const supportStrength = hist.applicabilitySignal * caseSaturation * 0.1;
    consensus = Math.min(0.98, consensus + ALPHA * levelWeight * 0.5 * supportStrength);
  }

  const { profile, expressionGuide: baseGuide } = determineProfile(consensus, rebuttal, inertia, inPool);
  const hasAmended = allVersionIds.length > 1 &&
    await prisma.lawArticle.count({ where: { id: { in: allVersionIds }, status: 'AMENDED' } }).then(c => c > 0);
  const expressionGuide = hasAmended
    ? `${baseGuide}（注：该条文存在修正案历史版本，引用历史案例时须核查当时适用版本与现行条文的差异）`
    : baseGuide;
  const totalCasesApplied = references.length + totalHistoricalCases;

  const data = {
    profile, consensusScore: Math.round(consensus * 1000) / 1000, challengePressure: Math.round(rebuttal * 1000) / 1000,
    inertia: Math.round(inertia * 1000) / 1000, inCandidatePool: inPool, alternativeStrength: Math.round(alternativeStrength * 1000) / 1000,
    sourceIndependence: Math.round(indep.independence * 1000) / 1000, effectiveSourceCount: indep.effectiveCount,
    totalCasesApplied, jurisdictionCount: indep.jurisdictionCount, courtLevelSpread: indep.courtLevelSpread,
    minorityPressureCount: minorityCount, poolEntryDate, poolExitDate, expressionGuide, lastCaseId: lastCaseId ?? null,
  };
  await prisma.lawArticleEpistemicState.upsert({
    where: { lawArticleId: articleId },
    create: { lawArticleId: articleId, ...data },
    update: { ...data, computedAt: new Date() },
  });
}

async function main() {
  log('开始全量认识论状态计算...');
  const startTime = Date.now();

  const [liveRefs, historicalRefs] = await Promise.all([
    prisma.legalReference.findMany({
      where: { articleId: { not: null }, status: 'VALID', NOT: { metadata: { path: ['aiGenerated'], equals: true } } },
      select: { articleId: true }, distinct: ['articleId'],
    }),
    prisma.historicalCaseArticleRef.findMany({ select: { lawArticleId: true }, distinct: ['lawArticleId'] }),
  ]);

  const idSet = new Set<string>();
  liveRefs.forEach(r => { if (r.articleId) idSet.add(r.articleId); });
  historicalRefs.forEach(r => idSet.add(r.lawArticleId));
  const ids = Array.from(idSet);

  log(`需计算法条数：${ids.length}（实时引用 ${liveRefs.length} 条，历史聚合 ${historicalRefs.length} 个）`);

  let processed = 0, errors = 0;
  const BATCH = 50;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(id =>
      computeForArticle(id).then(() => processed++).catch(e => { errors++; log(`  错误 ${id}: ${e}`); })
    ));
    if ((i + BATCH) % 500 === 0) log(`  进度 ${processed}/${ids.length}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`完成：处理 ${processed} 条，失败 ${errors} 条（${elapsed}s）`);

  const distribution = await prisma.lawArticleEpistemicState.groupBy({ by: ['profile'], _count: { id: true } });
  log('状态分布：');
  for (const d of distribution) log(`  ${d.profile}: ${d._count.id} 条`);
}

main()
  .catch(err => { log(`FATAL: ${err}`); process.exit(1); })
  .finally(() => prisma.$disconnect());
