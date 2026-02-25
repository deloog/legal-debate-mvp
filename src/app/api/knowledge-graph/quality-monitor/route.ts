/**
 * 知识图谱质量监控 API
 * GET /api/knowledge-graph/quality-monitor
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { generateDataQualityReport } from '@/lib/knowledge-graph/quality-monitor/data-quality-monitor';
import { QualityMonitorConfig } from '@/lib/knowledge-graph/quality-monitor/types';

/**
 * GET 获取数据质量报告
 */
export async function GET(request: NextRequest) {
  try {
    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const minCoverageRate = searchParams.get('minCoverageRate');
    const maxOrphanArticles = searchParams.get('maxOrphanArticles');
    const lowQualityThreshold = searchParams.get('lowQualityThreshold');
    const minFeedbackCount = searchParams.get('minFeedbackCount');
    const staleThresholdDays = searchParams.get('staleThresholdDays');
    const pendingThresholdDays = searchParams.get('pendingThresholdDays');

    // 构建配置
    const config: Partial<QualityMonitorConfig> = {};

    if (minCoverageRate !== null) {
      config.coverage = {
        ...config.coverage,
        minCoverageRate: parseFloat(minCoverageRate),
      };
    }

    if (maxOrphanArticles !== null) {
      config.coverage = {
        ...config.coverage,
        maxOrphanArticles: parseInt(maxOrphanArticles, 10),
      };
    }

    if (lowQualityThreshold !== null) {
      config.accuracy = {
        ...config.accuracy,
        lowQualityThreshold: parseFloat(lowQualityThreshold),
      };
    }

    if (minFeedbackCount !== null) {
      config.accuracy = {
        ...config.accuracy,
        minFeedbackCount: parseInt(minFeedbackCount, 10),
      };
    }

    if (staleThresholdDays !== null) {
      config.timeliness = {
        ...config.timeliness,
        staleThresholdDays: parseInt(staleThresholdDays, 10),
      };
    }

    if (pendingThresholdDays !== null) {
      config.timeliness = {
        ...config.timeliness,
        pendingThresholdDays: parseInt(pendingThresholdDays, 10),
      };
    }

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
