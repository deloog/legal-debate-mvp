import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createCreatedResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { CaseRole } from '@/types/case-collaboration';

/**
 * 创建团队成员的Zod schema
 */
const addTeamMemberSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空'),
  role: z.nativeEnum(CaseRole, { message: '角色必须有效' }),
  permissions: z.array(z.string()).optional(),
  notes: z.string().max(1000).optional(),
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

/**
 * 查询团队成员的Zod schema
 */
const queryTeamMembersSchema = z.object({
  role: z.nativeEnum(CaseRole).optional(),
  page: z.coerce.number().min(1, '页码必须大于0').default(1),
  limit: z.coerce
    .number()
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .default(20),
  sortBy: z.enum(['joinedAt', 'role']).default('joinedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * 检查用户是否有权限访问案件
 */
async function checkCaseAccess(
  caseId: string,
  userId: string
): Promise<boolean> {
  // 检查用户是否是案件所有者
  const caseRecord = await prisma.case.findUnique({
    where: {
      id: caseId,
      deletedAt: null,
    },
    select: {
      userId: true,
    },
  });

  if (!caseRecord) {
    return false;
  }

  // 如果是案件所有者，有权限
  if (caseRecord.userId === userId) {
    return true;
  }

  // 如果不是所有者，检查是否是团队成员
  const teamMember = await prisma.caseTeamMember.findFirst({
    where: {
      caseId,
      userId,
      deletedAt: null,
    },
  });

  return !!teamMember;
}

/**
 * 检查用户是否有权限添加/移除团队成员
 */
async function checkTeamManagementPermission(
  caseId: string,
  userId: string
): Promise<{ hasPermission: boolean; isOwner: boolean }> {
  const caseRecord = await prisma.case.findUnique({
    where: {
      id: caseId,
      deletedAt: null,
    },
    select: {
      userId: true,
    },
  });

  if (!caseRecord) {
    return { hasPermission: false, isOwner: false };
  }

  const isOwner = caseRecord.userId === userId;

  // 只有案件所有者可以添加/移除团队成员
  return { hasPermission: isOwner, isOwner };
}

/**
 * 映射团队成员数据
 */
async function mapTeamMemberDetail(
  member: unknown,
  includeUserInfo = true
): Promise<unknown> {
  if (!member || typeof member !== 'object') {
    throw new Error('Invalid team member data');
  }

  const memberObj = member as Record<string, unknown>;
  const detail: Record<string, unknown> = {
    id: String(memberObj.id || ''),
    caseId: String(memberObj.caseId || ''),
    userId: String(memberObj.userId || ''),
    role: memberObj.role,
    joinedAt: new Date(memberObj.joinedAt as string),
    notes: memberObj.notes as string | null,
    metadata: memberObj.metadata as Record<string, unknown> | null,
  };

  if (includeUserInfo && memberObj.user) {
    const user = memberObj.user as Record<string, unknown>;
    detail.user = {
      id: String(user.id || ''),
      name: user.name as string | null,
      email: user.email as string,
      avatar: user.avatar as string | null,
      role: user.role as string,
    };
  }

  if (memberObj.permissions) {
    detail.permissions = memberObj.permissions;
  }

  return detail;
}

/**
 * GET /api/cases/[id]/team-members
 * 获取案件的团队成员列表
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

    const caseId = params.id;

    // 检查是否有权限访问案件
    const hasAccess = await checkCaseAccess(caseId, authUser.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: '无权限', message: '您没有权限访问此案件' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = queryTeamMembersSchema.parse(
      Object.fromEntries(searchParams)
    );

    const where: Record<string, unknown> = {
      caseId,
      deletedAt: null,
    };

    if (query.role) {
      where.role = query.role;
    }

    const orderBy: Record<string, 'asc' | 'desc'> = {
      [query.sortBy]: query.sortOrder,
    };

    const [members, total] = await Promise.all([
      prisma.caseTeamMember.findMany({
        where,
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
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy,
      }),
      prisma.caseTeamMember.count({ where }),
    ]);

    const memberDetails = await Promise.all(
      members.map((member: unknown) => mapTeamMemberDetail(member, true))
    );

    return createSuccessResponse(
      { members: memberDetails, total, caseId },
      {
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
          hasNext: (query.page - 1) * query.limit + query.limit < total,
          hasPrevious: query.page > 1,
        },
      }
    );
  }
);

/**
 * POST /api/cases/[id]/team-members
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

    const caseId = params.id;

    // 检查是否有权限添加团队成员
    const { hasPermission } = await checkTeamManagementPermission(
      caseId,
      authUser.userId
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: '无权限', message: '只有案件所有者可以添加团队成员' },
        { status: 403 }
      );
    }

    // 验证案件是否存在
    const caseRecord = await prisma.case.findUnique({
      where: {
        id: caseId,
        deletedAt: null,
      },
    });

    if (!caseRecord) {
      return NextResponse.json(
        { error: '案件不存在', message: '指定的案件不存在' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = addTeamMemberSchema.parse(body);

    // 检查要添加的用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: {
        id: validatedData.userId,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: '用户不存在', message: '指定的用户不存在' },
        { status: 404 }
      );
    }

    // 检查用户是否已经是团队成员
    const existingMember = await prisma.caseTeamMember.findFirst({
      where: {
        caseId,
        userId: validatedData.userId,
        deletedAt: null,
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: '已存在', message: '该用户已经是团队成员' },
        { status: 409 }
      );
    }

    // 创建团队成员
    const member = await prisma.caseTeamMember.create({
      data: {
        caseId,
        userId: validatedData.userId,
        role: validatedData.role,
        permissions: (validatedData.permissions ||
          []) as unknown as Prisma.JsonValue,
        notes: validatedData.notes,
        metadata: (validatedData.metadata ||
          null) as unknown as Prisma.JsonValue,
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
      },
    });

    const memberDetail = await mapTeamMemberDetail(member, true);

    return createCreatedResponse(memberDetail);
  }
);

/**
 * OPTIONS /api/cases/[id]/team-members
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
