/**
 * 管理员审核律师资格API
 * POST /api/admin/qualifications/[id]/review
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import type { ReviewRequest } from '@/types/qualification';
import { QualificationStatus } from '@/types/qualification';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证认证（支持 cookie 和 Bearer token）
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权',
          error: '请先登录',
        } as const,
        { status: 401 }
      );
    }

    // 从 DB 查询角色，避免依赖可能过期的 JWT payload
    const currentUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });

    // 验证管理员权限
    if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        {
          success: false,
          message: '权限不足',
          error: '需要管理员权限',
        } as const,
        { status: 403 }
      );
    }

    // 获取请求数据
    const body = (await request.json()) as ReviewRequest;
    const { approved, reviewNotes } = body;

    // 验证请求数据
    if (typeof approved !== 'boolean' || !reviewNotes) {
      return NextResponse.json(
        {
          success: false,
          message: '参数错误',
          error: 'approved和reviewNotes为必填项',
        } as const,
        { status: 400 }
      );
    }

    // 获取资格ID
    const { id: qualificationId } = await params;

    // 更新资格认证记录
    const qualification = await prisma.lawyerQualification.update({
      where: { id: qualificationId },
      data: {
        status: approved
          ? QualificationStatus.APPROVED
          : QualificationStatus.REJECTED,
        reviewedAt: new Date(),
        reviewNotes,
      },
    });

    // 如果审核通过，更新用户角色
    if (approved) {
      await prisma.user.update({
        where: { id: qualification.userId },
        data: { role: 'LAWYER' },
      });
    }

    return NextResponse.json({
      success: true,
      message: approved ? '审核通过' : '审核拒绝',
      data: {
        qualification: {
          id: qualification.id,
          licenseNumber: qualification.licenseNumber,
          fullName: qualification.fullName,
          lawFirm: qualification.lawFirm,
          status: qualification.status,
          submittedAt: qualification.submittedAt,
          reviewedAt: qualification.reviewedAt,
          reviewNotes: qualification.reviewNotes,
        },
      },
    } as const);
  } catch (error) {
    logger.error('审核律师资格失败:', error);
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
