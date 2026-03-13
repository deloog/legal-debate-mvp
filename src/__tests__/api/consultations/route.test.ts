/**
 * 咨询API路由测试
 * 测试 GET /api/consultations 接口
 */
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/consultations/route';

// Mock Prisma Client
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    consultation: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

// Mock JWT 工具
jest.mock('@/lib/auth/jwt', () => ({
  extractTokenFromHeader: jest.fn((header: string) =>
    header?.replace('Bearer ', '')
  ),
  verifyToken: jest.fn(() => ({
    valid: true,
    payload: { userId: 'test-user-id' },
  })),
}));

// Mock NextAuth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// 辅助函数：创建带有 headers 的 mock Request
function createMockRequest(url: string): NextRequest {
  return {
    url: new URL(url),
    headers: {
      get: jest.fn((key: string) => {
        if (key.toLowerCase() === 'authorization') return 'Bearer test-token';
        return null;
      }),
    },
  } as unknown as NextRequest;
}

// Mock Request对象
const mockRequest = createMockRequest(
  'http://localhost:3000/api/consultations'
);

describe('GET /api/consultations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('参数验证', () => {
    test('应该接受默认分页参数', async () => {
      const mockConsultations = [
        {
          id: '1',
          consultNumber: 'ZX20260128001',
          clientName: '张三',
          clientPhone: '13800138000',
          consultType: 'PHONE',
          consultTime: new Date('2026-01-28'),
          caseType: '劳动争议',
          status: 'PENDING',
          createdAt: new Date('2026-01-28'),
          updatedAt: new Date('2026-01-28'),
        },
      ];

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue(
        mockConsultations
      );
      (prisma.consultation.count as jest.Mock).mockResolvedValue(1);

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.pagination).toBeDefined();
    });

    test('应该接受自定义page参数', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?page=2'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: expect.any(Number),
          take: expect.any(Number),
        })
      );
    });

    test('应该接受自定义pageSize参数', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?pageSize=50'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });

    test('应该限制最大pageSize为100', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?pageSize=200'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    test('应该设置最小pageSize为1', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?pageSize=0'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        })
      );
    });
  });

  describe('筛选功能', () => {
    test('应该支持status筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?status=PENDING'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      );
    });

    test('应该支持consultType筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?consultType=PHONE'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            consultType: 'PHONE',
          }),
        })
      );
    });

    test('应该支持startDate筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?startDate=2026-01-01'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            consultTime: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      );
    });

    test('应该支持endDate筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?endDate=2026-12-31'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            consultTime: expect.objectContaining({
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    test('应该支持keyword搜索（姓名）', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?keyword=张三'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                clientName: expect.objectContaining({
                  contains: '张三',
                }),
              }),
            ]),
          }),
        })
      );
    });

    test('应该支持keyword搜索（电话）', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?keyword=138'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                clientPhone: expect.objectContaining({
                  contains: '138',
                }),
              }),
            ]),
          }),
        })
      );
    });

    test('应该支持组合筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?status=PENDING&consultType=PHONE&keyword=张三'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
            consultType: 'PHONE',
            OR: expect.any(Array),
          }),
        })
      );
    });

    test('应该处理无效的status参数', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?status=INVALID'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    test('应该处理无效的consultType参数', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?consultType=INVALID'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('排序功能', () => {
    test('应该按consultTime降序排序（默认）', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            consultTime: 'desc',
          },
        })
      );
    });

    test('应该支持sortBy参数', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?sortBy=createdAt'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'desc',
          },
        })
      );
    });

    test('应该支持sortOrder参数', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?sortOrder=asc'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            consultTime: 'asc',
          },
        })
      );
    });
  });

  describe('数据返回', () => {
    test('应该返回正确的分页信息', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?page=1&pageSize=20'
      );

      const mockConsultations = Array.from({ length: 20 }, (_, i) => ({
        id: `id-${i}`,
        consultNumber: `ZX202601280${String(i + 1).padStart(2, '0')}`,
        clientName: `客户${i + 1}`,
        consultType: 'PHONE',
        consultTime: new Date('2026-01-28'),
        status: 'PENDING',
        createdAt: new Date('2026-01-28'),
        updatedAt: new Date('2026-01-28'),
      }));

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue(
        mockConsultations
      );
      (prisma.consultation.count as jest.Mock).mockResolvedValue(100);

      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 100,
        totalPages: 5,
      });
    });

    test('应该排除已删除的记录', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      await response.json();

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });

    test('应该按咨询时间降序返回最新记录', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations'
      );

      const mockConsultations = [
        {
          id: '1',
          consultNumber: 'ZX20260128002',
          consultTime: new Date('2026-01-28T12:00:00'),
          clientName: '客户2',
        },
        {
          id: '2',
          consultNumber: 'ZX20260128001',
          consultTime: new Date('2026-01-28T10:00:00'),
          clientName: '客户1',
        },
      ];

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue(
        mockConsultations
      );
      (prisma.consultation.count as jest.Mock).mockResolvedValue(2);

      const response = await GET(request);
      const data = await response.json();

      expect(data.data[0].consultNumber).toBe('ZX20260128002');
      expect(data.data[1].consultNumber).toBe('ZX20260128001');
    });
  });

  describe('错误处理', () => {
    test('应该处理数据库错误', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations'
      );

      (prisma.consultation.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );
      (prisma.consultation.count as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    test('应该处理空结果', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?keyword=不存在的客户'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(0);
      expect(data.pagination.total).toBe(0);
    });

    test('应该处理无效的日期格式', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?startDate=invalid-date'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('日期格式');
    });
  });

  describe('响应格式', () => {
    test('应该返回标准的成功响应格式', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations'
      );

      const mockConsultations = [
        {
          id: '1',
          consultNumber: 'ZX20260128001',
          clientName: '张三',
          consultType: 'PHONE',
          consultTime: new Date('2026-01-28'),
          status: 'PENDING',
          createdAt: new Date('2026-01-28'),
          updatedAt: new Date('2026-01-28'),
        },
      ];

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue(
        mockConsultations
      );
      (prisma.consultation.count as jest.Mock).mockResolvedValue(1);

      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('pagination');
    });

    test('应该返回标准的错误响应格式', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/consultations?status=INVALID'
      );

      (prisma.consultation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consultation.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code');
      expect(data.error).toHaveProperty('message');
    });
  });
});

describe('POST /api/consultations', () => {
  let mockRequest: NextRequest;
  let mockJsonBody: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJsonBody = {
      consultType: 'PHONE',
      consultTime: '2026-01-28T10:00:00.000Z',
      clientName: '张三',
      clientPhone: '13800138000',
      clientEmail: 'zhangsan@example.com',
      clientCompany: '某某公司',
      caseType: '劳动争议',
      caseSummary: '这是一段案情摘要，至少需要10个字符才能通过验证。',
      clientDemand: '希望获得合理的经济补偿',
      followUpDate: '2026-01-30T10:00:00.000Z',
      followUpNotes: '需要准备相关材料',
    };
  });

  describe('正常创建场景', () => {
    test('应该成功创建咨询记录', async () => {
      const mockCreatedConsultation = {
        id: 'consult-id-123',
        consultNumber: 'ZX20260128001',
        consultType: 'PHONE',
        consultTime: new Date('2026-01-28T10:00:00.000Z'),
        clientName: '张三',
        clientPhone: '13800138000',
        clientEmail: 'zhangsan@example.com',
        clientCompany: '某某公司',
        caseType: '劳动争议',
        caseSummary: '这是一段案情摘要，至少需要10个字符才能通过验证。',
        clientDemand: '希望获得合理的经济补偿',
        status: 'PENDING',
        followUpDate: new Date('2026-01-30T10:00:00.000Z'),
        followUpNotes: '需要准备相关材料',
        userId: 'user-id-123',
        createdAt: new Date('2026-01-28T10:00:00.000Z'),
        updatedAt: new Date('2026-01-28T10:00:00.000Z'),
      };

      (prisma.consultation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.consultation.create as jest.Mock).mockResolvedValue(
        mockCreatedConsultation
      );

      mockRequest = {
        json: jest.fn().mockResolvedValue(mockJsonBody),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.consultNumber).toBe('ZX20260128001');
      expect(prisma.consultation.create).toHaveBeenCalled();
    });

    test('应该生成咨询编号', async () => {
      const mockCreatedConsultation = {
        id: 'consult-id-123',
        consultNumber: 'ZX20260128002',
        clientName: '张三',
        status: 'PENDING',
        userId: 'user-id-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.consultation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.consultation.create as jest.Mock).mockResolvedValue(
        mockCreatedConsultation
      );

      mockRequest = {
        json: jest.fn().mockResolvedValue(mockJsonBody),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.data.consultNumber).toMatch(/^ZX\d{11}$/);
    });

    test('应该设置默认状态为PENDING', async () => {
      const mockCreatedConsultation = {
        id: 'consult-id-123',
        consultNumber: 'ZX20260128001',
        status: 'PENDING',
        userId: 'user-id-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.consultation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.consultation.create as jest.Mock).mockResolvedValue(
        mockCreatedConsultation
      );

      mockRequest = {
        json: jest.fn().mockResolvedValue(mockJsonBody),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.data.status).toBe('PENDING');
    });

    test('应该处理可选字段为null的情况', async () => {
      const mockCreatedConsultation = {
        id: 'consult-id-123',
        consultNumber: 'ZX20260128001',
        consultType: 'VISIT',
        consultTime: new Date('2026-01-28T10:00:00.000Z'),
        clientName: '李四',
        caseType: null,
        caseSummary: '这是一段案情摘要，至少需要10个字符才能通过验证。',
        status: 'PENDING',
        followUpDate: null,
        followUpNotes: null,
        userId: 'user-id-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.consultation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.consultation.create as jest.Mock).mockResolvedValue(
        mockCreatedConsultation
      );

      mockRequest = {
        json: jest.fn().mockResolvedValue({
          consultType: 'VISIT',
          consultTime: '2026-01-28T10:00:00.000Z',
          clientName: '李四',
          caseSummary: '这是一段案情摘要，至少需要10个字符才能通过验证。',
        }),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });
  });

  describe('字段验证', () => {
    test('应该拒绝缺少clientName的请求', async () => {
      const { clientName, ...bodyWithoutName } = mockJsonBody;

      mockRequest = {
        json: jest.fn().mockResolvedValue(bodyWithoutName),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    test('应该拒绝缺失caseSummary的请求', async () => {
      const { caseSummary, ...bodyWithoutSummary } = mockJsonBody;

      mockRequest = {
        json: jest.fn().mockResolvedValue(bodyWithoutSummary),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test('应该验证手机号格式', async () => {
      mockRequest = {
        json: jest.fn().mockResolvedValue({
          ...mockJsonBody,
          clientPhone: 'invalid-phone',
        }),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('手机');
    });

    test('应该验证邮箱格式', async () => {
      mockRequest = {
        json: jest.fn().mockResolvedValue({
          ...mockJsonBody,
          clientEmail: 'invalid-email',
        }),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('邮箱');
    });

    test('应该验证案情摘要最小长度（10字符）', async () => {
      mockRequest = {
        json: jest.fn().mockResolvedValue({
          ...mockJsonBody,
          caseSummary: '太短',
        }),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('10');
    });

    test('应该验证案情摘要最大长度（500字符）', async () => {
      const longSummary = 'a'.repeat(501);

      mockRequest = {
        json: jest.fn().mockResolvedValue({
          ...mockJsonBody,
          caseSummary: longSummary,
        }),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('500');
    });

    test('应该验证咨询人姓名最大长度（50字符）', async () => {
      const longName = '张'.repeat(51);

      mockRequest = {
        json: jest.fn().mockResolvedValue({
          ...mockJsonBody,
          clientName: longName,
        }),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('50');
    });

    test('应该验证咨询方式是否有效', async () => {
      mockRequest = {
        json: jest.fn().mockResolvedValue({
          ...mockJsonBody,
          consultType: 'INVALID_TYPE',
        }),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test('应该验证咨询时间格式', async () => {
      mockRequest = {
        json: jest.fn().mockResolvedValue({
          ...mockJsonBody,
          consultTime: 'invalid-date',
        }),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('错误处理', () => {
    test('应该处理数据库创建失败', async () => {
      (prisma.consultation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.consultation.create as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      mockRequest = {
        json: jest.fn().mockResolvedValue(mockJsonBody),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    test('应该处理JSON解析错误', async () => {
      mockRequest = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test('应该处理缺少必需字段的情况', async () => {
      mockRequest = {
        json: jest.fn().mockResolvedValue({}),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('咨询编号生成', () => {
    test('应该查询当天最大序号', async () => {
      const mockLatestConsultation = {
        consultNumber: 'ZX20260128005',
        id: 'id-123',
      };

      (prisma.consultation.findFirst as jest.Mock).mockResolvedValue(
        mockLatestConsultation
      );
      (prisma.consultation.create as jest.Mock).mockResolvedValue({
        id: 'new-id',
        consultNumber: 'ZX20260128006',
      });

      mockRequest = {
        json: jest.fn().mockResolvedValue(mockJsonBody),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      await POST(mockRequest);

      expect(prisma.consultation.findFirst).toHaveBeenCalledWith({
        where: {
          consultNumber: {
            startsWith: expect.stringMatching(/^ZX\d{8}/),
          },
          deletedAt: null,
        },
        orderBy: {
          consultNumber: 'desc',
        },
      });
    });

    test('当天没有咨询时应从001开始', async () => {
      (prisma.consultation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.consultation.create as jest.Mock).mockResolvedValue({
        id: 'new-id',
        consultNumber: 'ZX20260128001',
      });

      mockRequest = {
        json: jest.fn().mockResolvedValue(mockJsonBody),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.data.consultNumber).toBe('ZX20260128001');
    });
  });

  describe('响应格式', () => {
    test('应该返回标准的成功响应格式', async () => {
      const mockCreatedConsultation = {
        id: 'consult-id-123',
        consultNumber: 'ZX20260128001',
        consultType: 'PHONE',
        consultTime: new Date('2026-01-28T10:00:00.000Z'),
        clientName: '张三',
        status: 'PENDING',
        userId: 'user-id-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.consultation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.consultation.create as jest.Mock).mockResolvedValue(
        mockCreatedConsultation
      );

      mockRequest = {
        json: jest.fn().mockResolvedValue(mockJsonBody),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('consultNumber');
    });

    test('应该返回标准的错误响应格式', async () => {
      mockRequest = {
        json: jest.fn().mockResolvedValue({}),
        headers: { get: jest.fn() },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code');
      expect(data.error).toHaveProperty('message');
    });
  });
});
