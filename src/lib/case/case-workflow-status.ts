import { prisma } from '@/lib/db/prisma';
import { buildPackageSections } from '@/lib/case/package-builder';
import {
  computePackageHash,
  isValidSectionKeys,
} from '@/lib/case/package-hash';
import type { SectionKey } from '@/lib/case/package-hash';
import { resolveReviewMatch } from '@/lib/case/review-matcher';

const TEMPLATE_VERSION = 'v1';

export type PackageReviewValidity = 'none' | 'valid' | 'stale';

export interface CaseWorkflowStatus {
  documentsTotal: number;
  documentsCompleted: number;
  hasExtraction: boolean;
  extractionGeneratedAt: string | null;
  hasRiskAssessment: boolean;
  riskAssessedAt: string | null;
  hasDebate: boolean;
  debateId: string | null;
  hasValidPackageReview: boolean;
  packageReviewValidity: PackageReviewValidity;
  nextStep:
    | 'upload'
    | 'wait_analysis'
    | 'extraction'
    | 'risk'
    | 'debate'
    | 'package'
    | 'done';
}

/**
 * 聚合案件工作流各阶段状态，供案件页进度面板消费。
 * 返回 null 表示案件不存在（路由应响应 404）。
 */
export async function getCaseWorkflowStatus(
  caseId: string
): Promise<CaseWorkflowStatus | null> {
  const [docs, caseRow, debates, latestReview] = await Promise.all([
    prisma.document.findMany({
      where: { caseId, deletedAt: null },
      select: { analysisStatus: true },
    }),
    prisma.case.findUnique({
      where: { id: caseId, deletedAt: null },
      select: { metadata: true },
    }),
    prisma.debate.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
      take: 1,
      select: { id: true },
    }),
    prisma.casePackageReview.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, contentHash: true, selectedSections: true },
    }),
  ]);

  if (!caseRow) return null;

  const documentsTotal = docs.length;
  const documentsCompleted = docs.filter(
    d => d.analysisStatus === 'COMPLETED'
  ).length;

  const meta =
    typeof caseRow.metadata === 'object' && caseRow.metadata !== null
      ? (caseRow.metadata as Record<string, unknown>)
      : {};

  const snap = meta['extractionSnapshot'] as
    | { generatedAt?: string }
    | undefined;
  const risk = meta['riskAssessment'] as
    | { aiAssessment?: { generatedAt?: string } }
    | undefined;

  const hasExtraction = !!snap?.generatedAt;
  const extractionGeneratedAt = snap?.generatedAt ?? null;
  const hasRiskAssessment = !!risk?.aiAssessment?.generatedAt;
  const riskAssessedAt = risk?.aiAssessment?.generatedAt ?? null;
  const hasDebate = debates.length > 0;
  const debateId = debates[0]?.id ?? null;

  // ── 复核有效性：必须 hash 匹配，不能只看记录是否存在 ──────────────────────
  let hasValidPackageReview = false;
  let packageReviewValidity: PackageReviewValidity = 'none';

  if (latestReview) {
    const storedSections = Array.isArray(latestReview.selectedSections)
      ? (latestReview.selectedSections as unknown[])
      : [];

    if (storedSections.length > 0 && isValidSectionKeys(storedSections)) {
      const buildResult = await buildPackageSections(caseId);
      if (buildResult.found) {
        const currentHash = computePackageHash(
          buildResult.sections as Record<string, unknown>,
          storedSections as SectionKey[],
          TEMPLATE_VERSION
        );
        const matchResult = resolveReviewMatch({
          latestReview: {
            contentHash: latestReview.contentHash,
            selectedSections: latestReview.selectedSections,
          },
          currentHash,
          selectedSections: storedSections as SectionKey[],
          templateVersion: TEMPLATE_VERSION,
        });
        hasValidPackageReview = matchResult.status === 'matched';
        packageReviewValidity =
          matchResult.status === 'matched' ? 'valid' : 'stale';
      } else {
        packageReviewValidity = 'stale';
      }
    } else {
      packageReviewValidity = 'stale';
    }
  }

  let nextStep: CaseWorkflowStatus['nextStep'];
  if (documentsTotal === 0) {
    nextStep = 'upload';
  } else if (documentsCompleted === 0) {
    nextStep = 'wait_analysis';
  } else if (!hasExtraction) {
    nextStep = 'extraction';
  } else if (!hasRiskAssessment) {
    nextStep = 'risk';
  } else if (!hasDebate) {
    nextStep = 'debate';
  } else if (!hasValidPackageReview) {
    nextStep = 'package';
  } else {
    nextStep = 'done';
  }

  return {
    documentsTotal,
    documentsCompleted,
    hasExtraction,
    extractionGeneratedAt,
    hasRiskAssessment,
    riskAssessedAt,
    hasDebate,
    debateId,
    hasValidPackageReview,
    packageReviewValidity,
    nextStep,
  };
}
