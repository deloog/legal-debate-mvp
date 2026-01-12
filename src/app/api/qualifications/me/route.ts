/**
 * 获取当前用户资格状态API
 * GET /api/qualifications/me
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  try {
    // 验证认证
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权',
          error: '缺少认证信息',
        } as const,
        { status: 401 }
      );
    }

    // 从Authorization header中提取token
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权',
          error: '无效的认证格式',
        } as const,
        { status: 401 }
      );
    }

    const tokenResult = verifyToken(token);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权',
          error: '无效的token',
        } as const,
        { status: 401 }
      );
    }

    // 查询用户资格认证记录
    // 注意：这里需要等待 Prisma generate 完成后才能使用
    return NextResponse.json({
      success: true,
      message: '获取资格状态成功',
      data: {
        qualification: null,
      },
    } as const);
  } catch (error) {
    console.error('获取资格状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '服务器错误',
        error: error instanceof Error ? error.message : '未知错误',
      } as const,
      { status: 500 }
    );
  }
}
