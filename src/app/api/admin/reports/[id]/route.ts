/**
 * 报告详情和下载API
 * GET /api/admin/reports/[id] - 获取报告详情
 * DELETE /api/admin/reports/[id] - 删除报告
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { prisma } from '@/lib/db/prisma';
import fs from 'fs/promises';

// 辅助响应函数
function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { success: false, message: '未授权访问' },
    { status: 401 }
  );
}

/**
 * GET /api/admin/reports/[id] - 获取报告详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户身份
    const user = await getAuthUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    // 检查权限（使用报告读取权限）
    const permissionError = await validatePermissions(request, 'report:read');
    if (permissionError) {
      return permissionError;
    }

    const { id } = params;

    // 查询报告详情
    const report = await prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      return NextResponse.json(
        { success: false, message: '报告不存在' },
        { status: 404 }
      );
    }

    // 增加下载计数
    await prisma.report.update({
      where: { id },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: '获取报告详情成功',
      data: report,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '获取报告详情失败';
    console.error('获取报告详情失败:', error);

    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/reports/[id] - 删除报告
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户身份
    const user = await getAuthUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    // 检查权限（使用报告删除权限）
    const permissionError = await validatePermissions(request, 'report:delete');
    if (permissionError) {
      return permissionError;
    }

    const { id } = params;

    // 查询报告
    const report = await prisma.report.findUnique({
      where: { id },
      select: { filePath: true },
    });

    if (!report) {
      return NextResponse.json(
        { success: false, message: '报告不存在' },
        { status: 404 }
      );
    }

    // 删除文件
    if (report.filePath) {
      try {
        await fs.unlink(report.filePath);
      } catch (fileError) {
        console.error('删除报告文件失败:', fileError);
        // 继续删除数据库记录
      }
    }

    // 删除数据库记录
    await prisma.report.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '删除报告成功',
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '删除报告失败';
    console.error('删除报告失败:', error);

    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
