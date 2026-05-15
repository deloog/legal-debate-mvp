import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkResourceOwnership,
  createPermissionErrorResponse,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { checkPermission } from '@/lib/case/case-permission-manager';
import { CasePermission } from '@/types/case-collaboration';
import { runCaseRiskAssessment } from '@/lib/case/case-risk-pipeline';
import { logger } from '@/lib/logger';

// ── 权限校验（与 extract 路由保持一致） ─────────────────────────────────────

async function checkCaseAccess(
  userId: string,
  caseId: string,
  requiredPermission: CasePermission
): Promise<{ allowed: boolean; errorResponse?: NextResponse }> {
  const ownerResult = await checkResourceOwnership(
    userId,
    caseId,
    ResourceType.CASE
  );
  if (ownerResult.hasPermission) return { allowed: true };

  const teamPerm = await checkPermission(userId, caseId, requiredPermission);
  if (teamPerm.hasPermission) return { allowed: true };

  return {
    allowed: false,
    errorResponse: createPermissionErrorResponse(
      requiredPermission === CasePermission.EDIT_CASE
        ? '您无权对此案件执行风险评估（需要 EDIT_CASE 权限）'
        : '您无权访问此案件（需要 VIEW_CASE 权限）'
    ),
  };
}

// ── GET /api/v1/cases/[id]/assess ────────────────────────────────────────────

/**
 * 返回当前已保存的风险评估快照（不重新触发）。
 * 权限：案件所有人 / 管理员，或团队成员具备 VIEW_CASE
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: caseId } = await params;

  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  const access = await checkCaseAccess(
    authUser.userId,
    caseId,
    CasePermission.VIEW_CASE
  );
  if (!access.allowed) return access.errorResponse!;

  const { prisma } = await import('@/lib/db/prisma');
  const caseRow = await prisma.case.findUnique({
    where: { id: caseId, deletedAt: null },
    select: { metadata: true },
  });
  if (!caseRow) {
    return NextResponse.json(
      { success: false, error: '案件不存在' },
      { status: 404 }
    );
  }

  const meta =
    caseRow.metadata && typeof caseRow.metadata === 'object'
      ? (caseRow.metadata as Record<string, unknown>)
      : {};

  return NextResponse.json({
    success: true,
    data: meta['riskAssessment'] ?? null,
  });
}

// ── POST /api/v1/cases/[id]/assess ───────────────────────────────────────────

/**
 * 手动触发案件风险评估，结果写入 Case.metadata.riskAssessment。
 * 依赖 extractionSnapshot 已存在；若不存在返回 422。
 * 权限：案件所有人 / 管理员，或团队成员具备 EDIT_CASE
 *
 * Body（可选）：暂无参数
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: caseId } = await params;

  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  const access = await checkCaseAccess(
    authUser.userId,
    caseId,
    CasePermission.EDIT_CASE
  );
  if (!access.allowed) return access.errorResponse!;

  try {
    const snapshot = await runCaseRiskAssessment(caseId);
    if (!snapshot) {
      return NextResponse.json(
        {
          success: false,
          error: '风险评估失败：需要先完成案件提炼（POST /extract）',
          code: 'EXTRACTION_REQUIRED',
        },
        { status: 422 }
      );
    }
    return NextResponse.json({ success: true, data: snapshot });
  } catch (err) {
    logger.error(`[assess route] 风险评估 AI 调用失败 [${caseId}]:`, err);
    return NextResponse.json(
      {
        success: false,
        error: 'AI 服务调用失败，请稍后重试',
        code: 'AI_UNAVAILABLE',
      },
      { status: 503 }
    );
  }
}
