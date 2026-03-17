/**
 * 系统配置API测试
 * 覆盖GET、POST、PUT、DELETE操作
 */

import { NextRequest } from 'next/server';
import { GET, POST, PUT as PUT_BATCH } from '@/app/api/admin/configs/route';
import {
  GET as GET_BY_KEY,
  PUT,
  DELETE,
} from '@/app/api/admin/configs/[key]/route';
import { prisma } from '@/lib/db/prisma';
import {
  isValidConfigType,
  isValidConfigCategory,
  formatConfigValue,
  parseConfigValue,
} from '@/types/config';

// =============================================================================
// Mock设置
// =============================================================================

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    systemConfig: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Mock认证和权限检查
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: jest.fn(),
}));

import * as auth from '@/lib/middleware/auth';
import * as permission from '@/lib/middleware/permission-check';

const getAuthUser = auth.getAuthUser as jest.MockedFunction<
  typeof auth.getAuthUser
>;
const validatePermissions =
  permission.validatePermissions as jest.MockedFunction<
    typeof permission.validatePermissions
  >;

// =============================================================================
// 辅助函数
// =============================================================================

function mockRequest(url: string, method = 'GET', body?: unknown): NextRequest {
  const req = {
    url: `http://localhost${url}`,
    method,
    json: async () => body as unknown,
  } as unknown as NextRequest;
  return req;
}

// =============================================================================
// 工具函数测试
// =============================================================================

describe('配置工具函数', () => {
  describe('isValidConfigType', () => {
    it('应验证有效的配置类型', () => {
      expect(isValidConfigType('STRING')).toBe(true);
      expect(isValidConfigType('NUMBER')).toBe(true);
      expect(isValidConfigType('BOOLEAN')).toBe(true);
      expect(isValidConfigType('ARRAY')).toBe(true);
      expect(isValidConfigType('OBJECT')).toBe(true);
    });

    it('应拒绝无效的配置类型', () => {
      expect(isValidConfigType('INVALID')).toBe(false);
      expect(isValidConfigType('')).toBe(false);
      expect(isValidConfigType('string')).toBe(false);
    });
  });

  describe('isValidConfigCategory', () => {
    it('应验证有效的配置分类', () => {
      expect(isValidConfigCategory('general')).toBe(true);
      expect(isValidConfigCategory('ai')).toBe(true);
      expect(isValidConfigCategory('storage')).toBe(true);
      expect(isValidConfigCategory('security')).toBe(true);
      expect(isValidConfigCategory('feature')).toBe(true);
      expect(isValidConfigCategory('ui')).toBe(true);
      expect(isValidConfigCategory('notification')).toBe(true);
      expect(isValidConfigCategory('other')).toBe(true);
    });

    it('应拒绝无效的配置分类', () => {
      expect(isValidConfigCategory('INVALID')).toBe(false);
      expect(isValidConfigCategory('')).toBe(false);
      expect(isValidConfigCategory('General')).toBe(false);
    });
  });

  describe('formatConfigValue', () => {
    it('应正确格式化布尔值', () => {
      expect(formatConfigValue(true, 'BOOLEAN')).toBe('是');
      expect(formatConfigValue(false, 'BOOLEAN')).toBe('否');
    });

    it('应正确格式化对象和数组', () => {
      const obj = { key: 'value' };
      const arr = [1, 2, 3];
      expect(formatConfigValue(obj, 'OBJECT')).toBe(
        JSON.stringify(obj, null, 2)
      );
      expect(formatConfigValue(arr, 'ARRAY')).toBe(
        JSON.stringify(arr, null, 2)
      );
    });

    it('应正确格式化字符串和数字', () => {
      expect(formatConfigValue('test', 'STRING')).toBe('test');
      expect(formatConfigValue(123, 'NUMBER')).toBe('123');
    });
  });

  describe('parseConfigValue', () => {
    it('应正确解析字符串', () => {
      expect(parseConfigValue('', 'STRING')).toBe('');
      expect(parseConfigValue('123', 'STRING')).toBe('123');
    });

    it('应正确解析数字', () => {
      expect(parseConfigValue('', 'NUMBER')).toBe(NaN);
      expect(parseConfigValue('123', 'NUMBER')).toBe(123);
    });

    it('应正确解析布尔值', () => {
      expect(parseConfigValue('true', 'BOOLEAN')).toBe(true);
      expect(parseConfigValue('false', 'BOOLEAN')).toBe(false);
      expect(parseConfigValue('1', 'BOOLEAN')).toBe(true);
      expect(parseConfigValue('0', 'BOOLEAN')).toBe(false);
    });

    it('应正确解析数组', () => {
      expect(parseConfigValue('[]', 'ARRAY')).toEqual([]);
      expect(parseConfigValue('[1,2,3]', 'ARRAY')).toEqual([1, 2, 3]);
    });

    it('应正确解析对象', () => {
      expect(parseConfigValue('{}', 'OBJECT')).toEqual({});
      expect(parseConfigValue('{"key":"value"}', 'OBJECT')).toEqual({
        key: 'value',
      });
    });
  });
});

// =============================================================================
// GET /api/admin/configs 测试
// =============================================================================

describe('GET /api/admin/configs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAuthUser.mockResolvedValue({
      userId: 'user1',
      email: 'test@example.com',
      role: 'ADMIN',
    });
    validatePermissions.mockResolvedValue(null);
  });

  it('应返回配置列表（管理员权限）', async () => {
    const mockConfigs = [
      {
        id: 'config1',
        key: 'test.config1',
        value: 'value1',
        type: 'STRING',
        category: 'general',
        description: '测试配置1',
        isPublic: true,
        isRequired: false,
        defaultValue: null,
        validationRules: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    (prisma.systemConfig.count as jest.Mock).mockResolvedValue(1);
    (prisma.systemConfig.findMany as jest.Mock).mockResolvedValue(mockConfigs);

    const response = await GET(
      mockRequest('/api/admin/configs?page=1&limit=20')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.configs.length).toBe(1);
    expect(data.data.pagination.total).toBe(1);
  });

  it('应支持按分类筛选', async () => {
    (prisma.systemConfig.count as jest.Mock).mockResolvedValue(0);
    (prisma.systemConfig.findMany as jest.Mock).mockResolvedValue([]);

    const __response = await GET(mockRequest('/api/admin/configs?category=ai'));

    expect(prisma.systemConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: 'ai',
        }),
      })
    );
  });

  it('应支持按类型筛选', async () => {
    (prisma.systemConfig.count as jest.Mock).mockResolvedValue(0);
    (prisma.systemConfig.findMany as jest.Mock).mockResolvedValue([]);

    const __response = await GET(
      mockRequest('/api/admin/configs?type=BOOLEAN')
    );

    expect(prisma.systemConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'BOOLEAN',
        }),
      })
    );
  });

  it('应支持搜索功能', async () => {
    (prisma.systemConfig.count as jest.Mock).mockResolvedValue(0);
    (prisma.systemConfig.findMany as jest.Mock).mockResolvedValue([]);

    const __response = await GET(mockRequest('/api/admin/configs?search=test'));

    expect(prisma.systemConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              key: { contains: 'test', mode: 'insensitive' },
            }),
          ]),
        }),
      })
    );
  });

  it('未认证用户应返回401', async () => {
    getAuthUser.mockResolvedValue(null);

    const response = await GET(mockRequest('/api/admin/configs'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('权限不足应返回权限错误', async () => {
    validatePermissions.mockResolvedValue(
      Response.json({ error: '权限不足' }, { status: 403 }) as never
    );

    const __response = await GET(mockRequest('/api/admin/configs'));

    expect(validatePermissions).toHaveBeenCalled();
  });
});

// =============================================================================
// POST /api/admin/configs 测试
// =============================================================================

describe('POST /api/admin/configs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAuthUser.mockResolvedValue({
      userId: 'user1',
      email: 'test@example.com',
      role: 'ADMIN',
    });
    validatePermissions.mockResolvedValue(null);
  });

  it('应成功创建配置', async () => {
    const newConfig = {
      id: 'config1',
      key: 'test.new',
      value: 'value',
      type: 'STRING',
      category: 'general',
      description: '新配置',
      isPublic: false,
      isRequired: false,
      defaultValue: null,
      validationRules: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.systemConfig.create as jest.Mock).mockResolvedValue(newConfig);

    const response = await POST(
      mockRequest('/api/admin/configs', 'POST', {
        key: 'test.new',
        value: 'value',
        type: 'STRING',
        category: 'general',
        description: '新配置',
      })
    );

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe('配置创建成功');
    expect(data.data.key).toBe(newConfig.key);
  });

  it('应拒绝缺少必填字段的请求', async () => {
    const response = await POST(
      mockRequest('/api/admin/configs', 'POST', {
        key: 'test',
      })
    );

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('应拒绝无效的配置类型', async () => {
    const response = await POST(
      mockRequest('/api/admin/configs', 'POST', {
        key: 'test',
        value: 'value',
        type: 'INVALID',
        category: 'general',
      })
    );

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain('无效的配置类型');
  });

  it('应拒绝无效的配置分类', async () => {
    const response = await POST(
      mockRequest('/api/admin/configs', 'POST', {
        key: 'test',
        value: 'value',
        type: 'STRING',
        category: 'INVALID',
      })
    );

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain('无效的配置分类');
  });

  it('应拒绝类型不匹配的配置值', async () => {
    const response = await POST(
      mockRequest('/api/admin/configs', 'POST', {
        key: 'test',
        value: 'not-a-number',
        type: 'NUMBER',
        category: 'general',
      })
    );

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain('配置值类型与指定类型NUMBER不匹配');
  });

  it('应拒绝重复的配置键', async () => {
    const existingConfig = { id: 'config1', key: 'test' };
    (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(
      existingConfig
    );

    const response = await POST(
      mockRequest('/api/admin/configs', 'POST', {
        key: 'test',
        value: 'value',
        type: 'STRING',
        category: 'general',
      })
    );

    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain('配置键test已存在');
  });
});

// =============================================================================
// PUT /api/admin/configs 测试（批量更新）
// =============================================================================

describe('PUT /api/admin/configs (批量更新)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAuthUser.mockResolvedValue({
      userId: 'user1',
      email: 'test@example.com',
      role: 'ADMIN',
    });
    validatePermissions.mockResolvedValue(null);
  });

  it('应成功批量更新配置', async () => {
    const existingConfigs = [
      { id: 'config1', key: 'test.config1', type: 'STRING', isRequired: false },
      { id: 'config2', key: 'test.config2', type: 'NUMBER', isRequired: false },
    ];

    (prisma.systemConfig.findUnique as jest.Mock)
      .mockResolvedValueOnce(existingConfigs[0])
      .mockResolvedValueOnce(existingConfigs[1]);
    (prisma.systemConfig.update as jest.Mock)
      .mockResolvedValueOnce({ ...existingConfigs[0], value: 'new value1' })
      .mockResolvedValueOnce({ ...existingConfigs[1], value: 'new value2' });

    const response = await PUT_BATCH(
      mockRequest('/api/admin/configs', 'PUT', {
        configs: [
          { key: 'test.config1', value: 'new value1' },
          { key: 'test.config2', value: 'new value2' },
        ],
      })
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('批量更新完成');
    expect(data.data.updated).toBeGreaterThanOrEqual(1);
  });

  it('应拒绝缺少configs数组的请求', async () => {
    const response = await PUT_BATCH(
      mockRequest('/api/admin/configs', 'PUT', {})
    );

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('应处理部分更新失败的情况', async () => {
    (prisma.systemConfig.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'config1',
        key: 'test.config1',
        type: 'STRING',
        isRequired: false,
      })
      .mockResolvedValueOnce(null); // 第二个配置不存在
    (prisma.systemConfig.update as jest.Mock).mockResolvedValue({
      id: 'config1',
      key: 'test.config1',
      value: 'new value',
    });

    const response = await PUT_BATCH(
      mockRequest('/api/admin/configs', 'PUT', {
        configs: [
          { key: 'test.config1', value: 'new value' },
          { key: 'test.config2', value: 'new value2' }, // 不存在
        ],
      })
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.updated).toBe(1);
    expect(data.data.failed).toBeGreaterThanOrEqual(1);
    expect(data.data.errors).toBeDefined();
  });
});

// =============================================================================
// GET /api/admin/configs/[key] 测试
// =============================================================================

describe('GET /api/admin/configs/[key]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAuthUser.mockResolvedValue({
      userId: 'user1',
      email: 'test@example.com',
      role: 'ADMIN',
    });
    validatePermissions.mockResolvedValue(null);
  });

  it('应返回单个配置', async () => {
    const config = {
      id: 'config1',
      key: 'test.config1',
      value: 'value1',
      type: 'STRING',
      category: 'general',
      description: '测试配置',
      isPublic: true,
      isRequired: false,
      defaultValue: null,
      validationRules: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(config);

    const response = await GET_BY_KEY(
      mockRequest('/api/admin/configs/test.config1'),
      {
        params: Promise.resolve({ key: 'test.config1' }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.key).toBe(config.key);
  });

  it('配置不存在应返回404', async () => {
    (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await GET_BY_KEY(
      mockRequest('/api/admin/configs/nonexistent'),
      {
        params: Promise.resolve({ key: 'nonexistent' }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('未找到');
  });
});

// =============================================================================
// PUT /api/admin/configs/[key] 测试
// =============================================================================

describe('PUT /api/admin/configs/[key]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAuthUser.mockResolvedValue({
      userId: 'user1',
      email: 'test@example.com',
      role: 'ADMIN',
    });
    validatePermissions.mockResolvedValue(null);
  });

  it('应成功更新配置', async () => {
    const existingConfig = {
      id: 'config1',
      key: 'test.config1',
      type: 'STRING',
      isRequired: false,
    };

    const updatedConfig = {
      ...existingConfig,
      value: 'new value',
      description: '更新后的描述',
    };

    (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(
      existingConfig
    );
    (prisma.systemConfig.update as jest.Mock).mockResolvedValue(updatedConfig);

    const response = await PUT(
      mockRequest('/api/admin/configs/test.config1', 'PUT', {
        value: 'new value',
        description: '更新后的描述',
      }),
      { params: Promise.resolve({ key: 'test.config1' }) }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('配置更新成功');
    expect(data.data).toEqual(updatedConfig);
  });

  it('配置不存在应返回404', async () => {
    (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await PUT(
      mockRequest('/api/admin/configs/nonexistent', 'PUT', {
        value: 'new value',
      }),
      { params: Promise.resolve({ key: 'nonexistent' }) }
    );

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('未找到');
  });

  it('应拒绝类型不匹配的配置值', async () => {
    const existingConfig = {
      id: 'config1',
      key: 'test.config1',
      type: 'NUMBER',
      isRequired: false,
    };

    (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(
      existingConfig
    );

    const response = await PUT(
      mockRequest('/api/admin/configs/test.config1', 'PUT', {
        value: 'not-a-number',
      }),
      { params: Promise.resolve({ key: 'test.config1' }) }
    );

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain('配置值类型与指定类型NUMBER不匹配');
  });
});

// =============================================================================
// DELETE /api/admin/configs/[key] 测试
// =============================================================================

describe('DELETE /api/admin/configs/[key]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAuthUser.mockResolvedValue({
      userId: 'user1',
      email: 'test@example.com',
      role: 'ADMIN',
    });
    validatePermissions.mockResolvedValue(null);
  });

  it('应成功删除配置', async () => {
    const config = {
      id: 'config1',
      key: 'test.config1',
      type: 'STRING',
      isRequired: false,
    };

    (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(config);
    (prisma.systemConfig.delete as jest.Mock).mockResolvedValue(config);

    const response = await DELETE(
      mockRequest('/api/admin/configs/test.config1', 'DELETE'),
      { params: Promise.resolve({ key: 'test.config1' }) }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('配置删除成功');
    expect(prisma.systemConfig.delete).toHaveBeenCalledWith({
      where: { key: 'test.config1' },
    });
  });

  it('配置不存在应返回404', async () => {
    (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await DELETE(
      mockRequest('/api/admin/configs/nonexistent', 'DELETE'),
      { params: Promise.resolve({ key: 'nonexistent' }) }
    );

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('未找到');
  });

  it('应禁止删除必填配置', async () => {
    const config = {
      id: 'config1',
      key: 'test.config1',
      type: 'STRING',
      isRequired: true,
    };

    (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(config);

    const response = await DELETE(
      mockRequest('/api/admin/configs/test.config1', 'DELETE'),
      { params: Promise.resolve({ key: 'test.config1' }) }
    );

    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('禁止操作');
    expect(data.message).toBe('必填配置不能删除');
  });
});
