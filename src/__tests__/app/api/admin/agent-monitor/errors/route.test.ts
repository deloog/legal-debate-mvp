/**
 * Agent Monitor Errors API 测试
 * TDD: 先写测试，后实现代码
 * 包含权限验证、速率限制、输入验证测试
 */

import { prisma } from '@/lib/db/prisma';
import { ActionStatus } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    agentAction: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

// Mock 权限验证
jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: jest.fn().mockResolvedValue(null), // 默认通过
}));

import { validatePermissions } from '@/lib/middleware/permission-check';
import { AGENT_MONITOR_PERMISSIONS } from '@/types/permission';

describe('Agent Monitor Errors API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 重置权限验证 mock
    (validatePermissions as jest.Mock).mockResolvedValue(null);
  });

  describe('GET /api/admin/agent-monitor/errors', () => {
    it('应返回错误类型分布统计', async () => {
      // Arrange: 准备模拟数据
      const mockErrors = [
        {
          id: '1',
          agentName: 'VerificationAgent',
          actionName: 'verify',
          metadata: {
            errorMessage: 'API timeout: Connection refused',
          },
          createdAt: new Date('2024-01-15'),
        },
        {
          id: '2',
          agentName: 'VerificationAgent',
          actionName: 'verify',
          metadata: {
            errorMessage: 'API timeout: Read timeout',
          },
          createdAt: new Date('2024-01-16'),
        },
        {
          id: '3',
          agentName: 'MemoryAgent',
          actionName: 'retrieve',
          metadata: {
            errorMessage: 'Database error: Connection lost',
          },
          createdAt: new Date('2024-01-17'),
        },
        {
          id: '4',
          agentName: 'GenerationAgent',
          actionName: 'generate',
          metadata: {
            errorMessage: 'AI model error: Rate limit exceeded',
          },
          createdAt: new Date('2024-01-18'),
        },
      ];

      (prisma.agentAction.findMany as jest.Mock).mockResolvedValue(mockErrors);

      // Act
      const { GET } =
        await import('@/app/api/admin/agent-monitor/errors/route');
      const request = new Request(
        'http://localhost/api/admin/agent-monitor/errors'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('errorDistribution');
      expect(data.data).toHaveProperty('agentErrors');
      expect(data.data).toHaveProperty('recentErrors');
    });

    it('应验证权限', async () => {
      // Arrange
      (prisma.agentAction.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const { GET } =
        await import('@/app/api/admin/agent-monitor/errors/route');
      const request = new Request(
        'http://localhost/api/admin/agent-monitor/errors'
      );
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
      const { GET } =
        await import('@/app/api/admin/agent-monitor/errors/route');
      const request = new Request(
        'http://localhost/api/admin/agent-monitor/errors'
      );
      const response = await GET(request as unknown as Request);

      // Assert
      expect(response.status).toBe(403);
    });

    it('应按Agent分组统计错误', async () => {
      // Arrange
      const mockErrors = [
        {
          id: '1',
          agentName: 'VerificationAgent',
          actionName: 'verify',
          metadata: { errorMessage: 'Error A' },
          createdAt: new Date(),
        },
        {
          id: '2',
          agentName: 'VerificationAgent',
          actionName: 'verify',
          metadata: { errorMessage: 'Error B' },
          createdAt: new Date(),
        },
        {
          id: '3',
          agentName: 'MemoryAgent',
          actionName: 'retrieve',
          metadata: { errorMessage: 'Error C' },
          createdAt: new Date(),
        },
      ];

      (prisma.agentAction.findMany as jest.Mock).mockResolvedValue(mockErrors);

      // Act
      const { GET } =
        await import('@/app/api/admin/agent-monitor/errors/route');
      const request = new Request(
        'http://localhost/api/admin/agent-monitor/errors'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      // Assert
      const agentErrors = data.data.agentErrors;
      expect(agentErrors).toHaveLength(2);

      const verificationAgent = agentErrors.find(
        (a: { agentName: string }) => a.agentName === 'VerificationAgent'
      );
      expect(verificationAgent.errorCount).toBe(2);
    });

    it('应分类错误类型', async () => {
      // Arrange
      const mockErrors = [
        {
          id: '1',
          agentName: 'AgentA',
          metadata: { errorMessage: 'API timeout error' },
          createdAt: new Date(),
        },
        {
          id: '2',
          agentName: 'AgentA',
          metadata: { errorMessage: 'Connection timeout' },
          createdAt: new Date(),
        },
        {
          id: '3',
          agentName: 'AgentB',
          metadata: { errorMessage: 'Database connection failed' },
          createdAt: new Date(),
        },
        {
          id: '4',
          agentName: 'AgentC',
          metadata: { errorMessage: 'AI rate limit exceeded' },
          createdAt: new Date(),
        },
        {
          id: '5',
          agentName: 'AgentD',
          metadata: { errorMessage: 'Unknown error' },
          createdAt: new Date(),
        },
      ];

      (prisma.agentAction.findMany as jest.Mock).mockResolvedValue(mockErrors);

      // Act
      const { GET } =
        await import('@/app/api/admin/agent-monitor/errors/route');
      const request = new Request(
        'http://localhost/api/admin/agent-monitor/errors'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      // Assert
      const distribution = data.data.errorDistribution;
      expect(distribution).toContainEqual(
        expect.objectContaining({ category: 'TIMEOUT' })
      );
      expect(distribution).toContainEqual(
        expect.objectContaining({ category: 'DATABASE' })
      );
      expect(distribution).toContainEqual(
        expect.objectContaining({ category: 'AI_MODEL' })
      );
      expect(distribution).toContainEqual(
        expect.objectContaining({ category: 'UNKNOWN' })
      );
    });

    it('应支持限制返回的错误数量', async () => {
      // Arrange
      const mockErrors = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        agentName: 'AgentA',
        actionName: 'action',
        metadata: { errorMessage: `Error ${i}` },
        createdAt: new Date(),
      }));

      (prisma.agentAction.findMany as jest.Mock).mockResolvedValue(mockErrors);

      // Act
      const { GET } =
        await import('@/app/api/admin/agent-monitor/errors/route');
      const request = new Request(
        'http://localhost/api/admin/agent-monitor/errors?limit=10'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      // Assert
      expect(data.data.recentErrors.length).toBeLessThanOrEqual(10);
    });

    it('应支持按Agent过滤', async () => {
      // Arrange
      (prisma.agentAction.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const { GET } =
        await import('@/app/api/admin/agent-monitor/errors/route');
      const request = new Request(
        'http://localhost/api/admin/agent-monitor/errors?agent=VerificationAgent'
      );
      await GET(request as unknown as Request);

      // Assert
      expect(prisma.agentAction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            agentName: 'VerificationAgent',
            status: ActionStatus.FAILED,
          }),
        })
      );
    });

    it('应处理数据库错误', async () => {
      // Arrange
      (prisma.agentAction.findMany as jest.Mock).mockRejectedValue(
        new Error('Query failed')
      );

      // Act
      const { GET } =
        await import('@/app/api/admin/agent-monitor/errors/route');
      const request = new Request(
        'http://localhost/api/admin/agent-monitor/errors'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });

    it('当没有错误时应返回空结果', async () => {
      // Arrange
      (prisma.agentAction.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const { GET } =
        await import('@/app/api/admin/agent-monitor/errors/route');
      const request = new Request(
        'http://localhost/api/admin/agent-monitor/errors'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.errorDistribution).toEqual([]);
      expect(data.data.agentErrors).toEqual([]);
      expect(data.data.recentErrors).toEqual([]);
    });
  });
});
