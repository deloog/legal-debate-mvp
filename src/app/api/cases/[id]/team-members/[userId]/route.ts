import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createNoContentResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { CaseRole } from '@/types/case-collaboration';

/**
 * 更新团队成员的Zod schema
 */
const updateTeamMemberSchema = z.object({
  role: z.nativeEnum(CaseRole, { message: '角色必须有效' }).optional(),
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
 * 检查用户是否有权限访问案件
 */
async function checkCaseAccess(
  caseId: string,
  userId: string
): Promise<boolean> {
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

  if (caseRecord.userId === userId) {
    return true;
  }

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
 * 检查用户是否有权限管理团队成员
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
 * GET /api/cases/[id]/team-members/[userId]
 * 获取指定团队成员的详细信息
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    {
      params,
    }: {
      params: { id: string; userId: string };
    }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id: caseId, userId: targetUserId } = params;

    const hasAccess = await checkCaseAccess(caseId, authUser.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: '无权限', message: '您没有权限访问此案件' },
        { status: 403 }
      );
    }

    const member = await prisma.caseTeamMember.findFirst({
      where: {
        caseId,
        userId: targetUserId,
        deletedAt: null,
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

    if (!member) {
      return NextResponse.json(
        { error: '未找到', message: '团队成员不存在' },
        { status: 404 }
      );
    }

    const memberDetail = await mapTeamMemberDetail(member, true);

    return createSuccessResponse(memberDetail);
  }
);

/**
 * PUT /api/cases/[id]/team-members/[userId]
 * 更新指定团队成员的信息
 */
export const PUT = withErrorHandler(
  async (
    request: NextRequest,
    {
      params,
    }: {
      params: { id: string; userId: string };
    }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id: caseId, userId: targetUserId } = params;

    const { hasPermission } = await checkTeamManagementPermission(
      caseId,
      authUser.userId
    );

    if (!hasPermission) {
      return NextResponse.json(
        {
          error: '无权限',
          message: '只有案件所有者可以更新团队成员信息',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateTeamMemberSchema.parse(body);

    const existingMember = await prisma.caseTeamMember.findFirst({
      where: {
        caseId,
        userId: targetUserId,
        deletedAt: null,
      },
    });

    if (!existingMember) {
      return NextResponse.json(
        { error: '未找到', message: '团队成员不存在' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (validatedData.role) {
      updateData.role = validatedData.role;
    }

    if (validatedData.permissions !== undefined) {
      updateData.permissions = (validatedData.permissions ||
        []) as unknown as Prisma.JsonValue;
    }

    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }

    if (validatedData.metadata !== undefined) {
      updateData.metadata = (validatedData.metadata ||
        null) as unknown as Prisma.JsonValue;
    }

    const updatedMember = await prisma.caseTeamMember.update({
      where: {
        id: existingMember.id,
      },
      data: updateData,
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

    const memberDetail = await mapTeamMemberDetail(updatedMember, true);

    return createSuccessResponse(memberDetail);
  }
);

/**
 * DELETE /api/cases/[id]/team-members/[userId]
 * 移除指定的团队成员（软删除）
 */
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    {
      params,
    }: {
      params: { id: string; userId: string };
    }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id: caseId, userId: targetUserId } = params;

    const { hasPermission } = await checkTeamManagementPermission(
      caseId,
      authUser.userId
    );

    if (!hasPermission) {
      return NextResponse.json(
        {
          error: '无权限',
          message: '只有案件所有者可以移除团队成员',
        },
        { status: 403 }
      );
    }

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
      return NextResponse.json(
        { error: '案件不存在', message: '指定的案件不存在' },
        { status: 404 }
      );
    }

    // 检查是否要删除案件所有者
    if (caseRecord.userId === targetUserId) {
      return NextResponse.json(
        {
          error: '非法操作',
          message: '不能移除案件所有者',
        },
        { status: 400 }
      );
    }

    const member = await prisma.caseTeamMember.findFirst({
      where: {
        caseId,
        userId: targetUserId,
        deletedAt: null,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: '未找到', message: '团队成员不存在' },
        { status: 404 }
      );
    }

    // 软删除团队成员
    await prisma.caseTeamMember.update({
      where: {
        id: member.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return createNoContentResponse();
  }
);

/**
 * OPTIONS /api/cases/[id]/team-members/[userId]
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
