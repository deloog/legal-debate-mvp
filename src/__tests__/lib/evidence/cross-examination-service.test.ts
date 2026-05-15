import { CrossExaminationService } from '@/lib/evidence/cross-examination-service';
import type { Evidence } from '@prisma/client';

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

const MOCK_AI_RESPONSE = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          possibleChallenges: [
            {
              type: 'authenticity',
              content: '复印件无法核实原件真实性',
              likelihood: 70,
            },
            {
              type: 'relevance',
              content: '合同签订时间与争议事项无关联',
              likelihood: 30,
            },
          ],
          responses: [
            {
              challenge: '复印件无法核实原件真实性',
              response: '提供原件或申请法院调取备案合同',
              supportingEvidence: '备案合同',
            },
          ],
          overallRisk: 'medium',
          riskNote: '存在真实性质疑风险，建议补充原件',
        }),
      },
    },
  ],
};

describe('CrossExaminationService', () => {
  let service: CrossExaminationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CrossExaminationService();
    mockChatCompletion.mockResolvedValue(MOCK_AI_RESPONSE);
  });

  const buildEvidence = (overrides: Partial<Evidence> = {}): Evidence =>
    ({
      id: 'evidence-1',
      caseId: 'case-1',
      type: 'DOCUMENT',
      name: '劳动合同复印件',
      description: '与公司签订的劳动合同复印件',
      fileUrl: null,
      submitter: 'test@example.com',
      source: '原告提交',
      status: 'ACCEPTED',
      relevanceScore: 85,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    }) as Evidence;

  it('应该成功预判质证意见', async () => {
    const result = await service.preAssess({
      evidence: buildEvidence(),
      ourPosition: 'plaintiff',
      caseType: 'LABOR_DISPUTE',
    });

    expect(result.possibleChallenges).toHaveLength(2);
    expect(result.responses).toHaveLength(1);
    expect(result.overallRisk).toBe('medium');
    expect(result.riskNote).toContain('真实性');
  });

  it('应该正确分类质证类型和可能性范围', async () => {
    const result = await service.preAssess({
      evidence: buildEvidence(),
      ourPosition: 'plaintiff',
      caseType: 'LABOR_DISPUTE',
    });

    for (const challenge of result.possibleChallenges) {
      expect(['authenticity', 'legality', 'relevance']).toContain(
        challenge.type
      );
      expect(challenge.likelihood).toBeGreaterThanOrEqual(0);
      expect(challenge.likelihood).toBeLessThanOrEqual(100);
    }
  });

  it('应该处理不同立场与案件类型', async () => {
    const plaintiffResult = await service.preAssess({
      evidence: buildEvidence(),
      ourPosition: 'plaintiff',
      caseType: 'LABOR_DISPUTE',
    });
    const defendantResult = await service.preAssess({
      evidence: buildEvidence({ type: 'AUDIO_VIDEO', name: '录音证据' }),
      ourPosition: 'defendant',
      caseType: 'CONTRACT_DISPUTE',
    });

    expect(plaintiffResult).toBeDefined();
    expect(defendantResult).toBeDefined();
    expect(mockChatCompletion).toHaveBeenCalledTimes(2);
  });

  it('应该处理不同证据类型', async () => {
    await expect(
      service.preAssess({
        evidence: buildEvidence({ type: 'PHYSICAL', name: '工作证' }),
        ourPosition: 'plaintiff',
      })
    ).resolves.toBeDefined();

    await expect(
      service.preAssess({
        evidence: buildEvidence({ type: 'AUDIO_VIDEO', name: '监控录像' }),
        ourPosition: 'plaintiff',
      })
    ).resolves.toBeDefined();
  });

  it('应该在 AI 服务失败时抛错', async () => {
    mockChatCompletion.mockRejectedValueOnce(new Error('AI服务不可用'));

    await expect(
      service.preAssess({
        evidence: buildEvidence(),
        ourPosition: 'plaintiff',
      })
    ).rejects.toThrow('AI服务不可用');
  });

  it('应该在 AI 返回非 JSON 时抛错', async () => {
    mockChatCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: 'Hello! How can I help you today?' } }],
    });

    await expect(
      service.preAssess({
        evidence: buildEvidence(),
        ourPosition: 'plaintiff',
      })
    ).rejects.toThrow('AI 未返回有效 JSON');
  });

  it('应该校验非法输入', async () => {
    await expect(
      service.preAssess({
        evidence: { id: 'broken' } as Evidence,
        ourPosition: 'plaintiff',
      })
    ).rejects.toThrow();

    await expect(
      service.preAssess({
        evidence: buildEvidence(),
        ourPosition: 'invalid' as any,
      })
    ).rejects.toThrow('当事人立场必须是plaintiff或defendant');
  });
});
