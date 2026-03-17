/**
 * API监控模块单元测试
 */

import { prisma } from '@/lib/db/prisma';
import {
  APIMonitor,
  APIMetrics,
  DatabaseMetrics,
  AIMetrics,
  BusinessMetrics,
  createPerformanceTracker,
  monitorDatabaseQuery,
  monitorAICall,
} from '@/lib/monitoring/api-monitor';

describe('APIMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logRequest', () => {
    test('应该成功记录API请求指标', async () => {
      const metrics: Omit<APIMetrics, 'timestamp'> = {
        endpoint: '/api/test',
        method: 'POST',
        statusCode: 200,
        responseTime: 100,
        userId: 'user123',
        requestId: 'req123',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
      };

      const createSpy = jest
        .spyOn(prisma.aIInteraction, 'create')
        .mockResolvedValue({
          id: '1',
          type: 'API_REQUEST',
          provider: 'MONITOR',
          model: 'POST /api/test',
          request: {
            endpoint: '/api/test',
            method: 'POST',
            statusCode: 200,
            responseTime: 100,
            userId: 'user123',
            requestId: 'req123',
            userAgent: 'test-agent',
            ip: '127.0.0.1',
          },
          response: null,
          tokensUsed: 100,
          duration: 100,
          success: true,
          createdAt: new Date(),
          cost: null,
          error: null,
        } as never);

      await APIMonitor.logRequest(metrics);

      expect(createSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'API_REQUEST',
          provider: 'MONITOR',
          model: 'POST /api/test',
          success: true,
        }),
      });
    });

    test('应该处理错误情况', async () => {
      const metrics: Omit<APIMetrics, 'timestamp'> = {
        endpoint: '/api/test',
        method: 'GET',
        statusCode: 500,
        responseTime: 200,
        error: 'Internal server error',
      };

      const createSpy = jest
        .spyOn(prisma.aIInteraction, 'create')
        .mockResolvedValue({
          id: '1',
          type: 'API_REQUEST',
          provider: 'MONITOR',
          model: 'GET /api/test',
          request: {
            endpoint: '/api/test',
            method: 'GET',
            statusCode: 500,
            responseTime: 200,
          },
          response: { error: 'Internal server error' },
          tokensUsed: 200,
          duration: 200,
          success: false,
          createdAt: new Date(),
          cost: null,
          error: null,
        } as never);

      await APIMonitor.logRequest(metrics);

      expect(createSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: false,
        }),
      });
    });

    test('应该捕获数据库错误', async () => {
      const metrics: Omit<APIMetrics, 'timestamp'> = {
        endpoint: '/api/test',
        method: 'GET',
        statusCode: 200,
        responseTime: 100,
      };

      const createSpy = jest
        .spyOn(prisma.aIInteraction, 'create')
        .mockRejectedValue(new Error('Database error'));

      // 应该不抛出错误（内部捕获处理）
      await expect(APIMonitor.logRequest(metrics)).resolves.not.toThrow();
      expect(createSpy).toHaveBeenCalled();
    });
  });

  describe('logDatabaseOperation', () => {
    test('应该成功记录数据库操作指标', async () => {
      const metrics: Omit<DatabaseMetrics, 'timestamp'> = {
        operation: 'findMany',
        table: 'User',
        duration: 50,
        success: true,
      };

      const createSpy = jest
        .spyOn(prisma.aIInteraction, 'create')
        .mockResolvedValue({
          id: '1',
          type: 'DATABASE_OPERATION',
          provider: 'DATABASE',
          model: 'findMany User',
          request: {
            operation: 'findMany',
            table: 'User',
          },
          response: null,
          duration: 50,
          success: true,
          createdAt: new Date(),
          tokensUsed: null,
          cost: null,
          error: null,
        } as never);

      await APIMonitor.logDatabaseOperation(metrics);

      expect(createSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'DATABASE_OPERATION',
          provider: 'DATABASE',
          model: 'findMany User',
          success: true,
        }),
      });
    });

    test('应该记录失败的数据库操作', async () => {
      const metrics: Omit<DatabaseMetrics, 'timestamp'> = {
        operation: 'create',
        table: 'Case',
        duration: 100,
        success: false,
        error: 'Duplicate key',
      };

      const createSpy = jest
        .spyOn(prisma.aIInteraction, 'create')
        .mockResolvedValue({
          id: '1',
          type: 'DATABASE_OPERATION',
          provider: 'DATABASE',
          model: 'create Case',
          request: {
            operation: 'create',
            table: 'Case',
          },
          response: { error: 'Duplicate key' },
          duration: 100,
          success: false,
          createdAt: new Date(),
          tokensUsed: null,
          cost: null,
          error: null,
        } as never);

      await APIMonitor.logDatabaseOperation(metrics);

      expect(createSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: false,
          response: { error: 'Duplicate key' },
        }),
      });
    });
  });

  describe('logAIOperation', () => {
    test('应该成功记录AI操作指标', async () => {
      const metrics: Omit<AIMetrics, 'timestamp'> = {
        provider: 'deepseek',
        model: 'deepseek-chat',
        operation: 'generate-debate',
        tokensUsed: 1000,
        duration: 2000,
        cost: 0.002,
        success: true,
      };

      const createSpy = jest
        .spyOn(prisma.aIInteraction, 'create')
        .mockResolvedValue({
          id: '1',
          type: 'AI_OPERATION',
          provider: 'deepseek',
          model: 'deepseek-chat',
          request: {
            operation: 'generate-debate',
          },
          response: null,
          tokensUsed: 1000,
          duration: 2000,
          cost: 0.002,
          success: true,
          createdAt: new Date(),
          error: null,
        } as never);

      await APIMonitor.logAIOperation(metrics);

      expect(createSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'AI_OPERATION',
          provider: 'deepseek',
          model: 'deepseek-chat',
          tokensUsed: 1000,
          cost: 0.002,
          success: true,
        }),
      });
    });

    test('应该记录失败的AI操作', async () => {
      const metrics: Omit<AIMetrics, 'timestamp'> = {
        provider: 'zhipu',
        operation: 'analyze-document',
        duration: 1000,
        success: false,
        error: 'Rate limit exceeded',
      };

      const createSpy = jest
        .spyOn(prisma.aIInteraction, 'create')
        .mockResolvedValue({
          id: '1',
          type: 'AI_OPERATION',
          provider: 'zhipu',
          model: undefined,
          request: {
            operation: 'analyze-document',
          },
          response: { error: 'Rate limit exceeded' },
          tokensUsed: undefined,
          duration: 1000,
          cost: undefined,
          success: false,
          createdAt: new Date(),
          error: null,
        } as never);

      await APIMonitor.logAIOperation(metrics);

      expect(createSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: false,
          response: { error: 'Rate limit exceeded' },
        }),
      });
    });
  });

  describe('logBusinessEvent', () => {
    test('应该成功记录业务事件', async () => {
      const metrics: Omit<BusinessMetrics, 'timestamp'> = {
        eventType: 'CASE_CREATED',
        entityType: 'Case',
        entityId: 'case123',
        userId: 'user123',
        details: { title: 'Test case' },
      };

      const createSpy = jest
        .spyOn(prisma.aIInteraction, 'create')
        .mockResolvedValue({
          id: '1',
          type: 'BUSINESS_EVENT',
          provider: 'SYSTEM',
          model: 'CASE_CREATED',
          request: {
            entityType: 'Case',
            entityId: 'case123',
            userId: 'user123',
            details: { title: 'Test case' },
          },
          success: true,
          createdAt: new Date(),
          tokensUsed: null,
          cost: null,
          duration: null,
          error: null,
          response: null,
        } as never);

      await APIMonitor.logBusinessEvent(metrics);

      expect(createSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'BUSINESS_EVENT',
          provider: 'SYSTEM',
          model: 'CASE_CREATED',
          success: true,
        }),
      });
    });

    test('应该记录没有用户的业务事件', async () => {
      const metrics: Omit<BusinessMetrics, 'timestamp'> = {
        eventType: 'SYSTEM_STARTUP',
        entityType: 'System',
        entityId: 'system1',
        details: { version: '1.0.0' },
      };

      const createSpy = jest
        .spyOn(prisma.aIInteraction, 'create')
        .mockResolvedValue({
          id: '1',
          type: 'BUSINESS_EVENT',
          provider: 'SYSTEM',
          model: 'SYSTEM_STARTUP',
          request: {
            entityType: 'System',
            entityId: 'system1',
            details: { version: '1.0.0' },
          },
          success: true,
          createdAt: new Date(),
          tokensUsed: null,
          cost: null,
          duration: null,
          error: null,
          response: null,
        } as never);

      await APIMonitor.logBusinessEvent(metrics);

      expect(createSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          request: expect.objectContaining({
            userId: undefined,
          }),
        }),
      });
    });
  });

  describe('getAPIStats', () => {
    test('应该返回API性能统计', async () => {
      const mockInteractions = [
        {
          id: '1',
          type: 'API_REQUEST',
          model: 'GET /api/users',
          success: true,
          duration: 100,
          createdAt: new Date(),
          tokensUsed: null,
          cost: null,
          error: null,
          request: {},
          response: null,
          provider: '',
        },
        {
          id: '2',
          type: 'API_REQUEST',
          model: 'POST /api/users',
          success: false,
          duration: 200,
          createdAt: new Date(),
          tokensUsed: null,
          cost: null,
          error: null,
          request: {},
          response: null,
          provider: '',
        },
        {
          id: '3',
          type: 'API_REQUEST',
          model: 'GET /api/users',
          success: true,
          duration: 150,
          createdAt: new Date(),
          tokensUsed: null,
          cost: null,
          error: null,
          request: {},
          response: null,
          provider: '',
        },
      ];

      jest
        .spyOn(prisma.aIInteraction, 'findMany')
        .mockResolvedValue(mockInteractions as never);

      const stats = await APIMonitor.getAPIStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.errorRate).toBe(1 / 3);
      expect(stats.averageResponseTime).toBeCloseTo(150);
      expect(stats.topEndpoints).toHaveLength(2);
      expect(stats.topEndpoints[0].endpoint).toBe('GET /api/users');
      expect(stats.topEndpoints[0].count).toBe(2);
      expect(stats.topEndpoints[0].avgResponseTime).toBe(125);
      expect(stats.topEndpoints[1].endpoint).toBe('POST /api/users');
      expect(stats.topEndpoints[1].count).toBe(1);
    });

    test('应该支持时间范围过滤', async () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const timeRange = { start, end };

      jest.spyOn(prisma.aIInteraction, 'findMany').mockResolvedValue([]);

      await APIMonitor.getAPIStats(timeRange);

      expect(prisma.aIInteraction.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          createdAt: {
            gte: start,
            lte: end,
          },
        }),
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });
    });
  });

  describe('getAIStats', () => {
    test('应该返回AI服务统计', async () => {
      const mockInteractions = [
        {
          id: '1',
          type: 'AI_OPERATION',
          provider: 'deepseek',
          model: 'deepseek-chat',
          success: true,
          duration: 1000,
          tokensUsed: 1000,
          cost: 0.002,
          createdAt: new Date(),
          error: null,
          request: {},
          response: null,
        },
        {
          id: '2',
          type: 'AI_OPERATION',
          provider: 'zhipu',
          model: 'glm-4',
          success: true,
          duration: 2000,
          tokensUsed: 2000,
          cost: 0.004,
          createdAt: new Date(),
          error: null,
          request: {},
          response: null,
        },
        {
          id: '3',
          type: 'AI_OPERATION',
          provider: 'deepseek',
          model: 'deepseek-chat',
          success: false,
          duration: 500,
          tokensUsed: 500,
          cost: 0.001,
          createdAt: new Date(),
          error: null,
          request: {},
          response: null,
        },
      ];

      jest
        .spyOn(prisma.aIInteraction, 'findMany')
        .mockResolvedValue(mockInteractions as never);

      const stats = await APIMonitor.getAIStats();

      expect(stats.totalOperations).toBe(3);
      expect(stats.successRate).toBeCloseTo(2 / 3);
      expect(stats.averageDuration).toBeCloseTo(1166.67);
      expect(stats.totalTokens).toBe(3500);
      expect(stats.totalCost).toBeCloseTo(0.007);
      expect(stats.providerStats).toHaveLength(2);
      expect(stats.providerStats[0].provider).toBe('deepseek');
      expect(stats.providerStats[0].count).toBe(2);
    });
  });

  describe('getBusinessStats', () => {
    test('应该返回业务事件统计', async () => {
      const mockInteractions = [
        {
          id: '1',
          type: 'BUSINESS_EVENT',
          model: 'CASE_CREATED',
          request: {
            entityType: 'Case',
            entityId: 'case1',
          },
          createdAt: new Date(),
          tokensUsed: null,
          cost: null,
          success: true,
          error: null,
          response: null,
          duration: null,
          provider: '',
        },
        {
          id: '2',
          type: 'BUSINESS_EVENT',
          model: 'CASE_UPDATED',
          request: {
            entityType: 'Case',
            entityId: 'case2',
          },
          createdAt: new Date(),
          tokensUsed: null,
          cost: null,
          success: true,
          error: null,
          response: null,
          duration: null,
          provider: '',
        },
        {
          id: '3',
          type: 'BUSINESS_EVENT',
          model: 'USER_REGISTERED',
          request: {
            entityType: 'User',
            entityId: 'user1',
          },
          createdAt: new Date(),
          tokensUsed: null,
          cost: null,
          success: true,
          error: null,
          response: null,
          duration: null,
          provider: '',
        },
      ];

      jest
        .spyOn(prisma.aIInteraction, 'findMany')
        .mockResolvedValue(mockInteractions as never);

      const stats = await APIMonitor.getBusinessStats();

      expect(stats.totalEvents).toBe(3);
      expect(stats.eventTypeStats).toHaveLength(3);
      expect(stats.entityTypeStats).toHaveLength(2);
      expect(stats.entityTypeStats[0].entityType).toBe('Case');
      expect(stats.entityTypeStats[0].count).toBe(2);
    });
  });

  describe('cleanupOldData', () => {
    test('应该清理旧的监控数据', async () => {
      const deleteSpy = jest
        .spyOn(prisma.aIInteraction, 'deleteMany')
        .mockResolvedValue({ count: 10 });

      await APIMonitor.cleanupOldData(30);

      expect(deleteSpy).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
          type: {
            in: [
              'API_REQUEST',
              'DATABASE_OPERATION',
              'AI_OPERATION',
              'BUSINESS_EVENT',
            ],
          },
        },
      });
    });
  });

  describe('createPerformanceTracker', () => {
    test('应该创建性能追踪器', () => {
      const tracker = createPerformanceTracker('/api/test', 'GET');

      expect(tracker.requestId).toBeDefined();
      expect(tracker.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    test('应该计算响应时间', async () => {
      const tracker = createPerformanceTracker('/api/test', 'POST');

      jest.spyOn(APIMonitor, 'logRequest').mockResolvedValue(undefined);

      // 添加小延迟确保有时间差
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await tracker.endTime(
        200,
        'user123',
        'test-agent',
        '1.2.3.4'
      );

      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.requestId).toBeDefined();
      expect(APIMonitor.logRequest).toHaveBeenCalledWith({
        endpoint: '/api/test',
        method: 'POST',
        statusCode: 200,
        responseTime: expect.any(Number),
        userId: 'user123',
        requestId: tracker.requestId,
        userAgent: 'test-agent',
        ip: '1.2.3.4',
      });
    });
  });

  describe('monitorDatabaseQuery装饰器', () => {
    test('应该监控成功的数据库查询', async () => {
      jest
        .spyOn(APIMonitor, 'logDatabaseOperation')
        .mockResolvedValue(undefined);

      class TestClass {
        @monitorDatabaseQuery('findMany', 'User')
        async findUsers() {
          return [{ id: '1', name: 'test' }];
        }
      }

      const instance = new TestClass();
      const result = await instance.findUsers();

      expect(result).toEqual([{ id: '1', name: 'test' }]);
      expect(APIMonitor.logDatabaseOperation).toHaveBeenCalledWith({
        operation: 'findMany',
        table: 'User',
        duration: expect.any(Number),
        success: true,
        error: undefined,
      });
    });

    test('应该监控失败的数据库查询', async () => {
      jest
        .spyOn(APIMonitor, 'logDatabaseOperation')
        .mockResolvedValue(undefined);

      class TestClass {
        @monitorDatabaseQuery('create', 'Case')
        async createCase() {
          throw new Error('Database error');
        }
      }

      const instance = new TestClass();

      await expect(instance.createCase()).rejects.toThrow('Database error');
      expect(APIMonitor.logDatabaseOperation).toHaveBeenCalledWith({
        operation: 'create',
        table: 'Case',
        duration: expect.any(Number),
        success: false,
        error: 'Database error',
      });
    });
  });

  describe('monitorAICall装饰器', () => {
    test('应该监控成功的AI调用', async () => {
      jest.spyOn(APIMonitor, 'logAIOperation').mockResolvedValue(undefined);

      class TestClass {
        @monitorAICall('deepseek', 'generate-debate', 'deepseek-chat')
        async generateDebate() {
          return {
            tokensUsed: 1000,
            cost: 0.002,
            result: 'debate content',
          };
        }
      }

      const instance = new TestClass();
      const result = await instance.generateDebate();

      expect(result).toEqual({
        tokensUsed: 1000,
        cost: 0.002,
        result: 'debate content',
      });
      expect(APIMonitor.logAIOperation).toHaveBeenCalledWith({
        provider: 'deepseek',
        model: 'deepseek-chat',
        operation: 'generate-debate',
        tokensUsed: 1000,
        cost: 0.002,
        duration: expect.any(Number),
        success: true,
        error: undefined,
      });
    });

    test('应该监控失败的AI调用', async () => {
      jest.spyOn(APIMonitor, 'logAIOperation').mockResolvedValue(undefined);

      class TestClass {
        @monitorAICall('zhipu', 'analyze-document')
        async analyzeDocument() {
          throw new Error('AI service error');
        }
      }

      const instance = new TestClass();

      await expect(instance.analyzeDocument()).rejects.toThrow(
        'AI service error'
      );
      expect(APIMonitor.logAIOperation).toHaveBeenCalledWith({
        provider: 'zhipu',
        model: undefined,
        operation: 'analyze-document',
        tokensUsed: undefined,
        cost: undefined,
        duration: expect.any(Number),
        success: false,
        error: 'AI service error',
      });
    });
  });
});
