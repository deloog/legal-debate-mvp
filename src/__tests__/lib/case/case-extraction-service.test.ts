/**
 * case-extraction-service 单元 + mock 集成测试
 *
 * 测试策略：
 * - detectMaterialTypes / shouldTriggerExtraction 为纯逻辑 / mock DB 测试
 * - runCaseExtraction 为 mock AI + mock DB 的集成测试
 */

// ── Mock 依赖 ──────────────────────────────────────────────────────────────────

const mockCaseUpdate = jest.fn();
const mockCaseFindUnique = jest.fn();
const mockDocumentFindMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findUnique: (...args: unknown[]) => mockCaseFindUnique(...args),
      update: (...args: unknown[]) => mockCaseUpdate(...args),
    },
    document: {
      findMany: (...args: unknown[]) => mockDocumentFindMany(...args),
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
  getDefaultModel: jest.fn().mockReturnValue('glm-4-flash'),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── 导入被测模块 ───────────────────────────────────────────────────────────────

import {
  detectMaterialTypes,
  shouldTriggerExtraction,
  runCaseExtraction,
  type CaseExtractionSnapshot,
} from '@/lib/case/case-extraction-service';

beforeEach(() => {
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// detectMaterialTypes — 纯函数，无副作用
// ══════════════════════════════════════════════════════════════════════════════

describe('detectMaterialTypes()', () => {
  it('应识别起诉状类型', () => {
    const types = detectMaterialTypes(['01_民事起诉状_原告版.txt']);
    expect(types.has('complaint')).toBe(true);
  });

  it('应识别借条/协议类型', () => {
    const types = detectMaterialTypes(['02_借条与借款协议.txt']);
    expect(types.has('agreement')).toBe(true);
  });

  it('应识别银行流水类型', () => {
    const types = detectMaterialTypes(['03_银行转账流水_整理版.txt']);
    expect(types.has('bankStatement')).toBe(true);
  });

  it('同一批文件中应识别多个类型', () => {
    const filenames = [
      '01_民事起诉状_原告版.txt',
      '02_借条与借款协议.txt',
      '03_银行转账流水_整理版.txt',
    ];
    const types = detectMaterialTypes(filenames);
    expect(types.size).toBe(3);
    expect(types.has('complaint')).toBe(true);
    expect(types.has('agreement')).toBe(true);
    expect(types.has('bankStatement')).toBe(true);
  });

  it('3 份相同类型的聊天记录不应被计为多类', () => {
    const filenames = ['聊天记录1.txt', '聊天记录2.txt', '聊天记录3.txt'];
    const types = detectMaterialTypes(filenames);
    expect(types.size).toBe(1); // 全是 chat 类
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// shouldTriggerExtraction — mock DB
// ══════════════════════════════════════════════════════════════════════════════

describe('shouldTriggerExtraction()', () => {
  it('0 份文档时返回 false', async () => {
    mockDocumentFindMany.mockResolvedValue([]);
    expect(await shouldTriggerExtraction('case-1')).toBe(false);
  });

  it('覆盖 2 类核心材料时返回 true（优先条件）', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { filename: '01_民事起诉状.txt', analysisResult: null },
      { filename: '02_借条.txt', analysisResult: null },
    ]);
    expect(await shouldTriggerExtraction('case-1')).toBe(true);
  });

  it('3 份同类聊天记录不满足优先条件', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { filename: '聊天记录1.txt', analysisResult: null },
      { filename: '聊天记录2.txt', analysisResult: null },
      { filename: '聊天记录3.txt', analysisResult: null },
    ]);
    expect(await shouldTriggerExtraction('case-1')).toBe(false);
  });

  it('文档数 >= 5 且有 summary 时，fallback 条件成立', async () => {
    const withSummary = {
      filename: 'doc1.txt',
      analysisResult: { extractedData: { summary: '测试摘要' } },
    };
    const withoutSummary = { filename: 'doc.txt', analysisResult: null };
    mockDocumentFindMany.mockResolvedValue([
      withSummary,
      withoutSummary,
      withoutSummary,
      withoutSummary,
      withoutSummary,
    ]);
    // 单类材料（非 chat/complaint 等），5 份，有 summary → fallback 成立
    expect(await shouldTriggerExtraction('case-1')).toBe(true);
  });

  it('文档数 >= 5 但全部 summary 为空时，fallback 不成立', async () => {
    mockDocumentFindMany.mockResolvedValue(
      Array(5).fill({ filename: 'doc.txt', analysisResult: null })
    );
    expect(await shouldTriggerExtraction('case-1')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// runCaseExtraction — mock AI + mock DB
// ══════════════════════════════════════════════════════════════════════════════

describe('runCaseExtraction()', () => {
  const caseId = 'case-test-001';

  const mockCaseRow = {
    title: '张三诉李四借款纠纷',
    plaintiffName: '张三',
    defendantName: '李四',
    metadata: {},
  };

  const mockDocs = [
    {
      id: 'doc-1',
      analysisResult: {
        extractedData: {
          parties: [{ type: 'plaintiff', name: '张三' }],
          summary: '原告主张被告借款未还',
          claims: [{ content: '还款10万元' }],
          keyFacts: [{ description: '2023年1月借款' }],
          core_disputes: ['是否已还款'],
        },
      },
    },
    {
      id: 'doc-2',
      analysisResult: {
        extractedData: {
          parties: [{ type: 'defendant', name: '李四' }],
          summary: '被告主张已现金还款',
          claims: [],
          keyFacts: [],
          core_disputes: ['现金还款凭证'],
        },
      },
    },
  ];

  const mockAIResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: '借款纠纷，原告主张被告未还款10万元',
            establishedFacts: ['2023年1月借款10万元'],
            uncertainFacts: ['现金还款2万元是否成立'],
            disputeFocuses: ['借款是否已还清', '利率是否过高'],
          }),
        },
      },
    ],
  };

  it('AI 成功时应返回快照并写入 metadata', async () => {
    mockCaseFindUnique.mockResolvedValue(mockCaseRow);
    mockDocumentFindMany.mockResolvedValue(mockDocs);
    mockChatCompletion.mockResolvedValue(mockAIResponse);
    mockCaseUpdate.mockResolvedValue({});

    const result = await runCaseExtraction(caseId);

    expect(result).not.toBeNull();
    const snap = result as CaseExtractionSnapshot;
    expect(snap.summary).toBe('借款纠纷，原告主张被告未还款10万元');
    expect(snap.disputeFocuses).toHaveLength(2);
    expect(snap.sourceDocumentIds).toEqual(['doc-1', 'doc-2']);
    expect(snap.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // 验证 metadata 写回
    expect(mockCaseUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockCaseUpdate.mock.calls[0][0];
    expect(updateCall.where.id).toBe(caseId);
    expect(updateCall.data.metadata).toHaveProperty('extractionSnapshot');
  });

  it('AI 失败时应直接抛出错误（不降级，由调用方处理）', async () => {
    mockCaseFindUnique.mockResolvedValue(mockCaseRow);
    mockDocumentFindMany.mockResolvedValue(mockDocs);
    mockChatCompletion.mockRejectedValue(new Error('AI 服务不可用'));

    await expect(runCaseExtraction(caseId)).rejects.toThrow('AI 服务不可用');
    // AI 失败不写入 metadata
    expect(mockCaseUpdate).not.toHaveBeenCalled();
  });

  it('案件不存在时应返回 null', async () => {
    mockCaseFindUnique.mockResolvedValue(null);

    const result = await runCaseExtraction(caseId);

    expect(result).toBeNull();
    expect(mockCaseUpdate).not.toHaveBeenCalled();
  });

  it('无已完成文档时应返回 null', async () => {
    mockCaseFindUnique.mockResolvedValue(mockCaseRow);
    mockDocumentFindMany.mockResolvedValue([]);

    const result = await runCaseExtraction(caseId);

    expect(result).toBeNull();
    expect(mockCaseUpdate).not.toHaveBeenCalled();
  });

  it('写入时应合并保留 metadata 中已有的其他字段', async () => {
    const caseWithExistingMeta = {
      ...mockCaseRow,
      metadata: { winRate: 0.7, riskLevel: 'MEDIUM' },
    };
    mockCaseFindUnique.mockResolvedValue(caseWithExistingMeta);
    mockDocumentFindMany.mockResolvedValue(mockDocs);
    mockChatCompletion.mockResolvedValue(mockAIResponse);
    mockCaseUpdate.mockResolvedValue({});

    await runCaseExtraction(caseId);

    const updateCall = mockCaseUpdate.mock.calls[0][0];
    const writtenMeta = updateCall.data.metadata as Record<string, unknown>;
    // 保留已有字段
    expect(writtenMeta['winRate']).toBe(0.7);
    expect(writtenMeta['riskLevel']).toBe('MEDIUM');
    // 同时写入快照
    expect(writtenMeta['extractionSnapshot']).toBeDefined();
  });
});
