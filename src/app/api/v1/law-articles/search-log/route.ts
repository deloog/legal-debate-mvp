/**
 * 搜索日志 API
 *
 * POST /api/v1/law-articles/search-log
 *
 * 功能：记录用户搜索行为
 */

import { NextRequest, NextResponse } from 'next/server';
import { logSearchHistory } from '@/lib/law-article/user-behavior-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { userId, keyword, category, lawType, resultsCount, clickedId } =
      body;

    // 验证必需字段
    if (!userId || !keyword) {
      return NextResponse.json(
        { error: '缺少必需字段: userId, keyword' },
        { status: 400 }
      );
    }

    await logSearchHistory({
      userId,
      keyword,
      category,
      lawType,
      resultsCount: resultsCount || 0,
      clickedId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('记录搜索日志失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
