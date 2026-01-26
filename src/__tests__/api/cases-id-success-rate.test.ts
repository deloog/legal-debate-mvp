import { GET } from '@/app/api/cases/[id]/success-rate/route';
import { NextRequest } from 'next/server';
import { SimilarCaseServiceFactory } from '@/lib/case/similar-case-service';

jest.mock('@/lib/case/similar-case-service');
jest.mock('@/lib/agent/security/logger');

describe('GET /api/cases/[id]/success-rate', () => {
  let mockAnalyzeSuccessRate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyzeSuccessRate = jest.fn();
    (SimilarCaseServiceFactory.getInstance as jest.Mock).mockReturnValue({
      analyzeSuccessRate: mockAnalyzeSuccessRate,
    });
  });

  describe('成功情况', () => {
    it('应该返回胜败率分析结果', async () => {
      const mockAnalysis = {
        caseId: 'case-123',
        winRate: 0.75,
        winProbability: 0.8,
        confidence: 0.85,
        similarCasesCount: 10,
        winCasesCount: 7,
        loseCasesCount: 2,
        partialCasesCount: 1,
        withdrawCasesCount: 0,
        analysis: {
          trend: 'increasing' as const,
          recommendation: '案件胜诉概率较高，建议积极准备案件。',
          riskLevel: 'low' as const,
        },
      };

      mockAnalyzeSuccessRate.mockResolvedValue(mockAnalysis);

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate?minSimilarity=0.6&maxCases=20&includePartial=true&includeWithdraw=false'
      );

      const response = await GET(request, { params: { id: 'case-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockAnalysis);
    });

    it('应该使用默认参数', async () => {
      const mockAnalysis = {
        caseId: 'case-123',
        winRate: 0.5,
        winProbability: 0.5,
        confidence: 0.6,
        similarCasesCount: 8,
        winCasesCount: 4,
        loseCasesCount: 4,
        partialCasesCount: 0,
        withdrawCasesCount: 0,
        analysis: {
          trend: 'stable' as const,
          recommendation: '案件存在一定风险，建议谨慎评估。',
          riskLevel: 'medium' as const,
        },
      };

      mockAnalyzeSuccessRate.mockResolvedValue(mockAnalysis);

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate'
      );

      await GET(request, { params: { id: 'case-123' } });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith({
        caseId: 'case-123',
        minSimilarity: 0.6,
        maxCases: 20,
        includePartial: false,
        includeWithdraw: false,
      });
    });

    it('应该正确解析查询参数', async () => {
      const mockAnalysis = {
        caseId: 'case-123',
        winRate: 0.7,
        winProbability: 0.75,
        confidence: 0.8,
        similarCasesCount: 10,
        winCasesCount: 7,
        loseCasesCount: 3,
        partialCasesCount: 0,
        withdrawCasesCount: 0,
        analysis: {
          trend: 'increasing' as const,
          recommendation: '案件胜诉概率较高。',
          riskLevel: 'low' as const,
        },
      };

      mockAnalyzeSuccessRate.mockResolvedValue(mockAnalysis);

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate?minSimilarity=0.8&maxCases=10&includePartial=true&includeWithdraw=true'
      );

      await GET(request, { params: { id: 'case-123' } });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith({
        caseId: 'case-123',
        minSimilarity: 0.8,
        maxCases: 10,
        includePartial: true,
        includeWithdraw: true,
      });
    });

    it('应该处理包含撤诉的参数', async () => {
      const mockAnalysis = {
        caseId: 'case-123',
        winRate: 0.6,
        winProbability: 0.6,
        confidence: 0.7,
        similarCasesCount: 5,
        winCasesCount: 3,
        loseCasesCount: 1,
        partialCasesCount: 0,
        withdrawCasesCount: 1,
        analysis: {
          trend: 'stable' as const,
          recommendation: '建议谨慎评估。',
          riskLevel: 'medium' as const,
        },
      };

      mockAnalyzeSuccessRate.mockResolvedValue(mockAnalysis);

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate?includeWithdraw=true'
      );

      await GET(request, { params: { id: 'case-123' } });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith(
        expect.objectContaining({
          includeWithdraw: true,
        })
      );
    });
  });

  describe('错误情况', () => {
    it('应该在服务抛出错误时返回500', async () => {
      mockAnalyzeSuccessRate.mockRejectedValue(new Error('Service error'));

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate'
      );

      const response = await GET(request, { params: { id: 'case-123' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Service error');
    });

    it('应该处理未知错误', async () => {
      mockAnalyzeSuccessRate.mockRejectedValue('Unknown error');

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate'
      );

      const response = await GET(request, { params: { id: 'case-123' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unknown error');
    });
  });

  describe('参数解析', () => {
    it('应该正确解析minSimilarity参数', async () => {
      mockAnalyzeSuccessRate.mockResolvedValue({
        caseId: 'case-123',
        winRate: 0.5,
        winProbability: 0.5,
        confidence: 0.5,
        similarCasesCount: 5,
        winCasesCount: 2,
        loseCasesCount: 3,
        partialCasesCount: 0,
        withdrawCasesCount: 0,
        analysis: {
          trend: 'stable' as const,
          recommendation: 'test',
          riskLevel: 'low' as const,
        },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate?minSimilarity=0.9'
      );

      await GET(request, { params: { id: 'case-123' } });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith(
        expect.objectContaining({
          minSimilarity: 0.9,
        })
      );
    });

    it('应该正确解析maxCases参数', async () => {
      mockAnalyzeSuccessRate.mockResolvedValue({
        caseId: 'case-123',
        winRate: 0.5,
        winProbability: 0.5,
        confidence: 0.5,
        similarCasesCount: 5,
        winCasesCount: 2,
        loseCasesCount: 3,
        partialCasesCount: 0,
        withdrawCasesCount: 0,
        analysis: {
          trend: 'stable' as const,
          recommendation: 'test',
          riskLevel: 'low' as const,
        },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate?maxCases=50'
      );

      await GET(request, { params: { id: 'case-123' } });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith(
        expect.objectContaining({
          maxCases: 50,
        })
      );
    });

    it('应该正确解析includePartial布尔参数', async () => {
      mockAnalyzeSuccessRate.mockResolvedValue({
        caseId: 'case-123',
        winRate: 0.5,
        winProbability: 0.5,
        confidence: 0.5,
        similarCasesCount: 5,
        winCasesCount: 2,
        loseCasesCount: 3,
        partialCasesCount: 0,
        withdrawCasesCount: 0,
        analysis: {
          trend: 'stable' as const,
          recommendation: 'test',
          riskLevel: 'low' as const,
        },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate?includePartial=true'
      );

      await GET(request, { params: { id: 'case-123' } });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith(
        expect.objectContaining({
          includePartial: true,
        })
      );
    });

    it('应该将非true的includePartial解析为false', async () => {
      mockAnalyzeSuccessRate.mockResolvedValue({
        caseId: 'case-123',
        winRate: 0.5,
        winProbability: 0.5,
        confidence: 0.5,
        similarCasesCount: 5,
        winCasesCount: 2,
        loseCasesCount: 3,
        partialCasesCount: 0,
        withdrawCasesCount: 0,
        analysis: {
          trend: 'stable' as const,
          recommendation: 'test',
          riskLevel: 'low' as const,
        },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate?includePartial=false'
      );

      await GET(request, { params: { id: 'case-123' } });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith(
        expect.objectContaining({
          includePartial: false,
        })
      );
    });

    it('应该正确解析includeWithdraw布尔参数', async () => {
      mockAnalyzeSuccessRate.mockResolvedValue({
        caseId: 'case-123',
        winRate: 0.5,
        winProbability: 0.5,
        confidence: 0.5,
        similarCasesCount: 5,
        winCasesCount: 2,
        loseCasesCount: 3,
        partialCasesCount: 0,
        withdrawCasesCount: 0,
        analysis: {
          trend: 'stable' as const,
          recommendation: 'test',
          riskLevel: 'low' as const,
        },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate?includeWithdraw=true'
      );

      await GET(request, { params: { id: 'case-123' } });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith(
        expect.objectContaining({
          includeWithdraw: true,
        })
      );
    });
  });
});
