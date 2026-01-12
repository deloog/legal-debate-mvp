/**
 * 管理员审核企业账号API
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/permissions";
import { reviewEnterpriseAccount } from "@/lib/enterprise/service";
import { UserRole } from "@/types/auth";
import type { EnterpriseReviewRequest } from "@/types/enterprise";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // 获取认证用户信息
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "未登录",
          error: "UNAUTHORIZED",
        },
        { status: 401 },
      );
    }

    // 检查权限
    const hasPermission = requireRole(user.role, [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
    ]);
    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          message: "权限不足",
          error: "FORBIDDEN",
        },
        { status: 403 },
      );
    }

    // 解析请求体
    const body: EnterpriseReviewRequest = await request.json();
    const { reviewAction, reviewNotes } = body;

    // 审核企业账号
    const enterpriseAccount = await reviewEnterpriseAccount(
      params.id,
      user.userId,
      reviewAction,
      reviewNotes,
    );

    return NextResponse.json({
      success: true,
      message: "审核完成",
      data: enterpriseAccount,
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          error: error.name,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "服务器内部错误",
        error: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
