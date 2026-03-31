/**
 * 获取当前用户资格状态API
 * GET /api/qualifications/me
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, message: '未授权' } as const, {
        status: 401,
      });
    }

    const { userId } = authUser;

    const qualification = await prisma.lawyerQualification.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        licenseNumber: true,
        fullName: true,
        idCardNumber: true,
        lawFirm: true,
        licensePhoto: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        reviewNotes: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: '获取资格状态成功',
      data: { qualification },
    } as const);
  } catch (error) {
    logger.error('获取资格状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '服务器错误',
        error: '未知错误',
      } as const,
      { status: 500 }
    );
  }
}
