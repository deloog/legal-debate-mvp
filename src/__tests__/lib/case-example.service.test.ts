import { jest } from '@jest/globals';

// Create mock before jest.mock
const mockCreate = jest.fn().mockImplementation(() => ({}));
const mockFindUnique = jest.fn().mockImplementation(() => null);
const mockUpdate = jest.fn().mockImplementation(() => ({}));
const mockDelete = jest.fn().mockImplementation(() => ({}));
const mockFindMany = jest.fn().mockImplementation(() => []);
const mockCount = jest.fn().mockImplementation(() => 0);
const mockGroupBy = jest.fn().mockImplementation(() => []);

const mockPrisma = {
  caseExample: {
    create: mockCreate,
    findUnique: mockFindUnique,
    update: mockUpdate,
    delete: mockDelete,
    findMany: mockFindMany,
    count: mockCount,
    groupBy: mockGroupBy,
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CaseExampleService } from '@/lib/case/case-example-service';

function clearAllMocks() {
  jest.clearAllMocks();
}

describe('CaseExampleService', () => {
  beforeEach(() => {
    clearAllMocks();
  });

  afterEach(() => {
    clearAllMocks();
  });

  describe('create', () => {
    it('应该成功创建新案例', async () => {
      const mockExample = {
        id: '1',
        title: '测试案例',
        caseNumber: 'CN2024-001',
        court: '测试法院',
        type: 'CIVIL',
        facts: '测试事实',
        judgment: '测试判决',
        result: 'WIN',
        judgmentDate: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreate.mockResolvedValue(mockExample as unknown as never);

      const input = {
        title: '测试案例',
        caseNumber: 'CN2024-001',
        court: '测试法院',
        type: 'CIVIL' as const,
        facts: '测试事实',
        judgment: '测试判决',
        result: 'WIN' as const,
        judgmentDate: new Date('2024-01-01'),
      };

      const result = await CaseExampleService.create(input);

      expect(mockPrisma.caseExample.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: input.title,
          caseNumber: input.caseNumber,
          court: input.court,
          type: input.type,
          facts: input.facts,
          judgment: input.judgment,
          result: input.result,
          judgmentDate: input.judgmentDate,
        }),
      });
      expect(result).toEqual(mockExample);
    });
  });

  describe('getById', () => {
    it('应该成功获取案例详情', async () => {
      const mockExample = {
        id: '1',
        title: '测试案例',
        caseNumber: 'CN2024-001',
        court: '测试法院',
        type: 'CIVIL',
        facts: '测试事实',
        judgment: '测试判决',
        result: 'WIN',
        judgmentDate: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFindUnique.mockResolvedValue(mockExample as unknown as never);

      const result = await CaseExampleService.getById('1');

      expect(mockPrisma.caseExample.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result).toEqual(mockExample);
    });

    it('案例不存在时应返回null', async () => {
      mockFindUnique.mockResolvedValue(null as unknown as never);

      const result = await CaseExampleService.getById('999');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('应该成功更新案例', async () => {
      const mockExample = {
        id: '1',
        title: '更新后的标题',
        caseNumber: 'CN2024-001',
        court: '测试法院',
        type: 'CIVIL',
        facts: '测试事实',
        judgment: '测试判决',
        result: 'WIN',
        judgmentDate: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUpdate.mockResolvedValue(mockExample as unknown as never);

      const input = {
        title: '更新后的标题',
      };

      const result = await CaseExampleService.update('1', input);

      expect(mockPrisma.caseExample.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          title: input.title,
        }),
      });
      expect(result).toEqual(mockExample);
    });
  });

  describe('delete', () => {
    it('应该成功删除案例', async () => {
      const mockExample = {
        id: '1',
        title: '测试案例',
        caseNumber: 'CN2024-001',
        court: '测试法院',
        type: 'CIVIL',
        facts: '测试事实',
        judgment: '测试判决',
        result: 'WIN',
        judgmentDate: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDelete.mockResolvedValue(mockExample as unknown as never);

      const result = await CaseExampleService.delete('1');

      expect(mockPrisma.caseExample.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result).toEqual(mockExample);
    });
  });

  describe('list', () => {
    it('应该成功获取案例列表', async () => {
      const mockExamples = [
        {
          id: '1',
          title: '测试案例1',
          caseNumber: 'CN2024-001',
          court: '测试法院',
          type: 'CIVIL',
          facts: '测试事实1',
          judgment: '测试判决1',
          result: 'WIN',
          judgmentDate: new Date('2024-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          title: '测试案例2',
          caseNumber: 'CN2024-002',
          court: '测试法院',
          type: 'CRIMINAL',
          facts: '测试事实2',
          judgment: '测试判决2',
          result: 'LOSE',
          judgmentDate: new Date('2024-02-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFindMany.mockResolvedValue(mockExamples as unknown as never);
      mockCount.mockResolvedValue(2 as unknown as never);

      const result = await CaseExampleService.list({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        examples: mockExamples,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('应该正确处理分页参数', async () => {
      mockFindMany.mockResolvedValue([] as unknown as never);
      mockCount.mockResolvedValue(0 as unknown as never);

      await CaseExampleService.list({
        page: 2,
        limit: 20,
      });

      expect(mockPrisma.caseExample.findMany).toHaveBeenCalledWith({
        skip: 20,
        take: 20,
        where: {},
        orderBy: { judgmentDate: 'desc' },
      });
    });

    it('应该正确应用筛选条件', async () => {
      mockFindMany.mockResolvedValue([] as unknown as never);
      mockCount.mockResolvedValue(0 as unknown as never);

      await CaseExampleService.list({
        type: 'CIVIL',
        result: 'WIN',
        court: '测试法院',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });

      expect(mockPrisma.caseExample.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {
          AND: [
            { type: 'CIVIL' },
            { result: 'WIN' },
            { court: { contains: '测试法院', mode: 'insensitive' } },
            {
              judgmentDate: {
                gte: new Date('2024-01-01'),
                lte: new Date('2024-12-31'),
              },
            },
          ],
        },
        orderBy: { judgmentDate: 'desc' },
      });
    });
  });

  describe('getStatistics', () => {
    it('应该正确计算统计信息', async () => {
      mockCount.mockResolvedValue(100 as unknown as never);
      mockGroupBy
        .mockResolvedValueOnce([
          { type: 'CIVIL', _count: 50 },
          { type: 'CRIMINAL', _count: 30 },
        ] as unknown as never)
        .mockResolvedValueOnce([
          { result: 'WIN', _count: 60 },
          { result: 'LOSE', _count: 40 },
        ] as unknown as never)
        .mockResolvedValueOnce([
          { court: '法院A', _count: 40 },
          { court: '法院B', _count: 60 },
        ] as unknown as never)
        .mockResolvedValueOnce([
          { cause: '案由A', _count: 50 },
          { cause: '案由B', _count: 50 },
        ] as unknown as never);

      const result = await CaseExampleService.getStatistics();

      expect(result).toEqual({
        total: 100,
        byType: { CIVIL: 50, CRIMINAL: 30 },
        byResult: { WIN: 60, LOSE: 40 },
        byCourt: { 法院A: 40, 法院B: 60 },
        byCause: { 案由A: 50, 案由B: 50 },
        winRate: 60,
      });
    });

    it('应该正确计算胜诉率', async () => {
      mockCount.mockResolvedValue(100 as unknown as never);
      mockGroupBy
        .mockResolvedValueOnce([] as unknown as never)
        .mockResolvedValueOnce([
          { result: 'WIN', _count: 40 },
          { result: 'LOSE', _count: 60 },
        ] as unknown as never)
        .mockResolvedValueOnce([] as unknown as never)
        .mockResolvedValueOnce([] as unknown as never);

      const result = await CaseExampleService.getStatistics();

      expect(result.winRate).toBe(40);
    });

    it('没有胜诉和败诉数据时胜诉率应为0', async () => {
      mockCount.mockResolvedValue(0 as unknown as never);
      mockGroupBy
        .mockResolvedValueOnce([] as unknown as never)
        .mockResolvedValueOnce([] as unknown as never)
        .mockResolvedValueOnce([] as unknown as never)
        .mockResolvedValueOnce([] as unknown as never);

      const result = await CaseExampleService.getStatistics();

      expect(result.winRate).toBe(0);
    });
  });
});
