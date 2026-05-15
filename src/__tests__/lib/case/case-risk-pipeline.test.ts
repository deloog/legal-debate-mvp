/**
 * case-risk-pipeline 单元 + mock 集成测试
 */

// ── Mock ──────────────────────────────────────────────────────────────────────

const mockCaseUpdate = jest.fn();
const mockCaseFindUnique = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findUnique: (...args: unknown[]) => mockCaseFindUnique(...args),
      update: (...args: unknown[]) => mockCaseUpdate(...args),
    },
  },
}));

const mockChatCompletion = jest.fn();
jest.mock('@/lib/ai/service-refactored', () => ({
  AIServiceFactory: {
    getInstance: jest.fn().mockResolvedValue({
      chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
    }),
  },
}));

jest.mock('@/lib/ai/config', () => ({
  getDefaultModel: jest.fn().mockReturnValue('deepseek-chat'),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  runCaseRiskAssessment,
  type RiskAssessmentSnapshot,
} from '@/lib/case/case-risk-pipeline';

beforeEach(() => {
  jest.clearAllMocks();
});

// ── 工具：构建提炼快照 ─────────────────────────────────────────────────────────

const BASE_SNAPSHOT = {
  summary: '借款10万元，被告主张已还款',
  plaintiffName: '张三',
  defendantName: '李四',
  establishedFacts: ['2023年1月借款10万元', '银行转账凭证存在'],
  uncertainFacts: ['现金还款2万元无凭证', '利率是否超过LPR四倍'],
  disputeFocuses: ['借款是否已全部还清', '利率是否合法'],
  sourceDocumentIds: ['doc-1', 'doc-2'],
  generatedAt: '2026-05-12T10:00:00.000Z',
};

const MOCK_CASE_WITH_SNAPSHOT = {
  title: '张三诉李四民间借贷纠纷',
  metadata: { extractionSnapshot: BASE_SNAPSHOT },
};

const MOCK_AI_RISK_RESPONSE = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          winRate: 0.65,
          difficulty: '中等',
          riskLevel: 'MEDIUM',
          summary: '原告胜诉概率较高，主要风险在于被告主张的现金还款无法核实',
          keyRisks: ['现金还款2万元无凭证', '利率争议可能影响利息部分'],
        }),
      },
    },
  ],
};

// ══════════════════════════════════════════════════════════════════════════════

describe('runCaseRiskAssessment()', () => {
  const caseId = 'case-risk-001';

  it('AI 成功时应返回完整快照并写入 metadata.riskAssessment', async () => {
    mockCaseFindUnique.mockResolvedValue(MOCK_CASE_WITH_SNAPSHOT);
    mockChatCompletion.mockResolvedValue(MOCK_AI_RISK_RESPONSE);
    mockCaseUpdate.mockResolvedValue({});

    const result = await runCaseRiskAssessment(caseId);

    expect(result).not.toBeNull();
    const snap = result as RiskAssessmentSnapshot;
    expect(snap.winRate).toBe(0.65);
    expect(snap.difficulty).toBe('中等');
    expect(snap.riskLevel).toBe('MEDIUM');
    expect(snap.aiAssessment.keyRisks).toHaveLength(2);
    expect(snap.aiAssessment.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // 验证写入 metadata.riskAssessment 子键
    expect(mockCaseUpdate).toHaveBeenCalledTimes(1);
    const call = mockCaseUpdate.mock.calls[0][0];
    expect(call.where.id).toBe(caseId);
    const written = call.data.metadata as Record<string, unknown>;
    expect(written['riskAssessment']).toBeDefined();
    // 保留了 extractionSnapshot
    expect(written['extractionSnapshot']).toBeDefined();
  });

  it('AI 失败时应直接抛出错误（不降级，由调用方处理）', async () => {
    mockCaseFindUnique.mockResolvedValue(MOCK_CASE_WITH_SNAPSHOT);
    mockChatCompletion.mockRejectedValue(new Error('网络超时'));

    await expect(runCaseRiskAssessment(caseId)).rejects.toThrow('网络超时');
    // AI 失败不写入 metadata
    expect(mockCaseUpdate).not.toHaveBeenCalled();
  });

  it('案件不存在时应返回 null', async () => {
    mockCaseFindUnique.mockResolvedValue(null);

    const result = await runCaseRiskAssessment(caseId);

    expect(result).toBeNull();
    expect(mockCaseUpdate).not.toHaveBeenCalled();
  });

  it('无提炼快照时应返回 null（提示需先执行 /extract）', async () => {
    mockCaseFindUnique.mockResolvedValue({
      title: '无快照案件',
      metadata: { winRate: 0.5 }, // 旧格式，但没有 extractionSnapshot
    });

    const result = await runCaseRiskAssessment(caseId);

    expect(result).toBeNull();
    expect(mockCaseUpdate).not.toHaveBeenCalled();
  });

  it('winRate 应被 clamp 在 [0,1] 范围内', async () => {
    mockCaseFindUnique.mockResolvedValue(MOCK_CASE_WITH_SNAPSHOT);
    mockChatCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              winRate: 1.5, // 超出范围
              difficulty: '简单',
              riskLevel: 'LOW',
              summary: '胜诉把握极高',
              keyRisks: [],
            }),
          },
        },
      ],
    });
    mockCaseUpdate.mockResolvedValue({});

    const result = await runCaseRiskAssessment(caseId);

    expect(result!.winRate).toBe(1); // 被 clamp
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// package-builder §5 兼容性：RiskAssessmentSnapshot 契约验证
// ══════════════════════════════════════════════════════════════════════════════

describe('RiskAssessmentSnapshot 结构契约', () => {
  it('快照字段与 §5 parseRiskMetadata 期望一致', () => {
    const snapshot: RiskAssessmentSnapshot = {
      winRate: 0.65,
      difficulty: '中等',
      riskLevel: 'MEDIUM',
      aiAssessment: {
        summary: '测试摘要',
        keyRisks: ['风险1', '风险2'],
        generatedAt: new Date().toISOString(),
      },
    };

    // parseRiskMetadata 检查的字段
    expect(typeof snapshot.winRate).toBe('number');
    expect(typeof snapshot.difficulty).toBe('string');
    expect(typeof snapshot.riskLevel).toBe('string');
    expect(typeof snapshot.aiAssessment.summary).toBe('string');
    expect(Array.isArray(snapshot.aiAssessment.keyRisks)).toBe(true);
  });
});
