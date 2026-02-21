/**
 * 管理员审核律师资格API
 * POST /api/admin/qualifications/[id]/review
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';
import type { ReviewRequest } from '@/types/qualification';
import { QualificationStatus } from '@/types/qualification';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { role } = tokenResult.payload;

    // 验证管理员权限
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
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
        error: error instanceof Error ? error.message : '未知错误',
      } as const,
      { status: 500 }
    );
  }
}
