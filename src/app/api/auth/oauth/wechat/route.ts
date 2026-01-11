/**
 * 微信 OAuth API 路由
 */

import { NextRequest, NextResponse } from "next/server";
import { wechatOAuth } from "@/lib/auth/wechat-oauth";
import { OAuthService } from "@/lib/auth/oauth-service";

/**
 * 生成随机state
 */
function generateState(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * GET /api/auth/oauth/wechat/authorize - 获取微信授权URL
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const redirectUri = searchParams.get("redirect_uri");
    const state = generateState();

    const response = await wechatOAuth.authorize({
      state,
      redirectUri: redirectUri || undefined,
    });

    if (!response.success) {
      return NextResponse.json({ error: response.error }, { status: 400 });
    }

    return NextResponse.json({
      authorizeUrl: response.authorizeUrl,
      state: response.state,
    });
  } catch (error) {
    console.error("Wechat authorize error:", error);
    return NextResponse.json(
      { error: "Failed to generate authorize URL" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/auth/oauth/wechat/callback - 微信OAuth回调
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state } = body;

    if (!code || !state) {
      return NextResponse.json(
        { error: "Code and state are required" },
        { status: 400 },
      );
    }

    // 处理OAuth回调
    const callbackResponse = await wechatOAuth.callback({
      code,
      state,
    });

    if (!callbackResponse.success) {
      return NextResponse.json(
        { error: callbackResponse.error },
        { status: 400 },
      );
    }

    // 获取用户信息
    const userInfo = await wechatOAuth.getUserInfo(
      callbackResponse.token,
      callbackResponse.user.id,
    );

    // 处理登录
    const loginResult = await OAuthService.handleOAuthLogin(
      "wechat",
      callbackResponse.user.id,
      userInfo,
    );

    return NextResponse.json({
      success: true,
      user: loginResult.user,
      token: loginResult.token,
      isNewUser: loginResult.isNewUser,
    });
  } catch (error) {
    console.error("Wechat callback error:", error);
    return NextResponse.json(
      { error: "Failed to handle OAuth callback" },
      { status: 500 },
    );
  }
}
