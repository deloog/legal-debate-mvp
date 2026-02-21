/**
 * 法条详情API
 *
 * GET /api/v1/law-articles/[id]
 *
 * 功能：获取指定法条的详细信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * 获取法条详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await prisma.lawArticle.findUnique({
      where: { id: params.id },
    });

    if (!article) {
      return NextResponse.json({ error: '法条不存在' }, { status: 404 });
    }

    return NextResponse.json(article);
  } catch (error) {
    logger.error('获取法条详情失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
