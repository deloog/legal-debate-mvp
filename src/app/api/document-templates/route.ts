/** @legacy 优先使用 /api/v1/document-templates，此路由保留以向后兼容 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import {
  DocumentTemplateType,
  DocumentTemplateCategory,
  TemplateStatus,
} from '@/types/document-template';
import { logger } from '@/lib/logger';

/**
 * GET /api/document-templates
 * 获取模板列表
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const status = searchParams.get('status') || '';
    const category = searchParams.get('category') || '';

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: Record<string, unknown> = {
      OR: [
        { createdBy: authUser.userId },
        { isPublic: true },
        { isSystem: true },
      ],
    };

    if (search) {
      where.name = {
        contains: search,
      };
    }

    if (
      type &&
      Object.values(DocumentTemplateType).includes(type as DocumentTemplateType)
    ) {
      where.type = type;
    }

    if (
      status &&
      Object.values(TemplateStatus).includes(status as TemplateStatus)
    ) {
      where.status = status;
    }

    if (
      category &&
      Object.values(DocumentTemplateCategory).includes(
        category as DocumentTemplateCategory
      )
    ) {
      where.category = category;
    }

    const [templates, total] = await Promise.all([
      prisma.documentTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.documentTemplate.count({ where }),
    ]);

    // 转换数据格式
    const formattedTemplates = templates.map(templateItem => ({
      id: templateItem.id,
      name: templateItem.name,
      type: templateItem.type as DocumentTemplateType,
      category: templateItem.category as DocumentTemplateCategory | null,
      status: templateItem.status as TemplateStatus,
      description: null,
      content: templateItem.content,
      variables: templateItem.variables as Array<{
        name: string;
        type: string;
        description: string | null;
        required: boolean;
        defaultValue: string | null;
      }>,
      isPublic: templateItem.isPublic,
      isSystem: templateItem.isSystem,
      version: templateItem.version,
      createdAt: templateItem.createdAt.toISOString(),
      updatedAt: templateItem.updatedAt.toISOString(),
      creatorId: templateItem.createdBy,
      creatorName: null,
    }));

    return NextResponse.json({
      templates: formattedTemplates,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('获取模板列表失败:', error);
    return NextResponse.json({ error: '获取模板列表失败' }, { status: 500 });
  }
}

/**
 * POST /api/document-templates
 * 创建模板
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, category, status, content, variables, isPublic } = body;

    if (!name || !content) {
      return NextResponse.json(
        { error: '模板名称和内容不能为空' },
        { status: 400 }
      );
    }

    // 获取当前最大版本号
    const maxVersion = await prisma.documentTemplate.findFirst({
      where: {
        createdBy: authUser.userId,
        name,
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const template = await prisma.documentTemplate.create({
      data: {
        name: name.trim(),
        type,
        category,
        status: status || TemplateStatus.DRAFT,
        content,
        variables: variables || [],
        isPublic: Boolean(isPublic),
        isSystem: false,
        version: String(
          (maxVersion?.version ? Number(maxVersion.version) : 0) + 1
        ),
        createdBy: authUser.userId,
      },
    });

    return NextResponse.json(
      {
        id: template.id,
        message: '创建成功',
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('创建模板失败:', error);
    return NextResponse.json({ error: '创建模板失败' }, { status: 500 });
  }
}
