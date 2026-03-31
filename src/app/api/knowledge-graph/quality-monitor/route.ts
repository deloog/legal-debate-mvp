/**
 * 知识图谱质量监控 API
 * GET /api/knowledge-graph/quality-monitor
 */

import { generateDataQualityReport } from '@/lib/knowledge-graph/quality-monitor/data-quality-monitor';
import { QualityMonitorConfig } from '@/lib/knowledge-graph/quality-monitor/types';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET 获取数据质量报告（仅管理员）
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    // 从DB实时读取角色，仅管理员可查看质量报告
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可查看数据质量报告' },
        { status: 403 }
      );
    }

    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const minCoverageRate = searchParams.get('minCoverageRate');
    const maxOrphanArticles = searchParams.get('maxOrphanArticles');
    const lowQualityThreshold = searchParams.get('lowQualityThreshold');
    const minFeedbackCount = searchParams.get('minFeedbackCount');
    const staleThresholdDays = searchParams.get('staleThresholdDays');
    const pendingThresholdDays = searchParams.get('pendingThresholdDays');

    // 构建配置
    const config: QualityMonitorConfig = {
      coverage: {
        minCoverageRate: minCoverageRate ? parseFloat(minCoverageRate) : 0.8,
        maxOrphanArticles: maxOrphanArticles
          ? parseInt(maxOrphanArticles, 10)
          : 100,
      },
      accuracy: {
        lowQualityThreshold: lowQualityThreshold
          ? parseFloat(lowQualityThreshold)
          : 0.5,
        minFeedbackCount: minFeedbackCount
          ? parseInt(minFeedbackCount, 10)
          : 10,
      },
      timeliness: {
        staleThresholdDays: staleThresholdDays
          ? parseInt(staleThresholdDays, 10)
          : 30,
        pendingThresholdDays: pendingThresholdDays
          ? parseInt(pendingThresholdDays, 10)
          : 7,
      },
    };

    // 生成数据质量报告
    const report = await generateDataQualityReport(config);

    logger.info('数据质量报告查询成功', {
      overallScore: report.overallScore,
      qualityLevel: report.qualityLevel,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    logger.error('获取数据质量报告失败', { error });

    return NextResponse.json(
      {
        success: false,
        error: '获取数据质量报告失败',
      },
      { status: 500 }
    );
  }
}
