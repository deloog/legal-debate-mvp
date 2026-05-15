import { POST } from '@/app/api/consultations/[id]/assess/route';
import { NextRequest } from 'next/server';

const mockAssess = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    consultation: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(async () => ({
    userId: 'user-1',
    email: 'test@example.com',
    role: 'LAWYER',
  })),
}));

jest.mock('@/lib/consultation/case-assessment-service', () => ({
  createCaseAssessmentService: jest.fn(() => ({
    assess: mockAssess,
  })),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { prisma } from '@/lib/db/prisma';

const mockConsultationFindFirst = prisma.consultation.findFirst as jest.Mock;
const mockConsultationUpdate = prisma.consultation.update as jest.Mock;

describe('POST /api/consultations/[id]/assess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsultationFindFirst.mockResolvedValue({
      id: 'consultation-1',
      userId: 'user-1',
      caseType: '民间借贷',
      caseSummary: '出借人通过银行转账交付借款，借款人逾期未还。',
      clientDemand: '要求返还本金及利息',
      consultType: 'PHONE',
    });
  });

  it('AI 评估失败时应返回 503 友好错误', async () => {
    mockAssess.mockRejectedValue(new Error('AI unavailable'));

    const response = await POST(
      new NextRequest(
        'http://localhost:3000/api/consultations/consultation-1/assess',
        { method: 'POST' }
      ),
      { params: Promise.resolve({ id: 'consultation-1' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toMatchObject({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'AI案件评估暂时不可用，请稍候重试',
      },
    });
    expect(mockConsultationUpdate).not.toHaveBeenCalled();
  });

  it('AI 评估成功后应写回咨询评估字段', async () => {
    const assessment = {
      winRate: 0.7,
      winRateReasoning: '证据较完整',
      difficulty: 'MEDIUM',
      difficultyFactors: ['被告可能抗辩'],
      riskLevel: 'LOW',
      riskFactors: ['需核验转账备注'],
      suggestedFeeMin: 8000,
      suggestedFeeMax: 15000,
      feeReasoning: '按工作量估算',
      keyLegalPoints: [{ point: '借贷关系', relevantLaw: '民法典' }],
      suggestions: ['补充催收记录'],
      similarCases: [],
    };
    mockAssess.mockResolvedValue(assessment);
    mockConsultationUpdate.mockResolvedValue({});

    const response = await POST(
      new NextRequest(
        'http://localhost:3000/api/consultations/consultation-1/assess',
        { method: 'POST' }
      ),
      { params: Promise.resolve({ id: 'consultation-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockConsultationUpdate).toHaveBeenCalledWith({
      where: { id: 'consultation-1' },
      data: expect.objectContaining({
        aiAssessment: assessment,
        winRate: 0.7,
        difficulty: 'MEDIUM',
        riskLevel: 'LOW',
        suggestedFee: 15000,
      }),
    });
  });
});
