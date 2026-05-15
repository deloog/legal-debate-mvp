/**
 * 企业法务工作台API测试
 * 测试覆盖：
 * 1. 获取工作台数据
 * 2. 统计数据计算
 * 3. 风险告警查询
 * 4. 合同列表查询
 * 5. 合规状态计算
 * 6. 任务列表查询
 * 7. 错误处理
 * 8. 权限验证
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/dashboard/enterprise/route';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    enterpriseAccount: {
      findUnique: jest.fn(),
    },
    contract: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    task: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    enterpriseComplianceCheck: {
      count: jest.fn().mockResolvedValue(0),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('企业法务工作台API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'enterprise-user-1',
    });
    (prisma.enterpriseAccount.findUnique as jest.Mock).mockResolvedValue({
      status: 'APPROVED',
    });
  });

  describe('GET /api/dashboard/enterprise', () => {
    it('未登录时应返回401', async () => {
      (getAuthUser as jest.Mock).mockResolvedValueOnce(null);
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('未找到企业账号时应返回404', async () => {
      (prisma.enterpriseAccount.findUnique as jest.Mock).mockResolvedValueOnce(
        null
      );
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('ENTERPRISE_ACCOUNT_NOT_FOUND');
    });

    it('企业未审核通过时应返回403', async () => {
      (prisma.enterpriseAccount.findUnique as jest.Mock).mockResolvedValueOnce({
        status: 'PENDING',
      });
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe('ENTERPRISE_NOT_APPROVED');
    });

    it('应该成功返回工作台数据', async () => {
      // Mock数据
      (prisma.contract.count as jest.Mock)
        .mockResolvedValueOnce(5) // pendingReviewContracts
        .mockResolvedValueOnce(2); // highRiskContracts

      (prisma.task.count as jest.Mock).mockResolvedValueOnce(3); // pendingTasks

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: '1',
          contractNumber: 'HT20260130001',
          clientName: '测试客户A',
          caseType: '劳动争议',
          status: 'SIGNED',
          totalFee: 50000,
          updatedAt: new Date('2026-01-30T10:00:00Z'),
        },
      ]);

      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: '1',
          title: '合同审查任务',
          description: '审查HT20260130001合同',
          dueDate: new Date('2026-01-31T10:00:00Z'),
          priority: 'HIGH',
          status: 'TODO',
        },
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('stats');
      expect(data.data).toHaveProperty('riskAlerts');
      expect(data.data).toHaveProperty('recentContracts');
      expect(data.data).toHaveProperty('complianceStatus');
      expect(data.data).toHaveProperty('upcomingTasks');
    });

    it('应该正确计算统计数据', async () => {
      (prisma.contract.count as jest.Mock)
        .mockResolvedValueOnce(5) // pendingReviewContracts
        .mockResolvedValueOnce(2) // highRiskContracts
        .mockResolvedValueOnce(10); // totalContracts

      (prisma.task.count as jest.Mock).mockResolvedValueOnce(3); // pendingTasks

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.stats.pendingReviewContracts).toBe(5);
      expect(data.data.stats.highRiskContracts).toBe(2);
      expect(data.data.stats.pendingTasks).toBe(3);
      expect(data.data.stats.complianceScore).toBeGreaterThanOrEqual(0);
      expect(data.data.stats.complianceScore).toBeLessThanOrEqual(100);
    });

    it('应该返回风险告警列表', async () => {
      (prisma.contract.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(2); // highRiskContracts

      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(Array.isArray(data.data.riskAlerts)).toBe(true);
      // 应该有高风险合同告警
      expect(data.data.riskAlerts.length).toBeGreaterThan(0);
    });

    it('应该返回最近审查的合同列表', async () => {
      (prisma.contract.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: '1',
          contractNumber: 'HT20260130001',
          clientName: '测试客户A',
          caseType: '劳动争议',
          status: 'SIGNED',
          totalFee: 50000,
          updatedAt: new Date('2026-01-30T10:00:00Z'),
        },
        {
          id: '2',
          contractNumber: 'HT20260130002',
          clientName: '测试客户B',
          caseType: '合同纠纷',
          status: 'PENDING',
          totalFee: 80000,
          updatedAt: new Date('2026-01-30T09:00:00Z'),
        },
      ]);

      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(Array.isArray(data.data.recentContracts)).toBe(true);
      expect(data.data.recentContracts.length).toBe(2);
      expect(data.data.recentContracts[0].contractNumber).toBe('HT20260130001');
    });

    it('应该返回合规状态信息', async () => {
      (prisma.contract.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.complianceStatus).toHaveProperty('totalChecks');
      expect(data.data.complianceStatus).toHaveProperty('passedChecks');
      expect(data.data.complianceStatus).toHaveProperty('failedChecks');
      expect(data.data.complianceStatus).toHaveProperty('score');
      expect(typeof data.data.complianceStatus.score).toBe('number');
    });

    it('应该返回即将到期的任务列表', async () => {
      (prisma.contract.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce([]);

      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: '1',
          title: '合同审查任务',
          description: '审查HT20260130001合同',
          dueDate: new Date('2026-01-31T10:00:00Z'),
          priority: 'HIGH',
          status: 'TODO',
        },
        {
          id: '2',
          title: '合规检查任务',
          description: '进行月度合规检查',
          dueDate: new Date('2026-02-01T10:00:00Z'),
          priority: 'MEDIUM',
          status: 'TODO',
        },
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(Array.isArray(data.data.upcomingTasks)).toBe(true);
      expect(data.data.upcomingTasks.length).toBe(2);
      expect(data.data.upcomingTasks[0].title).toBe('合同审查任务');
    });

    it('应该处理数据库查询错误', async () => {
      (prisma.contract.count as jest.Mock).mockRejectedValueOnce(
        new Error('Database error')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toHaveProperty('code');
      expect(data.error).toHaveProperty('message');
    });

    it('应该限制返回的合同数量', async () => {
      (prisma.contract.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);

      // 模拟返回5条合同
      const mockContracts = Array.from({ length: 5 }, (_, i) => ({
        id: `${i + 1}`,
        contractNumber: `HT2026013000${i + 1}`,
        clientName: `测试客户${i + 1}`,
        caseType: '劳动争议',
        status: 'SIGNED',
        totalFee: 50000,
        updatedAt: new Date('2026-01-30T10:00:00Z'),
      }));

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce(
        mockContracts
      );
      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      // 应该只返回最多5条
      expect(data.data.recentContracts.length).toBeLessThanOrEqual(5);
    });

    it('应该限制返回的任务数量', async () => {
      (prisma.contract.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce([]);

      // 模拟返回5条任务
      const mockTasks = Array.from({ length: 5 }, (_, i) => ({
        id: `${i + 1}`,
        title: `任务${i + 1}`,
        description: `描述${i + 1}`,
        dueDate: new Date('2026-01-31T10:00:00Z'),
        priority: 'HIGH',
        status: 'TODO',
      }));

      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce(mockTasks);

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      // 应该只返回最多5条
      expect(data.data.upcomingTasks.length).toBeLessThanOrEqual(5);
    });

    it('应该按时间倒序排列合同', async () => {
      (prisma.contract.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: '1',
          contractNumber: 'HT20260130001',
          clientName: '测试客户A',
          caseType: '劳动争议',
          status: 'SIGNED',
          totalFee: 50000,
          updatedAt: new Date('2026-01-30T10:00:00Z'),
        },
        {
          id: '2',
          contractNumber: 'HT20260130002',
          clientName: '测试客户B',
          caseType: '合同纠纷',
          status: 'PENDING',
          totalFee: 80000,
          updatedAt: new Date('2026-01-30T09:00:00Z'),
        },
      ]);

      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const __data = await response.json();

      // 验证调用了正确的排序参数
      expect(prisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { updatedAt: 'desc' },
        })
      );
    });

    it('应该按到期时间升序排列任务', async () => {
      (prisma.contract.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce([]);

      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: '1',
          title: '合同审查任务',
          description: '审查HT20260130001合同',
          dueDate: new Date('2026-01-31T10:00:00Z'),
          priority: 'HIGH',
          status: 'TODO',
        },
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const __data = await response.json();

      // 验证调用了正确的排序参数
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { dueDate: 'asc' },
        })
      );
    });

    it('应该正确计算合规评分', async () => {
      (prisma.contract.count as jest.Mock)
        .mockResolvedValueOnce(0) // pendingReviewContracts
        .mockResolvedValueOnce(2) // highRiskContracts
        .mockResolvedValueOnce(10); // totalContracts

      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      // 合规评分应该基于高风险合同比例计算
      // 如果有10个合同，2个高风险，合规评分应该是80分左右
      expect(data.data.stats.complianceScore).toBeGreaterThanOrEqual(70);
      expect(data.data.stats.complianceScore).toBeLessThanOrEqual(90);
    });

    it('应该在没有合同时返回满分合规评分', async () => {
      (prisma.contract.count as jest.Mock)
        .mockResolvedValueOnce(0) // pendingReviewContracts
        .mockResolvedValueOnce(0) // highRiskContracts
        .mockResolvedValueOnce(0); // totalContracts

      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/enterprise'
      );
      const response = await GET(request);
      const data = await response.json();

      // 没有合同时应该返回满分
      expect(data.data.stats.complianceScore).toBe(100);
    });
  });
});
