import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/app/api/lib/errors/error-handler";
import {
  createSuccessResponse,
  createCreatedResponse,
} from "@/app/api/lib/responses/api-response";
import {
  validateRequestBody,
  validatePathParam,
} from "@/app/api/lib/validation/validator";
import {
  uuidSchema,
  createDebateRoundSchema,
} from "@/app/api/lib/validation/schemas";
import { prisma } from "@/lib/db/prisma";
import { DebateStatus, RoundStatus } from "@prisma/client";

/**
 * 创建404响应的辅助函数
 */
function createNotFoundResponse(
  message: string = "Resource not found",
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message,
        timestamp: new Date().toISOString(),
      },
    },
    { status: 404 },
  );
}

/**
 * POST /api/v1/debates/[id]/rounds
 * 开始新轮次
 */
export const POST = withErrorHandler(
  async (request: NextRequest, context: { params: { id: string } }) => {
    // 验证路径参数
    const debateId = validatePathParam(context.params.id, uuidSchema);

    // 验证请求体
    const body = await validateRequestBody(request, createDebateRoundSchema);

    // 使用事务确保数据一致性
    const result = await prisma.$transaction(async (tx) => {
      // 1. 获取当前辩论信息
      const debate = await tx.debate.findUnique({
        where: { id: debateId },
        select: { currentRound: true, status: true },
      });

      if (!debate) {
        throw new Error("Debate not found");
      }

      // 检查辩论状态
      if (
        debate.status !== DebateStatus.DRAFT &&
        debate.status !== DebateStatus.IN_PROGRESS
      ) {
        throw new Error("Cannot create round for completed or archived debate");
      }

      // 2. 计算新轮次号
      const newRoundNumber = debate.currentRound + 1;

      // 3. 创建新轮次
      const newRound = await tx.debateRound.create({
        data: {
          debateId,
          roundNumber: newRoundNumber,
          status: RoundStatus.IN_PROGRESS,
          startedAt: new Date(),
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

      // 4. 更新辩论的当前轮次和状态
      await tx.debate.update({
        where: { id: debateId },
        data: {
          currentRound: newRoundNumber,
          status: DebateStatus.IN_PROGRESS,
          updatedAt: new Date(),
        },
      });

      return newRound;
    });

    return createCreatedResponse(result);
  },
);

/**
 * GET /api/v1/debates/[id]/rounds
 * 获取辩论轮次列表
 */
export const GET = withErrorHandler(
  async (request: NextRequest, context: { params: { id: string } }) => {
    // 验证路径参数
    const debateId = validatePathParam(context.params.id, uuidSchema);

    // 查询轮次列表
    const rounds = await prisma.debateRound.findMany({
      where: { debateId },
      include: {
        arguments: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { roundNumber: "asc" },
    });

    return createSuccessResponse(rounds);
  },
);

/**
 * OPTIONS /api/v1/debates/[id]/rounds
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async (request: NextRequest) => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
});
