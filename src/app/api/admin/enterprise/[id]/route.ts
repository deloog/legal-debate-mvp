/**
 * 企业认证详情API - 管理员专用
 * 支持获取企业认证详细信息
 */

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { EnterpriseStatus } from '@/types/enterprise';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface EnterpriseDetail {
  id: string;
  userId: string;
  enterpriseName: string;
  creditCode: string;
  legalPerson: string;
  industryType: string;
  businessLicense: string | null;
  status: EnterpriseStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewerId: string | null;
  reviewNotes: string | null;
  expiresAt: Date | null;
  verificationData: unknown | null;
  metadata: unknown | null;
  user: {
    id: string;
    email: string;
    username: string | null;
    name: string | null;
    phone: string | null;
  };
  reviews: Array<{
    id: string;
    reviewerId: string;
    reviewerName: string | null;
    reviewAction: string;
    reviewNotes: string | null;
    createdAt: Date;
  }>;
}

function isValidEnterpriseId(id: string): boolean {
  return id.length > 0 && /^[a-zA-Z0-9_-]+$/.test(id);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const permissionError = await validatePermissions(request, 'enterprise:read');
  if (permissionError) {
    return permissionError;
  }

  const enterpriseId = (await params).id;

  if (!isValidEnterpriseId(enterpriseId)) {
    return NextResponse.json(
      { error: '无效参数', message: '企业ID格式不正确' },
      { status: 400 }
    );
  }

  try {
    const enterprise = await prisma.enterpriseAccount.findUnique({
      where: { id: enterpriseId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
            phone: true,
          },
        },
        reviews: {
          include: {
            reviewer: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!enterprise) {
      return NextResponse.json(
        { error: '未找到', message: '企业认证不存在' },
        { status: 404 }
      );
    }

    const responseData: EnterpriseDetail = {
      id: enterprise.id,
      userId: enterprise.userId,
      enterpriseName: enterprise.enterpriseName,
      creditCode: enterprise.creditCode,
      legalPerson: enterprise.legalPerson,
      industryType: enterprise.industryType,
      businessLicense: enterprise.businessLicense,
      status: enterprise.status as EnterpriseStatus,
      submittedAt: enterprise.submittedAt,
      reviewedAt: enterprise.reviewedAt,
      reviewerId: enterprise.reviewerId,
      reviewNotes: enterprise.reviewNotes,
      expiresAt: enterprise.expiresAt,
      verificationData: enterprise.verificationData,
      metadata: enterprise.metadata,
      user: enterprise.user,
      reviews: enterprise.reviews.map(review => ({
        id: review.id,
        reviewerId: review.reviewerId,
        reviewerName: review.reviewer?.name || null,
        reviewAction: review.reviewAction,
        reviewNotes: review.reviewNotes,
        createdAt: review.createdAt,
      })),
    };

    return NextResponse.json({ data: responseData }, { status: 200 });
  } catch (error) {
    logger.error('获取企业认证详情失败:', error);
    return NextResponse.json(
      { error: '服务器错误', message: '获取企业认证详情失败' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
