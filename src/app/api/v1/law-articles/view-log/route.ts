/**
 * 浏览日志 API
 *
 * POST /api/v1/law-articles/view-log
 *
 * 功能：记录用户浏览法条行为
 */

import { NextRequest, NextResponse } from 'next/server';
import { logLawArticleView } from '@/lib/law-article/user-behavior-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { userId, lawArticleId, viewDuration } = body;

    // 验证必需字段
    if (!userId || !lawArticleId) {
      return NextResponse.json(
        { error: '缺少必需字段: userId, lawArticleId' },
        { status: 400 }
      );
    }

    await logLawArticleView({
      userId,
      lawArticleId,
      viewDuration,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('记录浏览日志失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
