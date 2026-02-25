/**
 * 合规报告生成器单元测试
 */

import { ComplianceGenerator } from '@/lib/knowledge-graph/audit-report/compliance-generator';
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
    },
    user: {
      findMany: jest.fn(),
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

describe('ComplianceGenerator', () => {
  let generator: ComplianceGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new ComplianceGenerator();
  });

  const mockStartDate = '2026-01-01T00:00:00.000Z';
  const mockEndDate = '2026-01-31T23:59:59.999Z';

  describe('generate', () => {
    it('应该生成合规报告', async () => {
      // Mock数据
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          actionType: 'VIEW_CASE',
          actionCategory: 'USER',
          description: '查看用户数据',
          resourceType: 'USER',
          resourceId: 'user123',
          createdAt: new Date('2026-01-15T10:00:00.000Z'),
        },
        {
          id: 'log2',
          userId: 'user2',
          actionType: 'DELETE_CASE',
          actionCategory: 'USER',
          description: '删除用户数据',
          resourceType: 'USER',
          resourceId: 'user456',
          createdAt: new Date('2026-01-20T14:30:00.000Z'),
        },
      ];

      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.COMPLIANCE,
        format: AuditReportFormat.JSON,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      // 验证报告结构
      expect(report.reportType).toBe(AuditReportType.COMPLIANCE);
      expect(report.period.start).toBe(mockStartDate);
      expect(report.period.end).toBe(mockEndDate);
      expect(report.generatedBy).toBe('admin1');
      expect(report.generatedAt).toBeDefined();
      expect(Array.isArray(report.details)).toBe(true);
      expect(report.details).toHaveLength(mockLogs.length);

      // 验证摘要
      const summary = report.summary;
      expect(summary.totalDataAccess).toBeDefined();
      expect(summary.sensitiveDataAccess).toBeDefined();
      expect(summary.complianceScore).toBeGreaterThanOrEqual(0);
      expect(summary.complianceScore).toBeLessThanOrEqual(100);
    });

    it('应该正确统计数据访问次数', async () => {
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          actionType: 'VIEW_CASE',
          actionCategory: 'USER',
          description: '查看用户数据',
          resourceType: 'USER',
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
        {
          id: 'log2',
          userId: 'user2',
          actionType: 'VIEW_CASE',
          actionCategory: 'USER',
          description: '查看用户数据',
          resourceType: 'USER',
          createdAt: new Date('2026-01-02T11:00:00.000Z'),
        },
        {
          id: 'log3',
          userId: 'user3',
          actionType: 'VIEW_CASE',
          actionCategory: 'USER',
          description: '查看法条数据',
          resourceType: 'LAW_ARTICLE',
          createdAt: new Date('2026-01-03T12:00:00.000Z'),
        },
      ];

      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.COMPLIANCE,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      expect(report.summary.totalDataAccess).toBe(3);
    });

    it('应该正确识别敏感数据访问', async () => {
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          actionType: 'VIEW_CASE',
          actionCategory: 'USER',
          description: '查看用户数据',
          resourceType: 'USER',
          metadata: { isSensitive: true },
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
        {
          id: 'log2',
          userId: 'user2',
          actionType: 'VIEW_CASE',
          actionCategory: 'USER',
          description: '查看法条数据',
          resourceType: 'LAW_ARTICLE',
          createdAt: new Date('2026-01-02T11:00:00.000Z'),
        },
      ];

      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.COMPLIANCE,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      expect(report.summary.sensitiveDataAccess).toBe(1);
    });

    it('应该统计数据删除请求', async () => {
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          actionType: 'DELETE_CASE',
          actionCategory: 'USER',
          description: '删除用户数据',
          resourceType: 'USER',
          metadata: { isCompleted: true },
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
        {
          id: 'log2',
          userId: 'user2',
          actionType: 'DELETE_CASE',
          actionCategory: 'USER',
          description: '删除用户数据',
          resourceType: 'USER',
          metadata: { isCompleted: false },
          createdAt: new Date('2026-01-02T11:00:00.000Z'),
        },
      ];

      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.COMPLIANCE,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      expect(report.summary.dataDeletionRequests).toBe(2);
      expect(report.summary.dataDeletionCompleted).toBe(1);
    });

    it('应该正确计算合规评分', async () => {
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          actionType: 'VIEW_CASE',
          actionCategory: 'USER',
          description: '查看用户数据',
          resourceType: 'USER',
          metadata: { isAuthorized: true },
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
        {
          id: 'log2',
          userId: 'user2',
          actionType: 'VIEW_CASE',
          actionCategory: 'USER',
          description: '查看用户数据',
          resourceType: 'USER',
          metadata: { isAuthorized: false, isUnauthorized: true },
          createdAt: new Date('2026-01-02T11:00:00.000Z'),
        },
      ];

      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.COMPLIANCE,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      // 1次未授权访问，总次数2，合规率50%
      expect(report.summary.unauthorizedAccessAttempts).toBe(1);
      expect(report.summary.complianceScore).toBe(50);
    });

    it('应该正确处理空数据', async () => {
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.COMPLIANCE,
        userId: 'admin1',
      };

      const report = await generator.generate(params);

      expect(report.summary.totalDataAccess).toBe(0);
      expect(report.summary.sensitiveDataAccess).toBe(0);
      expect(report.summary.dataDeletionRequests).toBe(0);
      expect(report.summary.dataDeletionCompleted).toBe(0);
      expect(report.summary.complianceScore).toBe(100); // 无违规时100分
      expect(report.summary.privacyViolations).toBe(0);
      expect(report.summary.unauthorizedAccessAttempts).toBe(0);
      expect(report.details).toHaveLength(0);
    });

    it('应该记录生成日志', async () => {
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.COMPLIANCE,
        userId: 'admin1',
      };

      await generator.generate(params);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('开始生成合规报告'),
        expect.any(Object)
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('合规报告生成完成'),
        expect.any(Object)
      );
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database connection failed');
      (prisma.actionLog.findMany as jest.Mock).mockRejectedValue(error);

      const params = {
        startDate: mockStartDate,
        endDate: mockEndDate,
        reportType: AuditReportType.COMPLIANCE,
        userId: 'admin1',
      };

      await expect(generator.generate(params)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        '生成合规报告失败',
        expect.objectContaining({ error })
      );
    });
  });

  describe('formatDetails', () => {
    it('应该正确格式化详情记录', () => {
      const generator = new ComplianceGenerator();

      const mockLog = {
        id: 'log1',
        userId: 'user1',
        userName: '张三',
        actionType: 'VIEW_CASE',
        actionCategory: 'USER',
        description: '查看用户数据',
        resourceType: 'USER',
        resourceId: 'user123',
        metadata: { isSensitive: true, isAuthorized: true },
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
      };

      const details = generator.formatDetails([mockLog]);

      expect(details).toHaveLength(1);
      expect(details[0]).toEqual({
        timestamp: mockLog.createdAt,
        userId: 'user1',
        userName: '张三',
        action: 'VIEW_CASE',
        resourceType: 'USER',
        resourceId: 'user123',
        isSensitive: true,
        description: '查看用户数据',
        riskLevel: expect.any(String), // 应该是 'low', 'medium', 'high', 或 'critical'
      });
    });

    it('应该根据metadata判断风险等级', () => {
      const generator = new ComplianceGenerator();

      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          actionType: 'VIEW_CASE',
          description: '查看数据',
          resourceType: 'USER',
          metadata: { isUnauthorized: true },
          createdAt: new Date('2026-01-15T10:00:00.000Z'),
        },
        {
          id: 'log2',
          userId: 'user2',
          actionType: 'VIEW_CASE',
          description: '查看数据',
          resourceType: 'USER',
          metadata: { isSensitive: true, isUnauthorized: true },
          createdAt: new Date('2026-01-15T11:00:00.000Z'),
        },
      ];

      const details = generator.formatDetails(mockLogs);

      expect(details[0].riskLevel).toBe('high'); // 未授权访问
      expect(details[1].riskLevel).toBe('critical'); // 敏感+未授权
    });
  });
});
