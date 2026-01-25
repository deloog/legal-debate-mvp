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
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const caseId = params.id;

    // 检查是否有权限共享案件
    const sharePermission = await canShareCase(caseId, authUser.userId);
    if (!sharePermission.hasPermission) {
      return NextResponse.json(
        { error: '无权限', message: sharePermission.reason },
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
        { error: '案件不存在', message: '指定的案件不存在' },
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
    const accessPermission = await canAccessSharedCase(caseId, authUser.userId);
    if (!accessPermission.hasAccess) {
      return NextResponse.json(
        { error: '无权限', message: accessPermission.reason },
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
        { error: '案件不存在', message: '指定的案件不存在' },
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
    let sharedByUser = null;
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
