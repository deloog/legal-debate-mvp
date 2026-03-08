/**
 * Layer 1 规则基础法条关系生成服务
 *
 * 规则 1 — SUPERSEDES / SUPERSEDED_BY
 *   同一法条存在多个版本时，按 effectiveDate 建立时间链（条文级）
 *
 * 规则 2 — CITES（保留，但中国法律文本中条文级跨法引用极少，暂无数据）
 *   解析 fullText 中《法律名》第X条 格式（实际文本大多引用章节，非条文）
 *
 * 规则 3 — IMPLEMENTS / IMPLEMENTED_BY
 *   根据法律名称命名规律，推断实施条例/实施细则与母法的实施关系
 *   例：《药品管理法实施条例》→ IMPLEMENTS →《药品管理法》
 *   粒度：以各法律第一条为代理（法律级关系）
 */

import {
  PrismaClient,
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
} from '@prisma/client';
import { logger } from '../logger';

const INSERT_BATCH = 500;
const READ_BATCH = 2000;

type RelationInput = {
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  strength: number;
  confidence: number;
  description: string;
  discoveryMethod: DiscoveryMethod;
  verificationStatus: VerificationStatus;
};

type LawIndex = Map<string, Map<string, string>>; // lawName → articleNumber → id

// 《法律名》第X条格式（条文级跨法引用）
const CITE_PATTERN =
  /《([^》]{2,40})》第([一二三四五六七八九十百千零〇\d]+)条/g;
// 本法/本条例 第X条（同法内部引用）
const SELF_PATTERN =
  /(?:本法|本条例|本规定|本办法|本规则|本细则|本章程)第([一二三四五六七八九十百千零〇\d]+)条/g;

// 法律名称中用于包裹母法名的括号变体
const BRACKET_PATTERNS = [
  /《([^》]+)》/, // 《XX法》
  /[（(]([^）)]{4,})[）)]/, // （XX法）
];

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size)
    result.push(arr.slice(i, i + size));
  return result;
}

async function insertBatch(
  prisma: PrismaClient,
  rows: RelationInput[]
): Promise<void> {
  if (rows.length === 0) return;
  for (const batch of chunkArray(rows, INSERT_BATCH)) {
    await prisma.lawArticleRelation.createMany({ data: batch });
  }
}

function findLawMap(
  index: LawIndex,
  name: string
): Map<string, string> | undefined {
  if (index.has(name)) return index.get(name);
  const full = '中华人民共和国' + name;
  if (index.has(full)) return index.get(full);
  if (name.startsWith('中华人民共和国')) {
    if (index.has(name.slice(7))) return index.get(name.slice(7));
  }
  return undefined;
}

async function buildLawIndex(prisma: PrismaClient): Promise<LawIndex> {
  const rows = await prisma.$queryRaw<
    { id: string; lawName: string; articleNumber: string }[]
  >`
    SELECT DISTINCT ON ("lawName", "articleNumber")
      id, "lawName", "articleNumber"
    FROM law_articles
    ORDER BY "lawName", "articleNumber", "effectiveDate" DESC
  `;
  const index: LawIndex = new Map();
  for (const r of rows) {
    if (!index.has(r.lawName)) index.set(r.lawName, new Map());
    index.get(r.lawName)!.set(r.articleNumber, r.id);
  }
  return index;
}

// ── 清除逻辑（按规则精准清除，不误伤其他规则的数据）──────────────────────────

const RULE_RELATION_TYPES: Record<string, RelationType[]> = {
  supersedes: [RelationType.SUPERSEDES, RelationType.SUPERSEDED_BY],
  cites: [RelationType.CITES, RelationType.CITED_BY],
  implements: [RelationType.IMPLEMENTS, RelationType.IMPLEMENTED_BY],
};

async function clearRuleRelations(
  prisma: PrismaClient,
  rule: string | undefined
): Promise<number> {
  if (!rule) {
    // 清除全部 RULE_BASED
    const { count } = await prisma.lawArticleRelation.deleteMany({
      where: { discoveryMethod: DiscoveryMethod.RULE_BASED },
    });
    return count;
  }
  const types = RULE_RELATION_TYPES[rule];
  if (!types) return 0;
  const { count } = await prisma.lawArticleRelation.deleteMany({
    where: {
      discoveryMethod: DiscoveryMethod.RULE_BASED,
      relationType: { in: types },
    },
  });
  return count;
}

// ── 规则 1: SUPERSEDES / SUPERSEDED_BY ───────────────────────────────────────

async function runSupersedes(
  prisma: PrismaClient,
  sinceDate?: Date
): Promise<number> {
  let groups: { lawName: string; articleNumber: string }[];

  if (sinceDate) {
    groups = await prisma.$queryRaw<
      { lawName: string; articleNumber: string }[]
    >`
      SELECT DISTINCT "lawName", "articleNumber"
      FROM law_articles
      WHERE "importedAt" >= ${sinceDate}
    `;
  } else {
    groups = await prisma.$queryRaw<
      { lawName: string; articleNumber: string }[]
    >`
      SELECT "lawName", "articleNumber"
      FROM law_articles
      GROUP BY "lawName", "articleNumber"
      HAVING COUNT(*) > 1
      ORDER BY "lawName", "articleNumber"
    `;
  }

  let created = 0;
  for (const batchGroups of chunkArray(groups, 200)) {
    const relations: RelationInput[] = [];
    for (const group of batchGroups) {
      const versions = await prisma.lawArticle.findMany({
        where: { lawName: group.lawName, articleNumber: group.articleNumber },
        select: { id: true, effectiveDate: true },
        orderBy: { effectiveDate: 'asc' },
      });
      if (versions.length < 2) continue;
      for (let i = 0; i < versions.length - 1; i++) {
        const older = versions[i];
        const newer = versions[i + 1];
        const dateOld = older.effectiveDate.toISOString().slice(0, 10);
        const dateNew = newer.effectiveDate.toISOString().slice(0, 10);
        relations.push({
          sourceId: newer.id,
          targetId: older.id,
          relationType: RelationType.SUPERSEDES,
          strength: 1.0,
          confidence: 1.0,
          description: `《${group.lawName}》${group.articleNumber} 新版本（${dateNew}）取代旧版本（${dateOld}）`,
          discoveryMethod: DiscoveryMethod.RULE_BASED,
          verificationStatus: VerificationStatus.VERIFIED,
        });
        relations.push({
          sourceId: older.id,
          targetId: newer.id,
          relationType: RelationType.SUPERSEDED_BY,
          strength: 1.0,
          confidence: 1.0,
          description: `《${group.lawName}》${group.articleNumber} 旧版本（${dateOld}）已被新版本（${dateNew}）取代`,
          discoveryMethod: DiscoveryMethod.RULE_BASED,
          verificationStatus: VerificationStatus.VERIFIED,
        });
      }
    }
    await insertBatch(prisma, relations);
    created += relations.length;
  }
  return created;
}

// ── 规则 2: CITES / CITED_BY（文本解析，中国法律实际数据稀少）────────────────

async function runCites(
  prisma: PrismaClient,
  index: LawIndex,
  sinceDate?: Date
): Promise<number> {
  const whereClause = sinceDate
    ? { importedAt: { gte: sinceDate } }
    : undefined;
  let created = 0;
  let cursor: string | undefined;

  while (true) {
    const articles = await prisma.lawArticle.findMany({
      where: { ...whereClause, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: { id: true, lawName: true, articleNumber: true, fullText: true },
      orderBy: { id: 'asc' },
      take: READ_BATCH,
    });
    if (articles.length === 0) break;
    cursor = articles[articles.length - 1].id;

    const relations: RelationInput[] = [];
    for (const article of articles) {
      const cited = new Set<string>();

      for (const match of article.fullText.matchAll(CITE_PATTERN)) {
        const refLaw = match[1];
        const refNum = `第${match[2]}条`;
        const targetMap = findLawMap(index, refLaw);
        if (!targetMap) continue;
        const targetId = targetMap.get(refNum);
        if (!targetId || targetId === article.id || cited.has(targetId))
          continue;
        cited.add(targetId);
        relations.push({
          sourceId: article.id,
          targetId,
          relationType: RelationType.CITES,
          strength: 0.95,
          confidence: 0.95,
          description: `《${article.lawName}》${article.articleNumber} 引用《${refLaw}》${refNum}`,
          discoveryMethod: DiscoveryMethod.RULE_BASED,
          verificationStatus: VerificationStatus.PENDING,
        });
        relations.push({
          sourceId: targetId,
          targetId: article.id,
          relationType: RelationType.CITED_BY,
          strength: 0.95,
          confidence: 0.95,
          description: `《${refLaw}》${refNum} 被《${article.lawName}》${article.articleNumber} 引用`,
          discoveryMethod: DiscoveryMethod.RULE_BASED,
          verificationStatus: VerificationStatus.PENDING,
        });
      }

      const selfMap = findLawMap(index, article.lawName);
      if (selfMap) {
        for (const match of article.fullText.matchAll(SELF_PATTERN)) {
          const refNum = `第${match[1]}条`;
          const targetId = selfMap.get(refNum);
          if (!targetId || targetId === article.id || cited.has(targetId))
            continue;
          cited.add(targetId);
          relations.push({
            sourceId: article.id,
            targetId,
            relationType: RelationType.CITES,
            strength: 0.9,
            confidence: 0.9,
            description: `《${article.lawName}》${article.articleNumber} 内部引用 ${refNum}`,
            discoveryMethod: DiscoveryMethod.RULE_BASED,
            verificationStatus: VerificationStatus.PENDING,
          });
        }
      }
    }

    await insertBatch(prisma, relations);
    created += relations.length;
  }
  return created;
}

// ── 规则 3: IMPLEMENTS / IMPLEMENTED_BY（基于法律命名规律）─────────────────────

/**
 * 根据法律名称推断"母法"，支持两种命名规律：
 *
 * 规律 A（名称中含《》）：
 *   "西藏自治区实施《中华人民共和国未成年人保护法》办法"  →  "中华人民共和国未成年人保护法"
 *   "成都市《中华人民共和国献血法》实施办法"              →  "中华人民共和国献血法"
 *
 * 规律 B（以实施后缀结尾）：
 *   "中华人民共和国药品管理法实施条例"  →  "中华人民共和国药品管理法"
 *
 * 返回 null 表示该法律名不是实施性法规
 */
function inferParentLawName(lawName: string): string | null {
  // 必须含有"实施"字样才考虑，排除无关的《》引用
  if (!lawName.includes('实施') && !lawName.includes('施行')) return null;

  // 规律 A：从名称中提取《》内的母法名
  for (const pat of BRACKET_PATTERNS) {
    const m = lawName.match(pat);
    if (m) return m[1];
  }

  // 规律 B：以实施后缀结尾
  const IMPL_SUFFIXES = [
    '实施细则',
    '实施条例',
    '实施办法',
    '实施规定',
    '实施方案',
    '实施意见',
  ];
  for (const suffix of IMPL_SUFFIXES) {
    if (lawName.endsWith(suffix)) return lawName.slice(0, -suffix.length);
  }

  return null;
}

async function runImplements(
  prisma: PrismaClient,
  sinceDate?: Date
): Promise<number> {
  // 取所有不重复的法律名
  let lawNames: { lawName: string }[];
  if (sinceDate) {
    lawNames = await prisma.$queryRaw<{ lawName: string }[]>`
      SELECT DISTINCT "lawName" FROM law_articles
      WHERE "importedAt" >= ${sinceDate}
      ORDER BY "lawName"
    `;
  } else {
    lawNames = await prisma.$queryRaw<{ lawName: string }[]>`
      SELECT DISTINCT "lawName" FROM law_articles
      ORDER BY "lawName"
    `;
  }

  // 建立法律名 → 第一条ID 的映射（作为法律级代理节点）
  const firstArticleMap = new Map<string, string>(); // lawName → id of 第一条
  const allLawNames = await prisma.$queryRaw<{ lawName: string }[]>`
    SELECT DISTINCT "lawName" FROM law_articles
  `;
  for (const row of allLawNames) {
    firstArticleMap.set(row.lawName, ''); // 先占位
  }

  // 批量查询各法律的第一条
  for (const batch of chunkArray([...firstArticleMap.keys()], 200)) {
    const articles = await prisma.lawArticle.findMany({
      where: {
        lawName: { in: batch },
        articleNumber: { in: ['第一条', '第1条'] },
      },
      select: { id: true, lawName: true },
      orderBy: { effectiveDate: 'desc' }, // 取最新版本
    });
    for (const a of articles) {
      firstArticleMap.set(a.lawName, a.id);
    }
  }

  const relations: RelationInput[] = [];

  for (const { lawName } of lawNames) {
    const parentName = inferParentLawName(lawName);
    if (!parentName) continue;

    // 尝试找母法（支持有/无"中华人民共和国"前缀）
    let parentId = firstArticleMap.get(parentName) ?? '';
    if (!parentId)
      parentId = firstArticleMap.get('中华人民共和国' + parentName) ?? '';
    if (!parentId && parentName.startsWith('中华人民共和国')) {
      parentId = firstArticleMap.get(parentName.slice(7)) ?? '';
    }
    if (!parentId) continue;

    const implId = firstArticleMap.get(lawName) ?? '';
    if (!implId) continue;

    if (implId === parentId) continue;

    relations.push({
      sourceId: implId,
      targetId: parentId,
      relationType: RelationType.IMPLEMENTS,
      strength: 0.9,
      confidence: 0.9,
      description: `《${lawName}》是《${parentName.replace('中华人民共和国', '')}》的实施性法规`,
      discoveryMethod: DiscoveryMethod.RULE_BASED,
      verificationStatus: VerificationStatus.PENDING,
    });
    relations.push({
      sourceId: parentId,
      targetId: implId,
      relationType: RelationType.IMPLEMENTED_BY,
      strength: 0.9,
      confidence: 0.9,
      description: `《${parentName.replace('中华人民共和国', '')}》由《${lawName}》实施`,
      discoveryMethod: DiscoveryMethod.RULE_BASED,
      verificationStatus: VerificationStatus.PENDING,
    });
  }

  await insertBatch(prisma, relations);
  return relations.length;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface GenerateStats {
  supersedesCreated: number;
  citesCreated: number;
  implementsCreated: number;
  totalCreated: number;
  durationMs: number;
}

export interface GenerateOptions {
  sinceDate?: Date;
  rule?: 'supersedes' | 'cites' | 'implements';
  clearExisting?: boolean;
}

export async function generateLayer1Relations(
  prisma: PrismaClient,
  options: GenerateOptions = {}
): Promise<GenerateStats> {
  const { sinceDate, rule, clearExisting = false } = options;
  const t0 = Date.now();

  if (clearExisting) {
    const deleted = await clearRuleRelations(prisma, rule);
    logger.info(
      `已清除旧的 RULE_BASED 关系：${deleted} 条（规则：${rule ?? '全部'}）`
    );
  }

  let supersedesCreated = 0;
  let citesCreated = 0;
  let implementsCreated = 0;

  if (!rule || rule === 'supersedes') {
    supersedesCreated = await runSupersedes(prisma, sinceDate);
    logger.info(`SUPERSEDES 生成完成：${supersedesCreated} 条`);
  }

  if (!rule || rule === 'cites') {
    const index = await buildLawIndex(prisma);
    citesCreated = await runCites(prisma, index, sinceDate);
    logger.info(`CITES 生成完成：${citesCreated} 条`);
  }

  if (!rule || rule === 'implements') {
    implementsCreated = await runImplements(prisma, sinceDate);
    logger.info(`IMPLEMENTS 生成完成：${implementsCreated} 条`);
  }

  const durationMs = Date.now() - t0;
  const totalCreated = supersedesCreated + citesCreated + implementsCreated;
  logger.info(
    `Layer 1 生成完成，共 ${totalCreated} 条，耗时 ${(durationMs / 1000).toFixed(1)}s`
  );

  return {
    supersedesCreated,
    citesCreated,
    implementsCreated,
    totalCreated,
    durationMs,
  };
}

export async function getLastGeneratedAt(
  prisma: PrismaClient
): Promise<Date | null> {
  const last = await prisma.lawArticleRelation.findFirst({
    where: { discoveryMethod: DiscoveryMethod.RULE_BASED },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return last?.createdAt ?? null;
}
