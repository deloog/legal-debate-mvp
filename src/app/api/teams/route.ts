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
import type { TeamDetail } from '@/types/team';
import { TeamType, TeamStatus } from '@/types/team';

const createTeamSchema = z.object({
  name: z.string().min(1, '团队名称不能为空').max(100),
  type: z.nativeEnum(TeamType),
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
});

const queryTeamSchema = z.object({
  type: z.nativeEnum(TeamType).optional(),
  status: z.nativeEnum(TeamStatus).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1, '页码必须大于0').default(1),
  limit: z.coerce
    .number()
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

async function getTeamMemberCount(teamId: string): Promise<number> {
  return await prisma.teamMember.count({
    where: {
      teamId,
      status: 'ACTIVE',
    },
  });
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

type TeamListResponse = {
  teams: TeamDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * GET /api/teams
 * 获取用户参与的团队列表
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = queryTeamSchema.parse(Object.fromEntries(searchParams));

  const where: Record<string, unknown> = {
    members: {
      some: {
        userId: authUser.userId,
      },
    },
  };

  if (query.type) {
    where.type = query.type;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const orderBy: Record<string, 'asc' | 'desc'> = {
    [query.sortBy]: query.sortOrder,
  };

  const [teams, total] = await Promise.all([
    prisma.team.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy,
    }),
    prisma.team.count({ where }),
  ]);

  const teamDetails = await Promise.all(
    teams.map((team: unknown) => mapTeamToDetail(team, true))
  );

  const response: TeamListResponse = {
    teams: teamDetails,
    total,
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
});

/**
 * POST /api/teams
 * 创建团队
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const validatedData = createTeamSchema.parse(body);

  const team = await prisma.team.create({
    data: {
      name: validatedData.name,
      type: validatedData.type,
      description: validatedData.description,
      logo: validatedData.logo,
      status: validatedData.status || TeamStatus.ACTIVE,
      metadata: validatedData.metadata as Prisma.JsonValue,
    },
  });

  await prisma.teamMember.create({
    data: {
      teamId: team.id,
      userId: authUser.userId,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  const teamDetail = await mapTeamToDetail(team, true);

  return createCreatedResponse(teamDetail);
});

/**
 * OPTIONS /api/teams
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
