/**
 * 企业认证管理API - 管理员专用
 * 支持获取企业认证列表
 */

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import type { EnterpriseListData, Pagination } from '@/types/admin-enterprise';
import { EnterpriseStatus } from '@/types/enterprise';
import { NextRequest } from 'next/server';

function isValidStatus(status: string): status is EnterpriseStatus {
  const validStatuses: EnterpriseStatus[] = [
    EnterpriseStatus.PENDING,
    EnterpriseStatus.UNDER_REVIEW,
    EnterpriseStatus.APPROVED,
    EnterpriseStatus.REJECTED,
    EnterpriseStatus.EXPIRED,
    EnterpriseStatus.SUSPENDED,
  ];
  return validStatuses.includes(status as EnterpriseStatus);
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getAuthUser(request);
  if (!user) {
    return Response.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const permissionError = await validatePermissions(request, 'enterprise:read');
  if (permissionError) {
    return permissionError;
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      parseInt(
        searchParams.get('pageSize') || searchParams.get('limit') || '20',
        10
      )
    )
  );
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (status !== null && status !== '' && !isValidStatus(status)) {
    return Response.json(
      { error: '无效参数', message: '状态值不正确' },
      { status: 400 }
    );
  }

  try {
    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (status && status !== '') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { enterpriseName: { contains: search, mode: 'insensitive' } },
        { creditCode: { contains: search, mode: 'insensitive' } },
        { legalPerson: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (startDate || endDate) {
      where.submittedAt = {};
      if (startDate) {
        (where.submittedAt as Record<string, unknown>).gte = new Date(
          startDate
        );
      }
      if (endDate) {
        (where.submittedAt as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * pageSize;
    const [total, enterprises] = await Promise.all([
      prisma.enterpriseAccount.count({ where }),
      prisma.enterpriseAccount.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { submittedAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              username: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    const pagination: Pagination = {
      total,
      page,
      pageSize,
      limit: pageSize,
      totalPages,
    };

    const responseData: EnterpriseListData = {
      enterprises: enterprises.map(enterprise => ({
        id: enterprise.id,
        userId: enterprise.userId,
        enterpriseName: enterprise.enterpriseName,
        creditCode: enterprise.creditCode,
        legalPerson: enterprise.legalPerson,
        industryType: enterprise.industryType,
        status: enterprise.status as EnterpriseStatus,
        submittedAt: enterprise.submittedAt,
        reviewedAt: enterprise.reviewedAt,
        reviewerId: enterprise.reviewerId,
        reviewNotes: enterprise.reviewNotes,
        expiresAt: enterprise.expiresAt,
        user: {
          email: enterprise.user.email,
          username: enterprise.user.username,
          name: enterprise.user.name,
        },
      })),
      pagination,
    };

    return Response.json({ data: responseData }, { status: 200 });
  } catch (error) {
    console.error('获取企业认证列表失败:', error);
    return Response.json(
      { error: '服务器错误', message: '获取企业认证列表失败' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
