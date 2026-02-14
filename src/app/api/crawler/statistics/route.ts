/**
 * 采集数据统计 API
 */

import { NextResponse } from 'next/server';
import { crawlTaskManager } from '@/lib/crawler/crawl-task-manager';

export async function GET() {
  try {
    const statistics = await crawlTaskManager.getSourceStatistics();
    const sourceConfig = await crawlTaskManager.getSourceConfig();

    return NextResponse.json({
      success: true,
      data: {
        statistics,
        sources: sourceConfig,
        summary: {
          totalArticles: statistics.reduce(
            (sum, s) => sum + s.totalArticles,
            0
          ),
          totalValid: statistics.reduce((sum, s) => sum + s.validArticles, 0),
          dataSources: statistics.length,
        },
      },
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json({ error: '获取统计数据失败' }, { status: 500 });
  }
}
