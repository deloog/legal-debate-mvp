import { GET } from '@/app/api/cases/[id]/success-rate/route';
import { NextRequest } from 'next/server';
import { SimilarCaseServiceFactory } from '@/lib/case/similar-case-service';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/case/similar-case-service');
jest.mock('@/lib/agent/security/logger');
jest.mock('@/lib/middleware/auth');
jest.mock('@/lib/db/prisma', () => ({
  prisma: { case: { findUnique: jest.fn() } },
}));

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCaseFindUnique = (prisma.case.findUnique as jest.Mock);

const AUTHED_USER = { userId: 'user-123', role: 'USER', email: 'user@test.com' };
const OWNED_CASE = { userId: 'user-123' };

describe('GET /api/cases/[id]/success-rate', () => {
  let mockAnalyzeSuccessRate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyzeSuccessRate = jest.fn();
    (SimilarCaseServiceFactory.getInstance as jest.Mock).mockReturnValue({
      analyzeSuccessRate: mockAnalyzeSuccessRate,
    });
    // 默认：已认证用户 + 拥有该案件
    mockGetAuthUser.mockResolvedValue(AUTHED_USER);
    mockCaseFindUnique.mockResolvedValue(OWNED_CASE);
  });

  describe('认证与权限', () => {
    it('未认证时应该返回401', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate'
      );
      const response = await GET(request, { params: Promise.resolve({ id: 'case-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('案件不存在时应该返回404', async () => {
      mockCaseFindUnique.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate'
      );
      const response = await GET(request, { params: Promise.resolve({ id: 'case-123' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('无权访问他人案件时应该返回403', async () => {
      mockCaseFindUnique.mockResolvedValue({ userId: 'other-user' });

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate'
      );
      const response = await GET(request, { params: Promise.resolve({ id: 'case-123' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
    });

    it('管理员可以访问任意案件', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1', role: 'ADMIN', email: 'admin@test.com' });
      mockCaseFindUnique.mockResolvedValue({ userId: 'other-user' });
      mockAnalyzeSuccessRate.mockResolvedValue({ caseId: 'case-123', winRate: 0.5 });

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate'
      );
      const response = await GET(request, { params: Promise.resolve({ id: 'case-123' }) });

      expect(response.status).toBe(200);
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

      const response = await GET(request, { params: Promise.resolve({ id: 'case-123' }) });
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

      await GET(request, { params: Promise.resolve({ id: 'case-123' }) });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith({
        caseId: 'case-123',
        minSimilarity: 0.6,
        maxCases: 20,
        includePartial: false,
        includeWithdraw: false,
      });
    });

    it('应该正确解析查询参数', async () => {
      mockAnalyzeSuccessRate.mockResolvedValue({ caseId: 'case-123', winRate: 0.7 });

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate?minSimilarity=0.8&maxCases=10&includePartial=true&includeWithdraw=true'
      );

      await GET(request, { params: Promise.resolve({ id: 'case-123' }) });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith({
        caseId: 'case-123',
        minSimilarity: 0.8,
        maxCases: 10,
        includePartial: true,
        includeWithdraw: true,
      });
    });
  });

  describe('错误情况', () => {
    it('应该在服务抛出错误时返回500', async () => {
      mockAnalyzeSuccessRate.mockRejectedValue(new Error('Service error'));

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate'
      );

      const response = await GET(request, { params: Promise.resolve({ id: 'case-123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('参数解析', () => {
    it('应该正确解析minSimilarity参数', async () => {
      mockAnalyzeSuccessRate.mockResolvedValue({ caseId: 'case-123', winRate: 0.5 });

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate?minSimilarity=0.9'
      );

      await GET(request, { params: Promise.resolve({ id: 'case-123' }) });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith(
        expect.objectContaining({ minSimilarity: 0.9 })
      );
    });

    it('应该正确解析maxCases参数', async () => {
      mockAnalyzeSuccessRate.mockResolvedValue({ caseId: 'case-123', winRate: 0.5 });

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate?maxCases=50'
      );

      await GET(request, { params: Promise.resolve({ id: 'case-123' }) });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith(
        expect.objectContaining({ maxCases: 50 })
      );
    });

    it('应该将非true的includePartial解析为false', async () => {
      mockAnalyzeSuccessRate.mockResolvedValue({ caseId: 'case-123', winRate: 0.5 });

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate?includePartial=false'
      );

      await GET(request, { params: Promise.resolve({ id: 'case-123' }) });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith(
        expect.objectContaining({ includePartial: false })
      );
    });

    it('应该正确解析includeWithdraw布尔参数', async () => {
      mockAnalyzeSuccessRate.mockResolvedValue({ caseId: 'case-123', winRate: 0.5 });

      const request = new NextRequest(
        'http://localhost:3000/api/cases/case-123/success-rate?includeWithdraw=true'
      );

      await GET(request, { params: Promise.resolve({ id: 'case-123' }) });

      expect(mockAnalyzeSuccessRate).toHaveBeenCalledWith(
        expect.objectContaining({ includeWithdraw: true })
      );
    });
  });
});
