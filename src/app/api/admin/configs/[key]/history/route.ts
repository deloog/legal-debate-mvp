import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { getSystemConfigHistory } from '@/lib/admin/system-config-governance';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED', message: '请先登录' },
      { status: 401 }
    );
  }

  const permissionError = await validatePermissions(request, 'system:config');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { key } = await params;
    const limit = Number.parseInt(
      new URL(request.url).searchParams.get('limit') ?? '20',
      10
    );
    const history = await getSystemConfigHistory(key, limit);

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('获取配置历史失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: '获取配置历史失败',
      },
      { status: 500 }
    );
  }
}
