/**
 * 访问审计生成器单元测试
 */

import { AccessAuditGenerator } from '@/lib/knowledge-graph/audit-report/access-audit-generator';
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
      findFirst: jest.fn(),
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

describe('AccessAuditGenerator', () => {
  let generator: AccessAuditGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new AccessAuditGenerator();
  });

  const mockStartDate = '2026-01-01T00:00:00.000Z';
  const mockEndDate = '2026-01-31T23:59:59.999Z';

  describe('generate', () => {
    it('应该生成访问审计报告', async () => {
      // Mock数据
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          actionType: 'VIEW_CASE',
          actionCategory: 'ADMIN',
          description: '查看知识图谱',
          resourceType: 'LAW_ARTICLE_RELATION',
          resourceId: 'relation1',
          createdAt: new Date('2026-01-15T10:00:00.000Z'),
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
        {
          id: 'log2',
          userId: 'user2',
          actionType: 'EXPORT_DATA',
          actionCategory: 'ADMIN',
          description: '导出图谱数据',
          resourceType: 'LAW_ARTICLE_RELATION',
          createdAt: new Date('2026-01-20T14:30:00.000Z'),
          ipAddress: '192.168.1.2',
          userAgent: 'Chrome/96.0',
        },
        {
          id: 'log3',
          userId: 'user1',
          actionType: 'VIEW_CASE',
          actionCategory: 'ADMIN',
          description: '查看法条关系',
          resourceType: 'LAW_ARTICLE_RELATION',
          resourceId: 'relation1',
          createdAt: new Date('2026-01-25T16:00:00.000Z'),
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      ];

      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.ACCESS_AUDIT,
        format: AuditReportFormat.JSON,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      // 验证报告结构
      expect(report.reportType).toBe(AuditReportType.ACCESS_AUDIT);
      expect(report.period.start).toBe(mockStartDate);
      expect(report.period.end).toBe(mockEndDate);
      expect(report.generatedBy).toBe('admin1');
      expect(report.generatedAt).toBeDefined();
      expect(Array.isArray(report.details)).toBe(true);
      expect(report.details).toHaveLength(mockLogs.length);

      // 验证摘要
      const summary = report.summary;
      expect(summary.totalViews).toBe(2); // 2次VIEW_CASE
      expect(summary.totalExports).toBe(1); // 1次EXPORT_DATA
      expect(summary.uniqueUsers).toBe(2); // 2个独立用户
      expect(summary.avgViewsPerUser).toBe(1); // 平均每人访问1次
      expect(summary.topViewedRelations).toBeDefined();
    });

    it('应该正确计算热门关系TOP10', async () => {
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          actionType: 'VIEW_CASE',
          actionCategory: 'ADMIN',
          description: '查看关系1',
          resourceType: 'LAW_ARTICLE_RELATION',
          resourceId: 'relation1',
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
        {
          id: 'log2',
          userId: 'user2',
          actionType: 'VIEW_CASE',
          actionCategory: 'ADMIN',
          description: '查看关系1',
          resourceType: 'LAW_ARTICLE_RELATION',
          resourceId: 'relation1',
          createdAt: new Date('2026-01-02T11:00:00.000Z'),
        },
        {
          id: 'log3',
          userId: 'user3',
          actionType: 'VIEW_CASE',
          actionCategory: 'ADMIN',
          description: '查看关系2',
          resourceType: 'LAW_ARTICLE_RELATION',
          resourceId: 'relation2',
          createdAt: new Date('2026-01-03T12:00:00.000Z'),
        },
      ];

      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.ACCESS_AUDIT,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      // 验证热门关系排序
      const topRelations = report.summary.topViewedRelations;
      expect(topRelations).toHaveLength(2);
      expect(topRelations[0].id).toBe('relation1');
      expect(topRelations[0].count).toBe(2);
      expect(topRelations[1].id).toBe('relation2');
      expect(topRelations[1].count).toBe(1);
    });

    it('应该找到访问高峰时间', async () => {
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          actionType: 'VIEW_CASE',
          actionCategory: 'ADMIN',
          description: '查看图谱',
          resourceType: 'LAW_ARTICLE_RELATION',
          createdAt: new Date('2026-01-15T10:00:00.000Z'),
        },
        {
          id: 'log2',
          userId: 'user2',
          actionType: 'VIEW_CASE',
          actionCategory: 'ADMIN',
          description: '查看图谱',
          resourceType: 'LAW_ARTICLE_RELATION',
          createdAt: new Date('2026-01-15T10:00:00.000Z'),
        },
        {
          id: 'log3',
          userId: 'user3',
          actionType: 'VIEW_CASE',
          actionCategory: 'ADMIN',
          description: '查看图谱',
          resourceType: 'LAW_ARTICLE_RELATION',
          createdAt: new Date('2026-01-15T14:00:00.000Z'),
        },
      ];

      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.ACCESS_AUDIT,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      // 验证访问高峰时间
      expect(report.summary.peakViewTime).toBeDefined();
      expect(report.summary.peakViewTime).toEqual(
        new Date('2026-01-15T10:00:00.000Z')
      );
    });

    it('应该正确处理空数据', async () => {
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.ACCESS_AUDIT,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      expect(report.summary.totalViews).toBe(0);
      expect(report.summary.totalExports).toBe(0);
      expect(report.summary.uniqueUsers).toBe(0);
      expect(report.summary.avgViewsPerUser).toBe(0);
      expect(report.summary.topViewedRelations).toHaveLength(0);
      expect(report.summary.peakViewTime).toBeNull();
      expect(report.details).toHaveLength(0);
    });

    it('应该记录生成日志', async () => {
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.ACCESS_AUDIT,
        userId: 'admin1',
      };

      await generator.generate(params);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('开始生成访问审计报告'),
        expect.any(Object)
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('访问审计报告生成完成'),
        expect.any(Object)
      );
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database connection failed');
      (prisma.actionLog.findMany as jest.Mock).mockRejectedValue(error);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.ACCESS_AUDIT,
        userId: 'admin1',
      };

      await expect(generator.generate(params)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        '生成访问审计报告失败',
        expect.objectContaining({ error })
      );
    });

    it('应该验证日期格式', async () => {
      const invalidParams = {
        startDate: 'invalid-date',
        endDate: mockEndDate,
        reportType: AuditReportType.ACCESS_AUDIT,
        userId: 'admin1',
      };

      await expect(generator.generate(invalidParams)).rejects.toThrow();
    });

    it('应该正确查询指定时间范围的数据', async () => {
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.ACCESS_AUDIT,
        userId: 'admin1',
      };

      await generator.generate(params);

      const query = (prisma.actionLog.findMany as jest.Mock).mock.calls[0][0];
      expect(query.where.createdAt.gte).toEqual(new Date(mockStartDate));
      // 代码会将结束日期设置为当天最后一刻
      const expectedEndDate = new Date(mockEndDate);
      expectedEndDate.setHours(23, 59, 59, 999);
      expect(query.where.createdAt.lte).toEqual(expectedEndDate);
    });
  });

  describe('formatDetails', () => {
    it('应该正确格式化详情记录', () => {
      const generator = new AccessAuditGenerator();

      const mockLog = {
        id: 'log1',
        userId: 'user1',
        actionType: 'VIEW_CASE',
        actionCategory: 'ADMIN',
        description: '查看知识图谱',
        resourceType: 'LAW_ARTICLE_RELATION',
        resourceId: 'relation1',
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const details = generator.formatDetails([mockLog]);

      expect(details).toHaveLength(1);
      expect(details[0]).toEqual({
        timestamp: mockLog.createdAt,
        userId: 'user1',
        action: 'VIEW_CASE',
        resourceType: 'LAW_ARTICLE_RELATION',
        resourceId: 'relation1',
        description: '查看知识图谱',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });
    });
  });
});
