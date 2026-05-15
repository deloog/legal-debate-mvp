/**
 * 案件共享API
 * 实现案件共享功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import {
  canShareCase,
  canAccessSharedCase,
} from '@/lib/case/share-permission-validator';
import { Prisma } from '@prisma/client';
import {
  checkResourceOwnership,
  ResourceType,
} from '@/lib/middleware/resource-permission';

/**
 * 共享案件的Zod schema
 */
const shareCaseSchema = z.object({
  sharedWithTeam: z.boolean().describe('是否共享给团队'),
  notes: z.string().max(500).optional(),
});

/**
 * POST /api/cases/[id]/share
 * 共享案件给团队
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const caseId = (await params).id;

    // 检查是否有权限共享案件
    const sharePermission = await canShareCase(authUser.userId, caseId);
    if (!sharePermission.hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: sharePermission.reason ?? '无权共享此案件',
          },
        },
        { status: 403 }
      );
    }

    // 验证案件是否存在
    const caseRecord = await prisma.case.findUnique({
      where: {
        id: caseId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        ownerType: true,
        sharedWithTeam: true,
      },
    });

    if (!caseRecord) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '案件不存在' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = shareCaseSchema.parse(body);

    // 构建metadata对象
    const newMetadata: Prisma.JsonValue = {
      sharedAt: validatedData.sharedWithTeam ? new Date().toISOString() : null,
      sharedBy: validatedData.sharedWithTeam ? authUser.userId : null,
      sharedNotes: validatedData.notes,
    };

    // 更新案件共享状态
    const updatedCase = await prisma.case.update({
      where: {
        id: caseId,
      },
      data: {
        sharedWithTeam: validatedData.sharedWithTeam,
        metadata: newMetadata,
      },
      select: {
        id: true,
        title: true,
        ownerType: true,
        sharedWithTeam: true,
        updatedAt: true,
      },
    });

    return createSuccessResponse({
      case: updatedCase,
      message: validatedData.sharedWithTeam
        ? '案件已成功共享给团队'
        : '案件共享已取消',
    });
  }
);

/**
 * GET /api/cases/[id]/share
 * 获取案件共享状态
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const caseId = (await params).id;

    // 所有者/管理员直接通过；其余用户走共享案件访问校验
    const ownershipResult = await checkResourceOwnership(
      authUser.userId,
      caseId,
      ResourceType.CASE
    );
    const accessPermission = ownershipResult.hasPermission
      ? { hasAccess: true }
      : await canAccessSharedCase(authUser.userId, caseId);
    if (!accessPermission.hasAccess) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: accessPermission.reason ?? '无权访问此案件',
          },
        },
        { status: 403 }
      );
    }

    // 查询案件信息
    const caseRecord = await prisma.case.findUnique({
      where: {
        id: caseId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        ownerType: true,
        sharedWithTeam: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
      },
    });

    if (!caseRecord) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '案件不存在' } },
        { status: 404 }
      );
    }

    // 获取共享元数据
    const metadata = caseRecord.metadata as Record<string, unknown> | null;
    const metadataObj =
      metadata && typeof metadata === 'object'
        ? (metadata as Record<string, unknown>)
        : {};

    const sharedAt =
      typeof metadataObj.sharedAt === 'string'
        ? new Date(metadataObj.sharedAt)
        : null;
    const sharedBy =
      typeof metadataObj.sharedBy === 'string' ? metadataObj.sharedBy : null;
    const sharedNotes =
      typeof metadataObj.sharedNotes === 'string'
        ? metadataObj.sharedNotes
        : undefined;

    // 查询共享者信息
    let sharedByUser: {
      id: string;
      name: string | null;
      email: string;
      avatar: string | null;
    } | null = null;
    if (sharedBy) {
      const sharedByUserRecord = await prisma.user.findUnique({
        where: { id: sharedBy },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      });
      if (sharedByUserRecord) {
        sharedByUser = {
          id: sharedByUserRecord.id,
          name: sharedByUserRecord.name,
          email: sharedByUserRecord.email,
          avatar: sharedByUserRecord.avatar,
        };
      }
    }

    return createSuccessResponse({
      case: {
        id: caseRecord.id,
        title: caseRecord.title,
        ownerType: caseRecord.ownerType,
        sharedWithTeam: caseRecord.sharedWithTeam,
        sharedAt,
        sharedBy: sharedByUser,
        sharedNotes,
      },
      isOwner: caseRecord.userId === authUser.userId,
      accessType: accessPermission.accessType,
      permissions: accessPermission.permissions,
    });
  }
);

/**
 * OPTIONS /api/cases/[id]/share
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
