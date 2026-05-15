import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkResourceOwnership,
  createPermissionErrorResponse,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { checkPermission } from '@/lib/case/case-permission-manager';
import { CasePermission } from '@/types/case-collaboration';
import { buildPackageSections } from '@/lib/case/package-builder';
import {
  computePackageHash,
  isValidSectionKeys,
} from '@/lib/case/package-hash';
import type { SectionKey } from '@/lib/case/package-hash';

/**
 * POST /api/v1/cases/[id]/package/review
 * 提交整案交付包复核：
 *   1. 服务端独立重建 sections payload
 *   2. 计算 contentHash（排除 generatedAt）
 *   3. 写入 CasePackageReview 记录（status: PENDING）
 *
 * 权限规则：
 *   - 案件所有人 / 管理员：直接通过
 *   - 团队成员：需具备 EDIT_CASE（复核是带责任确认的写操作，语义重于纯查看/导出）
 */
export const POST = withErrorHandler(
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

    // ── 权限：所有人/管理员直接通过，团队成员需 EDIT_CASE ────────────────────
    const ownershipResult = await checkResourceOwnership(
      userId,
      caseId,
      ResourceType.CASE
    );
    if (!ownershipResult.hasPermission) {
      const editPerm = await checkPermission(
        userId,
        caseId,
        CasePermission.EDIT_CASE
      );
      if (!editPerm.hasPermission) {
        return createPermissionErrorResponse('您无权提交此案件的交付包复核');
      }
    }

    // ── 请求体解析与验证 ─────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '请求体格式错误' },
        },
        { status: 400 }
      );
    }

    const { selectedSections, reviewNotes } = body;

    if (
      !Array.isArray(selectedSections) ||
      (selectedSections as unknown[]).length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'selectedSections 不能为空',
          },
        },
        { status: 400 }
      );
    }

    if (!isValidSectionKeys(selectedSections as unknown[])) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'selectedSections 包含无效的章节 key',
          },
        },
        { status: 400 }
      );
    }

    const validatedSections = selectedSections as SectionKey[];

    // ── 服务端独立构建 sections ───────────────────────────────────────────────
    const result = await buildPackageSections(caseId);
    if (!result.found) {
      const { NotFoundError } = await import('@/app/api/lib/errors/api-error');
      throw new NotFoundError('Case');
    }

    // ── 计算 contentHash（排除 generatedAt，纳入 templateVersion）───────────
    const contentHash = computePackageHash(
      result.sections as Record<string, unknown>,
      validatedSections,
      'v1'
    );

    // ── 写入 CasePackageReview ────────────────────────────────────────────────
    const review = await prisma.casePackageReview.create({
      data: {
        caseId,
        reviewerId: userId,
        contentHash,
        selectedSections: validatedSections,
        reviewNotes: typeof reviewNotes === 'string' ? reviewNotes : null,
      },
    });

    return NextResponse.json({ success: true, data: review }, { status: 201 });
  }
);
