/**
 * 获取当前用户企业信息API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getEnterpriseAccountByUserId } from '@/lib/enterprise/service';

export async function GET(request: NextRequest) {
  try {
    // 获取认证用户信息
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: '未登录',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // 获取企业账号信息
    const enterpriseAccount = await getEnterpriseAccountByUserId(user.userId);

    if (!enterpriseAccount) {
      return NextResponse.json(
        {
          success: false,
          message: '未找到企业账号',
          error: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { enterprise: enterpriseAccount },
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          error: error.name,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: '服务器内部错误',
        error: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
