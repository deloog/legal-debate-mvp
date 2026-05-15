import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkResourceOwnership,
  createPermissionErrorResponse,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { checkPermission } from '@/lib/case/case-permission-manager';
import { CasePermission } from '@/types/case-collaboration';
import { buildPackageSections } from '@/lib/case/package-builder';

const TEMPLATE_VERSION = 'v1';
const TOTAL_SECTIONS = 7;

/**
 * GET /api/v1/cases/[id]/package/preview
 * 返回整案交付包各章节（§1~§7）的结构化数据，供 Composer UI 渲染预览。
 * 并作为 Phase 2 contentHash 计算的稳定 payload 来源。
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

    // ── 构建章节 ─────────────────────────────────────────────────────────────
    const result = await buildPackageSections(caseId);
    if (!result.found) {
      const { NotFoundError } = await import('@/app/api/lib/errors/api-error');
      throw new NotFoundError('Case');
    }

    const { sections } = result;
    const totalAvailable = Object.values(sections).filter(
      s => s.available
    ).length;

    return createSuccessResponse({
      caseId,
      templateVersion: TEMPLATE_VERSION,
      generatedAt: new Date().toISOString(),
      sections,
      meta: {
        totalAvailable,
        totalSections: TOTAL_SECTIONS,
      },
      reviewStatus: null,
    });
  }
);
