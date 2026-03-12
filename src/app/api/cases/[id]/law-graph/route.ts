/**
 * 案件法条知识图谱分析 API
 *
 * GET /api/cases/[id]/law-graph
 *
 * 返回案件涉及法条之间的冲突、历史沿革、补充推荐和图谱可视化数据。
 * 需要用户已登录且对该案件有访问权限。
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth/jwt';
import { CaseKnowledgeGraphAnalyzer } from '@/lib/case/knowledge-graph-analyzer';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // JWT 认证
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader ?? '');
  const tokenResult = verifyToken(token ?? '');
  if (!tokenResult.valid || !tokenResult.payload) {
    return NextResponse.json(
      { success: false, message: '未授权' },
      { status: 401 }
    );
  }

  const { userId } = tokenResult.payload;
  const caseId = (await params).id;

  try {
    // 验证案件访问权限
    const caseRecord = await prisma.cases.findFirst({
      where: {
        id: caseId,
        OR: [
          { userId },
          { case_team_members: { some: { userId } } },
        ],
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!caseRecord) {
      return NextResponse.json(
        { success: false, message: '案件不存在或无权访问' },
        { status: 404 }
      );
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
