import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkResourceOwnership,
  createPermissionErrorResponse,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { checkPermission } from '@/lib/case/case-permission-manager';
import { CasePermission } from '@/types/case-collaboration';

/**
 * GET /api/v1/cases/[id]/package/review/latest
 * 返回该案件最新一条整案交付包复核记录（无则 data: null）。
 *
 * 权限规则：
 *   - 案件所有人 / 管理员：直接通过
 *   - 团队成员：需同时具备 VIEW_CASE + EXPORT_DATA 两项权限
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: caseId } = await params;

    // ── 认证 ────────────────────────────────────────────────────────────────
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const { userId } = authUser;

    // ── 权限：所有人/管理员直接通过，团队成员需 VIEW_CASE + EXPORT_DATA ────────
    const ownershipResult = await checkResourceOwnership(
      userId,
      caseId,
      ResourceType.CASE
    );
    if (!ownershipResult.hasPermission) {
      const viewPerm = await checkPermission(
        userId,
        caseId,
        CasePermission.VIEW_CASE
      );
      if (!viewPerm.hasPermission) {
        return createPermissionErrorResponse('您无权访问此案件');
      }
      const exportPerm = await checkPermission(
        userId,
        caseId,
        CasePermission.EXPORT_DATA
      );
      if (!exportPerm.hasPermission) {
        return createPermissionErrorResponse('您无权导出此案件的交付包');
      }
    }

    // ── 查询最新复核记录 ─────────────────────────────────────────────────────
    const latest = await prisma.casePackageReview.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });

    return createSuccessResponse(latest);
  }
);
