import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { ExportTask, ExportFormat, ExportTaskStatus } from '@/types/stats';

/**
 * GET /api/admin/export/tasks
 * 获取导出任务列表
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  // 验证管理员权限（简化处理：仅验证是否登录）
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({
        success: false,
        error: '无权限访问',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

  try {
    // 模拟导出任务列表（实际应该从数据库查询）
    const mockTasks: ExportTask[] = [
      {
        id: '1',
        userId: 'mock-user-1',
        filename: 'cases_export_20260128.csv',
        exportType: 'CASES',
        format: ExportFormat.CSV,
        status: ExportTaskStatus.COMPLETED,
        filePath: '/exports/cases_export_20260128.csv',
        progress: 100,
        createdAt: '2026-01-28T10:00:00Z',
        completedAt: '2026-01-28T10:05:00Z',
      },
      {
        id: '2',
        userId: 'mock-user-1',
        filename: 'stats_user_registration_20260127.xlsx',
        exportType: 'STATS',
        format: ExportFormat.EXCEL,
        status: ExportTaskStatus.COMPLETED,
        filePath: '/exports/stats_user_registration_20260127.xlsx',
        progress: 100,
        createdAt: '2026-01-27T15:00:00Z',
        completedAt: '2026-01-27T15:02:00Z',
      },
      {
        id: '3',
        userId: 'mock-user-1',
        filename: 'cases_export_20260129.csv',
        exportType: 'CASES',
        format: ExportFormat.CSV,
        status: ExportTaskStatus.PROCESSING,
        filePath: '/exports/cases_export_20260129.csv',
        progress: 60,
        createdAt: '2026-01-29T09:00:00Z',
      },
    ];

    // 分页处理
    const total = mockTasks.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const tasks = mockTasks.slice(start, end);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          tasks,
          pagination: {
            page,
            pageSize,
            total,
            totalPages,
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('获取导出任务列表失败:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: '获取导出任务列表失败',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
