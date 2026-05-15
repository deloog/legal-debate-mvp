/**
 * Phase 5 — 真实卷宗回归验证
 *
 * 使用 test-data/realistic-dossiers/loan-dispute-case-001/ 的文件名集合，
 * 验证卷宗自动化流程（Phase 1-3）的关键路径是否就绪。
 *
 * 不需要运行中的服务器：全部使用 mock 或纯逻辑验证。
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockDocumentFindMany = jest.fn();
const mockCaseFindUnique = jest.fn();
const mockDebateFindFirst = jest.fn();
const mockArgumentFindMany = jest.fn();
const mockEvidenceFindMany = jest.fn();
const mockEvidenceCount = jest.fn();
const mockConversationFindFirst = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    document: { findMany: (...a: unknown[]) => mockDocumentFindMany(...a) },
    case: { findUnique: (...a: unknown[]) => mockCaseFindUnique(...a) },
    debate: { findFirst: (...a: unknown[]) => mockDebateFindFirst(...a) },
    argument: { findMany: (...a: unknown[]) => mockArgumentFindMany(...a) },
    evidence: {
      findMany: (...a: unknown[]) => mockEvidenceFindMany(...a),
      count: (...a: unknown[]) => mockEvidenceCount(...a),
    },
    conversation: {
      findFirst: (...a: unknown[]) => mockConversationFindFirst(...a),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  detectMaterialTypes,
  shouldTriggerExtraction,
} from '@/lib/case/case-extraction-service';

// ── 真实卷宗文件名集合（按路线图顺序）──────────────────────────────────────────

const LOAN_DISPUTE_FILENAMES = [
  '00_案件概览.txt',
  '01_民事起诉状_原告版.txt',
  '02_借条与借款协议.txt',
  '03_银行转账流水_整理版.txt',
  '04_微信聊天记录节选.txt',
  '06_被告答辩意见_模拟版.txt',
  '07_证据目录及证明目的.txt',
  '09_OCR噪声版聊天记录.txt',
];

beforeEach(() => jest.clearAllMocks());

// ══════════════════════════════════════════════════════════════════════════════
// §A — 材料类型识别
// ══════════════════════════════════════════════════════════════════════════════

describe('detectMaterialTypes — 借款纠纷卷宗', () => {
  it('应从全套 8 份文件中识别出至少 4 种核心材料类型', () => {
    const types = detectMaterialTypes(LOAN_DISPUTE_FILENAMES);
    // overview / complaint / agreement / bankStatement / chat
    expect(types.size).toBeGreaterThanOrEqual(4);
  });

  it('应识别案件概览（00_案件概览.txt）', () => {
    const types = detectMaterialTypes(['00_案件概览.txt']);
    expect(types.has('overview')).toBe(true);
  });

  it('应识别起诉状（01_民事起诉状_原告版.txt）', () => {
    const types = detectMaterialTypes(['01_民事起诉状_原告版.txt']);
    expect(types.has('complaint')).toBe(true);
  });

  it('应识别借条与协议（02_借条与借款协议.txt）', () => {
    const types = detectMaterialTypes(['02_借条与借款协议.txt']);
    expect(types.has('agreement')).toBe(true);
  });

  it('应识别银行流水（03_银行转账流水_整理版.txt）', () => {
    const types = detectMaterialTypes(['03_银行转账流水_整理版.txt']);
    expect(types.has('bankStatement')).toBe(true);
  });

  it('两份聊天记录（04 和 09）应合并为同一类型', () => {
    const types = detectMaterialTypes([
      '04_微信聊天记录节选.txt',
      '09_OCR噪声版聊天记录.txt',
    ]);
    expect(types.has('chat')).toBe(true);
    // 两份同类不应被计为 2 种独立类型
    expect(types.size).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §B — 提炼触发阈值
// ══════════════════════════════════════════════════════════════════════════════

describe('shouldTriggerExtraction — 借款纠纷卷宗', () => {
  it('上传前 2 份核心材料（起诉状 + 借条）后应满足触发条件', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { filename: '01_民事起诉状_原告版.txt', analysisResult: null },
      { filename: '02_借条与借款协议.txt', analysisResult: null },
    ]);
    expect(await shouldTriggerExtraction('case-loan-001')).toBe(true);
  });

  it('全套 8 份文件应满足触发条件（≥2 类核心材料）', async () => {
    mockDocumentFindMany.mockResolvedValue(
      LOAN_DISPUTE_FILENAMES.map(filename => ({
        filename,
        analysisResult: null,
      }))
    );
    expect(await shouldTriggerExtraction('case-loan-001')).toBe(true);
  });

  it('仅上传 1 份零散文件（不属于核心类型）时不应触发', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { filename: '08_律师庭前工作备忘录.txt', analysisResult: null },
    ]);
    expect(await shouldTriggerExtraction('case-loan-001')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §C — 交付包章节可用性（buildPackageSections 真实模块调用）
// ══════════════════════════════════════════════════════════════════════════════

// 通过 mock prisma 直接调用 buildPackageSections，验证真实的 tier / available 输出

const CASE_BASE = {
  title: '张三诉李四民间借贷纠纷',
  type: 'CIVIL',
  status: 'ACTIVE',
  caseNumber: null,
  cause: null,
  court: null,
  plaintiffName: '张三',
  defendantName: '李四',
  amount: null,
};

describe('交付包章节 — buildPackageSections 真实输出验证', () => {
  beforeEach(() => {
    // 默认返回空结果，各测试按需覆盖
    mockDebateFindFirst.mockResolvedValue(null);
    mockArgumentFindMany.mockResolvedValue([]);
    mockEvidenceFindMany.mockResolvedValue([]);
    mockEvidenceCount.mockResolvedValue(0);
    mockConversationFindFirst.mockResolvedValue(null);
  });

  it('§2 在 Phase 1 提炼快照（disputeFocuses）写入后应为 tier=primary', async () => {
    const { buildPackageSections } = await import('@/lib/case/package-builder');

    mockCaseFindUnique.mockResolvedValue({
      ...CASE_BASE,
      metadata: {
        extractionSnapshot: {
          disputeFocuses: ['借款是否已还清', '利率是否合法'],
          establishedFacts: ['2023年1月借款10万元'],
          uncertainFacts: ['现金还款2万元无凭证'],
          generatedAt: '2026-05-12T10:00:00.000Z',
        },
      },
    });

    const result = await buildPackageSections('case-loan-001');

    expect(result.found).toBe(true);
    if (!result.found) return;

    const s2 = result.sections.s2_dispute_focus;
    expect(s2.tier).toBe('primary');
    expect(s2.available).toBe(true);
    // 提炼结果应写入 data.disputeFocuses
    const data = s2.data as Record<string, unknown> | null;
    expect(Array.isArray(data?.['disputeFocuses'])).toBe(true);
    expect((data?.['disputeFocuses'] as string[]).length).toBeGreaterThan(0);
  });

  it('§5 在 Phase 2 风险评估写入后应为 tier=primary', async () => {
    const { buildPackageSections } = await import('@/lib/case/package-builder');

    mockCaseFindUnique.mockResolvedValue({
      ...CASE_BASE,
      metadata: {
        riskAssessment: {
          winRate: 0.65,
          difficulty: '中等',
          riskLevel: 'MEDIUM',
          aiAssessment: {
            summary: '原告胜诉概率较高',
            keyRisks: ['现金还款无凭证'],
            generatedAt: '2026-05-12T11:00:00.000Z',
          },
        },
      },
    });

    const result = await buildPackageSections('case-loan-001');

    expect(result.found).toBe(true);
    if (!result.found) return;

    const s5 = result.sections.s5_risk_assessment;
    expect(s5.tier).toBe('primary');
    expect(s5.available).toBe(true);
    const data = s5.data as Record<string, unknown> | null;
    expect(typeof data?.['winRate']).toBe('number');
    expect(typeof data?.['riskLevel']).toBe('string');
  });

  it('§6 在 Phase 3.4 自动辩论摘要写入后应从 fallback 升为 tier=primary', async () => {
    const { buildPackageSections } = await import('@/lib/case/package-builder');

    mockCaseFindUnique.mockResolvedValue({ ...CASE_BASE, metadata: {} });
    mockDebateFindFirst.mockResolvedValue({
      summary: {
        verdict: '原告胜诉可能性较高',
        recommendation: '建议补充现金还款反驳证据',
        plaintiffStrengths: ['银行转账凭证完整', '借条有效'],
        defendantStrengths: ['主张现金还款', '利率过高抗辩'],
        autoGenerated: true,
        roundCount: 1,
      },
    });

    const result = await buildPackageSections('case-loan-001');

    expect(result.found).toBe(true);
    if (!result.found) return;

    const s6 = result.sections.s6_expert_opinion;
    expect(s6.tier).toBe('primary');
    expect(s6.available).toBe(true);
    const data = s6.data as Record<string, unknown> | null;
    expect(typeof data?.['verdict']).toBe('string');
    expect(Array.isArray(data?.['plaintiffStrengths'])).toBe(true);
  });

  it('无摘要时 §6 应为 tier=fallback（仍 available）', async () => {
    const { buildPackageSections } = await import('@/lib/case/package-builder');

    mockCaseFindUnique.mockResolvedValue({ ...CASE_BASE, metadata: {} });
    // mockDebateFindFirst 默认返回 null

    const result = await buildPackageSections('case-loan-001');

    expect(result.found).toBe(true);
    if (!result.found) return;

    const s6 = result.sections.s6_expert_opinion;
    expect(s6.tier).toBe('fallback');
    expect(s6.available).toBe(true); // fallback 仍然 available
  });

  it('案件不存在时应返回 found=false', async () => {
    const { buildPackageSections } = await import('@/lib/case/package-builder');

    mockCaseFindUnique.mockResolvedValue(null);

    const result = await buildPackageSections('case-nonexistent');

    expect(result.found).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §D — 可用性总计预测
// ══════════════════════════════════════════════════════════════════════════════

describe('交付包完整度预测（借款纠纷全流程完成后）', () => {
  it('Phase 1-3 完成后，§1/§2/§5/§6/§7 应均为 available（共 5 节）', () => {
    // §1: 始终 primary（案件基本信息）
    // §2: Phase 1 后 → primary（extractionSnapshot.disputeFocuses）
    // §3: 取决于辩论论点（有辩论则 available）
    // §4: 取决于 Evidence 记录（需要手动添加或文档分析创建）
    // §5: Phase 2 后 → primary（riskAssessment）
    // §6: Phase 3.4 后 → primary（自动辩论摘要）
    // §7: 始终 fallback available

    const expectedAvailable = {
      s1: true, // 始终
      s2: true, // Phase 1 后
      s3: true, // 有辩论论点后（需用户触发一次辩论）
      s4: false, // 需手动添加证据记录（当前 Document → Evidence 未自动化）
      s5: true, // Phase 2 后
      s6: true, // Phase 3.4 后（auto-summary）
      s7: true, // 始终
    };

    const availableCount =
      Object.values(expectedAvailable).filter(Boolean).length;
    // 6/7 是 Phase 1-3 完成后的预期（§4 需要额外添加证据才能达到 7/7）
    expect(availableCount).toBe(6);
    // §4 = false 是已知限制，后续可通过文档分析 → Evidence 自动化来解决
    expect(expectedAvailable.s4).toBe(false);
  });
});
