/**
 * 律师资格上传API
 * POST /api/qualifications/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { validateBasicInfo } from '@/lib/qualification/validator';
import {
  verifyLawyerQualification,
  buildVerificationData,
  requiresManualReview,
} from '@/lib/qualification/service';
import {
  QualificationStatus,
  QualificationErrorCode,
} from '@/types/qualification';
import type { QualificationUploadRequest } from '@/types/qualification';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

// TypeScript 重新加载触发点
export async function POST(request: NextRequest) {
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

    const { userId } = authUser;

    // 获取请求数据
    const body = (await request.json()) as QualificationUploadRequest;
    const { licenseNumber, fullName, idCardNumber, lawFirm, licensePhoto } =
      body;

    // 验证基础信息
    const validation = validateBasicInfo({
      licenseNumber,
      fullName,
      idCardNumber,
      lawFirm,
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          message: '信息验证失败',
          error: validation.errors,
        } as const,
        { status: 400 }
      );
    }

    // 获取格式化后的执业证号
    const formattedLicenseNumber = licenseNumber.replace(/[-\s]/g, '');

    // 检查执业证号是否已存在
    const existingQualification = await prisma.lawyerQualification.findUnique({
      where: { licenseNumber: formattedLicenseNumber },
    });

    if (existingQualification) {
      return NextResponse.json(
        {
          success: false,
          message: '执业证号已存在',
          error: QualificationErrorCode.QUALIFICATION_EXISTS,
        } as const,
        { status: 409 }
      );
    }

    // 检查用户是否已有资格认证记录
    const userQualifications = await prisma.lawyerQualification.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });

    const latestQualification = userQualifications[0];
    const canResubmit =
      latestQualification?.status === QualificationStatus.REJECTED ||
      latestQualification?.status === QualificationStatus.EXPIRED;

    if (userQualifications.length > 0 && !canResubmit) {
      return NextResponse.json(
        {
          success: false,
          message: '您已提交过律师资格认证',
          error: '已有资格认证记录',
        } as const,
        { status: 409 }
      );
    }

    // 调用第三方验证
    const verificationResult = await verifyLawyerQualification(
      formattedLicenseNumber
    );
    const verificationData = buildVerificationData(verificationResult);

    // 确定初始状态
    let initialStatus = QualificationStatus.PENDING;
    if (!requiresManualReview(verificationResult)) {
      // 自动通过验证
      initialStatus = QualificationStatus.APPROVED;
    } else {
      // 需要人工审核
      initialStatus = QualificationStatus.UNDER_REVIEW;
    }

    const qualificationData = {
      userId,
      licenseNumber: formattedLicenseNumber,
      fullName,
      idCardNumber,
      lawFirm,
      licensePhoto:
        typeof licensePhoto === 'string' && licensePhoto.trim() !== ''
          ? licensePhoto.trim()
          : null,
      status: initialStatus,
      verificationData: verificationData as Prisma.InputJsonValue,
    };

    // 被拒绝/过期的申请允许重新提交：复用原记录并重置审核状态
    const qualification =
      canResubmit && latestQualification
        ? await prisma.lawyerQualification.update({
            where: { id: latestQualification.id },
            data: {
              ...qualificationData,
              reviewedAt: null,
              reviewerId: null,
              reviewNotes: null,
              submittedAt: new Date(),
            },
          })
        : await prisma.lawyerQualification.create({
            data: qualificationData,
          });

    // 如果自动通过，更新用户角色
    if (initialStatus === QualificationStatus.APPROVED) {
      await prisma.user.update({
        where: { id: userId },
        data: { role: 'LAWYER' },
      });
    }

    // 返回结果
    return NextResponse.json(
      {
        success: true,
        message:
          initialStatus === QualificationStatus.APPROVED
            ? '律师资格验证通过'
            : '律师资格审核已提交，请等待管理员审核',
        data: {
          qualification: {
            id: qualification.id,
            licenseNumber: qualification.licenseNumber,
            fullName: qualification.fullName,
            lawFirm: qualification.lawFirm,
            licensePhoto: qualification.licensePhoto,
            status: qualification.status,
            submittedAt: qualification.submittedAt,
            reviewedAt: qualification.reviewedAt,
            reviewNotes: qualification.reviewNotes,
          },
        },
      } as const,
      { status: 201 }
    );
  } catch (error) {
    logger.error('律师资格上传失败:', error);
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
