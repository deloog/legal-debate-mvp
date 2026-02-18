import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import type { DiscussionWithAuthor } from '@/types/discussion';

const pinDiscussionSchema = z.object({
  isPinned: z.boolean(),
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
 * 检查用户是否有权限置顶讨论
 *
 * @param userId 用户ID
 * @param discussionId 讨论ID
 * @returns 是否有权限
 */
async function canPinDiscussion(
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
    },
  });

  if (!discussion) {
    return {
      hasPermission: false,
      reason: '讨论不存在',
    };
  }

  // 案件所有者可以置顶讨论
  const caseRecord = await prisma.case.findFirst({
    where: {
      id: discussion.caseId,
      deletedAt: null,
    },
    select: {
      userId: true,
    },
  });

  if (caseRecord?.userId === userId) {
    return { hasPermission: true };
  }

  // 检查用户是否是案件团队成员且有管理权限
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

    if (permissions && permissions.includes('PIN_DISCUSSIONS')) {
      return { hasPermission: true };
    }
  }

  return {
    hasPermission: false,
    reason: '无权置顶此讨论',
  };
}

/**
 * POST /api/discussions/[id]/pin
 * 置顶或取消置顶讨论
 */
export const POST = withErrorHandler(
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

    // 检查置顶权限
    const permissionResult = await canPinDiscussion(
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
    const validatedData = pinDiscussionSchema.parse(body);

    const discussion = await prisma.caseDiscussion.update({
      where: {
        id: discussionId,
      },
      data: {
        isPinned: validatedData.isPinned,
      },
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
 * OPTIONS /api/discussions/[id]/pin
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
