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

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { getSignedUrl, ossObjectExists } from '@/lib/storage/storage-service';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'qualifications');
const PRIVATE_UPLOAD_DIR = join(
  process.cwd(),
  'private_uploads',
  'qualifications'
);

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
 * 查找文件（尝试所有可能的扩展名，先查新路径再查旧路径）
 */
async function findFile(
  fileId: string
): Promise<{ path: string; ext: string } | null> {
  for (const ext of ALLOWED_EXTENSIONS) {
    // 优先查新路径（private_uploads）
    const newPath = join(PRIVATE_UPLOAD_DIR, `${fileId}${ext}`);
    if (existsSync(newPath)) {
      return { path: newPath, ext };
    }
    // 回退旧路径（uploads/qualifications）
    const oldPath = join(UPLOAD_DIR, `${fileId}${ext}`);
    if (existsSync(oldPath)) {
      return { path: oldPath, ext };
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
    // 认证
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, message: '未授权' },
        { status: 401 }
      );
    }

    const { userId } = authUser;
    const { fileId } = await params;

    // 验证文件 ID 格式
    if (!isValidFileId(fileId)) {
      logger.warn('非法的文件 ID 格式', { userId, fileId });
      return NextResponse.json(
        { success: false, message: '非法的文件 ID' },
        { status: 400 }
      );
    }

    // 权限检查：从 DB 实时读取角色（防止 stale JWT 绕过权限撤销）
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';

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
        logger.warn('未授权的文件访问尝试', { userId, fileId });
        return NextResponse.json(
          { success: false, message: '无权访问此文件' },
          { status: 403 }
        );
      }
    }

    // OSS模式：遍历扩展名找到实际存储的对象，生成签名URL后重定向
    if (process.env.OSS_ENABLED === 'true') {
      for (const ext of ALLOWED_EXTENSIONS) {
        const ossKey = `qualifications/${fileId}${ext}`;
        if (await ossObjectExists(ossKey)) {
          const signedUrl = await getSignedUrl(ossKey);
          if (signedUrl) {
            return NextResponse.redirect(signedUrl, { status: 302 });
          }
        }
      }
      logger.warn('OSS中未找到证件照', { userId, fileId });
      return NextResponse.json(
        { success: false, message: '文件不存在' },
        { status: 404 }
      );
    }

    // 本地模式：查找文件
    const fileInfo = await findFile(fileId);
    if (!fileInfo) {
      logger.warn('文件不存在', { userId, fileId });
      return NextResponse.json(
        { success: false, message: '文件不存在' },
        { status: 404 }
      );
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
