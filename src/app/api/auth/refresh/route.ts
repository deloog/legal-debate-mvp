/**
 * Token刷新API
 * 使用刷新令牌获取新的访问令牌
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyToken,
  generateAccessToken,
  generateRefreshToken,
} from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import type { JwtPayload } from "@/types/auth";
import type { RefreshTokenResponse } from "@/types/auth";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<RefreshTokenResponse>> {
  try {
    const body = await request.json();
    const { refreshToken } = body as { refreshToken?: string };

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          message: "刷新令牌不能为空",
          error: "MISSING_REFRESH_TOKEN",
        },
        { status: 400 },
      );
    }

    // 验证刷新令牌
    const verificationResult = verifyToken(refreshToken);

    if (!verificationResult.valid || !verificationResult.payload) {
      return NextResponse.json(
        {
          success: false,
          message: "无效或过期的刷新令牌",
          error: verificationResult.error,
        },
        { status: 401 },
      );
    }

    const payload = verificationResult.payload as JwtPayload;

    // 检查用户是否存在且状态正常
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "用户不存在",
          error: "USER_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "用户账户已被禁用",
          error: "USER_INACTIVE",
        },
        { status: 403 },
      );
    }

    // 检查刷新令牌是否存在于数据库中
    const session = await prisma.session.findFirst({
      where: {
        userId: user.id,
        sessionToken: refreshToken,
        expires: {
          gt: new Date(),
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "刷新令牌已失效或不存在",
          error: "SESSION_NOT_FOUND",
        },
        { status: 401 },
      );
    }

    // 生成新的访问令牌
    const newAccessToken = generateAccessToken(payload);

    // 生成新的刷新令牌（轮换策略）
    const newRefreshToken = generateRefreshToken(payload);

    // 更新数据库中的会话记录
    await prisma.session.update({
      where: { id: session.id },
      data: {
        sessionToken: newRefreshToken,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
      },
    });

    // 计算过期时间（秒）
    const expiresIn = 15 * 60; // 15分钟

    return NextResponse.json(
      {
        success: true,
        message: "令牌刷新成功",
        data: {
          token: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Token refresh error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "令牌刷新失败",
        error: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
