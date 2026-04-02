/**
 * 案例认识论贡献器
 *
 * 语义晶体 SCP 元认知哲学在法律案例层面的落地：
 * 每条法条的认识论状态由其历史案例引用语料持续更新。
 *
 * 流程（对应 SCP 五层架构）：
 *   Layer 0 - 从 LegalReference + Case 构建"语料"
 *   Layer 1 - 检测反驳类型信号（PMI 简化版：规则匹配）
 *   Layer 2 - 贝叶斯置信度更新（含惯性）
 *   Layer 3 - 来源独立性（法院层级 + 司法管辖多样性）
 *   Layer 4 - 输出认识论状态 + 校准表达词
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { EpistemicProfile, RebuttalType } from '@prisma/client';

// ══════════════════════════════════════════════════════
// 法律特有：法院效力层级权重（替代 SCP 的来源独立性权重）
// ══════════════════════════════════════════════════════

const COURT_LEVEL_WEIGHT: Record<string, number> = {
  SUPREME: 2.5, // 最高人民法院
  JUDICIAL_INTERP: 2.8, // 最高法司法解释
  HIGH: 1.8, // 高级人民法院（省级）
  INTERMEDIATE: 1.2, // 中级人民法院
  BASIC: 0.8, // 基层人民法院
  UNKNOWN: 1.0,
};

// ══════════════════════════════════════════════════════
// 反驳信号规则（Layer 1 简化版 — 规则匹配，无需 PMI）
// ══════════════════════════════════════════════════════

const REBUTTAL_PATTERNS: Array<{
  type: RebuttalType;
  weight: number;
  patterns: RegExp[];
}> = [
  {
    type: 'DIRECT_DENIAL',
    weight: 0.85,
    patterns: [
      /不(适用|符合|满足|成立|构成)/,
      /无效|违反|违法|不合法/,
      /已(废止|失效|撤销)/,
      /不予支持|驳回|不予认可/,
    ],
  },
  {
    type: 'BOUNDARY_CONTRACTION',
    weight: 0.5,
    patterns: [
      /仅(适用|限于|针对)/,
      /除非|前提是|条件是/,
      /不(一定|必然|当然)适用/,
      /需结合.{0,15}(具体|实际|情况)/,
      /限于|仅在|只有当/,
    ],
  },
  {
    type: 'COMPETITIVE_REPLACEMENT',
    weight: 0.65,
    patterns: [
      /应(适用|优先适用|援引)/,
      /特别法|优先(于|适用)/,
      /应当(依据|按照|参照)/,
      /竞合|冲突|优先性/,
    ],
  },
  {
    type: 'SILENT_NEGATION',
    weight: 0.25,
    patterns: [
      /难以(认定|支持|成立)/,
      /值得(商榷|探讨|质疑)/,
      /尚(存争议|无定论|不明确)/,
      /存在(分歧|争议|不同观点)/,
    ],
  },
];

const SUPPORT_PATTERNS: RegExp[] = [
  /依据.{0,20}(认定|支持|成立)/,
  /符合.{0,15}规定/,
  /适用.{0,10}(本条|该条|上述)/,
  /依法.{0,10}(支持|认可|确认)/,
  /应予(支持|认可|确认)/,
];

// ══════════════════════════════════════════════════════
// 工具函数
// ══════════════════════════════════════════════════════

function detectCourtLevel(courtName: string | null | undefined): string {
  if (!courtName) return 'UNKNOWN';
  if (courtName.includes('最高') || courtName.includes('最高人民法院'))
    return 'SUPREME';
  if (courtName.includes('高级') || courtName.includes('高院')) return 'HIGH';
  if (courtName.includes('中级') || courtName.includes('中院'))
    return 'INTERMEDIATE';
  if (
    courtName.includes('基层') ||
    courtName.includes('区') ||
    courtName.includes('县')
  )
    return 'BASIC';
  return 'UNKNOWN';
}

function extractJurisdiction(courtName: string | null | undefined): string {
  if (!courtName) return 'UNKNOWN';
  // 提取省/直辖市名
  const provinces = [
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
  for (const p of provinces) {
    if (courtName.includes(p)) return p;
  }
  return 'UNKNOWN';
}

function detectRebuttalSignals(content: string): {
  hasRebuttal: boolean;
  rebuttalType: RebuttalType | null;
  rebuttalStrength: number;
  hasSupport: boolean;
} {
  const text = content;
  let maxStrength = 0;
  let dominantType: RebuttalType | null = null;

  for (const rule of REBUTTAL_PATTERNS) {
    const hit = rule.patterns.some(p => p.test(text));
    if (hit && rule.weight > maxStrength) {
      maxStrength = rule.weight;
      dominantType = rule.type;
    }
  }

  const hasSupport = SUPPORT_PATTERNS.some(p => p.test(text));

  return {
    hasRebuttal: maxStrength > 0,
    rebuttalType: dominantType,
    rebuttalStrength: maxStrength,
    hasSupport,
  };
}

/**
 * 计算来源独立性（Layer 3 简化版）
 *
 * 核心洞见：同一法院同层级的多个判决 = 低独立性
 * 不同省份不同层级 = 高独立性
 *
 * 独立性权重 = (1 / sqrt(聚类大小)) * (1 - 内部相似度 * 0.5)
 */
function computeSourceIndependence(
  sources: Array<{
    courtName: string | null;
    level: string;
    jurisdiction: string;
    applicabilityScore: number;
  }>
): {
  independence: number;
  effectiveCount: number;
  jurisdictionCount: number;
  courtLevelSpread: number;
} {
  if (sources.length === 0) {
    return {
      independence: 0,
      effectiveCount: 0,
      jurisdictionCount: 0,
      courtLevelSpread: 0,
    };
  }

  // 按 (jurisdiction, level) 聚类
  const clusters = new Map<string, typeof sources>();
  for (const s of sources) {
    const key = `${s.jurisdiction}::${s.level}`;
    const existing = clusters.get(key) ?? [];
    existing.push(s);
    clusters.set(key, existing);
  }

  let effectiveCount = 0;
  for (const [, members] of clusters) {
    // 聚类独立性权重：越大权重越低（SCP Layer 3）
    const weight = 1.0 / Math.sqrt(Math.max(1, members.length));
    effectiveCount += weight;
  }

  const jurisdictions = new Set(
    sources.map(s => s.jurisdiction).filter(j => j !== 'UNKNOWN')
  );
  const levels = new Set(
    sources.map(s => s.level).filter(l => l !== 'UNKNOWN')
  );

  return {
    independence: Math.min(1.0, effectiveCount / sources.length),
    effectiveCount: Math.round(effectiveCount * 100) / 100,
    jurisdictionCount: jurisdictions.size,
    courtLevelSpread: levels.size,
  };
}

/**
 * 根据 consensusScore + challengePressure + inertia 确定状态画像
 * 对应 SCP BayesianUpdater.profile()
 */
function determineProfile(
  consensus: number,
  rebuttal: number,
  inertia: number,
  inPool: boolean
): { profile: EpistemicProfile; expressionGuide: string } {
  if (consensus > 0.85 && rebuttal < 0.15) {
    return { profile: 'IRON_CLAD', expressionGuide: '可以确定地说' };
  }
  if (consensus > 0.65 && rebuttal > 0.2) {
    return {
      profile: 'MAINSTREAM_TROUBLED',
      expressionGuide: '目前仍倾向于认为',
    };
  }
  if (inPool && consensus > 0.35 && consensus <= 0.65) {
    return { profile: 'CANDIDATE_POOL', expressionGuide: '目前无法确定' };
  }
  if (rebuttal > 0.7 || consensus < 0.35) {
    return {
      profile: 'FADING',
      expressionGuide: '现在倾向于认为这一解释存在争议',
    };
  }
  return {
    profile: 'UNCERTAIN',
    expressionGuide:
      '目前没有足够案例数据来判断法院在类似情形下是否一致适用该条文，但本案所涉事实较适用该条文，具体适用须以法院裁量为准',
  };
}

// ══════════════════════════════════════════════════════
// 主服务类
// ══════════════════════════════════════════════════════

export class CaseEpistemicContributor {
  // SCP BayesianUpdater 参数
  private readonly DECAY = 0.78;
  private readonly POOL_ENTRY_THRESHOLD = 0.4;
  private readonly POOL_EXIT_THRESHOLD = 0.15;
  private readonly ALPHA = 0.2; // 每次更新步长

  /**
   * 计算并更新单条法条的认识论状态
   *
   * 数据来源（双轨）：
   *   - LegalReference（真实案件，含 content 可做反驳信号检测）
   *   - HistoricalCaseArticleRef（CAIL2018 等历史聚合数据，全部为支持信号）
   */
  async computeForArticle(articleId: string): Promise<void> {
    try {
      // ── Layer 0a：真实案例引用（排除 AI 辩论生成，避免循环论证）──
      const references = await prisma.legalReference.findMany({
        where: {
          articleId,
          status: 'VALID',
          NOT: { metadata: { path: ['aiGenerated'], equals: true } },
        },
        include: {
          case: {
            select: { id: true, court: true, createdAt: true, cause: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // ── Layer 0b：历史聚合案例（跨版本聚合）──
      // 同一法条可能有多个版本 ID（VALID/AMENDED），CAIL2018 和指导案例可能分别链接不同版本
      // 必须聚合所有版本的历史引用，否则认识论证据会割裂
      const currentArticle = await prisma.lawArticle.findUnique({
        where: { id: articleId },
        select: { lawName: true, articleNumber: true },
      });
      const allVersionIds = currentArticle
        ? await prisma.lawArticle
            .findMany({
              where: {
                lawName: currentArticle.lawName,
                articleNumber: currentArticle.articleNumber,
              },
              select: { id: true },
            })
            .then(rows => rows.map(r => r.id))
        : [articleId];

      const historicalRefs = await prisma.historicalCaseArticleRef.findMany({
        where: { lawArticleId: { in: allVersionIds } },
      });

      const totalHistoricalCases = historicalRefs.reduce(
        (s, r) => s + r.caseCount,
        0
      );

      // ── 检测法条修正历史（AMENDED 版本存在 → 表达须提示核查）──
      // 以事实为依据、以法律为准绳：历史案例可能适用旧版条文，须提示律师核查现行版本
      const hasAmendedVersions =
        allVersionIds.length > 1 &&
        (await prisma.lawArticle
          .count({
            where: { id: { in: allVersionIds }, status: 'AMENDED' },
          })
          .then(c => c > 0));

      if (references.length === 0 && historicalRefs.length === 0) {
        await prisma.lawArticleEpistemicState.upsert({
          where: { lawArticleId: articleId },
          create: {
            lawArticleId: articleId,
            profile: 'UNCERTAIN',
            totalCasesApplied: 0,
          },
          update: { computedAt: new Date() },
        });
        return;
      }

      // ── Layer 3：来源独立性（实时引用部分）──
      const liveSources = references.map(r => ({
        courtName: r.case?.court ?? null,
        level: detectCourtLevel(r.case?.court),
        jurisdiction: extractJurisdiction(r.case?.court),
        applicabilityScore: r.applicabilityScore ?? 0.5,
      }));

      // 历史引用已经是 (jurisdiction, courtLevel) 聚合，每行即一个独立来源节点
      const historicalSources = historicalRefs.map(r => ({
        courtName: null,
        level: r.courtLevel,
        jurisdiction: r.jurisdiction,
        applicabilityScore: r.applicabilitySignal,
      }));

      const allSources = [...liveSources, ...historicalSources];
      const indepResult = computeSourceIndependence(allSources);

      // ── Layer 1 + 2：贝叶斯更新 ──
      let consensus = 0.5;
      let rebuttal = 0.01;
      let inertia = 0.0;
      let inPool = false;
      let poolEntryDate: Date | undefined;
      let poolExitDate: Date | undefined;
      let alternativeStrength = 0.0;
      let minorityCount = 0;
      let lastCaseId: string | undefined;

      // 先处理实时引用（含反驳信号检测）
      for (let i = 0; i < references.length; i++) {
        const ref = references[i];
        const s = liveSources[i];
        const levelWeight = COURT_LEVEL_WEIGHT[s.level] ?? 1.0;
        const w = Math.min(2.0, levelWeight * indepResult.independence);
        const alpha = this.ALPHA * w;

        const signals = detectRebuttalSignals(ref.content);
        if (signals.rebuttalStrength > 0.3 && consensus > 0.75) {
          minorityCount++;
        }
        if (signals.hasSupport && !signals.hasRebuttal) {
          consensus = Math.min(0.98, consensus + alpha * 0.3);
        }
        if (signals.hasRebuttal) {
          rebuttal = Math.min(1.0, rebuttal + alpha * signals.rebuttalStrength);
          consensus = Math.max(
            0.0,
            consensus - alpha * 0.7 * signals.rebuttalStrength
          );
        }
        if (signals.rebuttalType === 'COMPETITIVE_REPLACEMENT') {
          alternativeStrength = Math.min(
            1.0,
            alternativeStrength + alpha * 0.8
          );
        }
        inertia = signals.rebuttalStrength * w + this.DECAY * inertia;

        const prevPool = inPool;
        if (inertia > this.POOL_ENTRY_THRESHOLD && !inPool) {
          inPool = true;
          poolEntryDate = ref.case?.createdAt;
        } else if (inertia < this.POOL_EXIT_THRESHOLD && inPool) {
          inPool = false;
          poolExitDate = ref.case?.createdAt;
        }
        if (!prevPool && inPool) poolEntryDate = ref.case?.createdAt;
        lastCaseId = ref.caseId ?? undefined;
      }

      // 再处理历史聚合引用（仅支持信号，对数饱和，防止海量数据洗稿实时反驳）
      for (const hist of historicalRefs) {
        const levelWeight = COURT_LEVEL_WEIGHT[hist.courtLevel] ?? 1.0;
        // 对数饱和：1000条和10条不一样，但不呈线性；log10(10)=1, log10(1000)=3
        const caseSaturation = Math.min(2.0, Math.log10(1 + hist.caseCount));
        const supportStrength = hist.applicabilitySignal * caseSaturation * 0.1;
        const alpha = this.ALPHA * levelWeight * 0.5; // 历史引用权重减半，保留实时引用的主导地位
        consensus = Math.min(0.98, consensus + alpha * supportStrength);
      }

      // ── Layer 4：状态画像 ──
      const { profile, expressionGuide: baseGuide } = determineProfile(
        consensus,
        rebuttal,
        inertia,
        inPool
      );
      // 若该法条存在修正案历史版本，在表达指引末尾附加核查提示
      // 体现"以法律为准绳"原则：历史案例适用旧版，现行裁判须以最新版为准
      const expressionGuide = hasAmendedVersions
        ? `${baseGuide}（注：该条文存在修正案历史版本，引用历史案例时须核查当时适用版本与现行条文的差异）`
        : baseGuide;
      const totalCasesApplied = references.length + totalHistoricalCases;

      await prisma.lawArticleEpistemicState.upsert({
        where: { lawArticleId: articleId },
        create: {
          lawArticleId: articleId,
          profile,
          consensusScore: Math.round(consensus * 1000) / 1000,
          challengePressure: Math.round(rebuttal * 1000) / 1000,
          inertia: Math.round(inertia * 1000) / 1000,
          inCandidatePool: inPool,
          alternativeStrength: Math.round(alternativeStrength * 1000) / 1000,
          sourceIndependence:
            Math.round(indepResult.independence * 1000) / 1000,
          effectiveSourceCount: indepResult.effectiveCount,
          totalCasesApplied,
          jurisdictionCount: indepResult.jurisdictionCount,
          courtLevelSpread: indepResult.courtLevelSpread,
          minorityPressureCount: minorityCount,
          poolEntryDate,
          poolExitDate,
          expressionGuide,
          lastCaseId: lastCaseId ?? null,
        },
        update: {
          profile,
          consensusScore: Math.round(consensus * 1000) / 1000,
          challengePressure: Math.round(rebuttal * 1000) / 1000,
          inertia: Math.round(inertia * 1000) / 1000,
          inCandidatePool: inPool,
          alternativeStrength: Math.round(alternativeStrength * 1000) / 1000,
          sourceIndependence:
            Math.round(indepResult.independence * 1000) / 1000,
          effectiveSourceCount: indepResult.effectiveCount,
          totalCasesApplied,
          jurisdictionCount: indepResult.jurisdictionCount,
          courtLevelSpread: indepResult.courtLevelSpread,
          minorityPressureCount: minorityCount,
          poolEntryDate,
          poolExitDate,
          expressionGuide,
          lastCaseId: lastCaseId ?? null,
          computedAt: new Date(),
        },
      });

      logger.debug('Updated epistemic state', {
        articleId,
        profile,
        consensusScore: consensus,
        liveRefs: references.length,
        historicalClusters: historicalRefs.length,
        historicalCases: totalHistoricalCases,
        effectiveSourceCount: indepResult.effectiveCount,
      });
    } catch (error) {
      logger.error('CaseEpistemicContributor.computeForArticle failed', {
        articleId,
        error,
      });
    }
  }

  /**
   * 批量计算所有有案例引用的法条的认识论状态
   * 同时涵盖 LegalReference 和 HistoricalCaseArticleRef 两个数据源
   */
  async computeAll(
    batchSize = 50
  ): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    // 从两个数据源收集需要计算的 articleId
    const [liveRefs, historicalRefs] = await Promise.all([
      prisma.legalReference.findMany({
        where: {
          articleId: { not: null },
          status: 'VALID',
          NOT: { metadata: { path: ['aiGenerated'], equals: true } },
        },
        select: { articleId: true },
        distinct: ['articleId'],
      }),
      prisma.historicalCaseArticleRef.findMany({
        select: { lawArticleId: true },
        distinct: ['lawArticleId'],
      }),
    ]);

    const idSet = new Set<string>();
    liveRefs.forEach(r => {
      if (r.articleId) idSet.add(r.articleId);
    });
    historicalRefs.forEach(r => idSet.add(r.lawArticleId));

    const ids = Array.from(idSet);
    logger.info(
      `CaseEpistemicContributor: computing ${ids.length} articles (${liveRefs.length} live, ${historicalRefs.length} historical clusters)`
    );

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(id =>
          this.computeForArticle(id)
            .then(() => processed++)
            .catch(() => errors++)
        )
      );
      if ((i + batchSize) % 200 === 0) {
        logger.info(
          `CaseEpistemicContributor: progress ${processed}/${ids.length}`
        );
      }
    }

    logger.info(`CaseEpistemicContributor: done`, { processed, errors });
    return { processed, errors };
  }
}

// 单例工厂
let _instance: CaseEpistemicContributor | null = null;

export function getCaseEpistemicContributor(): CaseEpistemicContributor {
  if (!_instance) _instance = new CaseEpistemicContributor();
  return _instance;
}
