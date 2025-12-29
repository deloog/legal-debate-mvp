import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/app/api/lib/errors/error-handler";
import { createSuccessResponse } from "@/app/api/lib/responses/api-response";
import {
  validatePathParam,
  validateRequestBody,
} from "@/app/api/lib/validation/validator";
import {
  uuidSchema,
  updateDebateSchema,
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
 * GET /api/v1/debates/[id]
 * 获取辩论详情
 */
export const GET = withErrorHandler(
  async (request: NextRequest, context: { params: { id: string } }) => {
    // 验证路径参数
    const id = validatePathParam(context.params.id, uuidSchema);

    // 查询辩论详情
    const debate = await prisma.debate.findUnique({
      where: { id },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            status: true,
            amount: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
          },
        },
        rounds: {
          include: {
            arguments: {
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { roundNumber: "asc" },
        },
      },
    });

    // 检查辩论是否存在
    if (!debate) {
      return createNotFoundResponse("Debate not found");
    }

    return createSuccessResponse(debate);
  },
);

/**
 * PUT /api/v1/debates/[id]
 * 更新辩论信息
 */
export const PUT = withErrorHandler(
  async (request: NextRequest, context: { params: { id: string } }) => {
    // 验证路径参数
    const id = validatePathParam(context.params.id, uuidSchema);

    // 验证请求体
    const body = await validateRequestBody(request, updateDebateSchema);

    // 检查辩论是否存在
    const existingDebate = await prisma.debate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingDebate) {
      return createNotFoundResponse("Debate not found");
    }

    // 更新辩论
    const updatedDebate = await prisma.debate.update({
      where: { id },
      data: {
        ...body,
        updatedAt: new Date(),
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    return createSuccessResponse(updatedDebate);
  },
);

/**
 * DELETE /api/v1/debates/[id]
 * 删除辩论
 */
export const DELETE = withErrorHandler(
  async (request: NextRequest, context: { params: { id: string } }) => {
    // 验证路径参数
    const id = validatePathParam(context.params.id, uuidSchema);

    // 检查辩论是否存在
    const existingDebate = await prisma.debate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingDebate) {
      return createNotFoundResponse("Debate not found");
    }

    // 删除辩论（级联删除相关的轮次和论点）
    await prisma.debate.delete({
      where: { id },
    });

    return createSuccessResponse({ message: "Debate deleted successfully" });
  },
);

/**
 * OPTIONS /api/v1/debates/[id]
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async (request: NextRequest) => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
});
