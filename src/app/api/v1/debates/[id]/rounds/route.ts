import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createCreatedResponse,
} from '@/app/api/lib/responses/api-response';
import {
  validateRequestBody,
  validatePathParam,
} from '@/app/api/lib/validation/validator';
import { uuidSchema } from '@/app/api/lib/validation/schemas';
import { prisma } from '@/lib/db/prisma';
import { DebateStatus, RoundStatus } from '@prisma/client';
import { getAuthUser } from '@/lib/middleware/auth';
import { canAccessDebateByCasePermission } from '@/lib/debate/access';
import { CasePermission } from '@/types/case-collaboration';

/**
 * POST /api/v1/debates/[id]/rounds
 * 开始新轮次
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未认证' },
        { status: 401 }
      );
    }

    // Next.js 15+ requires awaiting params
    const resolvedParams = await context.params;

    // 验证路径参数
    const debateId = validatePathParam(resolvedParams.id, uuidSchema);

    // 验证请求体 - 这个API不接受任何参数，自动计算轮次号
    // 使用z.object({})接受空请求体
    await validateRequestBody(request, z.object({}).passthrough());

    // 使用事务确保数据一致性
    const result = await prisma.$transaction(async tx => {
      // 1. 获取当前辩论信息
      const debate = await tx.debate.findUnique({
        where: { id: debateId },
        select: { currentRound: true, status: true, userId: true },
      });

      if (!debate) {
        throw new Error('Debate not found');
      }

      const access = await canAccessDebateByCasePermission(
        authUser.userId,
        debateId,
        CasePermission.EDIT_DEBATES
      );
      if (!access.allowed) {
        throw new Error('Forbidden');
      }

      // 检查辩论状态
      if (
        debate.status !== DebateStatus.DRAFT &&
        debate.status !== DebateStatus.IN_PROGRESS
      ) {
        throw new Error('Cannot create round for completed or archived debate');
      }

      // 2. 计算新轮次号：基于已存在轮次的最大编号，避免与 PENDING 轮次冲突
      const maxRoundAgg = await tx.debateRound.aggregate({
        where: { debateId },
        _max: { roundNumber: true },
      });
      const newRoundNumber = (maxRoundAgg._max.roundNumber ?? 0) + 1;

      // 3. 创建新轮次，初始状态为 PENDING
      //    由 SSE 路由在建立连接时激活为 IN_PROGRESS 并声明 startedAt 软锁
      const newRound = await tx.debateRound.create({
        data: {
          debateId,
          roundNumber: newRoundNumber,
          status: RoundStatus.PENDING,
        },
        include: {
          debate: {
            select: {
              id: true,
              title: true,
              currentRound: true,
              status: true,
            },
          },
        },
      });

      // 4. 更新辩论状态为进行中（currentRound 由 generate/stream 在轮次完成时更新，
      //    此处不预先更新，避免 SSE 的 startFromRound 计算跳过当前新建轮次）
      await tx.debate.update({
        where: { id: debateId },
        data: {
          status: DebateStatus.IN_PROGRESS,
          updatedAt: new Date(),
        },
      });

      return newRound;
    });

    return createCreatedResponse(result);
  }
);

/**
 * GET /api/v1/debates/[id]/rounds
 * 获取辩论轮次列表
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未认证' },
        { status: 401 }
      );
    }

    // Next.js 15+ requires awaiting params
    const resolvedParams = await context.params;

    // 验证路径参数
    const debateId = validatePathParam(resolvedParams.id, uuidSchema);

    // 所有权校验
    const access = await canAccessDebateByCasePermission(
      authUser.userId,
      debateId,
      CasePermission.VIEW_DEBATES
    );
    if (!access.allowed || !access.debate) {
      return NextResponse.json(
        {
          success: false,
          error: access.reason === '辩论不存在' ? '辩论不存在' : '无权访问',
        },
        { status: access.reason === '辩论不存在' ? 404 : 403 }
      );
    }

    // 查询轮次列表
    const rounds = await prisma.debateRound.findMany({
      where: { debateId },
      include: {
        arguments: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { roundNumber: 'asc' },
    });

    return createSuccessResponse(rounds);
  }
);

/**
 * OPTIONS /api/v1/debates/[id]/rounds
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
