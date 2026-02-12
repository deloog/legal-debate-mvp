// @ts-nocheck - Jest mock 类型推断复杂，修复成本高且收益有限
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  CaseEmbeddingService,
  CaseEmbeddingServiceFactory,
} from '@/lib/case/embedding-service';
import { createMockPrisma, clearAllMocks } from '../test-utils';
import type { CaseEmbedder } from '@/lib/ai/case/case-embedder';
import * as CaseEmbedderModule from '@/lib/ai/case/case-embedder';

const mockPrisma = createMockPrisma();

// 添加 $disconnect 方法到 mockPrisma
const mockPrismaWithDisconnect = mockPrisma as typeof mockPrisma & {
  $disconnect: jest.Mock;
};
mockPrismaWithDisconnect.$disconnect = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaWithDisconnect),
}));

jest.mock('@/lib/ai/case/case-embedder', () => ({
  CaseEmbedderFactory: {
    getInstance: jest.fn(),
  },
}));

const mockEmbedder = {
  generateEmbedding: jest.fn(),
  clearCache: jest.fn(),
} as unknown as CaseEmbedder;

// Setup mock
jest
  .spyOn(CaseEmbedderModule.CaseEmbedderFactory, 'getInstance')
  .mockReturnValue(mockEmbedder);

describe('CaseEmbeddingService', () => {
  let service: CaseEmbeddingService;

  beforeEach(() => {
    clearAllMocks();
    jest
      .spyOn(CaseEmbedderModule.CaseEmbedderFactory, 'getInstance')
      .mockReturnValue(mockEmbedder);
    service = new CaseEmbeddingService();
  });

  afterEach(() => {
    clearAllMocks();
  });

  describe('generateAndStoreEmbedding', () => {
    it('应该成功为案例生成并存储向量', async () => {
      const mockCase: any = {
        id: 'test-1',
        title: '测试案例',
        facts: '测试事实',
        judgment: '测试判决',
        caseNumber: 'CASE-001',
        court: 'test-court',
        type: 'CIVIL',
        cause: 'test-cause',
        result: 'WIN',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        judgmentDate: new Date(),
        embedding: null,
        metadata: null,
      };

      const mockEmbedding = [0.1, 0.2, 0.3];

      (mockPrisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        mockCase as any
      );
      (mockEmbedder.generateEmbedding as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          embedding: mockEmbedding,
          model: 'zhipu-embedding-2',
          dimension: 3,
          generatedAt: new Date(),
          version: '1.0',
        },
      } as any);
      (mockPrisma.caseExample.update as jest.Mock).mockResolvedValue({
        ...mockCase,
        embedding: mockEmbedding,
      } as any);

      const result = await service.generateAndStoreEmbedding('test-1');

      expect(result.success).toBe(true);
      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockPrisma.caseExample.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-1' },
      });
      expect(mockEmbedder.generateEmbedding).toHaveBeenCalledWith(mockCase);
      expect(mockPrisma.caseExample.update).toHaveBeenCalledWith({
        where: { id: 'test-1' },
        data: {
          embedding: mockEmbedding,
        },
      });
    });

    it('案例不存在时应返回错误', async () => {
      (mockPrisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        null as any
      );

      const result = await service.generateAndStoreEmbedding('not-found');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('向量生成失败时应返回错误', async () => {
      const mockCase: any = {
        id: 'test-1',
        title: '测试案例',
        facts: '测试事实',
        judgment: '测试判决',
        caseNumber: 'CASE-001',
        court: 'test-court',
        type: 'CIVIL',
        cause: 'test-cause',
        result: 'WIN',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        judgmentDate: new Date(),
        embedding: null,
        metadata: null,
      };

      (mockPrisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        mockCase as any
      );
      (mockEmbedder.generateEmbedding as jest.Mock).mockResolvedValue({
        success: false,
        error: 'API error',
      } as any);

      const result = await service.generateAndStoreEmbedding('test-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });

  describe('batchGenerateAndStore', () => {
    it('应该成功批量生成并存储向量', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];

      (mockPrisma.caseExample.findUnique as jest.Mock).mockResolvedValue({
        id: 'test',
        title: '测试案例',
        facts: '测试事实',
        judgment: '测试判决',
      } as any);
      (mockEmbedder.generateEmbedding as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          embedding: mockEmbedding,
          model: 'zhipu-embedding-2',
          dimension: 3,
          generatedAt: new Date(),
          version: '1.0',
        },
      } as any);
      (mockPrisma.caseExample.update as jest.Mock).mockResolvedValue({
        embedding: mockEmbedding,
      } as any);

      const result = await service.batchGenerateAndStore([
        'test-1',
        'test-2',
        'test-3',
      ]);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('应该正确处理部分失败的情况', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];

      (mockPrisma.caseExample.findUnique as jest.Mock).mockResolvedValue({
        id: 'test',
        title: '测试案例',
        facts: '测试事实',
        judgment: '测试判决',
      } as any);
      (mockEmbedder.generateEmbedding as jest.Mock)
        .mockResolvedValueOnce({
          success: true,
          data: {
            embedding: mockEmbedding,
            model: 'zhipu-embedding-2',
            dimension: 3,
            generatedAt: new Date(),
            version: '1.0',
          },
        } as any)
        .mockResolvedValueOnce({
          success: false,
          error: 'API error',
        } as any)
        .mockResolvedValueOnce({
          success: true,
          data: {
            embedding: mockEmbedding,
            model: 'zhipu-embedding-2',
            dimension: 3,
            generatedAt: new Date(),
            version: '1.0',
          },
        } as any);
      (mockPrisma.caseExample.update as jest.Mock).mockResolvedValue({
        embedding: mockEmbedding,
      } as any);

      const result = await service.batchGenerateAndStore([
        'test-1',
        'test-2',
        'test-3',
      ]);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[2].success).toBe(true);
    });
  });

  describe('getEmbedding', () => {
    it('应该成功获取案例向量', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];

      (mockPrisma.caseExample.findUnique as jest.Mock).mockResolvedValue({
        embedding: mockEmbedding,
      } as any);

      const result = await service.getEmbedding('test-1');

      expect(result.success).toBe(true);
      expect(result.embedding).toEqual(mockEmbedding);
    });

    it('案例不存在时应返回错误', async () => {
      (mockPrisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        null as any
      );

      const result = await service.getEmbedding('not-found');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('向量不存在时应返回错误', async () => {
      (mockPrisma.caseExample.findUnique as jest.Mock).mockResolvedValue({
        embedding: null,
      } as any);

      const result = await service.getEmbedding('test-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('应该正确提取对象格式的向量', async () => {
      const mockEmbedding = { embedding: [0.1, 0.2, 0.3] };

      (mockPrisma.caseExample.findUnique as jest.Mock).mockResolvedValue({
        embedding: mockEmbedding,
      } as any);

      const result = await service.getEmbedding('test-1');

      expect(result.success).toBe(true);
      expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe('deleteEmbedding', () => {
    it('应该成功删除案例向量', async () => {
      (mockPrisma.caseExample.update as jest.Mock).mockResolvedValue({
        embedding: null,
      } as any);

      const result = await service.deleteEmbedding('test-1');

      expect(result.success).toBe(true);
      expect(mockPrisma.caseExample.update).toHaveBeenCalledWith({
        where: { id: 'test-1' },
        data: { embedding: null },
      });
    });
  });

  describe('batchDeleteEmbeddings', () => {
    it('应该成功批量删除向量', async () => {
      (mockPrisma.caseExample.update as jest.Mock).mockResolvedValue({
        embedding: null,
      } as any);

      const result = await service.batchDeleteEmbeddings(['test-1', 'test-2']);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('应该正确处理部分失败', async () => {
      (mockPrisma.caseExample.update as jest.Mock)
        .mockResolvedValueOnce({ embedding: null } as any)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ embedding: null } as any);

      const result = await service.batchDeleteEmbeddings([
        'test-1',
        'test-2',
        'test-3',
      ]);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe('validateEmbedding', () => {
    it('应该验证有效的向量', () => {
      const validEmbedding = [0.1, 0.2, 0.3];
      const result = service.validateEmbedding(validEmbedding);

      expect(result.valid).toBe(true);
    });

    it('应该拒绝无效的向量', () => {
      const invalidEmbedding = ['a', 'b', 'c'];
      const result = service.validateEmbedding(invalidEmbedding);

      expect(result.valid).toBe(false);
    });

    it('应该拒绝空向量', () => {
      const emptyEmbedding = [];
      const result = service.validateEmbedding(emptyEmbedding);

      expect(result.valid).toBe(false);
    });
  });

  describe('getStatistics', () => {
    it('应该正确获取向量统计信息', async () => {
      (mockPrisma.caseExample.count as jest.Mock).mockResolvedValueOnce(
        100 as any
      );
      (mockPrisma.caseExample.count as jest.Mock).mockResolvedValueOnce(
        75 as any
      );

      const result = await service.getStatistics();

      expect(result.totalCases).toBe(100);
      expect(result.casesWithEmbedding).toBe(75);
      expect(result.casesWithoutEmbedding).toBe(25);
    });
  });

  describe('clearCache', () => {
    it('应该清除缓存', () => {
      service.clearCache();

      expect(mockEmbedder.clearCache).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('应该正确清理资源', async () => {
      await service.dispose();

      expect(mockPrismaWithDisconnect.$disconnect).toHaveBeenCalled();
      expect(mockEmbedder.clearCache).toHaveBeenCalled();
    });
  });

  describe('CaseEmbeddingServiceFactory', () => {
    it('应该返回相同的实例', () => {
      const instance1 = CaseEmbeddingServiceFactory.getInstance('test');
      const instance2 = CaseEmbeddingServiceFactory.getInstance('test');

      expect(instance1).toBe(instance2);
    });

    it('应该返回不同的实例', () => {
      const instance1 = CaseEmbeddingServiceFactory.getInstance('test1');
      const instance2 = CaseEmbeddingServiceFactory.getInstance('test2');

      expect(instance1).not.toBe(instance2);
    });

    it('应该能移除实例', () => {
      CaseEmbeddingServiceFactory.getInstance('test');
      const removed = CaseEmbeddingServiceFactory.removeInstance('test');

      expect(removed).toBe(true);
    });

    it('应该能清理所有实例', async () => {
      CaseEmbeddingServiceFactory.getInstance('test1');
      CaseEmbeddingServiceFactory.getInstance('test2');

      await CaseEmbeddingServiceFactory.disposeAll();

      // 验证清理后获取新实例
      const newInstance = CaseEmbeddingServiceFactory.getInstance('test1');
      expect(newInstance).toBeDefined();
    });
  });
});
