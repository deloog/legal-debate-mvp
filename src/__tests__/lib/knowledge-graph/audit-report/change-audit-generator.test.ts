/**
 * 变更审计生成器单元测试
 */

import { ChangeAuditGenerator } from '@/lib/knowledge-graph/audit-report/change-audit-generator';
import {
  AuditReportType,
  AuditReportFormat,
} from '@/lib/knowledge-graph/audit-report/types';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    actionLog: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

// Mock Logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('ChangeAuditGenerator', () => {
  let generator: ChangeAuditGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new ChangeAuditGenerator();
  });

  const mockStartDate = '2026-01-01T00:00:00.000Z';
  const mockEndDate = '2026-01-31T23:59:59.999Z';

  describe('generate', () => {
    it('应该生成变更审计报告', async () => {
      // Mock数据
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '创建关系',
          resourceType: 'LAW_ARTICLE_RELATION',
          resourceId: 'relation1',
          metadata: { operation: 'create' },
          createdAt: new Date('2026-01-15T10:00:00.000Z'),
        },
        {
          id: 'log2',
          userId: 'user2',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '验证关系通过',
          resourceType: 'LAW_ARTICLE_RELATION',
          resourceId: 'relation2',
          metadata: { operation: 'verify', result: 'approved' },
          createdAt: new Date('2026-01-20T14:30:00.000Z'),
        },
        {
          id: 'log3',
          userId: 'user1',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '删除关系',
          resourceType: 'LAW_ARTICLE_RELATION',
          resourceId: 'relation3',
          metadata: { operation: 'delete' },
          createdAt: new Date('2026-01-25T16:00:00.000Z'),
        },
      ];

      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.CHANGE_AUDIT,
        format: AuditReportFormat.JSON,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      // 验证报告结构
      expect(report.reportType).toBe(AuditReportType.CHANGE_AUDIT);
      expect(report.period.start).toBe(mockStartDate);
      expect(report.period.end).toBe(mockEndDate);
      expect(report.generatedBy).toBe('admin1');
      expect(report.generatedAt).toBeDefined();
      expect(Array.isArray(report.details)).toBe(true);
      expect(report.details).toHaveLength(mockLogs.length);

      // 验证摘要
      const summary = report.summary;
      expect(summary.totalRelationsCreated).toBeDefined();
      expect(summary.totalRelationsDeleted).toBeDefined();
      expect(summary.totalVerified).toBeDefined();
      expect(summary.totalRejected).toBeDefined();
    });

    it('应该正确统计创建和删除关系数', async () => {
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '创建关系',
          resourceType: 'LAW_ARTICLE_RELATION',
          metadata: { operation: 'create' },
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
        {
          id: 'log2',
          userId: 'user2',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '创建关系',
          resourceType: 'LAW_ARTICLE_RELATION',
          metadata: { operation: 'create' },
          createdAt: new Date('2026-01-02T11:00:00.000Z'),
        },
        {
          id: 'log3',
          userId: 'user3',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '删除关系',
          resourceType: 'LAW_ARTICLE_RELATION',
          metadata: { operation: 'delete' },
          createdAt: new Date('2026-01-03T12:00:00.000Z'),
        },
      ];

      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.CHANGE_AUDIT,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      expect(report.summary.totalRelationsCreated).toBe(2);
      expect(report.summary.totalRelationsDeleted).toBe(1);
    });

    it('应该正确统计验证和拒绝数', async () => {
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '验证关系',
          resourceType: 'LAW_ARTICLE_RELATION',
          metadata: { operation: 'verify', result: 'approved' },
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
        {
          id: 'log2',
          userId: 'user2',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '验证关系',
          resourceType: 'LAW_ARTICLE_RELATION',
          metadata: { operation: 'verify', result: 'approved' },
          createdAt: new Date('2026-01-02T11:00:00.000Z'),
        },
        {
          id: 'log3',
          userId: 'user3',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '验证关系',
          resourceType: 'LAW_ARTICLE_RELATION',
          metadata: { operation: 'verify', result: 'rejected' },
          createdAt: new Date('2026-01-03T12:00:00.000Z'),
        },
      ];

      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.CHANGE_AUDIT,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      expect(report.summary.totalVerified).toBe(2);
      expect(report.summary.totalRejected).toBe(1);
      expect(report.summary.verificationRate).toBe(66.67); // (2 / 3) * 100
    });

    it('应该正确计算批量操作数', async () => {
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '批量验证',
          resourceType: 'LAW_ARTICLE_RELATION',
          metadata: { isBatch: true, count: 10 },
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
        {
          id: 'log2',
          userId: 'user2',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '单个验证',
          resourceType: 'LAW_ARTICLE_RELATION',
          metadata: { isBatch: false },
          createdAt: new Date('2026-01-02T11:00:00.000Z'),
        },
      ];

      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.CHANGE_AUDIT,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      expect(report.summary.totalBatchOperations).toBe(1);
    });

    it('应该找到活跃操作员TOP5', async () => {
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          userName: '张三',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '创建关系',
          resourceType: 'LAW_ARTICLE_RELATION',
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
        {
          id: 'log2',
          userId: 'user1',
          userName: '张三',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '创建关系',
          resourceType: 'LAW_ARTICLE_RELATION',
          createdAt: new Date('2026-01-02T11:00:00.000Z'),
        },
        {
          id: 'log3',
          userId: 'user2',
          userName: '李四',
          actionType: 'UPDATE_CASE',
          actionCategory: 'ADMIN',
          description: '验证关系',
          resourceType: 'LAW_ARTICLE_RELATION',
          createdAt: new Date('2026-01-03T12:00:00.000Z'),
        },
      ];

      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.CHANGE_AUDIT,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      const topOperators = report.summary.topOperators;
      expect(topOperators).toHaveLength(2);
      expect(topOperators[0].userId).toBe('user1');
      expect(topOperators[0].userName).toBe('张三');
      expect(topOperators[0].count).toBe(2);
      expect(topOperators[1].userId).toBe('user2');
      expect(topOperators[1].userName).toBe('李四');
      expect(topOperators[1].count).toBe(1);
    });

    it('应该正确处理空数据', async () => {
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.CHANGE_AUDIT,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      expect(report.summary.totalRelationsCreated).toBe(0);
      expect(report.summary.totalRelationsDeleted).toBe(0);
      expect(report.summary.totalVerified).toBe(0);
      expect(report.summary.totalRejected).toBe(0);
      expect(report.summary.verificationRate).toBe(0);
      expect(report.summary.totalBatchOperations).toBe(0);
      expect(report.summary.topOperators).toHaveLength(0);
      expect(report.details).toHaveLength(0);
    });

    it('应该记录生成日志', async () => {
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.CHANGE_AUDIT,
        userId: 'admin1',
      };

      await generator.generate(params);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('开始生成变更审计报告'),
        expect.any(Object)
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('变更审计报告生成完成'),
        expect.any(Object)
      );
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database connection failed');
      (prisma.actionLog.findMany as jest.Mock).mockRejectedValue(error);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.CHANGE_AUDIT,
        userId: 'admin1',
      };

      await expect(generator.generate(params)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        '生成变更审计报告失败',
        expect.objectContaining({ error })
      );
    });
  });

  describe('formatDetails', () => {
    it('应该正确格式化详情记录', () => {
      const generator = new ChangeAuditGenerator();

      const mockLog = {
        id: 'log1',
        userId: 'user1',
        userName: '张三',
        actionType: 'UPDATE_CASE',
        actionCategory: 'ADMIN',
        description: '创建关系',
        resourceType: 'LAW_ARTICLE_RELATION',
        resourceId: 'relation1',
        metadata: { operation: 'create' },
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
      };

      const details = generator.formatDetails([mockLog]);

      expect(details).toHaveLength(1);
      expect(details[0]).toEqual({
        timestamp: mockLog.createdAt,
        userId: 'user1',
        userName: '张三',
        action: 'UPDATE_CASE',
        resourceType: 'LAW_ARTICLE_RELATION',
        resourceId: 'relation1',
        description: '创建关系',
        metadata: { operation: 'create' },
      });
    });
  });
});
