/**
 * GET /api/evidence/file/[filename]
 * 认证后代理下载证据文件，防止未授权直接访问
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import { getSignedUrl } from '@/lib/storage/storage-service';
import { prisma } from '@/lib/db/prisma';

// MIME 类型映射
const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
): Promise<NextResponse> {
  // 认证：getAuthUser 已同时支持 JWT Bearer 和 httpOnly Cookie，无需额外 getServerSession
  const authUser = await getAuthUser(request);

  if (!authUser) {
    return NextResponse.json(
      { success: false, message: '请先登录' },
      { status: 401 }
    );
  }

  const { filename } = await params;

  // 安全：防止路径穿越攻击，只取文件名部分
  const safeFilename = basename(filename);
  if (safeFilename !== filename || safeFilename.includes('..')) {
    return NextResponse.json(
      { success: false, message: '非法文件路径' },
      { status: 400 }
    );
  }

  // 权限：从 DB 实时读取角色（防止 stale JWT 绕过权限撤销）
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { role: true },
  });
  const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';

  if (!isAdmin) {
    // 验证文件属于当前用户拥有的案件（或用户是该案件的团队成员）
    const evidence = await prisma.evidence.findFirst({
      where: {
        fileUrl: { contains: safeFilename },
        deletedAt: null,
        case: {
          deletedAt: null,
          OR: [
            { userId: authUser.userId },
            {
              teamMembers: {
                some: { userId: authUser.userId, deletedAt: null },
              },
            },
          ],
        },
      },
      select: { id: true },
    });

    if (!evidence) {
      logger.warn('[EvidenceFile] 未授权的文件访问尝试', {
        userId: authUser.userId,
        filename: safeFilename,
      });
      return NextResponse.json(
        { success: false, message: '无权访问此文件' },
        { status: 403 }
      );
    }
  }

  // OSS模式：生成签名URL后重定向
  const signedUrl = await getSignedUrl(`evidence/${safeFilename}`);
  if (signedUrl) {
    return NextResponse.redirect(signedUrl, { status: 302 });
  }

  // 本地模式：先从私有目录找，再回退到旧的 public 目录（兼容已有数据）
  const privatePath = join(
    process.cwd(),
    'private_uploads',
    'evidence',
    safeFilename
  );
  const legacyPath = join(
    process.cwd(),
    'public',
    'uploads',
    'evidence',
    safeFilename
  );

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(privatePath);
  } catch {
    try {
      fileBuffer = await readFile(legacyPath);
    } catch {
      logger.warn('[EvidenceFile] 文件不存在:', { filename: safeFilename });
      return NextResponse.json(
        { success: false, message: '文件不存在' },
        { status: 404 }
      );
    }
  }

  const ext = safeFilename.split('.').pop()?.toLowerCase() ?? '';
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

  return new NextResponse(fileBuffer.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${safeFilename}"`,
      'Cache-Control': 'private, no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
