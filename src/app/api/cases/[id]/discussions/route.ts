import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createCreatedResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/middleware/auth';
import { canAccessSharedCase } from '@/lib/case/share-permission-validator';
import { mentionParser } from '@/lib/discussion/mention-parser';
import { mentionNotificationService } from '@/lib/discussion/mention-notification-service';
import { logger } from '@/lib/agent/security/logger';
import { z } from 'zod';
import type {
  DiscussionListResponse,
  DiscussionWithAuthor,
} from '@/types/discussion';

const createDiscussionSchema = z.object({
  content: z.string().min(1, '讨论内容不能为空').max(10000),
  mentions: z.array(z.string()).default([]),
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

const queryDiscussionsSchema = z.object({
  isPinned: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  page: z.coerce.number().min(1, '页码必须大于0').default(1),
  limit: z.coerce
    .number()
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'isPinned']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
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
 * GET /api/cases/[id]/discussions
 * 获取指定案件的讨论列表
 */
export const GET = withErrorHandler(
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

    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);
    const query = queryDiscussionsSchema.parse(
      Object.fromEntries(searchParams)
    );

    // 检查案件访问权限
    const accessResult = await canAccessSharedCase(authUser.userId, caseId);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: '无权访问', message: accessResult.reason },
        { status: 403 }
      );
    }

    const where: Record<string, unknown> = {
      caseId,
    };

    if (query.isPinned !== undefined) {
      where.isPinned = query.isPinned;
    }

    if (!query.includeDeleted) {
      where.deletedAt = null;
    }

    const orderBy: Record<string, 'asc' | 'desc'> = {
      [query.sortBy]: query.sortOrder,
    };

    // 置顶讨论优先
    const [totalCount, discussions] = await Promise.all([
      prisma.caseDiscussion.count({ where }),
      prisma.caseDiscussion.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy:
          query.isPinned === true ? [{ isPinned: 'desc' }, orderBy] : orderBy,
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
      }),
    ]);

    const discussionsWithAuthor = await Promise.all(
      discussions.map((discussion: unknown) =>
        mapDiscussionWithAuthor(discussion)
      )
    );

    const response: DiscussionListResponse = {
      discussions: discussionsWithAuthor,
      total: totalCount,
      caseId,
      page: query.page,
      limit: query.limit,
    };

    return createSuccessResponse(response, {
      pagination: {
        page: query.page,
        limit: query.limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / query.limit),
        hasNext: (query.page - 1) * query.limit + query.limit < totalCount,
        hasPrevious: query.page > 1,
      },
    });
  }
);

/**
 * POST /api/cases/[id]/discussions
 * 在指定案件中发表讨论
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

    const { id: caseId } = await params;

    // 检查案件访问权限
    const accessResult = await canAccessSharedCase(authUser.userId, caseId);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: '无权访问', message: accessResult.reason },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createDiscussionSchema.parse(body);

    // 解析内容中的提及
    const parseResult = await mentionParser.parseMentions(
      validatedData.content,
      caseId
    );

    // 使用解析到的提及，如果没有则使用手动指定的提及
    const finalMentions =
      parseResult.mentions.length > 0
        ? parseResult.mentions
        : validatedData.mentions;

    // 创建讨论
    const discussion = await prisma.caseDiscussion.create({
      data: {
        caseId,
        userId: authUser.userId,
        content: validatedData.content,
        mentions: finalMentions,
        metadata: validatedData.metadata as Prisma.JsonValue,
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

    // 获取提及者的名称
    const mentionerName = discussion.user.name || discussion.user.email;

    // 异步发送提及通知
    if (finalMentions.length > 0) {
      // 使用 Promise 发送但不等待，避免阻塞响应
      mentionNotificationService
        .sendMentionNotifications({
          caseId,
          discussionId: discussion.id,
          discussionContent: validatedData.content,
          mentionedUserIds: finalMentions,
          mentionerId: authUser.userId,
          mentionerName,
        })
        .catch(error => {
          logger.error('发送提及通知失败', {
            discussionId: discussion.id,
            error: error instanceof Error ? error.message : String(error),
          } as never);
        });

      logger.info('提及通知已发送', {
        discussionId: discussion.id,
        mentionCount: finalMentions.length,
        mentionerId: authUser.userId,
      } as never);
    }

    const discussionWithAuthor = await mapDiscussionWithAuthor(discussion);

    return createCreatedResponse(discussionWithAuthor);
  }
);

/**
 * OPTIONS /api/cases/[id]/discussions
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
