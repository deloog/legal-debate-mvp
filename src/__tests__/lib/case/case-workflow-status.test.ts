/**
 * case-workflow-status 单元测试
 *
 * 重点验证：
 * 1. 案件不存在时返回 null
 * 2. 复核记录存在但 hash 不匹配时，hasValidPackageReview=false，nextStep='package'
 * 3. 复核记录存在且 hash 匹配时，hasValidPackageReview=true，nextStep='done'
 * 4. nextStep 各阶段推进逻辑
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockDocumentFindMany = jest.fn();
const mockCaseFindUnique = jest.fn();
const mockDebateFindMany = jest.fn();
const mockCasePackageReviewFindFirst = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    document: { findMany: (...a: unknown[]) => mockDocumentFindMany(...a) },
    case: { findUnique: (...a: unknown[]) => mockCaseFindUnique(...a) },
    debate: { findMany: (...a: unknown[]) => mockDebateFindMany(...a) },
    casePackageReview: {
      findFirst: (...a: unknown[]) => mockCasePackageReviewFindFirst(...a),
    },
  },
}));

const mockBuildPackageSections = jest.fn();
jest.mock('@/lib/case/package-builder', () => ({
  buildPackageSections: (...a: unknown[]) => mockBuildPackageSections(...a),
}));

const mockComputePackageHash = jest.fn();
const mockIsValidSectionKeys = jest.fn();
jest.mock('@/lib/case/package-hash', () => ({
  computePackageHash: (...a: unknown[]) => mockComputePackageHash(...a),
  isValidSectionKeys: (...a: unknown[]) => mockIsValidSectionKeys(...a),
}));

const mockResolveReviewMatch = jest.fn();
jest.mock('@/lib/case/review-matcher', () => ({
  resolveReviewMatch: (...a: unknown[]) => mockResolveReviewMatch(...a),
}));

import { getCaseWorkflowStatus } from '@/lib/case/case-workflow-status';

beforeEach(() => {
  jest.clearAllMocks();
  // 默认：sections key 有效
  mockIsValidSectionKeys.mockReturnValue(true);
  mockComputePackageHash.mockReturnValue('current-hash-abc');
  mockBuildPackageSections.mockResolvedValue({ found: true, sections: {} });
});

// ── 公共 fixtures ──────────────────────────────────────────────────────────────

const CASE_WITH_FULL_META = {
  metadata: {
    extractionSnapshot: { generatedAt: '2026-05-12T10:00:00.000Z' },
    riskAssessment: {
      aiAssessment: { generatedAt: '2026-05-12T11:00:00.000Z' },
    },
  },
};

const COMPLETED_DOCS = [
  { analysisStatus: 'COMPLETED' },
  { analysisStatus: 'COMPLETED' },
];

const DEBATE_ROW = [{ id: 'debate-001' }];

const REVIEW_ROW = {
  id: 'review-001',
  contentHash: 'stored-hash-xyz',
  selectedSections: ['s1_case_summary', 's5_risk_assessment'],
};

// ══════════════════════════════════════════════════════════════════════════════

describe('getCaseWorkflowStatus()', () => {
  const caseId = 'case-workflow-001';

  it('案件不存在时应返回 null', async () => {
    mockCaseFindUnique.mockResolvedValue(null);
    mockDocumentFindMany.mockResolvedValue([]);
    mockDebateFindMany.mockResolvedValue([]);
    mockCasePackageReviewFindFirst.mockResolvedValue(null);

    const result = await getCaseWorkflowStatus(caseId);

    expect(result).toBeNull();
  });

  it('无文档时 nextStep 为 upload', async () => {
    mockCaseFindUnique.mockResolvedValue({ metadata: {} });
    mockDocumentFindMany.mockResolvedValue([]);
    mockDebateFindMany.mockResolvedValue([]);
    mockCasePackageReviewFindFirst.mockResolvedValue(null);

    const result = await getCaseWorkflowStatus(caseId);

    expect(result).not.toBeNull();
    expect(result!.nextStep).toBe('upload');
    expect(result!.documentsTotal).toBe(0);
  });

  it('有文档但全部未完成分析时 nextStep 为 wait_analysis', async () => {
    mockCaseFindUnique.mockResolvedValue({ metadata: {} });
    mockDocumentFindMany.mockResolvedValue([
      { analysisStatus: 'PENDING' },
      { analysisStatus: 'PROCESSING' },
    ]);
    mockDebateFindMany.mockResolvedValue([]);
    mockCasePackageReviewFindFirst.mockResolvedValue(null);

    const result = await getCaseWorkflowStatus(caseId);

    expect(result!.nextStep).toBe('wait_analysis');
    expect(result!.documentsCompleted).toBe(0);
  });

  it('有完成文档但无提炼快照时 nextStep 为 extraction', async () => {
    mockCaseFindUnique.mockResolvedValue({ metadata: {} });
    mockDocumentFindMany.mockResolvedValue(COMPLETED_DOCS);
    mockDebateFindMany.mockResolvedValue([]);
    mockCasePackageReviewFindFirst.mockResolvedValue(null);

    const result = await getCaseWorkflowStatus(caseId);

    expect(result!.nextStep).toBe('extraction');
    expect(result!.hasExtraction).toBe(false);
  });

  it('有提炼快照但无风险评估时 nextStep 为 risk', async () => {
    mockCaseFindUnique.mockResolvedValue({
      metadata: {
        extractionSnapshot: { generatedAt: '2026-05-12T10:00:00.000Z' },
      },
    });
    mockDocumentFindMany.mockResolvedValue(COMPLETED_DOCS);
    mockDebateFindMany.mockResolvedValue([]);
    mockCasePackageReviewFindFirst.mockResolvedValue(null);

    const result = await getCaseWorkflowStatus(caseId);

    expect(result!.nextStep).toBe('risk');
    expect(result!.hasExtraction).toBe(true);
    expect(result!.hasRiskAssessment).toBe(false);
  });

  it('有风险评估但无辩论时 nextStep 为 debate', async () => {
    mockCaseFindUnique.mockResolvedValue(CASE_WITH_FULL_META);
    mockDocumentFindMany.mockResolvedValue(COMPLETED_DOCS);
    mockDebateFindMany.mockResolvedValue([]);
    mockCasePackageReviewFindFirst.mockResolvedValue(null);

    const result = await getCaseWorkflowStatus(caseId);

    expect(result!.nextStep).toBe('debate');
    expect(result!.hasRiskAssessment).toBe(true);
    expect(result!.hasDebate).toBe(false);
  });

  it('有辩论但无复核时 nextStep 为 package', async () => {
    mockCaseFindUnique.mockResolvedValue(CASE_WITH_FULL_META);
    mockDocumentFindMany.mockResolvedValue(COMPLETED_DOCS);
    mockDebateFindMany.mockResolvedValue(DEBATE_ROW);
    mockCasePackageReviewFindFirst.mockResolvedValue(null);

    const result = await getCaseWorkflowStatus(caseId);

    expect(result!.nextStep).toBe('package');
    expect(result!.hasDebate).toBe(true);
    expect(result!.packageReviewValidity).toBe('none');
    expect(result!.hasValidPackageReview).toBe(false);
  });

  it('复核记录存在但 hash 不匹配时，hasValidPackageReview=false，nextStep 保持 package', async () => {
    mockCaseFindUnique.mockResolvedValue(CASE_WITH_FULL_META);
    mockDocumentFindMany.mockResolvedValue(COMPLETED_DOCS);
    mockDebateFindMany.mockResolvedValue(DEBATE_ROW);
    mockCasePackageReviewFindFirst.mockResolvedValue(REVIEW_ROW);

    // 当前 hash 与存储 hash 不同 → mismatch
    mockComputePackageHash.mockReturnValue('current-hash-DIFFERENT');
    mockResolveReviewMatch.mockReturnValue({
      status: 'mismatch',
      message: '当前内容已变更，需重新复核',
    });

    const result = await getCaseWorkflowStatus(caseId);

    expect(result!.hasValidPackageReview).toBe(false);
    expect(result!.packageReviewValidity).toBe('stale');
    expect(result!.nextStep).toBe('package');
    // 应调用了 buildPackageSections
    expect(mockBuildPackageSections).toHaveBeenCalledWith(caseId);
    // 应调用了 resolveReviewMatch
    expect(mockResolveReviewMatch).toHaveBeenCalledTimes(1);
  });

  it('复核记录存在且 hash 匹配时，hasValidPackageReview=true，nextStep=done', async () => {
    mockCaseFindUnique.mockResolvedValue(CASE_WITH_FULL_META);
    mockDocumentFindMany.mockResolvedValue(COMPLETED_DOCS);
    mockDebateFindMany.mockResolvedValue(DEBATE_ROW);
    mockCasePackageReviewFindFirst.mockResolvedValue(REVIEW_ROW);

    // 当前 hash 与存储 hash 相同 → matched
    mockComputePackageHash.mockReturnValue('stored-hash-xyz');
    mockResolveReviewMatch.mockReturnValue({
      status: 'matched',
      message: '已完成律师复核',
    });

    const result = await getCaseWorkflowStatus(caseId);

    expect(result!.hasValidPackageReview).toBe(true);
    expect(result!.packageReviewValidity).toBe('valid');
    expect(result!.nextStep).toBe('done');
  });

  it('复核记录 selectedSections 无效时应视为 stale，不调用 buildPackageSections', async () => {
    mockCaseFindUnique.mockResolvedValue(CASE_WITH_FULL_META);
    mockDocumentFindMany.mockResolvedValue(COMPLETED_DOCS);
    mockDebateFindMany.mockResolvedValue(DEBATE_ROW);
    mockCasePackageReviewFindFirst.mockResolvedValue({
      ...REVIEW_ROW,
      selectedSections: ['invalid_key'],
    });
    mockIsValidSectionKeys.mockReturnValue(false);

    const result = await getCaseWorkflowStatus(caseId);

    expect(result!.packageReviewValidity).toBe('stale');
    expect(result!.hasValidPackageReview).toBe(false);
    expect(mockBuildPackageSections).not.toHaveBeenCalled();
  });

  it('buildPackageSections 返回 found=false 时复核视为 stale', async () => {
    mockCaseFindUnique.mockResolvedValue(CASE_WITH_FULL_META);
    mockDocumentFindMany.mockResolvedValue(COMPLETED_DOCS);
    mockDebateFindMany.mockResolvedValue(DEBATE_ROW);
    mockCasePackageReviewFindFirst.mockResolvedValue(REVIEW_ROW);
    mockBuildPackageSections.mockResolvedValue({ found: false });

    const result = await getCaseWorkflowStatus(caseId);

    expect(result!.packageReviewValidity).toBe('stale');
    expect(result!.hasValidPackageReview).toBe(false);
    expect(mockResolveReviewMatch).not.toHaveBeenCalled();
  });
});
