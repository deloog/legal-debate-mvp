import {
  GET as getTemplates,
  POST as createTemplate,
} from '@/app/api/document-templates/route';
import {
  GET as getTemplate,
  PUT as updateTemplate,
  DELETE as deleteTemplate,
} from '@/app/api/document-templates/[id]/route';
import { POST as generateDocument } from '@/app/api/document-templates/[id]/generate/route';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  DocumentTemplateType,
  TemplateStatus,
} from '@/types/document-template';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    documentTemplate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock getAuthUser
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

const { getAuthUser } = jest.requireMock('@/lib/middleware/auth');

describe('Document Templates API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/document-templates', () => {
    it('应该返回模板列表', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'USER',
      });

      const mockTemplates = [
        {
          id: 'template-1',
          name: '民事起诉状模板',
          type: DocumentTemplateType.INDICTMENT,
          category: 'CIVIL',
          status: TemplateStatus.PUBLISHED,
          content: '起诉状内容...',
          variables: [],
          isPublic: true,
          isSystem: false,
          version: '1.0',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          createdBy: 'user-1',
          description: null,
        },
      ];

      (prisma.documentTemplate.findMany as jest.Mock).mockResolvedValue(
        mockTemplates
      );
      (prisma.documentTemplate.count as jest.Mock).mockResolvedValue(1);

      // 创建带有模拟 searchParams 的请求
      const request = {
        url: 'http://localhost/api/document-templates',
        nextUrl: new URL('http://localhost/api/document-templates'),
        headers: new Headers(),
        cookies: {
          get: jest.fn(),
        },
        json: jest.fn(),
      } as unknown as NextRequest;

      const response = await getTemplates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.templates).toHaveLength(1);
      expect(data.templates[0].name).toBe('民事起诉状模板');
    });

    it('应该正确处理分页参数', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'USER',
      });

      (prisma.documentTemplate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.documentTemplate.count as jest.Mock).mockResolvedValue(0);

      const request = {
        url: 'http://localhost/api/document-templates?page=2&limit=10',
        nextUrl: new URL(
          'http://localhost/api/document-templates?page=2&limit=10'
        ),
        headers: new Headers(),
        cookies: {
          get: jest.fn(),
        },
        json: jest.fn(),
      } as unknown as NextRequest;

      await getTemplates(request);

      expect(prisma.documentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('应该返回401未授权', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = {
        url: 'http://localhost/api/document-templates',
        nextUrl: new URL('http://localhost/api/document-templates'),
        headers: new Headers(),
        cookies: {
          get: jest.fn(),
        },
        json: jest.fn(),
      } as unknown as NextRequest;

      const response = await getTemplates(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });
  });

  describe('POST /api/document-templates', () => {
    it('应该成功创建模板', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'USER',
      });

      const newTemplate = {
        id: 'template-new',
        name: '新模板',
        type: DocumentTemplateType.INDICTMENT,
        category: 'CIVIL',
        status: TemplateStatus.DRAFT,
        content: '模板内容',
        variables: [],
        isPublic: false,
        isSystem: false,
        version: '1',
        createdBy: 'user-1',
      };

      (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.documentTemplate.create as jest.Mock).mockResolvedValue(
        newTemplate
      );

      const request = {
        url: 'http://localhost/api/document-templates',
        nextUrl: new URL('http://localhost/api/document-templates'),
        headers: new Headers(),
        cookies: {
          get: jest.fn(),
        },
        json: async () => ({
          name: '新模板',
          type: DocumentTemplateType.INDICTMENT,
          category: 'CIVIL',
          content: '模板内容',
          variables: [],
          isPublic: false,
        }),
      } as unknown as NextRequest;

      const response = await createTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('template-new');
      expect(data.message).toBe('创建成功');
    });

    it('应该验证必填字段', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'USER',
      });

      const request = {
        url: 'http://localhost/api/document-templates',
        nextUrl: new URL('http://localhost/api/document-templates'),
        headers: new Headers(),
        cookies: {
          get: jest.fn(),
        },
        json: async () => ({
          name: '新模板',
          // content缺失
        }),
      } as unknown as NextRequest;

      const response = await createTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('模板名称和内容不能为空');
    });
  });

  describe('GET /api/document-templates/[id]', () => {
    it('应该返回模板详情', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'USER',
      });

      const mockTemplate = {
        id: 'template-1',
        name: '模板',
        type: DocumentTemplateType.INDICTMENT,
        category: 'CIVIL',
        status: TemplateStatus.PUBLISHED,
        content: '内容',
        variables: [],
        isPublic: true,
        isSystem: false,
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        description: null,
        metadata: null,
        deletedAt: null,
      };

      (prisma.documentTemplate.findUnique as jest.Mock).mockResolvedValue(
        mockTemplate
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        name: '张三',
      });

      const request = {
        url: 'http://localhost/api/document-templates/template-1',
        nextUrl: new URL('http://localhost/api/document-templates/template-1'),
        headers: new Headers(),
        cookies: {
          get: jest.fn(),
        },
        json: jest.fn(),
      } as unknown as NextRequest;

      const response = await getTemplate(request, {
        params: Promise.resolve({ id: 'template-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('template-1');
    });

    it('应该返回404当模板不存在', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'USER',
      });

      (prisma.documentTemplate.findUnique as jest.Mock).mockResolvedValue(null);

      const request = {
        url: 'http://localhost/api/document-templates/template-not-exist',
        nextUrl: new URL(
          'http://localhost/api/document-templates/template-not-exist'
        ),
        headers: new Headers(),
        cookies: {
          get: jest.fn(),
        },
        json: jest.fn(),
      } as unknown as NextRequest;

      const response = await getTemplate(request, {
        params: Promise.resolve({ id: 'template-not-exist' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('模板不存在');
    });
  });

  describe('PUT /api/document-templates/[id]', () => {
    it('应该成功更新模板', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'USER',
      });

      const mockTemplate = {
        id: 'template-1',
        name: '模板',
        type: DocumentTemplateType.INDICTMENT,
        category: 'CIVIL',
        status: TemplateStatus.DRAFT,
        content: '旧内容',
        variables: [],
        isPublic: false,
        isSystem: false,
        version: '1.0',
        createdBy: 'user-1',
      };

      const updatedTemplate = {
        ...mockTemplate,
        content: '新内容',
        version: '2.0',
      };

      (prisma.documentTemplate.findUnique as jest.Mock).mockResolvedValue(
        mockTemplate
      );
      (prisma.documentTemplate.update as jest.Mock).mockResolvedValue(
        updatedTemplate
      );

      const request = {
        url: 'http://localhost/api/document-templates/template-1',
        nextUrl: new URL('http://localhost/api/document-templates/template-1'),
        headers: new Headers(),
        cookies: {
          get: jest.fn(),
        },
        json: async () => ({
          content: '新内容',
          variables: [],
        }),
      } as unknown as NextRequest;

      const response = await updateTemplate(request, {
        params: Promise.resolve({ id: 'template-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('更新成功');
      expect(data.version).toBe('2.0');
    });

    it('应该返回403当用户无权限编辑', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-2',
        role: 'USER',
      });

      const mockTemplate = {
        id: 'template-1',
        name: '模板',
        type: DocumentTemplateType.INDICTMENT,
        category: 'CIVIL',
        status: TemplateStatus.DRAFT,
        content: '内容',
        variables: [],
        isPublic: false,
        isSystem: false,
        version: '1.0',
        createdBy: 'user-1',
      };

      (prisma.documentTemplate.findUnique as jest.Mock).mockResolvedValue(
        mockTemplate
      );

      const request = {
        url: 'http://localhost/api/document-templates/template-1',
        nextUrl: new URL('http://localhost/api/document-templates/template-1'),
        headers: new Headers(),
        cookies: {
          get: jest.fn(),
        },
        json: async () => ({ content: '新内容' }),
      } as unknown as NextRequest;

      const response = await updateTemplate(request, {
        params: Promise.resolve({ id: 'template-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('无权限编辑此模板');
    });
  });

  describe('DELETE /api/document-templates/[id]', () => {
    it('应该成功删除模板', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'USER',
      });

      const mockTemplate = {
        id: 'template-1',
        name: '模板',
        type: DocumentTemplateType.INDICTMENT,
        category: 'CIVIL',
        status: TemplateStatus.DRAFT,
        content: '内容',
        variables: [],
        isPublic: false,
        isSystem: false,
        version: '1.0',
        createdBy: 'user-1',
      };

      (prisma.documentTemplate.findUnique as jest.Mock).mockResolvedValue(
        mockTemplate
      );
      (prisma.documentTemplate.delete as jest.Mock).mockResolvedValue(
        mockTemplate
      );

      const request = {
        url: 'http://localhost/api/document-templates/template-1',
        nextUrl: new URL('http://localhost/api/document-templates/template-1'),
        headers: new Headers(),
        cookies: {
          get: jest.fn(),
        },
        json: jest.fn(),
      } as unknown as NextRequest;

      const response = await deleteTemplate(request, {
        params: Promise.resolve({ id: 'template-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('删除成功');
    });

    it('应该返回403当删除系统模板', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'USER',
      });

      const mockTemplate = {
        id: 'template-1',
        name: '模板',
        type: DocumentTemplateType.INDICTMENT,
        category: 'CIVIL',
        status: TemplateStatus.DRAFT,
        content: '内容',
        variables: [],
        isPublic: false,
        isSystem: true,
        version: '1.0',
        createdBy: 'user-1',
      };

      (prisma.documentTemplate.findUnique as jest.Mock).mockResolvedValue(
        mockTemplate
      );

      const request = {
        url: 'http://localhost/api/document-templates/template-1',
        nextUrl: new URL('http://localhost/api/document-templates/template-1'),
        headers: new Headers(),
        cookies: {
          get: jest.fn(),
        },
        json: jest.fn(),
      } as unknown as NextRequest;

      const response = await deleteTemplate(request, {
        params: Promise.resolve({ id: 'template-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('系统模板不能删除');
    });
  });

  describe('POST /api/document-templates/[id]/generate', () => {
    it('应该成功生成文档', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'USER',
      });

      const mockTemplate = {
        id: 'template-1',
        name: '模板',
        content: '尊敬的{{court}}：原告{{plaintiff}}...',
        variables: [],
        createdBy: 'user-1',
        isPublic: true,
        isSystem: false,
      };

      (prisma.documentTemplate.findUnique as jest.Mock).mockResolvedValue(
        mockTemplate
      );

      const request = {
        url: 'http://localhost/api/document-templates/template-1/generate',
        nextUrl: new URL(
          'http://localhost/api/document-templates/template-1/generate'
        ),
        headers: new Headers(),
        cookies: {
          get: jest.fn(),
        },
        json: async () => ({
          variables: {
            court: '北京市朝阳区人民法院',
            plaintiff: '张三',
          },
        }),
      } as unknown as NextRequest;

      const response = await generateDocument(request, {
        params: Promise.resolve({ id: 'template-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toContain('北京市朝阳区人民法院');
      expect(data.content).toContain('张三');
    });

    it('应该验证参数格式', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'USER',
      });

      const mockTemplate = {
        id: 'template-1',
        name: '模板',
        content: '内容',
        variables: [],
        createdBy: 'user-1',
        isPublic: true,
        isSystem: false,
      };

      (prisma.documentTemplate.findUnique as jest.Mock).mockResolvedValue(
        mockTemplate
      );

      const request = {
        url: 'http://localhost/api/document-templates/template-1/generate',
        nextUrl: new URL(
          'http://localhost/api/document-templates/template-1/generate'
        ),
        headers: new Headers(),
        cookies: {
          get: jest.fn(),
        },
        json: async () => ({
          invalid: 'data',
        }),
      } as unknown as NextRequest;

      const response = await generateDocument(request, {
        params: Promise.resolve({ id: 'template-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('参数错误');
    });
  });
});
