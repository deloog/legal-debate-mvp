/**
 * 告警API测试
 * 测试告警列表、详情、确认和处理功能
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/alerts/route';
import { GET as getAlertDetail } from '@/app/api/admin/alerts/[id]/route';
import { POST as acknowledgeAlert } from '@/app/api/admin/alerts/[id]/acknowledge/route';
import { POST as resolveAlert } from '@/app/api/admin/alerts/[id]/resolve/route';

// =============================================================================
// Mock设置
// =============================================================================

// Mock Prisma客户端
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    alert: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    errorLog: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock权限检查中间件
jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: jest.fn(),
  ALERT_PERMISSIONS: {
    READ: 'alert:read',
    ACKNOWLEDGE: 'alert:acknowledge',
    RESOLVE: 'alert:resolve',
  },
}));

// Mock认证中间件
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { prisma } from '@/lib/db/prisma';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { getAuthUser } from '@/lib/middleware/auth';

// =============================================================================
// 测试数据
// =============================================================================

const mockAlerts = [
  {
    alertId: 'alert-1',
    ruleName: 'High Error Rate',
    severity: 'HIGH',
    status: 'TRIGGERED',
    errorMessage: 'Error rate exceeded threshold',
    errorType: 'API_ERROR',
    errorLogId: 'log-1',
    triggeredAt: '2024-01-15T10:00:00.000Z',
  },
  {
    alertId: 'alert-2',
    ruleName: 'Database Connection Failed',
    severity: 'CRITICAL',
    status: 'ACKNOWLEDGED',
    errorMessage: 'Database connection timeout',
    errorType: 'DATABASE_ERROR',
    errorLogId: 'log-2',
    triggeredAt: '2024-01-15T09:00:00.000Z',
    acknowledgedAt: '2024-01-15T09:30:00.000Z',
    acknowledgedBy: 'admin-user-id',
  },
  {
    alertId: 'alert-3',
    ruleName: 'Authentication Failure',
    severity: 'MEDIUM',
    status: 'RESOLVED',
    errorMessage: 'Multiple auth failures',
    errorType: 'AUTHENTICATION_ERROR',
    errorLogId: 'log-3',
    triggeredAt: '2024-01-14T15:00:00.000Z',
    acknowledgedAt: '2024-01-14T16:00:00.000Z',
    acknowledgedBy: 'admin-user-id',
    resolvedAt: '2024-01-14T17:00:00.000Z',
    resolutionNotes: 'Fixed authentication bug',
  },
];

const mockErrorLog = {
  id: 'log-1',
  errorType: 'API_ERROR',
  errorCode: 'API_500',
  message: 'Test error',
  stackTrace: 'Error: Test error\n    at test.js:10:5',
};

const mockUser = {
  userId: 'admin-user-id',
  email: 'admin@example.com',
  role: 'ADMIN',
};

// =============================================================================
// 辅助函数
// =============================================================================

function setupMocks({
  isAuthenticated = true,
  hasPermission = true,
  alerts = mockAlerts,
  totalCount = mockAlerts.length,
  alert = mockAlerts[0],
  errorLog = null as typeof mockErrorLog | null,
}: {
  isAuthenticated?: boolean;
  hasPermission?: boolean;
  alerts?: typeof mockAlerts;
  totalCount?: number;
  alert?: (typeof mockAlerts)[0];
  errorLog?: typeof mockErrorLog | null;
} = {}) {
  // Mock认证
  (getAuthUser as jest.Mock).mockResolvedValue(
    isAuthenticated ? mockUser : null
  );

  // Mock权限检查
  (validatePermissions as jest.Mock).mockResolvedValue(
    hasPermission ? null : Response.json({ error: '权限不足' }, { status: 403 })
  );

  // Mock数据库查询
  (prisma.alert.findMany as jest.Mock).mockResolvedValue(alerts);
  (prisma.alert.count as jest.Mock).mockResolvedValue(totalCount);
  (prisma.alert.findUnique as jest.Mock).mockResolvedValue(alert);
  (prisma.errorLog.findUnique as jest.Mock).mockResolvedValue(errorLog);
}

function createAlertRequest(
  path: string,
  queryParams?: Record<string, string>
) {
  const searchParams = new URLSearchParams(queryParams).toString();
  const url = `http://localhost:3000${path}${
    searchParams ? `?${searchParams}` : ''
  }`;
  return new NextRequest(url, {
    headers: {
      'content-type': 'application/json',
    },
  });
}

// =============================================================================
// 测试用例
// =============================================================================

describe('告警API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /api/admin/alerts', () => {
    test('成功获取告警列表', async () => {
      setupMocks();
      const request = createAlertRequest('/api/admin/alerts');
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data[0].alertId).toBe(mockAlerts[0].alertId);
      expect(result.total).toBe(3);
      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 0,
          orderBy: { triggeredAt: 'desc' },
        })
      );
    });

    test('应正确处理分页参数', async () => {
      setupMocks();
      const request = createAlertRequest('/api/admin/alerts', {
        page: '2',
        pageSize: '20',
      });
      await GET(request);

      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 20,
        })
      );
    });

    test('应按严重程度筛选', async () => {
      setupMocks({
        alerts: [mockAlerts[1]],
        totalCount: 1,
      });
      const request = createAlertRequest('/api/admin/alerts', {
        severity: 'CRITICAL',
      });
      await GET(request);

      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { severity: 'CRITICAL' },
        })
      );
    });

    test('应按状态筛选', async () => {
      setupMocks({
        alerts: [mockAlerts[2]],
        totalCount: 1,
      });
      const request = createAlertRequest('/api/admin/alerts', {
        status: 'RESOLVED',
      });
      await GET(request);

      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'RESOLVED' },
        })
      );
    });

    test('应按错误类型筛选', async () => {
      setupMocks({
        alerts: [mockAlerts[1]],
        totalCount: 1,
      });
      const request = createAlertRequest('/api/admin/alerts', {
        errorType: 'DATABASE_ERROR',
      });
      await GET(request);

      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { errorType: 'DATABASE_ERROR' },
        })
      );
    });

    test('应支持组合筛选', async () => {
      setupMocks({
        alerts: [],
        totalCount: 0,
      });
      const request = createAlertRequest('/api/admin/alerts', {
        severity: 'CRITICAL',
        status: 'TRIGGERED',
      });
      await GET(request);

      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            severity: 'CRITICAL',
            status: 'TRIGGERED',
          },
        })
      );
    });

    test('未认证时应返回403错误', async () => {
      setupMocks({ hasPermission: false });
      const request = createAlertRequest('/api/admin/alerts');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    test('应处理数据库错误', async () => {
      setupMocks();
      (prisma.alert.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createAlertRequest('/api/admin/alerts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('获取告警列表失败');
    });

    test('应记录错误日志', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      setupMocks();
      (prisma.alert.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = createAlertRequest('/api/admin/alerts');
      await GET(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '获取告警列表失败:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('GET /api/admin/alerts/[id]', () => {
    test('成功获取告警详情', async () => {
      setupMocks({ alert: mockAlerts[0], errorLog: mockErrorLog });
      const request = createAlertRequest('/api/admin/alerts/alert-1');

      const response = await getAlertDetail(request, {
        params: { id: 'alert-1' },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.alert).toEqual(mockAlerts[0]);
      expect(result.data.errorLog).toEqual(mockErrorLog);
    });

    test('告警不存在时返回404', async () => {
      setupMocks({ alert: null });
      const request = createAlertRequest('/api/admin/alerts/non-existent');

      const response = await getAlertDetail(request, {
        params: { id: 'non-existent' },
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('告警不存在');
    });

    test('未认证时应返回403错误', async () => {
      setupMocks({ hasPermission: false });
      const request = createAlertRequest('/api/admin/alerts/alert-1');

      const response = await getAlertDetail(request, {
        params: { id: 'alert-1' },
      });

      expect(response.status).toBe(403);
    });

    test('应处理数据库错误', async () => {
      setupMocks();
      (prisma.alert.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createAlertRequest('/api/admin/alerts/alert-1');

      const response = await getAlertDetail(request, {
        params: { id: 'alert-1' },
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('获取告警详情失败');
    });
  });

  describe('POST /api/admin/alerts/[id]/acknowledge', () => {
    test('成功确认告警', async () => {
      const updatedAlert = {
        ...mockAlerts[0],
        status: 'ACKNOWLEDGED',
        acknowledgedBy: 'admin-user-id',
        acknowledgedAt: new Date().toISOString(),
      };

      setupMocks({ alert: mockAlerts[0] });
      (prisma.alert.update as jest.Mock).mockResolvedValue(updatedAlert);

      const request = createAlertRequest(
        '/api/admin/alerts/alert-1/acknowledge'
      );
      const response = await acknowledgeAlert(request, {
        params: { id: 'alert-1' },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.message).toBe('告警已确认');
      expect(result.data).toEqual(updatedAlert);
    });

    test('不应确认已确认的告警', async () => {
      setupMocks({ alert: mockAlerts[1] });

      const request = createAlertRequest(
        '/api/admin/alerts/alert-2/acknowledge'
      );
      const response = await acknowledgeAlert(request, {
        params: { id: 'alert-2' },
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('告警状态不正确，无法确认');
    });

    test('告警不存在时返回404', async () => {
      setupMocks({ alert: null });

      const request = createAlertRequest(
        '/api/admin/alerts/non-existent/acknowledge'
      );
      const response = await acknowledgeAlert(request, {
        params: { id: 'non-existent' },
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('告警不存在');
    });

    test('未认证时应返回403错误', async () => {
      setupMocks({ hasPermission: false });

      const request = createAlertRequest(
        '/api/admin/alerts/alert-1/acknowledge'
      );
      const response = await acknowledgeAlert(request, {
        params: { id: 'alert-1' },
      });

      expect(response.status).toBe(403);
    });

    test('应处理数据库错误', async () => {
      setupMocks({ alert: mockAlerts[0] });
      (prisma.alert.update as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createAlertRequest(
        '/api/admin/alerts/alert-1/acknowledge'
      );
      const response = await acknowledgeAlert(request, {
        params: { id: 'alert-1' },
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('确认告警失败');
    });

    test('应记录错误日志', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      setupMocks({ alert: mockAlerts[0] });
      (prisma.alert.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = createAlertRequest(
        '/api/admin/alerts/alert-1/acknowledge'
      );
      await acknowledgeAlert(request, {
        params: { id: 'alert-1' },
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '确认告警失败:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('POST /api/admin/alerts/[id]/resolve', () => {
    test('成功处理告警', async () => {
      const updatedAlert = {
        ...mockAlerts[0],
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
        resolutionNotes: 'Fixed issue',
      };

      setupMocks({ alert: mockAlerts[0] });
      (prisma.alert.update as jest.Mock).mockResolvedValue(updatedAlert);

      const request = createAlertRequest('/api/admin/alerts/alert-1/resolve');
      const response = await resolveAlert(request, {
        params: { id: 'alert-1' },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.message).toBe('告警已处理');
      expect(result.data.resolutionNotes).toBe('Fixed issue');
    });

    test('不应处理已解决的告警', async () => {
      setupMocks({ alert: mockAlerts[2] });

      const request = createAlertRequest('/api/admin/alerts/alert-3/resolve');
      const response = await resolveAlert(request, {
        params: { id: 'alert-3' },
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('告警已处理');
    });

    test('应能处理已确认的告警', async () => {
      const updatedAlert = {
        ...mockAlerts[1],
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
        resolutionNotes: null,
      };

      setupMocks({ alert: mockAlerts[1] });
      (prisma.alert.update as jest.Mock).mockResolvedValue(updatedAlert);

      const request = createAlertRequest('/api/admin/alerts/alert-2/resolve');
      const response = await resolveAlert(request, {
        params: { id: 'alert-2' },
      });

      expect(response.status).toBe(200);
      expect(response.body).toBeTruthy();
    });

    test('告警不存在时返回404', async () => {
      setupMocks({ alert: null });

      const request = createAlertRequest(
        '/api/admin/alerts/non-existent/resolve'
      );
      const response = await resolveAlert(request, {
        params: { id: 'non-existent' },
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('告警不存在');
    });

    test('未认证时应返回403错误', async () => {
      setupMocks({ hasPermission: false });

      const request = createAlertRequest('/api/admin/alerts/alert-1/resolve');
      const response = await resolveAlert(request, {
        params: { id: 'alert-1' },
      });

      expect(response.status).toBe(403);
    });

    test('应处理数据库错误', async () => {
      setupMocks({ alert: mockAlerts[0] });
      (prisma.alert.update as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createAlertRequest('/api/admin/alerts/alert-1/resolve');
      const response = await resolveAlert(request, {
        params: { id: 'alert-1' },
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('处理告警失败');
    });

    test('应记录错误日志', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      setupMocks({ alert: mockAlerts[0] });
      (prisma.alert.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = createAlertRequest('/api/admin/alerts/alert-1/resolve');
      await resolveAlert(request, {
        params: { id: 'alert-1' },
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '处理告警失败:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    test('应接受处理备注', async () => {
      const updatedAlert = {
        ...mockAlerts[0],
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
        resolutionNotes: 'Detailed resolution notes',
      };

      setupMocks({ alert: mockAlerts[0] });
      (prisma.alert.update as jest.Mock).mockResolvedValue(updatedAlert);

      const request = createAlertRequest('/api/admin/alerts/alert-1/resolve');
      const response = await resolveAlert(request, {
        params: { id: 'alert-1' },
      });

      expect(response.status).toBe(200);
    });

    test('应处理缺少JSON体的情况', async () => {
      const updatedAlert = {
        ...mockAlerts[0],
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
        resolutionNotes: null,
      };

      setupMocks({ alert: mockAlerts[0] });
      (prisma.alert.update as jest.Mock).mockResolvedValue(updatedAlert);

      const request = createAlertRequest('/api/admin/alerts/alert-1/resolve');
      const response = await resolveAlert(request, {
        params: { id: 'alert-1' },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('权限和认证', () => {
    test('所有端点都需要认证', async () => {
      setupMocks({ hasPermission: false });

      // Test list endpoint
      let request = createAlertRequest('/api/admin/alerts');
      let response = await GET(request);
      expect(response.status).toBe(403);

      // Test detail endpoint
      request = createAlertRequest('/api/admin/alerts/alert-1');
      response = await getAlertDetail(request, {
        params: { id: 'alert-1' },
      });
      expect(response.status).toBe(403);

      // Test acknowledge endpoint
      request = createAlertRequest('/api/admin/alerts/alert-1/acknowledge');
      response = await acknowledgeAlert(request, {
        params: { id: 'alert-1' },
      });
      expect(response.status).toBe(403);

      // Test resolve endpoint
      request = createAlertRequest('/api/admin/alerts/alert-1/resolve');
      response = await resolveAlert(request, {
        params: { id: 'alert-1' },
      });
      expect(response.status).toBe(403);
    });
  });
});
