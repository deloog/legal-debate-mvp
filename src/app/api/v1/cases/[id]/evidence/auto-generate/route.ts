/**
 * POST /api/v1/cases/[id]/evidence/auto-generate
 *
 * 触发自动证据草稿生成并落库（幂等）。
 * 权限：案件所有人 / 管理员，或团队成员具备 EDIT_CASE
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkResourceOwnership,
  createPermissionErrorResponse,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { checkPermission } from '@/lib/case/case-permission-manager';
import { CasePermission } from '@/types/case-collaboration';
import { upsertAutoEvidenceDrafts } from '@/lib/evidence/auto-evidence-draft-service';
import { logger } from '@/lib/logger';

async function checkCaseAccess(
  userId: string,
  caseId: string
): Promise<{ allowed: boolean; errorResponse?: NextResponse }> {
  const ownerResult = await checkResourceOwnership(
    userId,
    caseId,
    ResourceType.CASE
  );
  if (ownerResult.hasPermission) return { allowed: true };

  const teamPerm = await checkPermission(
    userId,
    caseId,
    CasePermission.EDIT_CASE
  );
  if (teamPerm.hasPermission) return { allowed: true };

  return {
    allowed: false,
    errorResponse: createPermissionErrorResponse(
      '您无权对此案件执行证据自动生成操作（需要 EDIT_CASE 权限）'
    ),
  };
}

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

  const access = await checkCaseAccess(authUser.userId, caseId);
  if (!access.allowed) return access.errorResponse!;

  const { prisma } = await import('@/lib/db/prisma');
  const caseRow = await prisma.case.findUnique({
    where: { id: caseId, deletedAt: null },
    select: { id: true },
  });
  if (!caseRow) {
    return NextResponse.json(
      { success: false, error: '案件不存在' },
      { status: 404 }
    );
  }

  try {
    const result = await upsertAutoEvidenceDrafts(caseId);
    return NextResponse.json({
      success: true,
      data: {
        drafts: result.drafts,
        created: result.created,
        updated: result.updated,
        skippedManual: result.skippedManual,
      },
    });
  } catch (err) {
    logger.error(`[evidence/auto-generate] 证据草稿生成失败 [${caseId}]:`, err);
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
