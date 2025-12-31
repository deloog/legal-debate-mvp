import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/app/api/lib/errors/error-handler";
import { createSuccessResponse } from "@/app/api/lib/responses/api-response";
import { validatePathParam } from "@/app/api/lib/validation/validator";
import { uuidSchema } from "@/app/api/lib/validation/schemas";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

/**
 * GET /api/v1/cases/[id]
 * 获取单个案件详情
 */
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    // 验证路径参数
    const id = validatePathParam(params.id, uuidSchema);

    // 调用实际的数据库查询
    const caseItem = await prisma.case.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { createdAt: "desc" },
        },
        debates: {
          include: {
            rounds: {
              orderBy: { roundNumber: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!caseItem) {
      const { NotFoundError } = await import("@/app/api/lib/errors/api-error");
      throw new NotFoundError("Case");
    }

    return createSuccessResponse(caseItem);
  },
);

/**
 * PUT /api/v1/cases/[id]
 * 更新案件信息
 */
export const PUT = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    // 验证路径参数
    const id = validatePathParam(params.id, uuidSchema);

    // 检查请求体是否为空
    const contentType = request.headers.get("Content-Type");

    // 如果请求没有Content-Type，则认为是空请求体
    if (!contentType) {
      const { ValidationError } =
        await import("@/app/api/lib/errors/api-error");
      throw new ValidationError("Request body is required for PUT requests");
    }

    // 验证请求体
    const { updateCaseSchema } =
      await import("@/app/api/lib/validation/schemas");

    try {
      const body = await request.json();
      const validatedData = updateCaseSchema.parse(body);

      // 转换类型枚举值
      const typeMap: Record<
        string,
        | "CIVIL"
        | "CRIMINAL"
        | "ADMINISTRATIVE"
        | "COMMERCIAL"
        | "LABOR"
        | "INTELLECTUAL"
        | "OTHER"
      > = {
        civil: "CIVIL",
        criminal: "CRIMINAL",
        administrative: "ADMINISTRATIVE",
        commercial: "COMMERCIAL",
        labor: "LABOR",
        intellectual: "INTELLECTUAL",
        other: "OTHER",
      };

      const statusMap: Record<
        string,
        "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED"
      > = {
        draft: "DRAFT",
        active: "ACTIVE",
        completed: "COMPLETED",
        archived: "ARCHIVED",
      };

      // 调用实际的数据库操作
      const updatedCase = await prisma.case.update({
        where: { id },
        data: {
          title: validatedData.title,
          description: validatedData.description,
          type: validatedData.type ? typeMap[validatedData.type] : undefined,
          status: validatedData.status
            ? statusMap[validatedData.status]
            : undefined,
          amount: validatedData.amount
            ? new Prisma.Decimal(validatedData.amount)
            : undefined,
          caseNumber: validatedData.caseNumber,
          cause: validatedData.cause,
          court: validatedData.court,
          plaintiffName: validatedData.plaintiffName,
          defendantName: validatedData.defendantName,
          metadata: validatedData.metadata,
          updatedAt: new Date(),
        },
      });

      return createSuccessResponse(updatedCase);
    } catch (error) {
      // 如果是JSON解析错误，重新抛出为验证错误
      if (
        error instanceof SyntaxError &&
        error.message.includes("Unexpected end of JSON input")
      ) {
        const { ValidationError } =
          await import("@/app/api/lib/errors/api-error");
        throw new ValidationError("Invalid JSON in request body");
      }
      throw error;
    }
  },
);

/**
 * DELETE /api/v1/cases/[id]
 * 删除案件（软删除）
 */
export const DELETE = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    // 验证路径参数
    const id = validatePathParam(params.id, uuidSchema);

    // 调用实际的数据库操作（软删除）
    await prisma.case.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return new NextResponse(null, { status: 204 });
  },
);

/**
 * OPTIONS /api/v1/cases/[id]
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
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
