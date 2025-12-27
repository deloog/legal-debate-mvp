/**
 * 辩论流API测试 - 综合测试文件
 * 整合所有流相关的测试用例
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TextDecoder } from 'util';
/// <reference path="./test-types.d.ts" />

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    debate: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    debateRound: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    argument: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock AI service
const mockGetUnifiedAIService = jest.fn(() => ({
  // @ts-ignore
  generateDebate: jest.fn().mockResolvedValue({
    choices: [{
      message: { content: '原告：测试论点。被告：测试反驳。' }
    }]
  }),
}));

jest.mock('@/lib/ai/unified-service', () => ({
  getUnifiedAIService: mockGetUnifiedAIService as any,
}));

import { prisma } from '@/lib/db/prisma';

describe('Debates Stream API - Comprehensive Tests', () => {
  let mockReq: any;
  let mockContext: any;
  let mockedPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma = prisma as any;
    
    // 创建模拟的NextRequest对象
    mockReq = {
      url: 'http://localhost:3000/api/v1/debates/123e4567-e89b-12d3-a456-426614174000/stream',
      headers: new Headers(),
      signal: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        aborted: false,
      },
    } as any;

    // 创建模拟的context对象
    mockContext = {
      params: {
        id: '123e4567-e89b-12d3-a456-426614174000',
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('基本流功能测试', () => {
    it('应该返回SSE流响应', async () => {
      // 模拟辩论存在
      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: '测试辩论',
        status: 'active',
        currentRound: 1,
        debateConfig: { maxRounds: 3 },
        case: {
          id: 'case-123',
          title: '测试案件',
          description: '案件描述',
          type: 'civil',
        },
        user: {
          id: 'user-123',
          username: 'testuser',
          name: '测试用户',
        },
        rounds: [],
        _count: { rounds: 0, arguments: 0 },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);

      // 动态导入路由处理器
      const { GET } = await import('@/app/api/v1/debates/[id]/stream/route');
      
      const response = await GET(mockReq, mockContext);

      // 验证响应头
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });

    it('应该处理辩论不存在的情况', async () => {
      mockedPrisma.debate.findUnique.mockResolvedValue(null);
      
      const { GET } = await import('@/app/api/v1/debates/[id]/stream/route');
      
      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(404);
    });

    it('应该验证辩论ID格式', async () => {
      mockContext.params.id = 'invalid-uuid-format';
      
      try {
        const { GET } = await import('@/app/api/v1/debates/[id]/stream/route');
        await GET(mockReq, mockContext);
        fail('Expected validation to throw an error');
      } catch (error) {
        // 验证错误类型
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Path parameter validation failed');
      }
    });
  });

  describe('AI服务错误处理', () => {
    it('应该处理AI服务返回空内容', async () => {
      // Mock AI service to return empty content
      // @ts-ignore
      mockGetUnifiedAIService.mockResolvedValue({
        // @ts-ignore
        generateDebate: jest.fn().mockResolvedValue({
          choices: [{
            message: { content: '' }
          }]
        }),
      } as any);

      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: '测试辩论',
        status: 'active',
        currentRound: 0,
        debateConfig: { maxRounds: 1 },
        case: { title: '测试案件', description: '案件描述' },
        rounds: [],
        _count: { rounds: 0, arguments: 0 },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);
      mockedPrisma.$transaction.mockImplementation(async (callback: any) => {
        const tx: any = {
          debateRound: {
            // @ts-ignore
            create: jest.fn().mockResolvedValue({
              id: 'round-1',
              debateId: '123e4567-e89b-12d3-a456-426614174000',
              roundNumber: 1,
              status: 'IN_PROGRESS',
              startedAt: new Date(),
            }),
          },
          argument: {
            // @ts-ignore
            create: jest.fn().mockResolvedValue({}),
          },
          debate: {
            // @ts-ignore
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return await callback(tx as any);
      });

      const { GET } = await import('@/app/api/v1/debates/[id]/stream/route');
      
      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it('应该处理AI服务超时', async () => {
      // Mock AI service to timeout
      // @ts-ignore
      mockGetUnifiedAIService.mockResolvedValue({
        // @ts-ignore
        generateDebate: jest.fn().mockImplementation(() =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI service timeout')), 100)
          )
        ),
      } as any);

      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: '测试辩论',
        status: 'active',
        currentRound: 0,
        debateConfig: { maxRounds: 1 },
        case: { title: '测试案件', description: '案件描述' },
        rounds: [],
        _count: { rounds: 0, arguments: 0 },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/v1/debates/[id]/stream/route');
      
      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });
  });

  describe('边界情况处理', () => {
    it('应该处理客户端断开连接', async () => {
      const mockAbortController = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        aborted: false,
      };
      
      mockReq.signal = mockAbortController;

      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: '测试辩论',
        status: 'active',
        case: { title: '测试案件' },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/v1/debates/[id]/stream/route');
      
      // 启动流
      const response = await GET(mockReq, mockContext);
      
      // 验证事件监听器被添加
      expect(mockAbortController.addEventListener).toHaveBeenCalledWith('abort', expect.any(Function));
    });

    it('应该处理已完成的辩论', async () => {
      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: '测试辩论',
        status: 'completed',
        currentRound: 3,
        debateConfig: { maxRounds: 3 },
        case: { title: '测试案件', description: '案件描述' },
        rounds: [],
        _count: { rounds: 3, arguments: 10 },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/v1/debates/[id]/stream/route');
      
      const response = await GET(mockReq, mockContext);
      
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });
  });

  describe('OPTIONS方法测试', () => {
    it('应该返回正确的CORS头', async () => {
      const { OPTIONS } = await import('@/app/api/v1/debates/[id]/stream/route');
      const response = await OPTIONS(mockReq);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });
  });
});
