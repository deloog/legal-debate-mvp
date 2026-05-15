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
import type { TeamDetail } from '@/types/team';
import { TeamType, TeamRole, MemberStatus, TeamStatus } from '@/types/team';

const updateTeamSchema = z
  .object({
    name: z.string().min(1, '团队名称不能为空').max(100).optional(),
    type: z.nativeEnum(TeamType).optional(),
    description: z.string().max(500).optional(),
    logo: z.string().optional(),
    status: z.nativeEnum(TeamStatus).optional(),
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

async function getTeamMemberCount(teamId: string): Promise<number> {
  return await prisma.teamMember.count({
    where: {
      teamId,
      status: MemberStatus.ACTIVE,
    },
  });
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

async function mapTeamToDetail(
  team: unknown,
  includeMemberCount = false
): Promise<TeamDetail> {
  if (!team || typeof team !== 'object') {
    throw new Error('Invalid team data');
  }

  const teamObj = team as Record<string, unknown>;
  const detail: TeamDetail = {
    id: String(teamObj.id || ''),
    name: String(teamObj.name || ''),
    type: teamObj.type as TeamType,
    description: teamObj.description as string | null,
    logo: teamObj.logo as string | null,
    status: teamObj.status as TeamStatus,
    metadata: teamObj.metadata as Record<string, unknown> | null,
    createdAt: new Date(teamObj.createdAt as string),
    updatedAt: new Date(teamObj.updatedAt as string),
  };

  if (includeMemberCount && teamObj.id) {
    const memberCount = await getTeamMemberCount(String(teamObj.id));
    detail.memberCount = memberCount;
  }

  return detail;
}

/**
 * GET /api/teams/[id]
 * 获取团队详情
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

    const { id } = await params;

    const hasAccess = await checkTeamAccess(id, authUser.userId, false);
    if (!hasAccess) {
      return NextResponse.json(
        { error: '权限不足', message: '您没有权限查看此团队' },
        { status: 403 }
      );
    }

    const team = await prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      return NextResponse.json(
        { error: '团队不存在', message: '未找到指定团队' },
        { status: 404 }
      );
    }

    const teamDetail = await mapTeamToDetail(team, true);

    return createSuccessResponse(teamDetail);
  }
);

/**
 * PATCH /api/teams/[id]
 * 更新团队信息
 */
export const PATCH = withErrorHandler(
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

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateTeamSchema.parse(body);

    const hasAccess = await checkTeamAccess(id, authUser.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: '权限不足', message: '您没有权限更新此团队' },
        { status: 403 }
      );
    }

    const team = await prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      return NextResponse.json(
        { error: '团队不存在', message: '未找到指定团队' },
        { status: 404 }
      );
    }

    const updatedTeam = await prisma.team.update({
      where: { id },
      data: {
        name: validatedData.name,
        type: validatedData.type,
        description: validatedData.description,
        logo: validatedData.logo,
        status: validatedData.status,
        metadata: validatedData.metadata as Prisma.InputJsonValue,
      },
    });

    const teamDetail = await mapTeamToDetail(updatedTeam, true);

    return createSuccessResponse(teamDetail);
  }
);

/**
 * DELETE /api/teams/[id]
 * 删除团队
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

    const { id } = await params;

    const hasAccess = await checkTeamAccess(id, authUser.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: '权限不足', message: '您没有权限删除此团队' },
        { status: 403 }
      );
    }

    const team = await prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      return NextResponse.json(
        { error: '团队不存在', message: '未找到指定团队' },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.teamMember.deleteMany({
        where: { teamId: id },
      }),
      prisma.team.delete({
        where: { id },
      }),
    ]);

    return createNoContentResponse();
  }
);

/**
 * OPTIONS /api/teams/[id]
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
