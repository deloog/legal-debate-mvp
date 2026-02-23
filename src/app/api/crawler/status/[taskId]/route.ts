/**
 * 采集任务状态查询 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { crawlTaskManager } from '@/lib/crawler/crawl-task-manager';
import { logger } from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;

    const status = await crawlTaskManager.getTaskStatus(taskId);

    if (!status) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('获取任务状态失败:', error);
    return NextResponse.json({ error: '获取任务状态失败' }, { status: 500 });
  }
}
