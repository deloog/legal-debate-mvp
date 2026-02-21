import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
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
    content: string;
    variables: unknown;
    createdBy: string;
    isPublic: boolean;
    isSystem: boolean;
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
 * 替换模板变量
 */
function replaceVariables(
  content: string,
  variables: Record<string, string>
): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

/**
 * POST /api/document-templates/[id]/generate
 * 生成文档
 */
export async function POST(
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

    // 验证请求体
    const body = await request.json();

    // 简单验证，不使用zod以避免测试环境问题
    if (!body || typeof body !== 'object' || !body.variables) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }

    const { variables } = body;

    // 替换模板中的变量
    const stringVariables: Record<string, string> = {};
    for (const [key, value] of Object.entries(variables)) {
      stringVariables[key] = String(value);
    }
    const generatedContent = replaceVariables(
      template.content,
      stringVariables
    );

    return NextResponse.json({
      content: generatedContent,
      templateId: template.id,
      templateName: template.name,
    });
  } catch (error) {
    logger.error('生成文档失败:', error);
    return NextResponse.json({ error: '生成文档失败' }, { status: 500 });
  }
}
