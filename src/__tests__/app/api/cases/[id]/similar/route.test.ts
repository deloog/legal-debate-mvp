import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cases/[id]/similar/route';
import { SimilarCaseServiceFactory } from '@/lib/case/similar-case-service';
import type {
  SimilaritySearchResult,
  SimilaritySearchParams,
} from '@/types/case-example';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies
jest.mock('@/lib/case/similar-case-service', () => ({
  SimilarCaseServiceFactory: {
    getInstance: jest.fn(),
  },
}));

jest.mock('@/lib/agent/security/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('GET /api/cases/[id]/similar', () => {
  let mockService: {
    searchSimilarCases: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock service
    mockService = {
      searchSimilarCases: jest.fn(),
    };

    (SimilarCaseServiceFactory.getInstance as jest.Mock).mockReturnValue(
      mockService as any
    );
  });

  test('应该成功检索相似案例', async () => {
    const mockResult: SimilaritySearchResult = {
      caseId: 'case-1',
      matches: [
        {
          caseExample: {
            id: 'case-2',
            title: 'Similar Case',
            caseNumber: '',
            court: '',
            type: 'CIVIL',
            cause: '',
            facts: '',
            judgment: '',
            result: 'WIN',
            judgmentDate: new Date(),
            embedding: [],
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          similarity: 0.85,
          matchingFactors: ['整体高度相似'],
        },
      ],
      totalMatches: 1,
      searchTime: 100,
    };

    mockService.searchSimilarCases.mockResolvedValue(
      mockResult as unknown as never
    );

    const request = new NextRequest(
      'http://localhost:3000/api/cases/case-1/similar?topK=5&threshold=0.8'
    );
    const response = await GET(request, { params: { id: 'case-1' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockResult);
    expect(mockService.searchSimilarCases).toHaveBeenCalledWith({
      caseId: 'case-1',
      topK: 5,
      threshold: 0.8,
    });
  });

  test('应该正确应用过滤参数', async () => {
    const mockResult: SimilaritySearchResult = {
      caseId: 'case-1',
      matches: [],
      totalMatches: 0,
      searchTime: 50,
    };

    mockService.searchSimilarCases.mockResolvedValue(
      mockResult as unknown as never
    );

    const request = new NextRequest(
      'http://localhost:3000/api/cases/case-1/similar' +
        '?caseType=CIVIL&result=WIN' +
        '&startDate=2024-01-01&endDate=2024-12-31'
    );
    const response = await GET(request, { params: { id: 'case-1' } });

    expect(response.status).toBe(200);

    const callArgs = mockService.searchSimilarCases.mock.calls[0] as [
      { caseType?: string; result?: string; startDate?: Date; endDate?: Date },
    ];
    expect(callArgs[0].caseType).toBe('CIVIL');
    expect(callArgs[0].result).toBe('WIN');
    expect(callArgs[0].startDate).toBeInstanceOf(Date);
    expect(callArgs[0].endDate).toBeInstanceOf(Date);
  });

  test('应该使用默认参数', async () => {
    const mockResult: SimilaritySearchResult = {
      caseId: 'case-1',
      matches: [],
      totalMatches: 0,
      searchTime: 50,
    };

    mockService.searchSimilarCases.mockResolvedValue(
      mockResult as unknown as never
    );

    const request = new NextRequest(
      'http://localhost:3000/api/cases/case-1/similar'
    );
    const response = await GET(request, { params: { id: 'case-1' } });

    expect(response.status).toBe(200);

    const callArgs = mockService.searchSimilarCases.mock.calls[0] as [
      { caseId: string; topK?: number; threshold?: number },
    ];
    expect(callArgs[0].caseId).toBe('case-1');
    expect(callArgs[0].topK).toBe(10);
    expect(callArgs[0].threshold).toBe(0.7);
  });

  test('应该正确处理服务错误', async () => {
    const error = new Error('Case example not found: case-1');
    mockService.searchSimilarCases.mockRejectedValue(error as unknown as never);

    const request = new NextRequest(
      'http://localhost:3000/api/cases/case-1/similar'
    );
    const response = await GET(request, { params: { id: 'case-1' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Case example not found: case-1');
  });

  test('应该正确处理未知错误', async () => {
    mockService.searchSimilarCases.mockRejectedValue(
      new Error('Unknown error') as unknown as never
    );

    const request = new NextRequest(
      'http://localhost:3000/api/cases/case-1/similar'
    );
    const response = await GET(request, { params: { id: 'case-1' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unknown error');
  });
});
