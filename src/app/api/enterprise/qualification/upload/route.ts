/**
 * 企业资质上传API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  updateBusinessLicense,
  getEnterpriseAccountByUserId,
} from '@/lib/enterprise/service';

/**
 * 更新企业营业执照
 * @param request Next.js请求对象
 * @returns Next.js响应对象
 */
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

    // 检查用户是否已注册企业账号
    const existingAccount = await getEnterpriseAccountByUserId(user.userId);
    if (!existingAccount) {
      return NextResponse.json(
        {
          success: false,
          message: '未找到企业账号，请先注册',
          error: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // 解析请求体
    const body: { businessLicense: string } = await request.json();
    const { businessLicense } = body;

    // 验证营业执照数据
    if (!businessLicense || typeof businessLicense !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: '营业执照数据无效',
          error: 'INVALID_DATA',
        },
        { status: 400 }
      );
    }

    // 检查是否为Base64格式
    if (!businessLicense.startsWith('data:image/')) {
      return NextResponse.json(
        {
          success: false,
          message: '营业执照必须为Base64格式的图片',
          error: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }

    // 限制图片大小（假设Base64编码后不超过5MB）
    const base64Data = businessLicense.split(',')[1] || businessLicense;
    if (base64Data.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          message: '营业执照图片大小不能超过5MB',
          error: 'FILE_TOO_LARGE',
        },
        { status: 400 }
      );
    }

    // 更新营业执照
    const enterpriseAccount = await updateBusinessLicense(
      user.userId,
      businessLicense
    );

    return NextResponse.json(
      {
        success: true,
        message: '营业执照上传成功',
        data: enterpriseAccount,
      },
      { status: 200 }
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
