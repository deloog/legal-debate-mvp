import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkResourceOwnership,
  createPermissionErrorResponse,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { checkPermission } from '@/lib/case/case-permission-manager';
import { CasePermission } from '@/types/case-collaboration';
import { prisma } from '@/lib/db/prisma';
import { buildPackageSections } from '@/lib/case/package-builder';
import {
  computePackageHash,
  isValidSectionKeys,
} from '@/lib/case/package-hash';
import type { SectionKey } from '@/lib/case/package-hash';
import { resolveReviewMatch } from '@/lib/case/review-matcher';
import { generateCasePackageDocx } from '@/lib/case/package-generator';

const TEMPLATE_VERSION = 'v1';

/**
 * POST /api/v1/cases/[id]/package/export
 * 生成整案交付包 DOCX 并以附件形式返回。
 *
 * 流程：
 *   1. auth + 权限（团队成员需 VIEW_CASE + EXPORT_DATA）
 *   2. 验证 selectedSections
 *   3. buildPackageSections（服务端独立拉取，不依赖 preview 路由）
 *   4. computePackageHash（与 review 记录对比基准相同）
 *   5. 查最新 review → resolveReviewMatch
 *   6. generateCasePackageDocx
 *   7. 返回 DOCX 流
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

    const { selectedSections } = body;

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
    const buildResult = await buildPackageSections(caseId);
    if (!buildResult.found) {
      const { NotFoundError } = await import('@/app/api/lib/errors/api-error');
      throw new NotFoundError('Case');
    }

    // ── 计算导出 hash（与 review 记录比对基准相同）────────────────────────────
    const currentHash = computePackageHash(
      buildResult.sections as Record<string, unknown>,
      validatedSections,
      TEMPLATE_VERSION
    );

    // ── 读最新复核记录并判定匹配状态 ─────────────────────────────────────────
    const latestReview = await prisma.casePackageReview.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    const baseReviewMatch = resolveReviewMatch({
      latestReview,
      currentHash,
      selectedSections: validatedSections,
      templateVersion: TEMPLATE_VERSION,
    });

    const reviewMatch =
      baseReviewMatch.status === 'matched' && latestReview
        ? {
            ...baseReviewMatch,
            reviewerName:
              latestReview.reviewer?.name ||
              latestReview.reviewer?.email ||
              '律师',
            reviewedAt:
              latestReview.createdAt instanceof Date
                ? latestReview.createdAt.toISOString()
                : undefined,
          }
        : baseReviewMatch;

    // ── 生成 DOCX ────────────────────────────────────────────────────────────
    const buffer = await generateCasePackageDocx({
      caseId,
      templateVersion: TEMPLATE_VERSION,
      selectedSections: validatedSections,
      sections: buildResult.sections as Record<
        string,
        { tier: string; available: boolean; data: unknown }
      >,
      reviewMatch,
    });

    const date = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
    const filename = encodeURIComponent(`整案交付包_${date}`);

    // 使用原生 Response 而非 NextResponse，确保 headers 在测试和生产环境均可访问
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}.docx`,
        'Content-Length': String(buffer.length),
      },
    }) as unknown as NextResponse;
  }
);
