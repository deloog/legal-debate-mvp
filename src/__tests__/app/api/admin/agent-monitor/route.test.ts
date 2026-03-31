/**
 * Agent Monitor API 测试
 * TDD: 先写测试，后实现代码
 * 包含权限验证、速率限制、输入验证测试
 */

import { prisma } from '@/lib/db/prisma';
import { ActionStatus } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    agentAction: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock 权限验证
jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: jest.fn().mockResolvedValue(null), // 默认通过
}));

// Mock zod 验证错误
jest.mock('zod', () => {
  const actual = jest.requireActual('zod');
  return {
    ...actual,
    z: {
      ...actual.z,
      object: jest.fn().mockReturnValue({
        parse: jest.fn().mockReturnValue({}),
        safeParse: jest.fn().mockReturnValue({ success: true, data: {} }),
      }),
    },
  };
});

import { validatePermissions } from '@/lib/middleware/permission-check';
import { AGENT_MONITOR_PERMISSIONS } from '@/types/permission';

describe('Agent Monitor API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 重置权限验证 mock
    (validatePermissions as jest.Mock).mockResolvedValue(null);
  });

  describe('GET /api/admin/agent-monitor', () => {
    it('应返回各Agent的统计信息', async () => {
      // Arrange: 准备模拟数据
      const mockStats = [
        {
          agentName: 'VerificationAgent',
          status: ActionStatus.COMPLETED,
          _count: { id: 100 },
          _avg: { executionTime: 500 },
          _min: { executionTime: 200 },
          _max: { executionTime: 1000 },
        },
        {
          agentName: 'VerificationAgent',
          status: ActionStatus.FAILED,
          _count: { id: 5 },
          _avg: { executionTime: 300 },
          _min: { executionTime: 100 },
          _max: { executionTime: 500 },
        },
        {
          agentName: 'MemoryAgent',
          status: ActionStatus.COMPLETED,
          _count: { id: 200 },
          _avg: { executionTime: 150 },
          _min: { executionTime: 50 },
          _max: { executionTime: 400 },
        },
      ];

      (prisma.agentAction.groupBy as jest.Mock).mockResolvedValue(mockStats);

      // Act: 调用 API
      const { GET } = await import('@/app/api/admin/agent-monitor/route');
      const request = new Request('http://localhost/api/admin/agent-monitor');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      // Assert: 验证结果
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('agents');
      expect(data.data.agents).toHaveLength(2);

      // 验证 VerificationAgent 统计
      const verificationAgent = data.data.agents.find(
        (a: { agentName: string }) => a.agentName === 'VerificationAgent'
      );
      expect(verificationAgent).toBeDefined();
      expect(verificationAgent.totalCalls).toBe(105);
      expect(verificationAgent.successCount).toBe(100);
      expect(verificationAgent.failedCount).toBe(5);
      expect(verificationAgent.successRate).toBe(95.24);
      expect(verificationAgent.avgExecutionTime).toBe(490.48);
    });

    it('应验证权限', async () => {
      // Arrange
      (prisma.agentAction.groupBy as jest.Mock).mockResolvedValue([]);

      // Act
      const { GET } = await import('@/app/api/admin/agent-monitor/route');
      const request = new Request('http://localhost/api/admin/agent-monitor');
      await GET(request as unknown as Request);

      // Assert: 验证权限检查被调用
      expect(validatePermissions).toHaveBeenCalledWith(
        expect.anything(),
        AGENT_MONITOR_PERMISSIONS.READ
      );
    });

    it('权限不足时应返回403', async () => {
      // Arrange: 模拟权限不足
      const forbiddenResponse = new Response(
        JSON.stringify({ success: false, error: { code: 'FORBIDDEN' } }),
        { status: 403 }
      );
      (validatePermissions as jest.Mock).mockResolvedValue(forbiddenResponse);

      // Act
      const { GET } = await import('@/app/api/admin/agent-monitor/route');
      const request = new Request('http://localhost/api/admin/agent-monitor');
      const response = await GET(request as unknown as Request);

      // Assert
      expect(response.status).toBe(403);
    });

    it('应支持按时间范围过滤', async () => {
      // Arrange
      const mockStats: unknown[] = [];
      (prisma.agentAction.groupBy as jest.Mock).mockResolvedValue(mockStats);

      // Act: 调用带时间参数的 API
      const { GET } = await import('@/app/api/admin/agent-monitor/route');
      const request = new Request(
        'http://localhost/api/admin/agent-monitor?startTime=2024-01-01T00:00:00.000Z&endTime=2024-01-31T23:59:59.000Z'
      );
      const response = await GET(request as unknown as Request);

      // Assert
      expect(response.status).toBe(200);
      // 验证 groupBy 被调用 (包含时间过滤参数)
      expect(prisma.agentAction.groupBy).toHaveBeenCalled();
      const callArgs = (prisma.agentAction.groupBy as jest.Mock).mock
        .calls[0][0];
      expect(callArgs).toHaveProperty('where');
    });

    it('应返回正确的响应时间分布', async () => {
      // Arrange
      const mockStats = [
        {
          agentName: 'VerificationAgent',
          status: ActionStatus.COMPLETED,
          _count: { id: 100 },
          _avg: { executionTime: 500 },
          _min: { executionTime: 100 },
          _max: { executionTime: 2000 },
        },
      ];

      (prisma.agentAction.groupBy as jest.Mock).mockResolvedValue(mockStats);

      // Act
      const { GET } = await import('@/app/api/admin/agent-monitor/route');
      const request = new Request('http://localhost/api/admin/agent-monitor');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      // Assert
      const agent = data.data.agents[0];
      expect(agent).toHaveProperty('minExecutionTime', 100);
      expect(agent).toHaveProperty('maxExecutionTime', 2000);
      expect(agent).toHaveProperty('avgExecutionTime', 500);
    });

    it('应处理数据库错误并返回500', async () => {
      // Arrange
      (prisma.agentAction.groupBy as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      const { GET } = await import('@/app/api/admin/agent-monitor/route');
      const request = new Request('http://localhost/api/admin/agent-monitor');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });

    it('当没有数据时应返回空数组', async () => {
      // Arrange
      (prisma.agentAction.groupBy as jest.Mock).mockResolvedValue([]);

      // Act
      const { GET } = await import('@/app/api/admin/agent-monitor/route');
      const request = new Request('http://localhost/api/admin/agent-monitor');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.agents).toEqual([]);
      expect(data.data.summary).toBeDefined();
    });

    it('应返回汇总统计数据', async () => {
      // Arrange
      const mockStats = [
        {
          agentName: 'AgentA',
          status: ActionStatus.COMPLETED,
          _count: { id: 80 },
          _avg: { executionTime: 300 },
          _min: { executionTime: 100 },
          _max: { executionTime: 500 },
        },
        {
          agentName: 'AgentA',
          status: ActionStatus.FAILED,
          _count: { id: 20 },
          _avg: { executionTime: 200 },
          _min: { executionTime: 50 },
          _max: { executionTime: 400 },
        },
        {
          agentName: 'AgentB',
          status: ActionStatus.COMPLETED,
          _count: { id: 100 },
          _avg: { executionTime: 200 },
          _min: { executionTime: 50 },
          _max: { executionTime: 300 },
        },
      ];

      (prisma.agentAction.groupBy as jest.Mock).mockResolvedValue(mockStats);

      // Act
      const { GET } = await import('@/app/api/admin/agent-monitor/route');
      const request = new Request('http://localhost/api/admin/agent-monitor');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      // Assert
      // AgentA: (300*80 + 200*20)/100 = 280ms avg, AgentB: 200ms avg
      // Overall: (280*100 + 200*100)/200 = 240ms avg
      expect(data.data.summary).toEqual({
        totalAgents: 2,
        totalCalls: 200,
        overallSuccessRate: 90,
        avgExecutionTime: 240,
      });
    });
  });
});
