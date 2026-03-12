import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cases/[id]/similar/route';
import { SimilarCaseServiceFactory } from '@/lib/case/similar-case-service';
import type {
  SimilaritySearchResult,
} from '@/types/case-example';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/case/similar-case-service', () => ({
  SimilarCaseServiceFactory: { getInstance: jest.fn() },
}));
jest.mock('@/lib/agent/security/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/middleware/auth');
jest.mock('@/lib/db/prisma', () => ({
  prisma: { case: { findUnique: jest.fn() } },
}));

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCaseFindUnique = prisma.case.findUnique as jest.Mock;
const AUTHED_USER = { userId: 'user-123', role: 'USER', email: 'user@test.com' };

describe('GET /api/cases/[id]/similar', () => {
  let mockService: { searchSimilarCases: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = { searchSimilarCases: jest.fn() };
    (SimilarCaseServiceFactory.getInstance as jest.Mock).mockReturnValue(mockService as any);
    mockGetAuthUser.mockResolvedValue(AUTHED_USER);
    mockCaseFindUnique.mockResolvedValue({ userId: 'user-123' });
  });

  describe('认证与权限', () => {
    test('未认证时应该返回401', async () => {
      mockGetAuthUser.mockResolvedValue(null);
      const request = new NextRequest('http://localhost:3000/api/cases/case-1/similar');
      const response = await GET(request, { params: Promise.resolve({ id: 'case-1' }) });
      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    test('案件不存在时应该返回404', async () => {
      mockCaseFindUnique.mockResolvedValue(null);
      const request = new NextRequest('http://localhost:3000/api/cases/case-1/similar');
      const response = await GET(request, { params: Promise.resolve({ id: 'case-1' }) });
      const data = await response.json();
      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    test('无权访问他人案件时应该返回403', async () => {
      mockCaseFindUnique.mockResolvedValue({ userId: 'other-user' });
      const request = new NextRequest('http://localhost:3000/api/cases/case-1/similar');
      const response = await GET(request, { params: Promise.resolve({ id: 'case-1' }) });
      const data = await response.json();
      expect(response.status).toBe(403);
      expect(data.error.code).toBe('FORBIDDEN');
    });

    test('管理员可以访问任意案件', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1', role: 'ADMIN', email: 'admin@test.com' });
      mockCaseFindUnique.mockResolvedValue({ userId: 'other-user' });
      mockService.searchSimilarCases.mockResolvedValue({ caseId: 'case-1', matches: [], totalMatches: 0, searchTime: 10 });
      const request = new NextRequest('http://localhost:3000/api/cases/case-1/similar');
      const response = await GET(request, { params: Promise.resolve({ id: 'case-1' }) });
      expect(response.status).toBe(200);
    });
  });

  test('应该成功检索相似案例', async () => {
    const mockResult: SimilaritySearchResult = {
      caseId: 'case-1',
      matches: [{
        caseExample: {
          id: 'case-2', title: 'Similar Case', caseNumber: '', court: '',
          type: 'CIVIL', cause: '', facts: '', judgment: '', result: 'WIN',
          judgmentDate: new Date(), embedding: [], metadata: null,
          createdAt: new Date(), updatedAt: new Date(),
          dataSource: 'cail', sourceId: null, importedAt: null,
        },
        similarity: 0.85, matchingFactors: ['整体高度相似'],
      }],
      totalMatches: 1, searchTime: 100,
    };
    mockService.searchSimilarCases.mockResolvedValue(mockResult as unknown as never);

    const request = new NextRequest(
      'http://localhost:3000/api/cases/case-1/similar?topK=5&threshold=0.8'
    );
    const response = await GET(request, { params: Promise.resolve({ id: 'case-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockResult);
    expect(mockService.searchSimilarCases).toHaveBeenCalledWith({
      caseId: 'case-1', topK: 5, threshold: 0.8,
    });
  });

  test('应该使用默认参数', async () => {
    mockService.searchSimilarCases.mockResolvedValue(
      { caseId: 'case-1', matches: [], totalMatches: 0, searchTime: 50 } as unknown as never
    );
    const request = new NextRequest('http://localhost:3000/api/cases/case-1/similar');
    await GET(request, { params: Promise.resolve({ id: 'case-1' }) });

    const callArgs = mockService.searchSimilarCases.mock.calls[0] as [
      { caseId: string; topK?: number; threshold?: number },
    ];
    expect(callArgs[0].caseId).toBe('case-1');
    expect(callArgs[0].topK).toBe(10);
    expect(callArgs[0].threshold).toBe(0.7);
  });

  test('应该正确处理服务错误', async () => {
    mockService.searchSimilarCases.mockRejectedValue(new Error('Service error') as unknown as never);
    const request = new NextRequest('http://localhost:3000/api/cases/case-1/similar');
    const response = await GET(request, { params: Promise.resolve({ id: 'case-1' }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });
});
