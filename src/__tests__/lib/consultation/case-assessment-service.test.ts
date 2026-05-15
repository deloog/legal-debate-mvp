const mockChatCompletion = jest.fn();

jest.mock('@/lib/ai/service-refactored', () => ({
  AIServiceFactory: {
    getInstance: jest.fn(async () => ({
      chatCompletion: mockChatCompletion,
    })),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { CaseAssessmentService } from '@/lib/consultation/case-assessment-service';

describe('CaseAssessmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该调用真实 AI 服务并解析结构化评估结果', async () => {
    mockChatCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              winRate: 0.68,
              winRateReasoning: '借款合意和转账证据较完整',
              difficulty: 'MEDIUM',
              difficultyFactors: ['被告可能抗辩款项性质'],
              riskLevel: 'MEDIUM',
              riskFactors: ['聊天记录完整性需核验'],
              suggestedFeeMin: 8000,
              suggestedFeeMax: 18000,
              feeReasoning: '按争议金额和证据整理工作量估算',
              keyLegalPoints: [
                { point: '民间借贷关系成立', relevantLaw: '民法典合同编' },
              ],
              suggestions: ['补充借款用途和催收记录'],
              similarCases: [],
              confidence: 0.82,
            }),
          },
        },
      ],
    });

    const result = await new CaseAssessmentService().assess({
      caseType: '民间借贷',
      caseSummary: '出借人通过银行转账向借款人支付借款，借款人逾期未还。',
      clientDemand: '要求返还本金和利息',
      consultationType: 'PHONE',
    });

    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('民间借贷'),
          }),
        ]),
      })
    );
    expect(result).toMatchObject({
      winRate: 0.68,
      difficulty: 'MEDIUM',
      riskLevel: 'MEDIUM',
      suggestedFeeMin: 8000,
      suggestedFeeMax: 18000,
      verifiedStatus: 'pending',
    });
  });

  it('AI 调用失败时不做关键词兜底，直接抛出错误', async () => {
    mockChatCompletion.mockRejectedValue(new Error('AI unavailable'));

    await expect(
      new CaseAssessmentService().assess({
        caseSummary: '一方拖欠借款，经多次催收未归还。',
      })
    ).rejects.toThrow('AI unavailable');
  });
});
