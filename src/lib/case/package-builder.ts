import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import type { CaseExtractionSnapshot } from '@/lib/case/case-extraction-service';

// ── 数据类型 ───────────────────────────────────────────────────────────────────

export type SectionTier = 'primary' | 'enhanced' | 'fallback' | 'none';

export interface Section<T> {
  tier: SectionTier;
  available: boolean;
  data: T | null;
}

interface RiskMetadata {
  winRate: number;
  difficulty: string;
  riskLevel: string;
  aiAssessment: {
    summary: string;
    keyRisks: string[];
    generatedAt: string;
  };
}

interface DebateSummary {
  verdict?: string;
  recommendation?: string;
  keyLegalIssues?: string[];
  plaintiffStrengths?: string[];
  defendantStrengths?: string[];
}

interface CaseCrystal {
  core_dispute?: string;
  open_questions?: string[];
  established_facts?: string[];
  uncertain_facts?: string[];
  parties?: { plaintiff: string; defendant: string };
}

// ── §5 metadata 解析 ───────────────────────────────────────────────────────────

function parseRiskMetadata(raw: unknown): RiskMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const ai = m['aiAssessment'];
  if (
    typeof m['winRate'] !== 'number' ||
    typeof m['difficulty'] !== 'string' ||
    typeof m['riskLevel'] !== 'string' ||
    !ai ||
    typeof ai !== 'object'
  )
    return null;
  const aiObj = ai as Record<string, unknown>;
  if (typeof aiObj['summary'] !== 'string' || !Array.isArray(aiObj['keyRisks']))
    return null;
  return {
    winRate: m['winRate'],
    difficulty: m['difficulty'],
    riskLevel: m['riskLevel'],
    aiAssessment: {
      summary: aiObj['summary'],
      keyRisks: aiObj['keyRisks'] as string[],
      generatedAt:
        typeof aiObj['generatedAt'] === 'string' ? aiObj['generatedAt'] : '',
    },
  };
}

// ── CaseCrystal 提取 ───────────────────────────────────────────────────────────

// 规整化 established_facts / uncertain_facts：
// AI 生成的真实 DB 数据是 { fact, confidence }[]；种子脚本写入的是 string[]。
// 统一输出 string[]，避免 DOCX 渲染时出现 [object Object]。
function normalizeFactArray(arr: unknown[]): string[] {
  return arr.map(item => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      return typeof obj['fact'] === 'string' ? obj['fact'] : String(item);
    }
    return String(item);
  });
}

function extractCrystal(caseContext: unknown): CaseCrystal | null {
  if (!caseContext || typeof caseContext !== 'object') return null;
  const ctx = caseContext as Record<string, unknown>;
  if (!ctx['core_dispute'] && !ctx['established_facts'] && !ctx['parties'])
    return null;
  return {
    core_dispute:
      typeof ctx['core_dispute'] === 'string' ? ctx['core_dispute'] : undefined,
    open_questions: Array.isArray(ctx['open_questions'])
      ? (ctx['open_questions'] as string[])
      : undefined,
    established_facts: Array.isArray(ctx['established_facts'])
      ? normalizeFactArray(ctx['established_facts'])
      : undefined,
    uncertain_facts: Array.isArray(ctx['uncertain_facts'])
      ? normalizeFactArray(ctx['uncertain_facts'])
      : undefined,
    parties:
      ctx['parties'] && typeof ctx['parties'] === 'object'
        ? (ctx['parties'] as { plaintiff: string; defendant: string })
        : undefined,
  };
}

// ── 章节行类型 ─────────────────────────────────────────────────────────────────

interface CaseRow {
  title: string;
  type: string;
  status: string;
  caseNumber: string | null;
  cause: string | null;
  court: string | null;
  plaintiffName: string | null;
  defendantName: string | null;
  amount: unknown;
  metadata: unknown;
}

interface ArgumentRow {
  id: string;
  side: string;
  type: string;
  content: string;
  legalBasis: unknown;
  confidence: number | null;
  legalScore: number | null;
  overallScore: number | null;
}

interface EvidenceRow {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string | null;
  submitter: string | null;
  source: string | null;
  relevanceScore: number | null;
}

// ── 章节构建函数 ───────────────────────────────────────────────────────────────

type S1Data = {
  title: string;
  type: string;
  status: string;
  caseNumber: string | null;
  cause: string | null;
  court: string | null;
  plaintiffName: string | null;
  defendantName: string | null;
  amount: number | null;
  established_facts?: string[];
  uncertain_facts?: string[];
  parties?: { plaintiff: string; defendant: string };
};

function buildS1(
  caseRow: CaseRow,
  crystal: CaseCrystal | null
): Section<S1Data> {
  const data: S1Data = {
    title: caseRow.title,
    type: caseRow.type,
    status: caseRow.status,
    caseNumber: caseRow.caseNumber,
    cause: caseRow.cause,
    court: caseRow.court,
    plaintiffName: caseRow.plaintiffName,
    defendantName: caseRow.defendantName,
    amount:
      caseRow.amount !== null && caseRow.amount !== undefined
        ? Number(caseRow.amount)
        : null,
  };
  if (crystal?.established_facts)
    data.established_facts = crystal.established_facts;
  if (crystal?.uncertain_facts) data.uncertain_facts = crystal.uncertain_facts;
  if (crystal?.parties) data.parties = crystal.parties;
  return { tier: 'primary', available: true, data };
}

type S2Data = {
  keyLegalIssues?: string[];
  core_dispute?: string;
  open_questions?: string[];
  disputeFocuses?: string[];
};

function extractionSnapshotFromMeta(
  metadata: unknown
): CaseExtractionSnapshot | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  const snap = m['extractionSnapshot'];
  if (!snap || typeof snap !== 'object') return null;
  return snap as CaseExtractionSnapshot;
}

// §2 优先级：
//   1. Case.metadata.extractionSnapshot.disputeFocuses（卷宗提炼）
//   2. Debate.summary.keyLegalIssues（辩论摘要）
//   3. Conversation.caseContext.core_dispute（对话晶体）
//   4. fallback
function buildS2(
  summary: DebateSummary | null,
  crystal: CaseCrystal | null,
  caseMetadata?: unknown
): Section<S2Data> {
  const snap = extractionSnapshotFromMeta(caseMetadata);

  // 优先级 1：卷宗提炼结果
  if (snap?.disputeFocuses && snap.disputeFocuses.length > 0) {
    const data: S2Data = { disputeFocuses: snap.disputeFocuses };
    if (summary?.keyLegalIssues?.length)
      data.keyLegalIssues = summary.keyLegalIssues;
    if (crystal?.core_dispute) data.core_dispute = crystal.core_dispute;
    if (crystal?.open_questions) data.open_questions = crystal.open_questions;
    return { tier: 'primary', available: true, data };
  }

  // 优先级 2：辩论摘要
  if (
    summary?.keyLegalIssues &&
    Array.isArray(summary.keyLegalIssues) &&
    summary.keyLegalIssues.length > 0
  ) {
    const data: S2Data = { keyLegalIssues: summary.keyLegalIssues };
    if (crystal?.core_dispute) data.core_dispute = crystal.core_dispute;
    if (crystal?.open_questions) data.open_questions = crystal.open_questions;
    return { tier: 'primary', available: true, data };
  }

  // 优先级 3：对话晶体
  if (crystal && (crystal.core_dispute || crystal.open_questions)) {
    return {
      tier: 'enhanced',
      available: true,
      data: {
        core_dispute: crystal.core_dispute,
        open_questions: crystal.open_questions,
      },
    };
  }

  return { tier: 'fallback', available: true, data: null };
}

type S3Data = {
  totalCount: number;
  items: Array<{
    id: string;
    side: string;
    type: string;
    content: string;
    legalBasis: unknown[];
    confidence: number | null;
    legalScore: number | null;
    overallScore: number | null;
  }>;
};

function buildS3(args: ArgumentRow[]): Section<S3Data> {
  if (args.length === 0) return { tier: 'none', available: false, data: null };
  const hasPrimary = args.some(
    a => Array.isArray(a.legalBasis) && (a.legalBasis as unknown[]).length > 0
  );
  const items = args.map(a => ({
    id: a.id,
    side: a.side,
    type: a.type,
    content: a.content,
    legalBasis: Array.isArray(a.legalBasis) ? (a.legalBasis as unknown[]) : [],
    confidence: a.confidence,
    legalScore: a.legalScore,
    overallScore: a.overallScore,
  }));
  return {
    tier: hasPrimary ? 'primary' : 'enhanced',
    available: true,
    data: { totalCount: args.length, items },
  };
}

type S4Data = {
  totalCount: number;
  items: EvidenceRow[];
};

function buildS4(
  evidenceList: EvidenceRow[],
  totalCount: number
): Section<S4Data> {
  if (totalCount === 0) return { tier: 'none', available: false, data: null };
  return {
    tier: 'primary',
    available: true,
    data: { totalCount, items: evidenceList },
  };
}

function buildS5(metadata: unknown): Section<RiskMetadata> {
  if (!metadata || typeof metadata !== 'object') {
    return { tier: 'none', available: false, data: null };
  }
  const meta = metadata as Record<string, unknown>;

  // 优先读 metadata.riskAssessment 子键（Phase 2 写入格式）
  const fromSubKey = parseRiskMetadata(meta['riskAssessment']);
  if (fromSubKey) return { tier: 'primary', available: true, data: fromSubKey };

  // 兼容旧格式：winRate 等字段直接写在 metadata 根级
  const fromRoot = parseRiskMetadata(metadata);
  if (fromRoot) return { tier: 'primary', available: true, data: fromRoot };

  return { tier: 'none', available: false, data: null };
}

type S6Data = {
  verdict: string | undefined;
  recommendation: string | undefined;
  plaintiffStrengths: string[];
  defendantStrengths: string[];
};

function buildS6(summary: DebateSummary | null): Section<S6Data> {
  if (!summary) return { tier: 'fallback', available: true, data: null };
  return {
    tier: 'primary',
    available: true,
    data: {
      verdict: summary.verdict,
      recommendation: summary.recommendation,
      plaintiffStrengths: summary.plaintiffStrengths ?? [],
      defendantStrengths: summary.defendantStrengths ?? [],
    },
  };
}

// ── 公共导出类型 ───────────────────────────────────────────────────────────────

export type PackageSections = ReturnType<typeof assembleSections>;

function assembleSections(
  caseRow: CaseRow,
  debateSummary: DebateSummary | null,
  argRows: ArgumentRow[],
  evidRows: EvidenceRow[],
  evidTotal: number,
  crystal: CaseCrystal | null
) {
  return {
    s1_case_summary: buildS1(caseRow, crystal),
    s2_dispute_focus: buildS2(debateSummary, crystal, caseRow.metadata),
    s3_argument_analysis: buildS3(argRows),
    s4_evidence: buildS4(evidRows, evidTotal),
    s5_risk_assessment: buildS5(caseRow.metadata),
    s6_expert_opinion: buildS6(debateSummary),
    s7_ai_declaration: {
      tier: 'fallback' as const,
      available: true,
      data: null,
    },
  };
}

// ── 主函数：拉取数据并构建章节 ─────────────────────────────────────────────────

export type BuildPackageResult =
  | { found: false }
  | { found: true; sections: PackageSections };

export async function buildPackageSections(
  caseId: string
): Promise<BuildPackageResult> {
  const [caseRow, debateRow, argRows, evidRows, evidTotal, convRow] =
    await Promise.all([
      prisma.case.findUnique({
        where: { id: caseId, deletedAt: null },
        select: {
          title: true,
          type: true,
          status: true,
          caseNumber: true,
          cause: true,
          court: true,
          plaintiffName: true,
          defendantName: true,
          amount: true,
          metadata: true,
        },
      }),
      prisma.debate.findFirst({
        where: { caseId, deletedAt: null, summary: { not: Prisma.DbNull } },
        orderBy: { updatedAt: 'desc' },
        select: { summary: true },
      }),
      prisma.argument.findMany({
        where: { round: { debate: { caseId, deletedAt: null } } },
        select: {
          id: true,
          side: true,
          type: true,
          content: true,
          legalBasis: true,
          confidence: true,
          legalScore: true,
          overallScore: true,
        },
        orderBy: [{ side: 'asc' }, { type: 'asc' }],
        take: 50,
      }),
      prisma.evidence.findMany({
        where: { caseId, deletedAt: null },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          description: true,
          submitter: true,
          source: true,
          relevanceScore: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.evidence.count({ where: { caseId, deletedAt: null } }),
      prisma.conversation.findFirst({
        where: { caseId, caseContext: { not: Prisma.DbNull } },
        orderBy: { updatedAt: 'desc' },
        select: { caseContext: true },
      }),
    ]);

  if (!caseRow) return { found: false };

  const debateSummary = debateRow?.summary as DebateSummary | null;
  const crystal = extractCrystal(convRow?.caseContext);

  return {
    found: true,
    sections: assembleSections(
      caseRow as CaseRow,
      debateSummary,
      argRows as ArgumentRow[],
      evidRows as EvidenceRow[],
      evidTotal,
      crystal
    ),
  };
}
