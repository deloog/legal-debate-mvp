import {
  RelationType,
  VerificationStatus,
  type LegalReferenceStatus,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import type {
  ConflictInfo,
  EvolutionChainItem,
} from '@/lib/case/knowledge-graph-analyzer';
import type { InferenceResult } from '@/lib/knowledge-graph/reasoning/types';

export type ApplicationConfidence = 'high' | 'medium' | 'low';
export type ApplicationRiskSeverity = 'high' | 'medium' | 'low';
export type ApplicationRouteStatus = 'ready' | 'attention' | 'missing';

export interface ApplicationCoreArticle {
  articleId: string;
  title: string;
  lawName: string;
  articleNumber: string;
  score: number | null;
  confidence: ApplicationConfidence;
  sourceLabel: string;
  status: string;
  reasons: string[];
  useGuidance: string;
  excerpt?: string;
}

export interface ApplicationSupportingArticle {
  articleId: string;
  title: string;
  relationType: RelationType;
  relationLabel: string;
  anchorArticleId: string;
  anchorTitle: string;
  confidence: ApplicationConfidence;
  score: number;
  reason: string;
}

export interface ApplicationRiskArticle {
  severity: ApplicationRiskSeverity;
  title: string;
  description: string;
  articleIds: string[];
  action: string;
}

export interface ApplicationRouteStep {
  id: string;
  title: string;
  status: ApplicationRouteStatus;
  articleIds: string[];
  description: string;
  action: string;
}

export interface CaseLawApplicationAnalysis {
  version: '2.0';
  summary: {
    coreCount: number;
    supportingCount: number;
    riskCount: number;
    overallConfidence: ApplicationConfidence;
    headline: string;
  };
  coreArticles: ApplicationCoreArticle[];
  supportingArticles: ApplicationSupportingArticle[];
  riskArticles: ApplicationRiskArticle[];
  applicationRoute: ApplicationRouteStep[];
  nextActions: string[];
}

interface BuildCaseLawApplicationAnalysisInput {
  caseId: string;
  articleIds: string[];
  conflicts: ConflictInfo[];
  evolutionChain: EvolutionChainItem[];
  recommendedArticleIds: string[];
  keyInferences: InferenceResult[];
}

interface LegalReferenceForAnalysis {
  articleId: string | null;
  source: string;
  articleNumber: string | null;
  content: string;
  applicabilityScore: number | null;
  relevanceScore: number | null;
  applicabilityReason: string | null;
  analysisResult: unknown;
  metadata: unknown;
  status: LegalReferenceStatus;
  analyzedAt: Date | null;
}

interface LawArticleForAnalysis {
  id: string;
  lawName: string;
  articleNumber: string;
  fullText: string;
  status: string;
  category: string;
  lawType: string;
}

interface RelationForAnalysis {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  strength: number;
  confidence: number;
  description: string | null;
  source: {
    id: string;
    lawName: string;
    articleNumber: string;
  };
  target: {
    id: string;
    lawName: string;
    articleNumber: string;
  };
}

const SUPPORTING_RELATIONS = new Set<RelationType>([
  RelationType.COMPLETES,
  RelationType.COMPLETED_BY,
  RelationType.IMPLEMENTS,
  RelationType.IMPLEMENTED_BY,
  RelationType.CITES,
  RelationType.CITED_BY,
  RelationType.RELATED,
]);

export function createEmptyLawApplicationAnalysis(): CaseLawApplicationAnalysis {
  return {
    version: '2.0',
    summary: {
      coreCount: 0,
      supportingCount: 0,
      riskCount: 0,
      overallConfidence: 'low',
      headline: '尚未形成可用的法条适用分析',
    },
    coreArticles: [],
    supportingArticles: [],
    riskArticles: [],
    applicationRoute: [],
    nextActions: [
      '先完成法条适用性分析或模拟辩论，让系统沉淀本案涉案法条。',
      '上传并分析主要卷宗后，再回到本页查看法条适用路线。',
    ],
  };
}

export async function buildCaseLawApplicationAnalysis({
  caseId,
  articleIds,
  conflicts,
  evolutionChain,
  recommendedArticleIds,
  keyInferences,
}: BuildCaseLawApplicationAnalysisInput): Promise<CaseLawApplicationAnalysis> {
  if (articleIds.length === 0) {
    return createEmptyLawApplicationAnalysis();
  }

  const [legalReferences, articles, relations] = await Promise.all([
    prisma.legalReference.findMany({
      where: { caseId },
      select: {
        articleId: true,
        source: true,
        articleNumber: true,
        content: true,
        applicabilityScore: true,
        relevanceScore: true,
        applicabilityReason: true,
        analysisResult: true,
        metadata: true,
        status: true,
        analyzedAt: true,
      },
    }) as Promise<LegalReferenceForAnalysis[]>,
    prisma.lawArticle.findMany({
      where: {
        id: { in: [...new Set([...articleIds, ...recommendedArticleIds])] },
      },
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        fullText: true,
        status: true,
        category: true,
        lawType: true,
      },
    }) as Promise<LawArticleForAnalysis[]>,
    prisma.lawArticleRelation.findMany({
      where: {
        OR: [
          { sourceId: { in: articleIds } },
          { targetId: { in: articleIds } },
        ],
        verificationStatus: VerificationStatus.VERIFIED,
      },
      include: {
        source: { select: { id: true, lawName: true, articleNumber: true } },
        target: { select: { id: true, lawName: true, articleNumber: true } },
      },
      take: 120,
    }) as Promise<RelationForAnalysis[]>,
  ]);

  const refs = legalReferences ?? [];
  const articleMap = new Map(
    (articles ?? []).map(article => [article.id, article])
  );
  const relationRows = relations ?? [];
  const refByArticleId = new Map(
    refs.filter(ref => ref.articleId).map(ref => [ref.articleId as string, ref])
  );

  const coreArticles = articleIds
    .map(articleId =>
      buildCoreArticle(
        articleId,
        articleMap.get(articleId),
        refByArticleId.get(articleId)
      )
    )
    .filter((article): article is ApplicationCoreArticle => Boolean(article))
    .sort((a, b) => scoreValue(b.score) - scoreValue(a.score))
    .slice(0, 8);

  const supportingArticles = buildSupportingArticles(
    articleIds,
    relationRows,
    articleMap
  );
  const riskArticles = buildRiskArticles({
    coreArticles,
    conflicts,
    evolutionChain,
    keyInferences,
  });
  const applicationRoute = buildApplicationRoute(
    coreArticles,
    supportingArticles,
    riskArticles
  );
  const nextActions = buildNextActions(
    coreArticles,
    supportingArticles,
    riskArticles
  );

  const overallConfidence = determineOverallConfidence(coreArticles);
  const summary = {
    coreCount: coreArticles.length,
    supportingCount: supportingArticles.length,
    riskCount: riskArticles.length,
    overallConfidence,
    headline: buildHeadline(coreArticles, supportingArticles, riskArticles),
  };

  return {
    version: '2.0',
    summary,
    coreArticles,
    supportingArticles,
    riskArticles,
    applicationRoute,
    nextActions,
  };
}

function buildCoreArticle(
  articleId: string,
  article?: LawArticleForAnalysis,
  ref?: LegalReferenceForAnalysis
): ApplicationCoreArticle | null {
  if (!article && !ref) return null;

  const lawName = article?.lawName ?? ref?.source ?? '未知法律';
  const articleNumber = article?.articleNumber ?? ref?.articleNumber ?? '';
  const score = normalizeScore(ref?.applicabilityScore ?? ref?.relevanceScore);
  const reasons = extractReasons(ref);
  const sourceLabel = resolveSourceLabel(ref);
  const status = article?.status ?? ref?.status ?? 'UNKNOWN';

  return {
    articleId,
    title: formatArticleTitle(lawName, articleNumber),
    lawName,
    articleNumber,
    score,
    confidence: confidenceFromScore(score),
    sourceLabel,
    status,
    reasons:
      reasons.length > 0
        ? reasons
        : [
            '该法条已被本案适用性分析或辩论论证引用，建议结合事实与证据核对构成要件。',
          ],
    useGuidance: buildUseGuidance(score),
    excerpt: excerpt(article?.fullText ?? ref?.content),
  };
}

function buildSupportingArticles(
  articleIds: string[],
  relations: RelationForAnalysis[],
  articleMap: Map<string, LawArticleForAnalysis>
): ApplicationSupportingArticle[] {
  const caseArticleSet = new Set(articleIds);
  const seen = new Set<string>();
  const items: ApplicationSupportingArticle[] = [];

  for (const relation of relations) {
    if (!SUPPORTING_RELATIONS.has(relation.relationType)) continue;

    const sourceIsCase = caseArticleSet.has(relation.sourceId);
    const targetIsCase = caseArticleSet.has(relation.targetId);
    if (sourceIsCase === targetIsCase) continue;

    const candidate = sourceIsCase ? relation.target : relation.source;
    const anchor = sourceIsCase ? relation.source : relation.target;
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);

    const article = articleMap.get(candidate.id);
    const score = normalizeScore(
      Math.max(relation.strength ?? 0, relation.confidence ?? 0)
    );
    const relationLabel = relationTypeLabel(relation.relationType);

    items.push({
      articleId: candidate.id,
      title: formatArticleTitle(
        article?.lawName ?? candidate.lawName,
        article?.articleNumber ?? candidate.articleNumber
      ),
      relationType: relation.relationType,
      relationLabel,
      anchorArticleId: anchor.id,
      anchorTitle: formatArticleTitle(anchor.lawName, anchor.articleNumber),
      confidence: confidenceFromScore(score),
      score: score ?? 0.5,
      reason:
        relation.description ??
        `${formatArticleTitle(anchor.lawName, anchor.articleNumber)}与该法条存在${relationLabel}关系，可用于解释、补强或限定核心法条。`,
    });
  }

  return items.sort((a, b) => b.score - a.score).slice(0, 8);
}

function buildRiskArticles({
  coreArticles,
  conflicts,
  evolutionChain,
  keyInferences,
}: {
  coreArticles: ApplicationCoreArticle[];
  conflicts: ConflictInfo[];
  evolutionChain: EvolutionChainItem[];
  keyInferences: InferenceResult[];
}): ApplicationRiskArticle[] {
  const risks: ApplicationRiskArticle[] = [];

  for (const conflict of conflicts.slice(0, 5)) {
    risks.push({
      severity: 'high',
      title: '存在法条冲突',
      description: `${conflict.sourceName} 与 ${conflict.targetName} 存在冲突关系，直接并列引用可能削弱论证稳定性。`,
      articleIds: [conflict.sourceId, conflict.targetId],
      action:
        '核对特别法优先、新法优先、上位法优先等适用规则，并在文书中解释取舍理由。',
    });
  }

  for (const item of evolutionChain
    .filter(item => item.isSuperseded)
    .slice(0, 5)) {
    risks.push({
      severity: 'high',
      title: '疑似引用旧法或被替代条文',
      description: `${item.articleName} 已被 ${item.supersededBy ?? '新条文'} 替代。`,
      articleIds: [item.articleId],
      action: '优先核实现行有效条文，避免把旧法作为核心请求权基础。',
    });
  }

  for (const article of coreArticles) {
    if (article.status === 'VALID') continue;
    risks.push({
      severity: article.status === 'REPEALED' ? 'high' : 'medium',
      title: '法条状态需要复核',
      description: `${article.title} 当前状态为 ${article.status}，引用前应核对其现行效力。`,
      articleIds: [article.articleId],
      action: '在正式文书中使用前，核对生效、修订、废止和过渡条款。',
    });
  }

  for (const inference of keyInferences
    .filter(item => item.inferredRelation === RelationType.CONFLICTS)
    .slice(0, 3)) {
    risks.push({
      severity: 'medium',
      title: '图谱推理提示潜在冲突',
      description: inference.explanation,
      articleIds: [inference.sourceArticleId, inference.targetArticleId],
      action: '将该推理作为复核线索，进一步核对真实条文、效力位阶和裁判口径。',
    });
  }

  return risks.slice(0, 10);
}

function buildApplicationRoute(
  coreArticles: ApplicationCoreArticle[],
  supportingArticles: ApplicationSupportingArticle[],
  riskArticles: ApplicationRiskArticle[]
): ApplicationRouteStep[] {
  const coreIds = coreArticles.slice(0, 3).map(article => article.articleId);
  const supportingIds = supportingArticles
    .slice(0, 3)
    .map(article => article.articleId);
  const riskIds = [...new Set(riskArticles.flatMap(risk => risk.articleIds))];

  return [
    {
      id: 'claim_basis',
      title: '确定请求权或抗辩基础',
      status: coreIds.length > 0 ? 'ready' : 'missing',
      articleIds: coreIds,
      description:
        coreIds.length > 0
          ? '优先围绕高适用度法条组织诉请、抗辩和裁判依据。'
          : '尚未识别出核心法条，需要先完成适用性分析。',
      action: '把最高适用度法条放在论证主轴，不要让低相关法条抢占核心位置。',
    },
    {
      id: 'elements',
      title: '拆解构成要件',
      status: coreIds.length > 0 ? 'ready' : 'missing',
      articleIds: coreIds,
      description: '将核心法条拆成主体、行为、金额、期限、责任承担等要件。',
      action: '逐项检查卷宗事实是否覆盖每个要件，缺口转入证据补强清单。',
    },
    {
      id: 'supplement',
      title: '补充解释和限定规则',
      status: supportingIds.length > 0 ? 'ready' : 'attention',
      articleIds: supportingIds,
      description:
        supportingIds.length > 0
          ? '图谱已识别可补强或解释核心法条的关联条文。'
          : '暂未发现明确补充法条，建议通过法条检索或辩论继续扩展。',
      action: '只保留能解释核心要件、责任范围或举证责任的补充条文。',
    },
    {
      id: 'risk_check',
      title: '排除冲突、失效和旧法风险',
      status: riskIds.length > 0 ? 'attention' : 'ready',
      articleIds: riskIds,
      description:
        riskIds.length > 0
          ? '存在需要人工复核的冲突或效力风险。'
          : '当前图谱未发现明显冲突或失效风险。',
      action: '正式引用前核对法条现行有效性、特别法/新法优先规则和裁判口径。',
    },
    {
      id: 'writing_order',
      title: '形成文书引用顺序',
      status: coreIds.length > 0 ? 'ready' : 'missing',
      articleIds: [...coreIds, ...supportingIds].slice(0, 5),
      description: '建议按“核心法条 -> 补充法条 -> 风险说明”的顺序组织文书。',
      action: '让每条法条都对应一个事实、一个要件或一个抗辩点，避免堆砌引用。',
    },
  ];
}

function buildNextActions(
  coreArticles: ApplicationCoreArticle[],
  supportingArticles: ApplicationSupportingArticle[],
  riskArticles: ApplicationRiskArticle[]
): string[] {
  const actions = [
    '把核心法条逐条映射到争议焦点和证据目录，形成“事实-要件-证据”表。',
  ];

  if (supportingArticles.length > 0) {
    actions.push('筛选补充法条，只保留能解释核心构成要件或责任范围的条文。');
  } else {
    actions.push('继续通过法条检索或模拟辩论补充解释性条文。');
  }

  if (riskArticles.length > 0) {
    actions.push('优先处理高风险法条，核对冲突、失效、替代和特别法优先问题。');
  } else {
    actions.push('正式出具文书前仍需人工核验法条现行有效性。');
  }

  return actions;
}

function buildHeadline(
  coreArticles: ApplicationCoreArticle[],
  supportingArticles: ApplicationSupportingArticle[],
  riskArticles: ApplicationRiskArticle[]
): string {
  if (coreArticles.length === 0) {
    return '尚未识别出可直接支撑本案的核心法条';
  }

  const top = coreArticles[0];
  if (riskArticles.some(risk => risk.severity === 'high')) {
    return `已识别 ${top.title} 等核心法条，但存在高优先级效力或冲突风险`;
  }

  if (supportingArticles.length > 0) {
    return `已形成以 ${top.title} 为核心的法条适用路线，并识别出补充条文`;
  }

  return `已形成以 ${top.title} 为核心的法条适用路线`;
}

function determineOverallConfidence(
  coreArticles: ApplicationCoreArticle[]
): ApplicationConfidence {
  if (coreArticles.length === 0) return 'low';
  const average =
    coreArticles.reduce((sum, article) => sum + scoreValue(article.score), 0) /
    coreArticles.length;
  return confidenceFromScore(average);
}

function extractReasons(ref?: LegalReferenceForAnalysis): string[] {
  if (!ref) return [];

  const fromReason = splitReason(ref.applicabilityReason);
  const analysis = ref.analysisResult;
  const fromAnalysis =
    analysis &&
    typeof analysis === 'object' &&
    Array.isArray((analysis as { reasons?: unknown }).reasons)
      ? (analysis as { reasons: unknown[] }).reasons.filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0
        )
      : [];

  return [...new Set([...fromReason, ...fromAnalysis])]
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function splitReason(reason?: string | null): string[] {
  if (!reason) return [];
  return reason
    .split(/[;；\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function resolveSourceLabel(ref?: LegalReferenceForAnalysis): string {
  if (!ref) return '法条图谱';
  const metadata = ref.metadata;
  if (
    metadata &&
    typeof metadata === 'object' &&
    (metadata as { source?: unknown }).source === 'debate_legal_basis'
  ) {
    return '模拟辩论引用';
  }
  if (ref.analyzedAt || ref.analysisResult) return '适用性分析';
  if (ref.relevanceScore !== null) return '法条检索';
  return '案件引用';
}

function buildUseGuidance(score: number | null): string {
  if (score !== null && score >= 0.8) {
    return '可作为本案主轴法条使用，建议直接对应诉请、抗辩或裁判要件。';
  }
  if (score !== null && score >= 0.6) {
    return '适合作为辅助论证依据，需结合事实和证据进一步说明适用条件。';
  }
  return '仅作为线索参考，正式引用前应人工核对适用范围和事实匹配度。';
}

function relationTypeLabel(type: RelationType): string {
  const labels: Record<RelationType, string> = {
    [RelationType.CITES]: '引用',
    [RelationType.CITED_BY]: '被引用',
    [RelationType.CONFLICTS]: '冲突',
    [RelationType.COMPLETES]: '补充',
    [RelationType.COMPLETED_BY]: '被补充',
    [RelationType.SUPERSEDES]: '替代',
    [RelationType.SUPERSEDED_BY]: '被替代',
    [RelationType.IMPLEMENTS]: '实施细化',
    [RelationType.IMPLEMENTED_BY]: '被实施细化',
    [RelationType.RELATED]: '相关',
  };
  return labels[type] ?? type;
}

function confidenceFromScore(score: number | null): ApplicationConfidence {
  if (score !== null && score >= 0.75) return 'high';
  if (score !== null && score >= 0.55) return 'medium';
  return 'low';
}

function normalizeScore(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function scoreValue(score: number | null): number {
  return score ?? 0.5;
}

function excerpt(text?: string | null): string | undefined {
  if (!text) return undefined;
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized.length > 140
    ? `${normalized.slice(0, 140)}...`
    : normalized;
}

function formatArticleTitle(lawName: string, articleNumber: string): string {
  if (!articleNumber) return lawName;
  if (articleNumber.includes('第') || articleNumber.includes('条')) {
    return `${lawName}${articleNumber}`;
  }
  return `${lawName}第${articleNumber}条`;
}
