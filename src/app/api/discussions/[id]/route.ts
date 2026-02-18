import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createNoContentResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import type { DiscussionWithAuthor } from '@/types/discussion';

const updateDiscussionSchema = z.object({
  content: z.string().min(1, '讨论内容不能为空').max(10000).optional(),
  mentions: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
  metadata: z
    .union([
      z.object({}).passthrough(),
      z.array(z.unknown()),
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
    ])
    .optional(),
});

async function mapDiscussionWithAuthor(
  discussion: unknown
): Promise<DiscussionWithAuthor> {
  if (!discussion || typeof discussion !== 'object') {
    throw new Error('Invalid discussion data');
  }

  const discussionObj = discussion as Record<string, unknown>;
  const userObj = discussionObj.user as Record<string, unknown> | undefined;

  return {
    id: String(discussionObj.id || ''),
    caseId: String(discussionObj.caseId || ''),
    userId: String(discussionObj.userId || ''),
    content: String(discussionObj.content || ''),
    mentions: Array.isArray(discussionObj.mentions)
      ? (discussionObj.mentions as string[]).map(String)
      : [],
    isPinned: Boolean(discussionObj.isPinned || false),
    metadata: (discussionObj.metadata as Prisma.JsonValue) || null,
    createdAt: new Date(discussionObj.createdAt as string),
    updatedAt: new Date(discussionObj.updatedAt as string),
    deletedAt: discussionObj.deletedAt
      ? new Date(discussionObj.deletedAt as string)
      : null,
    author: {
      id: String(userObj?.id || ''),
      name: userObj?.name as string | null,
      email: String(userObj?.email || ''),
      avatar: userObj?.avatar as string | null,
    },
  };
}

/**
 * 检查用户是否有权限编辑或删除讨论
 *
 * @param userId 用户ID
 * @param discussionId 讨论ID
 * @returns 是否有权限
 */
async function canEditOrDeleteDiscussion(
  userId: string,
  discussionId: string
): Promise<{ hasPermission: boolean; reason?: string }> {
  const discussion = await prisma.caseDiscussion.findFirst({
    where: {
      id: discussionId,
      deletedAt: null,
    },
    select: {
      id: true,
      caseId: true,
      userId: true,
    },
  });

  if (!discussion) {
    return {
      hasPermission: false,
      reason: '讨论不存在',
    };
  }

  // 讨论创建者可以编辑
  if (discussion.userId === userId) {
    return { hasPermission: true };
  }

  // 案件所有者可以编辑
  const caseRecord = await prisma.case.findFirst({
    where: {
      id: discussion.caseId,
      deletedAt: null,
    },
    select: {
      userId: true,
    },
  });

  if (caseRecord && caseRecord.userId === userId) {
    return { hasPermission: true };
  }

  // 检查用户是否是案件团队成员且有编辑权限
  const caseTeamMember = await prisma.caseTeamMember.findFirst({
    where: {
      caseId: discussion.caseId,
      userId,
      deletedAt: null,
    },
    select: {
      permissions: true,
    },
  });

  if (caseTeamMember) {
    const metadata = caseTeamMember.permissions as Record<
      string,
      unknown
    > | null;
    const permissions = metadata?.customPermissions as string[] | undefined;

    if (permissions && permissions.includes('EDIT_DISCUSSIONS')) {
      return { hasPermission: true };
    }
  }

  return {
    hasPermission: false,
    reason: '无权编辑此讨论',
  };
}

/**
 * PUT /api/discussions/[id]
 * 更新讨论
 */
export const PUT = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id: discussionId } = await params;

    // 检查编辑权限
    const permissionResult = await canEditOrDeleteDiscussion(
      authUser.userId,
      discussionId
    );
    if (!permissionResult.hasPermission) {
      if (permissionResult.reason === '讨论不存在') {
        return NextResponse.json(
          { error: '讨论不存在', message: permissionResult.reason },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: '权限不足', message: permissionResult.reason },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateDiscussionSchema.parse(body);

    const updateData: Record<string, unknown> = {
      ...(validatedData.content !== undefined && {
        content: validatedData.content,
      }),
      ...(validatedData.mentions !== undefined && {
        mentions: validatedData.mentions,
      }),
      ...(validatedData.isPinned !== undefined && {
        isPinned: validatedData.isPinned,
      }),
      ...(validatedData.metadata !== undefined && {
        metadata: validatedData.metadata,
      }),
    };

    const discussion = await prisma.caseDiscussion.update({
      where: {
        id: discussionId,
      },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    const discussionWithAuthor = await mapDiscussionWithAuthor(discussion);

    return createSuccessResponse(discussionWithAuthor);
  }
);

/**
 * DELETE /api/discussions/[id]
 * 删除讨论（软删除）
 */
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id: discussionId } = await params;

    // 检查编辑权限
    const permissionResult = await canEditOrDeleteDiscussion(
      authUser.userId,
      discussionId
    );
    if (!permissionResult.hasPermission) {
      if (permissionResult.reason === '讨论不存在') {
        return NextResponse.json(
          { error: '讨论不存在', message: permissionResult.reason },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: '权限不足', message: permissionResult.reason },
        { status: 403 }
      );
    }

    // 软删除讨论
    await prisma.caseDiscussion.update({
      where: {
        id: discussionId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return createNoContentResponse();
  }
);

/**
 * OPTIONS /api/discussions/[id]
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
