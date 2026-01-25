import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createNoContentResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';

// 更新证人验证模式
const updateWitnessSchema = z.object({
  name: z.string().min(1, '证人姓名不能为空').max(200).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  relationship: z.string().max(200).optional(),
  testimony: z.string().max(10000).optional(),
  courtScheduleId: z.string().optional(),
  status: z
    .enum(['NEED_CONTACT', 'CONTACTED', 'CONFIRMED', 'DECLINED', 'CANCELLED'])
    .optional(),
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

// 证人详情类型
type WitnessDetail = {
  id: string;
  caseId: string;
  name: string;
  phone: string | null;
  address: string | null;
  relationship: string | null;
  testimony: string | null;
  courtScheduleId: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  case?: {
    id: string;
    title: string;
  };
  courtSchedule?: {
    id: string;
    title: string;
  } | null;
};

// 映射证人数据到详情
async function mapWitnessToDetail(
  witness: unknown,
  includeCase = true,
  includeCourtSchedule = false
): Promise<WitnessDetail> {
  if (!witness || typeof witness !== 'object') {
    throw new Error('无效的证人数据');
  }

  const witnessObj = witness as Record<string, unknown>;
  const detail: WitnessDetail = {
    id: String(witnessObj.id || ''),
    caseId: String(witnessObj.caseId || ''),
    name: String(witnessObj.name || ''),
    phone: witnessObj.phone as string | null,
    address: witnessObj.address as string | null,
    relationship: witnessObj.relationship as string | null,
    testimony: witnessObj.testimony as string | null,
    courtScheduleId: witnessObj.courtScheduleId as string | null,
    status: String(witnessObj.status || ''),
    metadata: witnessObj.metadata as Record<string, unknown> | null,
    createdAt: new Date(witnessObj.createdAt as string),
    updatedAt: new Date(witnessObj.updatedAt as string),
  };

  if (includeCase) {
    const caseObj = witnessObj.case as Record<string, unknown> | undefined;
    detail.case = {
      id: String(caseObj?.id || ''),
      title: String(caseObj?.title || ''),
    };
  }

  if (includeCourtSchedule && witnessObj.courtScheduleId) {
    const courtScheduleObj = witnessObj.courtSchedule as
      | Record<string, unknown>
      | undefined;
    if (courtScheduleObj) {
      detail.courtSchedule = {
        id: String(courtScheduleObj.id || ''),
        title: String(courtScheduleObj.title || ''),
      };
    }
  }

  return detail;
}

/**
 * GET /api/witnesses/[id] - 获取证人详情
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

    const witnessId = params.id;

    // 获取证人详情
    const witness = await prisma.witness.findFirst({
      where: {
        id: witnessId,
        case: {
          userId: authUser.userId,
        },
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
          },
        },
        courtSchedule: {
          select: {
            id: true,
            title: true,
          },
        },
      } as Prisma.WitnessInclude,
    });

    if (!witness) {
      return NextResponse.json(
        { error: '证人不存在或无权限', message: '证人不存在或您没有权限访问' },
        { status: 404 }
      );
    }

    const witnessDetail = await mapWitnessToDetail(witness, true, true);

    return createSuccessResponse(witnessDetail);
  }
);

/**
 * PATCH /api/witnesses/[id] - 更新证人
 */
export const PATCH = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const witnessId = params.id;

    // 验证证人是否存在且属于当前用户
    const existingWitness = await prisma.witness.findFirst({
      where: {
        id: witnessId,
        case: {
          userId: authUser.userId,
        },
      },
    });

    if (!existingWitness) {
      return NextResponse.json(
        { error: '证人不存在或无权限', message: '证人不存在或您没有权限访问' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = updateWitnessSchema.parse(body);

    // 验证法庭日程是否存在（如果提供了courtScheduleId）
    if (validatedData.courtScheduleId) {
      const courtScheduleExists = await prisma.courtSchedule.findFirst({
        where: {
          id: validatedData.courtScheduleId,
          caseId: existingWitness.caseId,
        },
      });

      if (!courtScheduleExists) {
        return NextResponse.json(
          { error: '法庭日程不存在', message: '法庭日程不存在或不属于该案件' },
          { status: 404 }
        );
      }
    }

    // 更新证人
    const updatedWitness = await prisma.witness.update({
      where: { id: witnessId },
      data: {
        name: validatedData.name,
        phone: validatedData.phone,
        address: validatedData.address,
        relationship: validatedData.relationship,
        testimony: validatedData.testimony,
        courtScheduleId: validatedData.courtScheduleId,
        status: validatedData.status,
        metadata: validatedData.metadata as Prisma.InputJsonValue,
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
          },
        },
        courtSchedule: {
          select: {
            id: true,
            title: true,
          },
        },
      } as Prisma.WitnessInclude,
    });

    const witnessDetail = await mapWitnessToDetail(updatedWitness, true, true);

    return createSuccessResponse(witnessDetail);
  }
);

/**
 * DELETE /api/witnesses/[id] - 删除证人
 */
export const DELETE = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const witnessId = params.id;

    // 验证证人是否存在且属于当前用户
    const existingWitness = await prisma.witness.findFirst({
      where: {
        id: witnessId,
        case: {
          userId: authUser.userId,
        },
      },
    });

    if (!existingWitness) {
      return NextResponse.json(
        { error: '证人不存在或无权限', message: '证人不存在或您没有权限访问' },
        { status: 404 }
      );
    }

    // 删除证人
    await prisma.witness.delete({
      where: { id: witnessId },
    });

    return createNoContentResponse();
  }
);

/**
 * OPTIONS /api/witnesses/[id] - CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
