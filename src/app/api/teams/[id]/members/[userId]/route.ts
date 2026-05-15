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
import type { TeamMemberListResponse } from '@/types/team';
import { TeamRole, MemberStatus } from '@/types/team';

const updateTeamMemberSchema = z
  .object({
    role: z.nativeEnum(TeamRole).optional(),
    status: z.nativeEnum(MemberStatus).optional(),
    notes: z.string().max(500).optional(),
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
  })
  .partial();

async function mapTeamMemberToDetail(
  member: unknown
): Promise<TeamMemberListResponse['members'][0]> {
  if (!member || typeof member !== 'object') {
    throw new Error('Invalid team member data');
  }

  const memberObj = member as Record<string, unknown>;
  return {
    id: String(memberObj.id || ''),
    teamId: String(memberObj.teamId || ''),
    userId: String(memberObj.userId || ''),
    role: memberObj.role as TeamRole,
    status: memberObj.status as MemberStatus,
    joinedAt: new Date(memberObj.joinedAt as string),
    notes: memberObj.notes as string | null,
    metadata: memberObj.metadata as Record<string, unknown> | null,
  };
}

async function checkTeamAccess(
  teamId: string,
  userId: string,
  requireAdmin = true
): Promise<boolean> {
  const member = await prisma.teamMember.findFirst({
    where: {
      teamId,
      userId,
      status: MemberStatus.ACTIVE,
      ...(requireAdmin ? { role: TeamRole.ADMIN } : {}),
    },
  });
  return member !== null;
}

async function wouldRemoveLastAdmin(
  teamId: string,
  memberUserId: string,
  nextRole?: TeamRole,
  nextStatus?: MemberStatus
): Promise<boolean> {
  const member = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId: memberUserId,
      },
    },
    select: {
      role: true,
      status: true,
    },
  });

  if (
    !member ||
    member.role !== TeamRole.ADMIN ||
    member.status !== MemberStatus.ACTIVE
  ) {
    return false;
  }

  const remainsActiveAdmin =
    (nextRole ?? member.role) === TeamRole.ADMIN &&
    (nextStatus ?? member.status) === MemberStatus.ACTIVE;

  if (remainsActiveAdmin) {
    return false;
  }

  const activeAdminCount = await prisma.teamMember.count({
    where: {
      teamId,
      role: TeamRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  });

  return activeAdminCount <= 1;
}

/**
 * GET /api/teams/[id]/members/[userId]
 * 获取团队成员详情
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; userId: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id: teamId, userId: memberUserId } = await params;

    const hasAccess = await checkTeamAccess(teamId, authUser.userId, false);
    if (!hasAccess) {
      return NextResponse.json(
        { error: '权限不足', message: '您没有权限查看此成员' },
        { status: 403 }
      );
    }

    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: memberUserId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: '成员不存在', message: '未找到指定成员' },
        { status: 404 }
      );
    }

    const memberDetail = await mapTeamMemberToDetail(member);

    return createSuccessResponse(memberDetail);
  }
);

/**
 * PATCH /api/teams/[id]/members/[userId]
 * 更新成员角色或状态
 */
export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; userId: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id: teamId, userId: memberUserId } = await params;

    const hasAccess = await checkTeamAccess(teamId, authUser.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: '权限不足', message: '您没有权限更新此成员' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateTeamMemberSchema.parse(body);

    if (
      await wouldRemoveLastAdmin(
        teamId,
        memberUserId,
        validatedData.role,
        validatedData.status
      )
    ) {
      return NextResponse.json(
        {
          error: '非法操作',
          message: '团队至少需要保留一名活跃管理员',
        },
        { status: 400 }
      );
    }

    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: memberUserId,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: '成员不存在', message: '未找到指定成员' },
        { status: 404 }
      );
    }

    const updatedMember = await prisma.teamMember.update({
      where: {
        teamId_userId: {
          teamId,
          userId: memberUserId,
        },
      },
      data: {
        role: validatedData.role,
        status: validatedData.status,
        notes: validatedData.notes,
        metadata: validatedData.metadata as Prisma.InputJsonValue,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
          },
        },
      },
    });

    const memberDetail = await mapTeamMemberToDetail(updatedMember);

    return createSuccessResponse(memberDetail);
  }
);

/**
 * DELETE /api/teams/[id]/members/[userId]
 * 移除成员
 */
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; userId: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id: teamId, userId: memberUserId } = await params;

    const hasAccess = await checkTeamAccess(teamId, authUser.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: '权限不足', message: '您没有权限移除此成员' },
        { status: 403 }
      );
    }

    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: memberUserId,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: '成员不存在', message: '未找到指定成员' },
        { status: 404 }
      );
    }

    if (
      await wouldRemoveLastAdmin(
        teamId,
        memberUserId,
        undefined,
        MemberStatus.REMOVED
      )
    ) {
      return NextResponse.json(
        {
          error: '非法操作',
          message: '团队至少需要保留一名活跃管理员',
        },
        { status: 400 }
      );
    }

    await prisma.teamMember.delete({
      where: {
        teamId_userId: {
          teamId,
          userId: memberUserId,
        },
      },
    });

    return createNoContentResponse();
  }
);

/**
 * OPTIONS /api/teams/[id]/members/[userId]
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
