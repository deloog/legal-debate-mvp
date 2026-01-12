/**
 * 企业注册API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { createEnterpriseAccount } from '@/lib/enterprise/service';
import { validateEnterpriseRegistration } from '@/lib/enterprise/validator';
import type { EnterpriseRegisterRequest } from '@/types/enterprise';

export async function POST(request: NextRequest) {
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

    // 解析请求体
    const body: EnterpriseRegisterRequest = await request.json();
    const {
      enterpriseName,
      creditCode,
      legalPerson,
      industryType,
      businessLicense,
    } = body;

    // 验证输入数据
    const validation = validateEnterpriseRegistration({
      enterpriseName,
      creditCode,
      legalPerson,
      industryType,
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          message: '输入数据验证失败',
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // 创建企业账号
    const enterpriseAccount = await createEnterpriseAccount(user.userId, {
      enterpriseName,
      creditCode,
      legalPerson,
      industryType,
      businessLicense,
    });

    return NextResponse.json(
      {
        success: true,
        message: '企业注册成功，等待审核',
        data: { enterprise: enterpriseAccount },
      },
      { status: 201 }
    );
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
