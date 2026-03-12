/**
 * 律师资质证件照安全访问 API
 * GET /api/qualifications/photo/[fileId]
 * 
 * 安全特性：
 * - 需要 JWT 认证
 * - 用户只能访问自己的证件照（或管理员可访问所有）
 * - 从非 public 目录安全读取文件
 * - 添加适当的 Content-Type 和缓存控制头
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'qualifications');

// 支持的文件扩展名
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * 验证文件 ID 格式
 */
function isValidFileId(fileId: string): boolean {
  // 文件 ID 格式: qual-{timestamp}-{random}
  return /^qual-[a-z0-9]+-[a-f0-9]{32}$/.test(fileId);
}

/**
 * 查找文件（尝试所有可能的扩展名）
 */
async function findFile(fileId: string): Promise<{ path: string; ext: string } | null> {
  for (const ext of ALLOWED_EXTENSIONS) {
    const filePath = join(UPLOAD_DIR, `${fileId}${ext}`);
    if (existsSync(filePath)) {
      return { path: filePath, ext };
    }
  }
  return null;
}

/**
 * 获取文件对应的 MIME 类型
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // JWT 鉴权
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader ?? '');
    const tokenResult = verifyToken(token ?? '');
    
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json(
        { success: false, message: '未授权' },
        { status: 401 }
      );
    }

    const { userId, role } = tokenResult.payload;
    const { fileId } = await params;

    // 验证文件 ID 格式
    if (!isValidFileId(fileId)) {
      logger.warn('非法的文件 ID 格式', { userId, fileId });
      return NextResponse.json(
        { success: false, message: '非法的文件 ID' },
        { status: 400 }
      );
    }

    // 查找文件
    const fileInfo = await findFile(fileId);
    if (!fileInfo) {
      logger.warn('文件不存在', { userId, fileId });
      return NextResponse.json(
        { success: false, message: '文件不存在' },
        { status: 404 }
      );
    }

    // 权限检查：非管理员只能访问自己的照片
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    
    if (!isAdmin) {
      // 查询该文件是否属于当前用户
      const qualification = await prisma.lawyerQualification.findFirst({
        where: {
          userId,
          licensePhoto: {
            contains: fileId,
          },
        },
      });

      if (!qualification) {
        logger.warn('未授权的文件访问尝试', { userId, fileId, role });
        return NextResponse.json(
          { success: false, message: '无权访问此文件' },
          { status: 403 }
        );
      }
    }

    // 读取文件
    const fileBuffer = await readFile(fileInfo.path);

    // 返回文件内容，添加安全响应头
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': getMimeType(fileInfo.ext),
        'Content-Length': fileBuffer.length.toString(),
        // 禁用缓存或设置私有缓存
        'Cache-Control': 'private, max-age=3600',
        // 防止 MIME 嗅探
        'X-Content-Type-Options': 'nosniff',
        // 内容处置：inline 表示在浏览器中显示
        'Content-Disposition': 'inline',
      },
    });
  } catch (error) {
    logger.error('文件访问失败:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}
