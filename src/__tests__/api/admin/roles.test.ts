/**
 * 角色管理API测试
 */

import { NextRequest } from 'next/server';

// Mock Prisma
const mockPrisma = {
  role: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    count: jest.fn(),
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock Auth middleware
const mockGetAuthUser = jest.fn();
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: mockGetAuthUser,
}));

// Mock Permission middleware
const mockValidatePermissions = jest.fn();
jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: mockValidatePermissions,
}));

// =============================================================================
// 测试工具函数
// =============================================================================

function createMockRequest(
  url: string,
  method: string = 'GET',
  body?: Record<string, unknown>
): NextRequest {
  const request = new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (body) {
    request.json = async () => body;
  }

  return request;
}

// =============================================================================
// GET /api/admin/roles 测试
// =============================================================================

describe('GET /api/admin/roles', () => {
  // 在每个测试套件中动态导入
  let GET: (request: NextRequest) => Promise<ReturnType<typeof Response.json>>;

  beforeAll(async () => {
    const route = await import('@/app/api/admin/roles/route');
    GET = route.GET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('未认证用户应返回401', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const request = createMockRequest('http://localhost:3000/api/admin/roles');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('未认证');
  });

  test('无权限用户应返回403', async () => {
    mockGetAuthUser.mockResolvedValue({ id: '1', email: 'test@example.com' });
    mockValidatePermissions.mockResolvedValue(
      Response.json({ error: '无权限', message: '无权限访问' }, { status: 403 })
    );

    const request = createMockRequest('http://localhost:3000/api/admin/roles');
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  test('应成功返回角色列表', async () => {
    mockGetAuthUser.mockResolvedValue({ id: '1', email: 'admin@example.com' });
    mockValidatePermissions.mockResolvedValue(null);

    const mockRoles = [
      {
        id: '1',
        name: 'USER',
        description: '普通用户',
        isDefault: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        permissions: [
          {
            permission: {
              id: 'p1',
              name: 'case:read',
              description: '读取案件',
              resource: 'case',
              action: 'read',
            },
          },
        ],
      },
    ];

    mockPrisma.role.count.mockResolvedValue(1);
    mockPrisma.role.findMany.mockResolvedValue(mockRoles);
    mockPrisma.user.count.mockResolvedValue(5);

    const request = createMockRequest('http://localhost:3000/api/admin/roles');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.roles).toHaveLength(1);
    expect(data.data.pagination.total).toBe(1);
    expect(data.data.roles[0].userCount).toBe(5);
  });

  test('应支持分页', async () => {
    mockGetAuthUser.mockResolvedValue({ id: '1', email: 'admin@example.com' });
    mockValidatePermissions.mockResolvedValue(null);

    mockPrisma.role.count.mockResolvedValue(100);
    mockPrisma.role.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    const request = createMockRequest(
      'http://localhost:3000/api/admin/roles?page=2&limit=10'
    );
    await GET(request);

    expect(mockPrisma.role.findMany).toHaveBeenCalledWith({
      where: {},
      skip: 10,
      take: 10,
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  });

  test('应支持搜索', async () => {
    mockGetAuthUser.mockResolvedValue({ id: '1', email: 'admin@example.com' });
    mockValidatePermissions.mockResolvedValue(null);

    mockPrisma.role.count.mockResolvedValue(1);
    mockPrisma.role.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    const request = createMockRequest(
      'http://localhost:3000/api/admin/roles?search=ADMIN'
    );
    await GET(request);

    const calledWith = mockPrisma.role.findMany.mock.calls[0][0];
    expect(calledWith.where.OR).toBeDefined();
    expect(calledWith.where.OR).toHaveLength(2);
    expect(calledWith.where.OR[0].name.contains).toBe('ADMIN');
    expect(calledWith.where.OR[0].name.mode).toBe('insensitive');
  });

  test('应处理服务器错误', async () => {
    mockGetAuthUser.mockResolvedValue({ id: '1', email: 'admin@example.com' });
    mockValidatePermissions.mockResolvedValue(null);

    mockPrisma.role.count.mockRejectedValue(new Error('Database error'));

    const request = createMockRequest('http://localhost:3000/api/admin/roles');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('服务器错误');
  });
});

// =============================================================================
// POST /api/admin/roles 测试
// =============================================================================

describe('POST /api/admin/roles', () => {
  let POST: (request: NextRequest) => Promise<ReturnType<typeof Response.json>>;

  beforeAll(async () => {
    const route = await import('@/app/api/admin/roles/route');
    POST = route.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('未认证用户应返回401', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const request = createMockRequest(
      'http://localhost:3000/api/admin/roles',
      'POST',
      { name: 'TEST_ROLE' }
    );
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  test('无权限用户应返回403', async () => {
    mockGetAuthUser.mockResolvedValue({ id: '1', email: 'test@example.com' });
    mockValidatePermissions.mockResolvedValue(
      Response.json({ error: '无权限', message: '无权限访问' }, { status: 403 })
    );

    const request = createMockRequest(
      'http://localhost:3000/api/admin/roles',
      'POST',
      { name: 'TEST_ROLE' }
    );
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  test('角色名称为空应返回400', async () => {
    mockGetAuthUser.mockResolvedValue({ id: '1', email: 'admin@example.com' });
    mockValidatePermissions.mockResolvedValue(null);

    const request = createMockRequest(
      'http://localhost:3000/api/admin/roles',
      'POST',
      { name: '' }
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toBe('角色名称不能为空');
  });

  test('角色名称已存在应返回409', async () => {
    mockGetAuthUser.mockResolvedValue({ id: '1', email: 'admin@example.com' });
    mockValidatePermissions.mockResolvedValue(null);

    mockPrisma.role.findUnique.mockResolvedValue({ id: '1', name: 'USER' });

    const request = createMockRequest(
      'http://localhost:3000/api/admin/roles',
      'POST',
      { name: 'USER' }
    );
    const response = await POST(request);

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.message).toBe('角色名称已存在');
  });

  test('应成功创建新角色', async () => {
    mockGetAuthUser.mockResolvedValue({ id: '1', email: 'admin@example.com' });
    mockValidatePermissions.mockResolvedValue(null);

    mockPrisma.role.findUnique.mockResolvedValue(null);
    mockPrisma.role.create.mockResolvedValue({
      id: '1',
      name: 'TEST_ROLE',
      description: '测试角色',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createMockRequest(
      'http://localhost:3000/api/admin/roles',
      'POST',
      {
        name: 'TEST_ROLE',
        description: '测试角色',
        isDefault: false,
      }
    );
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.message).toBe('角色创建成功');
    expect(data.data.name).toBe('TEST_ROLE');
    expect(mockPrisma.role.create).toHaveBeenCalledWith({
      data: {
        name: 'TEST_ROLE',
        description: '测试角色',
        isDefault: false,
      },
    });
  });

  test('应处理服务器错误', async () => {
    mockGetAuthUser.mockResolvedValue({ id: '1', email: 'admin@example.com' });
    mockValidatePermissions.mockResolvedValue(null);

    mockPrisma.role.findUnique.mockRejectedValue(new Error('Database error'));

    const request = createMockRequest(
      'http://localhost:3000/api/admin/roles',
      'POST',
      { name: 'TEST_ROLE' }
    );
    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('服务器错误');
  });
});
