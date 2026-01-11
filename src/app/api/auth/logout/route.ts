/**
 * 登出API
 * 支持登出当前设备或所有设备
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/prisma";
import type { LogoutResponse } from "@/types/auth";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<LogoutResponse>> {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "未认证或令牌已失效",
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { allDevices = false } = body as { allDevices?: boolean };

    if (allDevices) {
      // 登出所有设备：删除用户的所有会话
      await prisma.session.deleteMany({
        where: { userId: user.userId },
      });
    } else {
      // 登出当前设备：从Authorization header获取token并删除对应会话
      const authHeader = request.headers.get("authorization");
      if (!authHeader) {
        return NextResponse.json(
          {
            success: false,
            message: "缺少认证令牌",
          },
          { status: 400 },
        );
      }

      const token = authHeader.replace("Bearer ", "");
      await prisma.session.deleteMany({
        where: {
          userId: user.userId,
          sessionToken: token,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: allDevices ? "已登出所有设备" : "已登出当前设备",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "登出失败",
      },
      { status: 500 },
    );
  }
}
