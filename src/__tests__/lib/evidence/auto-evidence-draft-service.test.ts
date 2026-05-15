/**
 * auto-evidence-draft-service 单元测试（AI批量规范化版）
 *
 * 覆盖：
 * §A normalizeEvidenceHintsWithAI（mock AI service）
 * §B generateAutoEvidenceDrafts（mock prisma + AI service）
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockDocumentFindMany = jest.fn();
const mockEvidenceFindMany = jest.fn();
const mockEvidenceCreate = jest.fn();
const mockEvidenceUpdate = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    document: { findMany: (...a: unknown[]) => mockDocumentFindMany(...a) },
    evidence: {
      findMany: (...a: unknown[]) => mockEvidenceFindMany(...a),
      create: (...a: unknown[]) => mockEvidenceCreate(...a),
      update: (...a: unknown[]) => mockEvidenceUpdate(...a),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockChatCompletion = jest.fn();
jest.mock('@/lib/ai/service-refactored', () => ({
  AIServiceFactory: {
    getInstance: jest.fn().mockResolvedValue({
      chatCompletion: (...a: unknown[]) => mockChatCompletion(...a),
    }),
  },
}));

import {
  normalizeEvidenceHintsWithAI,
  generateAutoEvidenceDrafts,
  persistAutoEvidenceDrafts,
  upsertAutoEvidenceDrafts,
  type EvidenceDraft,
} from '@/lib/evidence/auto-evidence-draft-service';

// ── 辅助：构造 AI 响应体 ────────────────────────────────────────────────────────

function mockAIResponse(
  items: Array<{ id: string; normalizedName: string | null }>
) {
  mockChatCompletion.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(items) } }],
  });
}

/** 从 chatCompletion 调用的 user message 中提取发送给 AI 的 hint 数组 */
function parseSentHints(
  callIndex = 0
): Array<{ id: string; text: string; isFilename?: boolean }> {
  const callArgs = mockChatCompletion.mock.calls[callIndex][0] as {
    messages: Array<{ role: string; content: string }>;
  };
  const userContent = callArgs.messages[1].content;
  const match = userContent.match(/输入：\n(\[[\s\S]*\])/);
  if (!match) throw new Error('AI user message 中未找到输入 JSON');
  return JSON.parse(match[1]) as Array<{
    id: string;
    text: string;
    isFilename?: boolean;
  }>;
}

beforeEach(() => jest.clearAllMocks());

// ══════════════════════════════════════════════════════════════════════════════
// §A — normalizeEvidenceHintsWithAI
// ══════════════════════════════════════════════════════════════════════════════

describe('normalizeEvidenceHintsWithAI', () => {
  it('空数组输入直接返回空 Map，不调用 AI', async () => {
    const result = await normalizeEvidenceHintsWithAI([]);
    expect(result.size).toBe(0);
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  it('正常 JSON 响应解析为 Map<id, normalizedName>', async () => {
    mockAIResponse([
      { id: 'h0', normalizedName: '借条与借款协议' },
      { id: 'h1', normalizedName: '银行转账流水' },
      { id: 'h2', normalizedName: null },
    ]);

    const result = await normalizeEvidenceHintsWithAI([
      { id: 'h0', text: '借条原件' },
      { id: 'h1', text: '银行流水明细' },
      { id: 'h2', text: '律师内部备忘录' },
    ]);

    expect(result.get('h0')).toBe('借条与借款协议');
    expect(result.get('h1')).toBe('银行转账流水');
    expect(result.get('h2')).toBeNull();
  });

  it('代码块包裹的 JSON 响应可正确解析', async () => {
    mockChatCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: '```json\n[{"id":"h0","normalizedName":"起诉状"}]\n```',
          },
        },
      ],
    });

    const result = await normalizeEvidenceHintsWithAI([
      { id: 'h0', text: '民事起诉状' },
    ]);
    expect(result.get('h0')).toBe('起诉状');
  });

  it('AI 响应不含 JSON 数组时抛出解析错误', async () => {
    // 响应包含 [] 但内容不合法
    mockChatCompletion.mockResolvedValue({
      choices: [{ message: { content: '[not valid json]' } }],
    });

    await expect(
      normalizeEvidenceHintsWithAI([{ id: 'h0', text: '测试' }])
    ).rejects.toThrow('AI 证据名称规范化响应解析失败');
  });

  it('isFilename=true 的线索发送给 AI 时带有该标记', async () => {
    mockAIResponse([{ id: 'h0', normalizedName: '借条与借款协议' }]);

    await normalizeEvidenceHintsWithAI([
      { id: 'h0', text: '02_借条与借款协议.txt', isFilename: true },
    ]);

    const sent = parseSentHints();
    expect(sent[0].isFilename).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §B — generateAutoEvidenceDrafts 基础行为
// ══════════════════════════════════════════════════════════════════════════════

describe('generateAutoEvidenceDrafts — 基础行为', () => {
  it('无已完成文档时返回空数组，不调用 AI', async () => {
    mockDocumentFindMany.mockResolvedValue([]);
    const result = await generateAutoEvidenceDrafts('case-001');
    expect(result).toEqual([]);
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  it('从 claims.evidence 提取线索并通过 AI 规范化', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-1',
        filename: '01_民事起诉状_原告版.txt',
        analysisResult: {
          extractedData: { claims: [{ evidence: ['合同协议', '付款凭证'] }] },
        },
      },
    ]);
    mockAIResponse([
      { id: 'h0', normalizedName: '合同协议' },
      { id: 'h1', normalizedName: '付款凭证' },
    ]);

    const result = await generateAutoEvidenceDrafts('case-001');
    const names = result.map(d => d.normalizedName);
    expect(names).toContain('合同协议');
    expect(names).toContain('付款凭证');
  });

  it('从 disputeFocuses.evidence 提取线索，sourceKinds 含 disputeFocus', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-2',
        filename: '07_证据目录及证明目的.txt',
        analysisResult: {
          extractedData: {
            claims: [],
            disputeFocuses: [
              { description: '借款是否已还清', evidence: ['借条原件'] },
            ],
          },
        },
      },
    ]);
    mockAIResponse([{ id: 'h0', normalizedName: '借条与借款协议' }]);

    const result = await generateAutoEvidenceDrafts('case-001');
    expect(result).toHaveLength(1);
    expect(result[0].normalizedName).toBe('借条与借款协议');
    expect(result[0].sourceKinds).toContain('disputeFocus');
  });

  it('从 keyFacts.evidence 提取线索，sourceKinds 含 keyFact', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-3',
        filename: '03_银行转账流水_整理版.txt',
        analysisResult: {
          extractedData: {
            claims: [],
            keyFacts: [
              { description: '2023年1月借款', evidence: ['银行流水'] },
            ],
          },
        },
      },
    ]);
    mockAIResponse([{ id: 'h0', normalizedName: '银行转账流水' }]);

    const result = await generateAutoEvidenceDrafts('case-001');
    expect(result[0].normalizedName).toBe('银行转账流水');
    expect(result[0].sourceKinds).toContain('keyFact');
  });

  it('evidence 数组中的空字符串和纯空白字符串被过滤，不发给 AI', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-4',
        filename: '01_民事起诉状_原告版.txt',
        analysisResult: {
          extractedData: {
            claims: [{ evidence: ['借条', '', '   '] }],
          },
        },
      },
    ]);
    mockAIResponse([{ id: 'h0', normalizedName: '借条与借款协议' }]);

    await generateAutoEvidenceDrafts('case-001');
    const sent = parseSentHints();
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toBe('借条');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §B — filename fallback
// ══════════════════════════════════════════════════════════════════════════════

describe('generateAutoEvidenceDrafts — filename fallback', () => {
  it('无结构化线索时文件名以 isFilename=true 提交给 AI', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-5',
        filename: '02_借条与借款协议.txt',
        analysisResult: null,
      },
    ]);
    mockAIResponse([{ id: 'h0', normalizedName: '借条与借款协议' }]);

    const result = await generateAutoEvidenceDrafts('case-001');
    expect(result).toHaveLength(1);
    expect(result[0].normalizedName).toBe('借条与借款协议');
    expect(result[0].sourceKinds).toEqual(['filename']);
    expect(result[0].confidence).toBe(0.55);

    const sent = parseSentHints();
    expect(sent[0].isFilename).toBe(true);
  });

  it('AI 对 filename 返回 null 时不生成草稿', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-6',
        filename: '08_律师庭前工作备忘录.txt',
        analysisResult: null,
      },
    ]);
    mockAIResponse([{ id: 'h0', normalizedName: null }]);

    const result = await generateAutoEvidenceDrafts('case-001');
    expect(result).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §B — 聚合与去重
// ══════════════════════════════════════════════════════════════════════════════

describe('generateAutoEvidenceDrafts — 聚合与去重', () => {
  it('两份文档的线索经 AI 归一为同名时合并为一条草稿', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-7',
        filename: '04_微信聊天记录节选.txt',
        analysisResult: {
          extractedData: { claims: [{ evidence: ['微信聊天记录'] }] },
        },
      },
      {
        id: 'doc-8',
        filename: '09_OCR噪声版聊天记录.txt',
        analysisResult: {
          extractedData: { claims: [{ evidence: ['聊天记录截图'] }] },
        },
      },
    ]);
    mockAIResponse([
      { id: 'h0', normalizedName: '聊天记录' },
      { id: 'h1', normalizedName: '聊天记录' },
    ]);

    const result = await generateAutoEvidenceDrafts('case-001');
    const chatDrafts = result.filter(d => d.normalizedName === '聊天记录');
    expect(chatDrafts).toHaveLength(1);
    expect(chatDrafts[0].sourceDocumentIds).toHaveLength(2);
    expect(chatDrafts[0].sourceFilenames).toHaveLength(2);
    expect(chatDrafts[0].evidenceHints).toContain('微信聊天记录');
    expect(chatDrafts[0].evidenceHints).toContain('聊天记录截图');
  });

  it('AI 返回 null 的线索不生成草稿', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-9',
        filename: '01_民事起诉状_原告版.txt',
        analysisResult: {
          extractedData: {
            claims: [{ evidence: ['起诉状', '律师内部备忘录'] }],
          },
        },
      },
    ]);
    mockAIResponse([
      { id: 'h0', normalizedName: '起诉状' },
      { id: 'h1', normalizedName: null },
    ]);

    const result = await generateAutoEvidenceDrafts('case-001');
    expect(result).toHaveLength(1);
    expect(result[0].normalizedName).toBe('起诉状');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §B — confidence 计算
// ══════════════════════════════════════════════════════════════════════════════

describe('generateAutoEvidenceDrafts — confidence 计算', () => {
  it('仅 filename 来源 → 0.55', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { id: 'doc-10', filename: '02_借条与借款协议.txt', analysisResult: null },
    ]);
    mockAIResponse([{ id: 'h0', normalizedName: '借条与借款协议' }]);

    const [draft] = await generateAutoEvidenceDrafts('case-001');
    expect(draft.confidence).toBe(0.55);
  });

  it('单一非 filename 来源（claim）→ 0.72', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-11',
        filename: '01_民事起诉状_原告版.txt',
        analysisResult: {
          extractedData: { claims: [{ evidence: ['起诉状'] }] },
        },
      },
    ]);
    mockAIResponse([{ id: 'h0', normalizedName: '起诉状' }]);

    const [draft] = await generateAutoEvidenceDrafts('case-001');
    expect(draft.confidence).toBe(0.72);
  });

  it('claim + keyFact 两来源合并后 → 0.85', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-12',
        filename: '03_银行转账流水_整理版.txt',
        analysisResult: {
          extractedData: {
            claims: [{ evidence: ['银行转账凭证'] }],
            keyFacts: [{ description: '转账记录', evidence: ['银行流水明细'] }],
          },
        },
      },
    ]);
    mockAIResponse([
      { id: 'h0', normalizedName: '银行转账流水' },
      { id: 'h1', normalizedName: '银行转账流水' },
    ]);

    const result = await generateAutoEvidenceDrafts('case-001');
    const draft = result.find(d => d.normalizedName === '银行转账流水');
    expect(draft?.confidence).toBe(0.85);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §B — disputeFocus coreIssue 优先于 description
// ══════════════════════════════════════════════════════════════════════════════

describe('generateAutoEvidenceDrafts — disputeFocus coreIssue 优先', () => {
  it('有 coreIssue 时写入 supportsDisputes，description 被忽略', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-13',
        filename: '07_证据目录及证明目的.txt',
        analysisResult: {
          extractedData: {
            claims: [],
            disputeFocuses: [
              {
                coreIssue: '借款是否已实际发生',
                description: '争议焦点描述（不应采用）',
                evidence: ['借条原件'],
              },
            ],
          },
        },
      },
    ]);
    mockAIResponse([{ id: 'h0', normalizedName: '借条与借款协议' }]);

    const result = await generateAutoEvidenceDrafts('case-001');
    const draft = result.find(d => d.normalizedName === '借条与借款协议');
    expect(draft?.supportsDisputes).toContain('借款是否已实际发生');
    expect(draft?.supportsDisputes).not.toContain('争议焦点描述（不应采用）');
  });

  it('无 coreIssue 时退回 description', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-14',
        filename: '07_证据目录及证明目的.txt',
        analysisResult: {
          extractedData: {
            claims: [],
            disputeFocuses: [
              { description: '利率是否合法', evidence: ['借款协议条款'] },
            ],
          },
        },
      },
    ]);
    mockAIResponse([{ id: 'h0', normalizedName: '借条与借款协议' }]);

    const result = await generateAutoEvidenceDrafts('case-001');
    const draft = result.find(d => d.normalizedName === '借条与借款协议');
    expect(draft?.supportsDisputes).toContain('利率是否合法');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §C — persistAutoEvidenceDrafts 幂等落库
// ══════════════════════════════════════════════════════════════════════════════

function makeDraft(overrides: Partial<EvidenceDraft> = {}): EvidenceDraft {
  return {
    normalizedName: '借条与借款协议',
    type: 'DOCUMENT',
    description: null,
    sourceDocumentIds: ['doc-1'],
    sourceFilenames: ['01_借条.txt'],
    sourceKinds: ['claim'],
    evidenceHints: ['借条原件'],
    supportsFacts: ['借款已发生'],
    supportsDisputes: [],
    confidence: 0.72,
    ...overrides,
  };
}

describe('persistAutoEvidenceDrafts — 幂等落库', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockEvidenceCreate.mockResolvedValue({ id: 'ev-new' });
    mockEvidenceUpdate.mockResolvedValue({ id: 'ev-existing' });
  });

  it('空 drafts 直接返回 { created: 0, updated: 0, skippedManual: 0 }，不查询数据库', async () => {
    const result = await persistAutoEvidenceDrafts('case-001', []);
    expect(result).toEqual({ created: 0, updated: 0, skippedManual: 0 });
    expect(mockEvidenceFindMany).not.toHaveBeenCalled();
  });

  it('DB 中不存在同名 Evidence → create 并关联 source document', async () => {
    mockEvidenceFindMany.mockResolvedValue([]);

    const result = await persistAutoEvidenceDrafts('case-001', [makeDraft()]);

    expect(result).toEqual({ created: 1, updated: 0, skippedManual: 0 });
    expect(mockEvidenceCreate).toHaveBeenCalledTimes(1);

    const createArg = mockEvidenceCreate.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data['name']).toBe('借条与借款协议');
    expect(createArg.data['caseId']).toBe('case-001');
    expect(createArg.data['type']).toBe('DOCUMENT');
    expect(createArg.data['status']).toBe('PENDING');
    expect(createArg.data['relevanceScore']).toBe(0.72);

    const relations = (createArg.data['relations'] as { create: unknown[] })
      .create;
    expect(relations).toHaveLength(1);
    expect((relations[0] as Record<string, unknown>)['relatedId']).toBe(
      'doc-1'
    );
    expect((relations[0] as Record<string, unknown>)['relationType']).toBe(
      'OTHER'
    );
  });

  it('DB 中已存在同名 Evidence → update 合并 metadata，不重复创建已有 relation', async () => {
    mockEvidenceFindMany.mockResolvedValue([
      {
        id: 'ev-existing',
        name: '借条与借款协议',
        relevanceScore: 0.6,
        metadata: {
          autoGenerated: true,
          sourceKinds: ['claim'],
          evidenceHints: ['旧借条'],
          supportsFacts: ['旧事实'],
          supportsDisputes: [],
          sourceFilenames: ['00_旧借条.txt'],
        },
        relations: [{ relatedId: 'doc-1', relationType: 'OTHER' }],
      },
    ]);

    const draft = makeDraft({ confidence: 0.8, sourceDocumentIds: ['doc-1'] });
    const result = await persistAutoEvidenceDrafts('case-001', [draft]);

    expect(result).toEqual({ created: 0, updated: 1, skippedManual: 0 });
    expect(mockEvidenceUpdate).toHaveBeenCalledTimes(1);
    expect(mockEvidenceCreate).not.toHaveBeenCalled();

    const updateArg = mockEvidenceUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(updateArg.where.id).toBe('ev-existing');
    expect(updateArg.data['relevanceScore']).toBe(0.8); // max(0.6, 0.8)

    const meta = updateArg.data['metadata'] as Record<string, unknown>;
    expect(meta['autoGenerated']).toBe(true);
    expect(meta['evidenceHints'] as string[]).toContain('旧借条');
    expect(meta['evidenceHints'] as string[]).toContain('借条原件');

    // doc-1 已存在，不应有 relations.create
    expect(updateArg.data['relations']).toBeUndefined();
  });

  it('已存在 Evidence，有新 docId → update 中包含新 relation', async () => {
    mockEvidenceFindMany.mockResolvedValue([
      {
        id: 'ev-existing',
        name: '借条与借款协议',
        relevanceScore: 0.7,
        metadata: {
          autoGenerated: true,
          sourceKinds: ['claim'],
          evidenceHints: ['借条'],
          supportsFacts: [],
          supportsDisputes: [],
          sourceFilenames: ['01_借条.txt'],
        },
        relations: [{ relatedId: 'doc-1', relationType: 'OTHER' }],
      },
    ]);

    const draft = makeDraft({ sourceDocumentIds: ['doc-1', 'doc-2'] });
    await persistAutoEvidenceDrafts('case-001', [draft]);

    const updateArg = mockEvidenceUpdate.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    const relations = (updateArg.data['relations'] as { create: unknown[] })
      .create;
    expect(relations).toHaveLength(1);
    expect((relations[0] as Record<string, unknown>)['relatedId']).toBe(
      'doc-2'
    );
  });

  it('多条 drafts：新建和更新分别计数', async () => {
    mockEvidenceFindMany.mockResolvedValue([
      {
        id: 'ev-1',
        name: '借条与借款协议',
        relevanceScore: 0.7,
        metadata: {
          autoGenerated: true,
          sourceKinds: [],
          evidenceHints: [],
          supportsFacts: [],
          supportsDisputes: [],
          sourceFilenames: [],
        },
        relations: [],
      },
    ]);

    const drafts = [
      makeDraft({ normalizedName: '借条与借款协议' }),
      makeDraft({
        normalizedName: '银行转账流水',
        sourceDocumentIds: ['doc-2'],
      }),
    ];
    const result = await persistAutoEvidenceDrafts('case-001', drafts);

    expect(result).toEqual({ created: 1, updated: 1, skippedManual: 0 });
    expect(mockEvidenceCreate).toHaveBeenCalledTimes(1);
    expect(mockEvidenceUpdate).toHaveBeenCalledTimes(1);
  });

  it('同名人工证据（无 autoGenerated 标记）→ 跳过，不调用 update，计入 skippedManual', async () => {
    // 人工证据：metadata 为空（律师手工录入）
    mockEvidenceFindMany.mockResolvedValue([
      {
        id: 'ev-manual',
        name: '借条与借款协议',
        relevanceScore: 0.9,
        metadata: null,
        relations: [],
      },
    ]);

    const result = await persistAutoEvidenceDrafts('case-001', [makeDraft()]);

    expect(result).toEqual({ created: 0, updated: 0, skippedManual: 1 });
    expect(mockEvidenceUpdate).not.toHaveBeenCalled();
    expect(mockEvidenceCreate).not.toHaveBeenCalled();
  });

  it('同名人工证据（metadata 不含 autoGenerated）→ 跳过不改 relevanceScore', async () => {
    // 人工证据：有 metadata 但不是自动生成的
    mockEvidenceFindMany.mockResolvedValue([
      {
        id: 'ev-manual-2',
        name: '借条与借款协议',
        relevanceScore: 0.95,
        metadata: { note: '律师手工标注的高价值证据', someOtherField: true },
        relations: [{ relatedId: 'doc-99', relationType: 'FACT' }],
      },
    ]);

    await persistAutoEvidenceDrafts('case-001', [
      makeDraft({ confidence: 1.0 }),
    ]);

    expect(mockEvidenceUpdate).not.toHaveBeenCalled();
  });

  it('混合场景：一条人工证据跳过，一条新草稿创建', async () => {
    mockEvidenceFindMany.mockResolvedValue([
      {
        id: 'ev-manual',
        name: '借条与借款协议',
        relevanceScore: 0.9,
        metadata: null,
        relations: [],
      },
    ]);

    const drafts = [
      makeDraft({ normalizedName: '借条与借款协议' }),
      makeDraft({
        normalizedName: '银行转账流水',
        sourceDocumentIds: ['doc-2'],
      }),
    ];
    const result = await persistAutoEvidenceDrafts('case-001', drafts);

    expect(result).toEqual({ created: 1, updated: 0, skippedManual: 1 });
    expect(mockEvidenceCreate).toHaveBeenCalledTimes(1);
    const createArg = mockEvidenceCreate.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data['name']).toBe('银行转账流水');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §C — upsertAutoEvidenceDrafts 编排
// ══════════════════════════════════════════════════════════════════════════════

describe('upsertAutoEvidenceDrafts — 编排', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // resetAllMocks 会清除 AIServiceFactory.getInstance 的实现，需重新设置
    (
      require('@/lib/ai/service-refactored').AIServiceFactory
        .getInstance as jest.Mock
    ).mockResolvedValue({ chatCompletion: mockChatCompletion });
    mockEvidenceFindMany.mockResolvedValue([]);
    mockEvidenceCreate.mockResolvedValue({ id: 'ev-new' });
  });

  it('返回 drafts + created + updated，且调用了 generate 和 persist', async () => {
    // generateAutoEvidenceDrafts 依赖
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-1',
        filename: '01_借条.txt',
        analysisResult: {
          extractedData: { claims: [{ evidence: ['借条原件'] }] },
        },
      },
    ]);
    mockAIResponse([{ id: 'h0', normalizedName: '借条与借款协议' }]);

    // persistAutoEvidenceDrafts 依赖
    mockEvidenceFindMany.mockResolvedValue([]);
    mockEvidenceCreate.mockResolvedValue({ id: 'ev-new' });

    const result = await upsertAutoEvidenceDrafts('case-001');

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].normalizedName).toBe('借条与借款协议');
    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
  });
});
