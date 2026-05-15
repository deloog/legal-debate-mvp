/**
 * 案件法条知识图谱分析 API
 *
 * GET /api/cases/[id]/law-graph
 *
 * 返回案件涉及法条之间的冲突、历史沿革、补充推荐和图谱可视化数据。
 * 需要用户已登录且对该案件有访问权限。
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { CaseKnowledgeGraphAnalyzer } from '@/lib/case/knowledge-graph-analyzer';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import {
  checkResourceOwnership,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { checkPermission } from '@/lib/case/case-permission-manager';
import { CasePermission } from '@/types/case-collaboration';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 使用 getAuthUser 同时支持 Authorization header 和 httpOnly Cookie
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, message: '未授权' },
      { status: 401 }
    );
  }

  const { userId } = authUser;
  const caseId = (await params).id;

  try {
    const caseRecord = await prisma.case.findFirst({
      where: { id: caseId, deletedAt: null },
      select: { id: true },
    });

    if (!caseRecord) {
      return NextResponse.json(
        { success: false, message: '案件不存在' },
        { status: 404 }
      );
    }

    const ownerResult = await checkResourceOwnership(
      userId,
      caseId,
      ResourceType.CASE
    );
    if (!ownerResult.hasPermission) {
      const teamPerm = await checkPermission(
        userId,
        caseId,
        CasePermission.VIEW_CASE
      );
      if (!teamPerm.hasPermission) {
        return NextResponse.json(
          { success: false, message: '无权访问此案件' },
          { status: 403 }
        );
      }
    }

    // 执行图谱分析
    const result = await CaseKnowledgeGraphAnalyzer.analyze(caseId);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error(
      '案件法条图谱分析接口异常',
      error instanceof Error ? error : undefined,
      { caseId }
    );
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}
