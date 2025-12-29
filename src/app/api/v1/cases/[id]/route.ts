import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/app/api/lib/errors/error-handler";
import { createSuccessResponse } from "@/app/api/lib/responses/api-response";
import { validatePathParam } from "@/app/api/lib/validation/validator";
import { uuidSchema } from "@/app/api/lib/validation/schemas";

/**
 * GET /api/v1/cases/[id]
 * 获取单个案件详情
 */
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    // 验证路径参数
    const id = validatePathParam(params.id, uuidSchema);

    // 这里应该调用实际的数据库查询
    // const caseItem = await prisma.case.findUnique({
    //   where: { id },
    //   include: {
    //     documents: true,
    //     debates: true,
    //   },
    // });

    // 模拟数据
    const caseItem = {
      id,
      title: "合同纠纷案件",
      description: "涉及买卖合同违约的纠纷案件",
      type: "civil",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
      debates: [],
    };

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

      // 这里应该调用实际的数据库操作
      // const updatedCase = await prisma.case.update({
      //   where: { id },
      //   data: {
      //     ...validatedData,
      //     updatedAt: new Date(),
      //   },
      // });

      // 模拟更新
      const updatedCase = {
        id,
        ...validatedData,
        updatedAt: new Date().toISOString(),
      };

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
 * 删除案件
 */
export const DELETE = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    // 验证路径参数
    const id = validatePathParam(params.id, uuidSchema);

    // 这里应该调用实际的数据库操作
    // await prisma.case.delete({
    //   where: { id },
    // });

    // 模拟删除
    console.log(`Deleting case with id: ${id}`);

    return new NextResponse(null, { status: 204 });
  },
);

/**
 * OPTIONS /api/v1/cases/[id]
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
