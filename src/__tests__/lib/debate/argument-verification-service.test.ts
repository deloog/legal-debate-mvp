/**
 * 论点验证服务测试
 */

import { ArgumentVerificationService } from '@/lib/debate/argument-verification-service';
import { prisma } from '@/lib/db/prisma';
import type { Argument, DebateInput } from '@/lib/debate/types';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    argument: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

// Mock VerificationAgent
jest.mock('@/lib/agent/verification-agent', () => ({
  VerificationAgent: jest.fn().mockImplementation(() => ({
    verify: jest.fn().mockResolvedValue({
      overallScore: 0.85,
      factualAccuracy: 0.9,
      logicalConsistency: 0.8,
      taskCompleteness: 0.85,
      passed: true,
      issues: [
        {
          id: 'issue_1',
          type: 'LOGICAL',
          severity: 'MEDIUM',
          category: 'LOGICAL',
          message: '推理过程可以更详细',
          detectedBy: 'logical',
        },
      ],
      suggestions: [
        {
          id: 'suggestion_1',
          type: 'IMPROVEMENT',
          priority: 'medium',
          action: '补充更多法律依据',
          reason: '当前引用法条较少',
          estimatedImpact: '提升法律准确性10%',
        },
      ],
      verificationTime: 150,
    }),
  })),
}));

describe('ArgumentVerificationService', () => {
  let service: ArgumentVerificationService;

  const mockArgument: Argument = {
    id: 'arg_test_123',
    side: 'plaintiff',
    type: 'main_point',
    content: '被告应赔偿原告损失100万元',
    reasoning: '根据合同法第107条，违约方应承担违约责任',
    legalBasis: [
      {
        lawName: '中华人民共和国合同法',
        articleNumber: '第107条',
        relevance: 0.9,
        explanation: '违约方应承担继续履行、采取补救措施或者赔偿损失等违约责任',
      },
    ],
    logicScore: 0.8,
    legalAccuracyScore: 0.85,
    overallScore: 0.825,
    generatedBy: 'ai',
    aiProvider: 'deepseek',
    generationTime: 1200,
  };

  const mockInput: DebateInput = {
    caseInfo: {
      title: '合同纠纷案',
      description: '原告与被告签订购销合同，被告未按时交货',
      caseType: '合同纠纷',
      parties: {
        plaintiff: '原告公司',
        defendant: '被告公司',
      },
      claims: ['要求被告赔偿损失100万元'],
      facts: ['原告与被告签订购销合同', '被告未按时交货'],
    },
    lawArticles: [
      {
        lawName: '中华人民共和国合同法',
        articleNumber: '第107条',
        content: '违约方应承担继续履行、采取补救措施或者赔偿损失等违约责任',
        relevance: 0.95,
      },
    ],
  };

  beforeEach(() => {
    service = new ArgumentVerificationService();
    jest.clearAllMocks();
  });

  describe('verifyArgument', () => {
    it('should verify argument and return scores', async () => {
      const result = await service.verifyArgument(mockArgument, mockInput);

      expect(result).toBeDefined();
      expect(result.legalScore).toBe(0.9); // factualAccuracy
      expect(result.logicScore).toBe(0.8); // logicalConsistency
      expect(result.overallScore).toBe(0.85); // overallScore
      expect(result.verificationData).toBeDefined();
      expect(result.verificationData.verifiedAt).toBeDefined();
      expect(result.verificationData.verificationResult).toBeDefined();
    });

    it('should categorize issues correctly', async () => {
      const result = await service.verifyArgument(mockArgument, mockInput);

      expect(result.verificationData.factualIssues).toBeInstanceOf(Array);
      expect(result.verificationData.logicalIssues).toBeInstanceOf(Array);
      expect(result.verificationData.completenessIssues).toBeInstanceOf(Array);
    });

    it('should handle verification errors gracefully', async () => {
      // Mock VerificationAgent to throw error
      const { VerificationAgent } = jest.requireMock(
        '@/lib/agent/verification-agent'
      );
      VerificationAgent.mockImplementationOnce(() => ({
        verify: jest.fn().mockRejectedValue(new Error('Verification failed')),
      }));

      const result = await service.verifyArgument(mockArgument, mockInput);

      // Should return default scores instead of throwing
      expect(result.legalScore).toBe(0.5);
      expect(result.logicScore).toBe(0.5);
      expect(result.overallScore).toBe(0.5);
      expect(result.verificationData.verificationResult.issues).toHaveLength(1);
    });
  });

  describe('verifyAndSaveArguments', () => {
    it('should verify and save multiple arguments', async () => {
      const mockUpdatedArgument = {
        ...mockArgument,
        legalScore: 0.9,
        logicScore: 0.8,
        overallScore: 0.85,
        metadata: {
          verification: {
            verifiedAt: expect.any(String),
            verificationResult: expect.any(Object),
          },
        },
      };

      (prisma.argument.update as jest.Mock).mockResolvedValue(
        mockUpdatedArgument
      );

      const arguments_ = [
        mockArgument,
        { ...mockArgument, id: 'arg_test_456' },
      ];
      const results = await service.verifyAndSaveArguments(
        arguments_,
        mockInput
      );

      expect(results).toHaveLength(2);
      expect(prisma.argument.update).toHaveBeenCalledTimes(2);
      expect(prisma.argument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: expect.any(String) },
          data: expect.objectContaining({
            legalScore: expect.any(Number),
            logicScore: expect.any(Number),
            overallScore: expect.any(Number),
            metadata: expect.any(Object),
          }),
        })
      );
    });

    it('should handle individual argument failures', async () => {
      (prisma.argument.update as jest.Mock)
        .mockResolvedValueOnce(mockArgument)
        .mockRejectedValueOnce(new Error('Update failed'));

      const arguments_ = [
        mockArgument,
        { ...mockArgument, id: 'arg_test_456' },
      ];
      const results = await service.verifyAndSaveArguments(
        arguments_,
        mockInput
      );

      expect(results).toHaveLength(2);
      // Second argument should still be in results even if update failed
      expect(results[1]).toBeDefined();
    });
  });

  describe('getVerificationDetails', () => {
    it('should return verification data for an argument', async () => {
      const mockVerificationData = {
        verifiedAt: new Date().toISOString(),
        verificationResult: {
          overallScore: 0.85,
          issues: [],
          suggestions: [],
        },
        factualIssues: [],
        logicalIssues: [],
        completenessIssues: [],
      };

      (prisma.argument.findUnique as jest.Mock).mockResolvedValue({
        metadata: {
          verification: mockVerificationData,
        },
      });

      const result = await service.getVerificationDetails('arg_test_123');

      expect(result).toEqual(mockVerificationData);
      expect(prisma.argument.findUnique).toHaveBeenCalledWith({
        where: { id: 'arg_test_123' },
        select: { metadata: true },
      });
    });

    it('should return null if no verification data', async () => {
      (prisma.argument.findUnique as jest.Mock).mockResolvedValue({
        metadata: {},
      });

      const result = await service.getVerificationDetails('arg_test_123');

      expect(result).toBeNull();
    });

    it('should return null if argument not found', async () => {
      (prisma.argument.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getVerificationDetails('arg_test_123');

      expect(result).toBeNull();
    });
  });
});
