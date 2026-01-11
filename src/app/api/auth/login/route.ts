/**
 * 用户登录 API
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { validateLoginRequest } from "@/lib/auth/validation";
import { generateToken } from "@/lib/auth/jwt";
import type { AuthResponse, LoginRequest } from "@/types/auth";
import type { JwtPayload } from "@/types/auth";
import { AuthErrorCode } from "@/types/auth";

/**
 * POST /api/auth/login
 * 用户登录
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 解析请求体
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // 验证输入数据
    const validation = validateLoginRequest(email, password);
    if (!validation.valid) {
      const response: AuthResponse = {
        success: false,
        message: "输入验证失败",
        error: validation.errors.join("; "),
      };
      return NextResponse.json(response, { status: 400 });
    }

    // 查找用户（使用原生 SQL 以包含 password 字段）
    const users = await prisma.$queryRaw<
      Array<{
        id: string;
        email: string;
        username: string | null;
        name: string | null;
        role: string;
        status: string;
        password: string | null;
        loginCount: number;
        createdAt: Date;
      }>
    >`
      SELECT id, email, username, name, role, status, password, "loginCount", "createdAt"
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;
    const user = users[0] || null;

    if (!user) {
      const response: AuthResponse = {
        success: false,
        message: "邮箱或密码错误",
        error: AuthErrorCode.INVALID_CREDENTIALS,
      };
      return NextResponse.json(response, { status: 401 });
    }

    // 检查用户状态
    if (user.status !== "ACTIVE") {
      const statusMap: Record<string, string> = {
        SUSPENDED: "账号已被暂停",
        BANNED: "账号已被封禁",
        INACTIVE: "账号未激活",
      };
      const response: AuthResponse = {
        success: false,
        message: statusMap[user.status] || "账号状态异常",
        error: AuthErrorCode.INVALID_CREDENTIALS,
      };
      return NextResponse.json(response, { status: 403 });
    }

    // 验证密码
    if (!user.password) {
      // 用户没有密码，可能是第三方登录用户
      const response: AuthResponse = {
        success: false,
        message: "此账号使用第三方登录",
        error: AuthErrorCode.INVALID_PASSWORD,
      };
      return NextResponse.json(response, { status: 401 });
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      const response: AuthResponse = {
        success: false,
        message: "邮箱或密码错误",
        error: AuthErrorCode.INVALID_CREDENTIALS,
      };
      return NextResponse.json(response, { status: 401 });
    }

    // 更新最后登录时间和登录次数
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: user.loginCount + 1,
      },
    });

    // 生成 JWT Token
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const token = generateToken(payload);

    // 返回响应
    const response: AuthResponse = {
      success: true,
      message: "登录成功",
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
        },
        token,
      },
    };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("登录失败:", error);
    const response: AuthResponse = {
      success: false,
      message: "登录失败，请稍后重试",
      error: "SERVER_ERROR",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * 不支持其他 HTTP 方法
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, message: "方法不允许" },
    { status: 405 },
  );
}
