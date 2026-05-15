import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import { canAccessSharedCase } from '@/lib/case/share-permission-validator';
import { CasePermission } from '@/types/case-collaboration';

/**
 * 获取当前用户的文档列表
 * GET /api/v1/documents?search=&page=1&pageSize=20
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, message: '未授权' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? '';
    const caseId = searchParams.get('caseId') ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(
      50,
      parseInt(searchParams.get('pageSize') ?? '20', 10)
    );

    let accessibleCaseIds: string[] | null = null;
    if (caseId) {
      const access = await canAccessSharedCase(
        authUser.userId,
        caseId,
        CasePermission.VIEW_DOCUMENTS
      );
      if (!access.hasAccess) {
        return NextResponse.json(
          { success: false, message: '无权查看该案件文档' },
          { status: 403 }
        );
      }
    } else {
      const directCases = await prisma.case.findMany({
        where: { userId: authUser.userId, deletedAt: null },
        select: { id: true },
      });
      const caseIds = directCases.map(item => item.id);
      const teamMembers = await prisma.caseTeamMember.findMany({
        where: {
          userId: authUser.userId,
          deletedAt: null,
        },
        select: { caseId: true },
      });
      const teamCaseIds = teamMembers.map(item => item.caseId);
      accessibleCaseIds = [...new Set([...caseIds, ...teamCaseIds])];
    }

    const where = {
      deletedAt: null,
      ...(caseId
        ? { caseId }
        : accessibleCaseIds
          ? { caseId: { in: accessibleCaseIds } }
          : { userId: authUser.userId }),
      ...(search
        ? { filename: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          case: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.document.count({ where }),
    ]);

    logger.info('[Documents] List fetched', { userId: authUser.userId, total });

    return NextResponse.json({
      success: true,
      data: { documents, total, page, pageSize },
    });
  } catch (error) {
    logger.error('[Documents] List error:', error);
    return NextResponse.json(
      { success: false, message: '获取文档列表失败' },
      { status: 500 }
    );
  }
}
