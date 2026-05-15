import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkResourceOwnership,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { checkPermission } from '@/lib/case/case-permission-manager';
import { CasePermission } from '@/types/case-collaboration';
import { getCaseWorkflowStatus } from '@/lib/case/case-workflow-status';

/**
 * GET /api/v1/cases/[id]/workflow-status
 *
 * 返回案件各阶段工作流状态，供前端进度面板消费。
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

  const ownerResult = await checkResourceOwnership(
    authUser.userId,
    caseId,
    ResourceType.CASE
  );
  if (!ownerResult.hasPermission) {
    const teamPerm = await checkPermission(
      authUser.userId,
      caseId,
      CasePermission.VIEW_CASE
    );
    if (!teamPerm.hasPermission) {
      return NextResponse.json(
        { success: false, error: '无权访问此案件' },
        { status: 403 }
      );
    }
  }

  const status = await getCaseWorkflowStatus(caseId);
  if (!status) {
    return NextResponse.json(
      { success: false, error: '案件不存在' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: status });
}
