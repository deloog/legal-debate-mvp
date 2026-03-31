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
import fsSync from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

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
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

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
    logger.error('获取报告详情失败:', error);
    return NextResponse.json(
      { success: false, message: '获取报告详情失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/reports/[id] - 删除报告
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

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

    // 删除文件（路径边界校验：防止 DB 被篡改后删除任意文件）
    if (report.filePath) {
      try {
        const allowedDir = path.resolve(process.cwd(), 'public', 'reports');
        const resolvedPath = path.resolve(report.filePath);
        if (!resolvedPath.startsWith(allowedDir + path.sep)) {
          logger.warn('拒绝删除越界文件路径:', { filePath: report.filePath });
          // 跳过文件删除，继续删除数据库记录
        } else {
          // 解析真实路径（跟随符号链接），防止符号链接穿越攻击
          let realPath: string;
          try {
            realPath = fsSync.realpathSync(resolvedPath);
          } catch {
            // 文件不存在，跳过删除
            realPath = resolvedPath;
          }
          const realAllowedDir = fsSync.realpathSync(allowedDir);
          if (!realPath.startsWith(realAllowedDir + path.sep)) {
            logger.warn('拒绝删除符号链接越界路径:', {
              filePath: report.filePath,
              realPath,
            });
          } else {
            await fs.unlink(resolvedPath);
          }
        }
      } catch (fileError) {
        logger.error('删除报告文件失败:', fileError);
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
    logger.error('删除报告失败:', error);
    return NextResponse.json(
      { success: false, message: '删除报告失败' },
      { status: 500 }
    );
  }
}
