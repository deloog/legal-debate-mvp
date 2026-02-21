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
 * 验证模板访问权限
 */
async function verifyTemplateAccess(
  templateId: string,
  userId: string
): Promise<{
  template: {
    id: string;
    name: string;
    type: string;
    category: string | null;
    content: string;
    variables: unknown;
    isPublic: boolean;
    isSystem: boolean;
    version: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    status: string;
    metadata: unknown;
    deletedAt: Date | null;
  } | null;
  hasAccess: boolean;
}> {
  const template = await prisma.documentTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    return { template: null, hasAccess: false };
  }

  // 检查权限：模板创建者或公开模板或系统模板
  const hasAccess =
    template.createdBy === userId || template.isPublic || template.isSystem;

  return { template, hasAccess };
}

/**
 * GET /api/document-templates/[id]
 * 获取模板详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = params;
    const { template, hasAccess } = await verifyTemplateAccess(
      id,
      authUser.userId
    );

    if (!template || !hasAccess) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // 获取创建者信息
    let creatorName = null;
    if (template.createdBy) {
      const creator = await prisma.user.findUnique({
        where: { id: template.createdBy },
        select: { name: true },
      });
      creatorName = creator?.name;
    }

    return NextResponse.json({
      id: template.id,
      name: template.name,
      type: template.type as DocumentTemplateType,
      category: template.category as DocumentTemplateCategory | null,
      status: template.status as TemplateStatus,
      description: null,
      content: template.content,
      variables: template.variables as Array<{
        name: string;
        type: string;
        description: string | null;
        required: boolean;
        defaultValue: string | null;
      }>,
      isPublic: template.isPublic,
      isSystem: template.isSystem,
      version: template.version,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      creatorId: template.createdBy,
      creatorName,
    });
  } catch (error) {
    logger.error('获取模板详情失败:', error);
    return NextResponse.json({ error: '获取模板详情失败' }, { status: 500 });
  }
}

/**
 * PUT /api/document-templates/[id]
 * 更新模板
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = params;
    const template = await prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // 只有创建者可以编辑
    if (template.createdBy !== authUser.userId) {
      return NextResponse.json({ error: '无权限编辑此模板' }, { status: 403 });
    }

    // 系统模板不能编辑
    if (template.isSystem) {
      return NextResponse.json({ error: '系统模板不能编辑' }, { status: 403 });
    }

    const body = await request.json();
    const { content, variables } = body;

    const updatedTemplate = await prisma.documentTemplate.update({
      where: { id },
      data: {
        content: content ?? template.content,
        variables: variables ?? template.variables,
        version: String(Number(template.version) + 1),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: '更新成功',
      version: updatedTemplate.version,
    });
  } catch (error) {
    logger.error('更新模板失败:', error);
    return NextResponse.json({ error: '更新模板失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/document-templates/[id]
 * 删除模板
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = params;
    const template = await prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // 只有创建者可以删除
    if (template.createdBy !== authUser.userId) {
      return NextResponse.json({ error: '无权限删除此模板' }, { status: 403 });
    }

    // 系统模板不能删除
    if (template.isSystem) {
      return NextResponse.json({ error: '系统模板不能删除' }, { status: 403 });
    }

    await prisma.documentTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    logger.error('删除模板失败:', error);
    return NextResponse.json({ error: '删除模板失败' }, { status: 500 });
  }
}
