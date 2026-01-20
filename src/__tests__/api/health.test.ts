import { GET as HealthGET, HEAD as HealthHEAD } from '@/app/api/health/route';
import { GET as DepsGET } from '@/app/api/health/deps/route';
import { checkDatabaseConnection, getConnectionInfo } from '@/lib/db/prisma';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import {
  createMockRequest,
  createTestResponse,
  assertions,
} from './test-utils';

// Mock数据库和AI服务
jest.mock('@/lib/db/prisma', () => ({
  checkDatabaseConnection: jest.fn(),
  getConnectionInfo: jest.fn(),
}));

jest.mock('@/lib/ai/service-refactored', () => ({
  AIServiceFactory: {
    getInstance: jest.fn(),
  },
}));

describe('Health API', () => {
  describe('GET /api/health', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('应返回健康状态当所有服务正常', async () => {
      // Mock数据库连接正常
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(true);
      (getConnectionInfo as jest.Mock).mockResolvedValue({
        active_connections: 5,
        total_connections: 100,
      });

      // Mock AI服务正常
      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: true,
          providerStatus: {
            deepseek: {
              provider: 'deepseek',
              healthy: true,
              responseTime: 100,
              lastCheck: Date.now(),
            },
          },
        }),
        getAvailableProviders: jest.fn().mockReturnValue(['deepseek']),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest('http://localhost:3000/api/health');
      const response = await HealthGET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(200);
      expect(testResponse.data.status).toBe('healthy');
      expect(testResponse.data.services).toBeDefined();
      expect(testResponse.data.services.database.status).toBe('healthy');
      expect(testResponse.data.services.ai.status).toBe('healthy');
      expect(testResponse.data.system).toBeDefined();
      expect(testResponse.data.system.uptime).toBeGreaterThan(0);
      expect(testResponse.data.system.memory).toBeDefined();
      expect(testResponse.data.system.nodeVersion).toBeDefined();
    });

    it('应返回不健康状态当数据库连接失败', async () => {
      // Mock数据库连接失败
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(false);

      // Mock AI服务正常
      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: true,
          providerStatus: {},
        }),
        getAvailableProviders: jest.fn().mockReturnValue([]),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest('http://localhost:3000/api/health');
      const response = await HealthGET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(503);
      expect(testResponse.data.status).toBe('unhealthy');
      expect(testResponse.data.services.database.status).toBe('unhealthy');
    });

    it('应返回不健康状态当AI服务不可用', async () => {
      // Mock数据库连接正常
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(true);
      (getConnectionInfo as jest.Mock).mockResolvedValue({
        active_connections: 5,
      });

      // Mock AI服务不可用
      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(false),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: false,
          providerStatus: {},
        }),
        getAvailableProviders: jest.fn().mockReturnValue([]),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest('http://localhost:3000/api/health');
      const response = await HealthGET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(503);
      expect(testResponse.data.status).toBe('unhealthy');
      expect(testResponse.data.services.ai.status).toBe('unhealthy');
    });

    it('应包含数据库连接信息', async () => {
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(true);
      (getConnectionInfo as jest.Mock).mockResolvedValue({
        active_connections: 10,
        total_connections: 100,
      });

      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: true,
          providerStatus: {},
        }),
        getAvailableProviders: jest.fn().mockReturnValue([]),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest('http://localhost:3000/api/health');
      const response = await HealthGET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.services.database.connectionInfo).toBeDefined();
      expect(
        testResponse.data.services.database.connectionInfo.activeConnections
      ).toBe(10);
      expect(
        testResponse.data.services.database.connectionInfo.totalConnections
      ).toBe(100);
    });

    it('应包含AI服务提供商信息', async () => {
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(true);

      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: true,
          providerStatus: {
            deepseek: {
              provider: 'deepseek',
              healthy: true,
              responseTime: 150,
              lastCheck: Date.now(),
            },
            zhipu: {
              provider: 'zhipu',
              healthy: true,
              responseTime: 120,
              lastCheck: Date.now(),
            },
          },
        }),
        getAvailableProviders: jest.fn().mockReturnValue(['deepseek', 'zhipu']),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest('http://localhost:3000/api/health');
      const response = await HealthGET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.services.ai.providers).toBeDefined();
      expect(testResponse.data.services.ai.providers).toHaveLength(2);
      expect(testResponse.data.services.ai.availableProviders).toEqual([
        'deepseek',
        'zhipu',
      ]);
      expect(testResponse.data.services.ai.availableModels).toEqual([
        'deepseek-chat',
        'glm-4',
      ]);
    });

    it('应包含响应时间信息', async () => {
      (checkDatabaseConnection as jest.Mock).mockImplementation(async () => {
        // 模拟延迟
        await new Promise(resolve => setTimeout(resolve, 10));
        return true;
      });
      (getConnectionInfo as jest.Mock).mockResolvedValue({
        active_connections: 5,
      });

      const mockAIService = {
        healthCheck: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return true;
        }),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: true,
          providerStatus: {},
        }),
        getAvailableProviders: jest.fn().mockReturnValue([]),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest('http://localhost:3000/api/health');
      const response = await HealthGET(request);
      const testResponse = await createTestResponse(response);

      expect(
        testResponse.data.services.database.responseTime
      ).toBeGreaterThanOrEqual(10);
      expect(testResponse.data.services.ai.responseTime).toBeGreaterThanOrEqual(
        10
      );
    });

    it('应包含系统信息', async () => {
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(true);

      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: true,
          providerStatus: {},
        }),
        getAvailableProviders: jest.fn().mockReturnValue([]),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest('http://localhost:3000/api/health');
      const response = await HealthGET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.system).toBeDefined();
      expect(testResponse.data.system.uptime).toBeGreaterThan(0);
      expect(testResponse.data.system.memory).toBeDefined();
      expect(testResponse.data.system.memory.used).toBeGreaterThan(0);
      expect(testResponse.data.system.memory.total).toBeGreaterThan(0);
      expect(testResponse.data.system.cpu).toBeDefined();
      expect(testResponse.data.system.nodeVersion).toBeDefined();
      expect(testResponse.data.system.platform).toBeDefined();
      expect(testResponse.data.system.arch).toBeDefined();
      expect(testResponse.data.system.environment).toBeDefined();
    });

    it('应包含响应headers', async () => {
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(true);

      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: true,
          providerStatus: {},
        }),
        getAvailableProviders: jest.fn().mockReturnValue([]),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest('http://localhost:3000/api/health');
      const response = await HealthGET(request);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('HEAD /api/health', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('应返回200状态当所有服务正常', async () => {
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(true);

      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest('http://localhost:3000/api/health', {
        method: 'HEAD',
      });
      const response = await HealthHEAD(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('');
    });

    it('应返回503状态当服务异常', async () => {
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(false);
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue({
        healthCheck: jest.fn().mockResolvedValue(true),
      });

      const request = createMockRequest('http://localhost:3000/api/health', {
        method: 'HEAD',
      });
      const response = await HealthHEAD(request);

      expect(response.status).toBe(503);
    });

    it('HEAD请求不应包含Content-Type头', async () => {
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(true);

      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest('http://localhost:3000/api/health', {
        method: 'HEAD',
      });
      const response = await HealthHEAD(request);

      expect(response.headers.get('Content-Type')).toBeUndefined();
    });
  });

  describe('GET /api/health/deps', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('应返回依赖服务健康状态', async () => {
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(true);
      (getConnectionInfo as jest.Mock).mockResolvedValue({
        active_connections: 5,
        total_connections: 100,
      });

      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: true,
          providerStatus: {
            deepseek: {
              provider: 'deepseek',
              healthy: true,
              responseTime: 100,
              lastCheck: Date.now(),
            },
          },
        }),
        getAvailableProviders: jest.fn().mockReturnValue(['deepseek']),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest(
        'http://localhost:3000/api/health/deps'
      );
      const response = await DepsGET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(200);
      expect(testResponse.data.status).toBe('healthy');
      expect(testResponse.data.dependencies).toBeDefined();
      expect(testResponse.data.dependencies.database).toBeDefined();
      expect(testResponse.data.dependencies.ai).toBeDefined();
      expect(testResponse.data.summary).toBeDefined();
      expect(testResponse.data.summary.total).toBe(2);
      expect(testResponse.data.summary.healthy).toBe(2);
      expect(testResponse.data.summary.degraded).toBe(0);
      expect(testResponse.data.summary.unhealthy).toBe(0);
    });

    it('应正确统计不健康的服务', async () => {
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(false);

      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: true,
          providerStatus: {},
        }),
        getAvailableProviders: jest.fn().mockReturnValue([]),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest(
        'http://localhost:3000/api/health/deps'
      );
      const response = await DepsGET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(503);
      expect(testResponse.data.status).toBe('unhealthy');
      expect(testResponse.data.summary.healthy).toBe(1);
      expect(testResponse.data.summary.unhealthy).toBe(1);
    });

    it('应返回503状态当任何服务不健康', async () => {
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(false);

      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: true,
          providerStatus: {},
        }),
        getAvailableProviders: jest.fn().mockReturnValue([]),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest(
        'http://localhost:3000/api/health/deps'
      );
      const response = await DepsGET(request);

      expect(response.status).toBe(503);
    });

    it('应包含每个依赖服务的详细信息', async () => {
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(true);
      (getConnectionInfo as jest.Mock).mockResolvedValue({
        active_connections: 8,
        total_connections: 100,
      });

      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: true,
          providerStatus: {
            deepseek: {
              provider: 'deepseek',
              healthy: true,
              responseTime: 120,
              lastCheck: Date.now(),
            },
          },
        }),
        getAvailableProviders: jest.fn().mockReturnValue(['deepseek']),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest(
        'http://localhost:3000/api/health/deps'
      );
      const response = await DepsGET(request);
      const testResponse = await createTestResponse(response);

      // 验证数据库信息
      expect(testResponse.data.dependencies.database.status).toBe('healthy');
      expect(
        testResponse.data.dependencies.database.responseTime
      ).toBeDefined();
      expect(
        testResponse.data.dependencies.database.connectionInfo
          ?.activeConnections
      ).toBe(8);
      expect(
        testResponse.data.dependencies.database.connectionInfo?.totalConnections
      ).toBe(100);

      // 验证AI服务信息
      expect(testResponse.data.dependencies.ai.status).toBe('healthy');
      expect(testResponse.data.dependencies.ai.responseTime).toBeDefined();
      expect(testResponse.data.dependencies.ai.providers).toHaveLength(1);
      expect(testResponse.data.dependencies.ai.providers[0].provider).toBe(
        'deepseek'
      );
      expect(testResponse.data.dependencies.ai.providers[0].status).toBe(
        'healthy'
      );
    });
  });

  describe('错误处理', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('应处理数据库检查异常', async () => {
      (checkDatabaseConnection as jest.Mock).mockImplementation(() => {
        throw new Error('Database connection error');
      });

      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: true,
          providerStatus: {},
        }),
        getAvailableProviders: jest.fn().mockReturnValue([]),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest('http://localhost:3000/api/health');
      const response = await HealthGET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(503);
      expect(testResponse.data.services.database.status).toBe('unhealthy');
      expect(testResponse.data.services.database.message).toBe(
        'Database connection error'
      );
    });

    it('应处理AI服务检查异常', async () => {
      (checkDatabaseConnection as jest.Mock).mockResolvedValue(true);

      (AIServiceFactory.getInstance as jest.Mock).mockRejectedValue(
        new Error('AI service error')
      );

      const request = createMockRequest('http://localhost:3000/api/health');
      const response = await HealthGET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(503);
      expect(testResponse.data.services.ai.status).toBe('unhealthy');
      expect(testResponse.data.services.ai.message).toBe('AI service error');
    });

    it('应优雅处理未知错误', async () => {
      (checkDatabaseConnection as jest.Mock).mockImplementation(() => {
        throw 'Unknown error';
      });

      const mockAIService = {
        healthCheck: jest.fn().mockResolvedValue(true),
        getServiceStatus: jest.fn().mockReturnValue({
          initialized: true,
          healthy: true,
          providerStatus: {},
        }),
        getAvailableProviders: jest.fn().mockReturnValue([]),
      };
      (AIServiceFactory.getInstance as jest.Mock).mockResolvedValue(
        mockAIService
      );

      const request = createMockRequest('http://localhost:3000/api/health');
      const response = await HealthGET(request);
      const testResponse = await createTestResponse(response);

      // 当发生未知错误时，应返回503状态
      expect(testResponse.status).toBe(503);
      expect(testResponse.data.services.database.status).toBe('unhealthy');
    });
  });
});
