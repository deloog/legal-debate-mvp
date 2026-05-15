const mockConsultationFindFirst = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    consultation: {
      findFirst: mockConsultationFindFirst,
    },
    $transaction: mockTransaction,
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { ConversionService } from '@/lib/consultation/conversion-service';

describe('ConversionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('咨询转案件时应生成 caseNumber', async () => {
    const tx = {
      case: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'case-1' }),
      },
      client: {
        create: jest.fn(),
      },
      consultation: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    mockConsultationFindFirst.mockResolvedValue({
      id: 'consultation-1',
      userId: 'user-1',
      consultNumber: 'ZX20260514001',
      clientName: '张三',
      clientPhone: '13800138000',
      clientEmail: 'zhangsan@example.com',
      clientCompany: null,
      caseType: null,
      caseSummary: '借款到期未还',
      aiAssessment: null,
      winRate: null,
      difficulty: null,
      riskLevel: null,
      suggestedFee: null,
      convertedToCaseId: null,
    });
    mockTransaction.mockImplementation(async callback => callback(tx));

    const result = await new ConversionService().convertToCase({
      consultationId: 'consultation-1',
      userId: 'user-1',
      title: '张三民间借贷案',
    });

    expect(result.success).toBe(true);
    expect(tx.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          caseNumber: expect.stringMatching(/^\d{4}M民初0001号$/),
        }),
      })
    );
  });
});
