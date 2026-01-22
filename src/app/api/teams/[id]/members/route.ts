import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createCreatedResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import type { TeamMemberListResponse } from '@/types/team';
import { TeamRole, MemberStatus } from '@/types/team';

const createTeamMemberSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空'),
  role: z.nativeEnum(TeamRole),
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
});

const queryTeamMemberSchema = z.object({
  role: z.nativeEnum(TeamRole).optional(),
  status: z.nativeEnum(MemberStatus).optional(),
  page: z.coerce.number().min(1, '页码必须大于0').default(1),
  limit: z.coerce
    .number()
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .default(20),
  sortBy: z.enum(['joinedAt', 'role', 'name']).default('joinedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

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
  userId: string
): Promise<boolean> {
  const member = await prisma.teamMember.findFirst({
    where: {
      teamId,
      userId,
      role: TeamRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  });
  return member !== null;
}

/**
 * GET /api/teams/[id]/members
 * 获取团队成员列表
 */
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id: teamId } = params;

    const hasAccess = await checkTeamAccess(teamId, authUser.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: '权限不足', message: '您没有权限查看此团队成员' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = queryTeamMemberSchema.parse(Object.fromEntries(searchParams));

    const where: Record<string, unknown> = {
      teamId,
    };

    if (query.role) {
      where.role = query.role;
    }

    if (query.status) {
      where.status = query.status;
    }

    const orderBy: Record<string, 'asc' | 'desc'> = {
      [query.sortBy]: query.sortOrder,
    };

    const [members, total] = await Promise.all([
      prisma.teamMember.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy,
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
      }),
      prisma.teamMember.count({ where }),
    ]);

    const memberDetails = await Promise.all(
      members.map((member: unknown) => mapTeamMemberToDetail(member))
    );

    const response: TeamMemberListResponse = {
      members: memberDetails,
      total,
      teamId,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };

    return createSuccessResponse(response, {
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasNext: (query.page - 1) * query.limit + query.limit < total,
        hasPrevious: query.page > 1,
      },
    });
  }
);

/**
 * POST /api/teams/[id]/members
 * 添加团队成员
 */
export const POST = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id: teamId } = params;

    const hasAccess = await checkTeamAccess(teamId, authUser.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: '权限不足', message: '您没有权限添加团队成员' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createTeamMemberSchema.parse(body);

    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: validatedData.userId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: '成员已存在', message: '该用户已经是团队成员' },
        { status: 409 }
      );
    }

    const member = await prisma.teamMember.create({
      data: {
        teamId,
        userId: validatedData.userId,
        role: validatedData.role,
        notes: validatedData.notes,
        metadata: validatedData.metadata as Prisma.JsonValue,
      },
    });

    const memberDetail = await mapTeamMemberToDetail(member);

    return createCreatedResponse(memberDetail);
  }
);

/**
 * OPTIONS /api/teams/[id]/members
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
