/**
 * 管理员审核律师资格API
 * POST /api/admin/qualifications/[id]/review
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import type { ReviewRequest } from "@/types/qualification";

export async function POST(request: NextRequest) {
  try {
    // 验证认证
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        {
          success: false,
          message: "未授权",
          error: "缺少认证信息",
        } as const,
        { status: 401 },
      );
    }

    const tokenResult = verifyToken(authHeader);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json(
        {
          success: false,
          message: "未授权",
          error: "无效的token",
        } as const,
        { status: 401 },
      );
    }

    const { role } = tokenResult.payload;

    // 验证管理员权限
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "权限不足",
          error: "需要管理员权限",
        } as const,
        { status: 403 },
      );
    }

    // 获取请求数据
    const body = (await request.json()) as ReviewRequest;
    const { approved, reviewNotes } = body;

    // 验证请求数据
    if (typeof approved !== "boolean" || !reviewNotes) {
      return NextResponse.json(
        {
          success: false,
          message: "参数错误",
          error: "approved和reviewNotes为必填项",
        } as const,
        { status: 400 },
      );
    }

    // 更新资格认证记录
    // 注意：这里需要等待 Prisma generate 完成后才能使用

    return NextResponse.json({
      success: true,
      message: approved ? "审核通过" : "审核拒绝",
      data: {
        qualification: null,
      },
    } as const);
  } catch (error) {
    console.error("审核律师资格失败:", error);
    return NextResponse.json(
      {
        success: false,
        message: "服务器错误",
        error: error instanceof Error ? error.message : "未知错误",
      } as const,
      { status: 500 },
    );
  }
}
