import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkResourceOwnership,
  createPermissionErrorResponse,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { checkPermission } from '@/lib/case/case-permission-manager';
import { CasePermission } from '@/types/case-collaboration';
import {
  runCaseExtraction,
  shouldTriggerExtraction,
} from '@/lib/case/case-extraction-service';
import { logger } from '@/lib/logger';

// ── 权限校验工具：对齐交付包权限规则 ───────────────────────────────────────────

/**
 * 校验案件访问权限。
 * - 案件所有人 / 管理员：直接通过
 * - 团队成员：检查指定的案件协作权限
 */
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
        ? '您无权对此案件执行提炼操作（需要 EDIT_CASE 权限）'
        : '您无权访问此案件（需要 VIEW_CASE 权限）'
    ),
  };
}

// ── GET /api/v1/cases/[id]/extract ──────────────────────────────────────────

/**
 * 返回当前已保存的提炼快照（不重新触发）。
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
    data: meta['extractionSnapshot'] ?? null,
  });
}

// ── POST /api/v1/cases/[id]/extract ─────────────────────────────────────────

/**
 * 手动触发（或强制重新执行）案件级提炼，结果写入 Case.metadata.extractionSnapshot。
 * 权限：案件所有人 / 管理员，或团队成员具备 EDIT_CASE
 *
 * Body（可选）：
 *   { "force": true }  — 跳过阈值检查，直接触发（有文档即可）
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

  // 解析 force 参数
  let force = false;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      force?: boolean;
    };
    force = body.force === true;
  } catch {
    // body 为空时忽略
  }

  if (!force) {
    const meetsThreshold = await shouldTriggerExtraction(caseId);
    if (!meetsThreshold) {
      return NextResponse.json(
        {
          success: false,
          error:
            '当前材料不足，无法触发案件提炼（需覆盖 2 类核心材料，或文档数 ≥ 5 且有摘要）',
          code: 'THRESHOLD_NOT_MET',
        },
        { status: 422 }
      );
    }
  }

  try {
    const snapshot = await runCaseExtraction(caseId);
    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: '案件提炼失败：无已完成文档' },
        { status: 422 }
      );
    }
    return NextResponse.json({ success: true, data: snapshot });
  } catch (err) {
    logger.error(`[extract route] 案件提炼 AI 调用失败 [${caseId}]:`, err);
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
