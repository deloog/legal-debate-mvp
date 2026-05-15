/**
 * 企业注册API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
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
    const { enterpriseName, creditCode, legalPerson, industryType } = body;
    const rawBody = body as EnterpriseRegisterRequest & {
      businessLicense?: unknown;
    };

    if (
      typeof rawBody.businessLicense === 'string' &&
      rawBody.businessLicense.trim().length > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: '营业执照请通过企业资质上传接口提交',
          error: 'LICENSE_UPLOAD_REQUIRED',
        },
        { status: 400 }
      );
    }

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
    logger.error('企业注册失败:', error);

    if (error instanceof Error) {
      if (error.name === 'ENTERPRISE_CREDIT_CODE_EXISTS') {
        return NextResponse.json(
          {
            success: false,
            message: error.message,
            error: 'CREDIT_CODE_EXISTS',
          },
          { status: 409 }
        );
      }

      if (error.name === 'ENTERPRISE_ACCOUNT_EXISTS') {
        return NextResponse.json(
          {
            success: false,
            message: error.message,
            error: 'ENTERPRISE_ACCOUNT_EXISTS',
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: '企业注册失败，请稍后重试',
        error: 'REGISTRATION_FAILED',
      },
      { status: 500 }
    );
  }
}
