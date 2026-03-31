import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/export/tasks
 * 获取当前用户的导出任务列表（从数据库查询）
 */
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);

  if (!authUser) {
    return new Response(JSON.stringify({ success: false, error: '未授权' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10))
  );

  try {
    const where = { userId: authUser.userId };

    const [total, tasks] = await prisma.$transaction([
      prisma.exportTask.count({ where }),
      prisma.exportTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          userId: true,
          filename: true,
          exportType: true,
          format: true,
          status: true,
          filePath: true,
          progress: true,
          error: true,
          createdAt: true,
          completedAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    // 将 Date 对象序列化为 ISO 字符串
    const serialized = tasks.map(t => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          tasks: serialized,
          pagination: { page, pageSize, total, totalPages },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('获取导出任务列表失败:', error);
    return new Response(
      JSON.stringify({ success: false, error: '获取导出任务列表失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
