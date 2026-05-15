/**
 * 企业营业执照安全访问 API
 * GET /api/enterprise/qualification/[fileId]
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

const UPLOAD_DIR = join(process.cwd(), 'private_uploads', 'enterprise');
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function isValidFileId(fileId: string): boolean {
  return /^entqual-[a-z0-9]+-[a-f0-9]{32}$/.test(fileId);
}

async function findFile(
  fileId: string
): Promise<{ path: string; ext: string } | null> {
  for (const ext of ALLOWED_EXTENSIONS) {
    const filePath = join(UPLOAD_DIR, `${fileId}${ext}`);
    if (existsSync(filePath)) return { path: filePath, ext };
  }
  return null;
}

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
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, message: '未授权' },
        { status: 401 }
      );
    }

    const { fileId } = await params;
    if (!isValidFileId(fileId)) {
      return NextResponse.json(
        { success: false, message: '非法的文件 ID' },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';

    if (!isAdmin) {
      const enterprise = await prisma.enterpriseAccount.findFirst({
        where: {
          userId: authUser.userId,
          businessLicense: {
            contains: fileId,
          },
        },
        select: { id: true },
      });

      if (!enterprise) {
        return NextResponse.json(
          { success: false, message: '无权访问此文件' },
          { status: 403 }
        );
      }
    }

    if (process.env.OSS_ENABLED === 'true') {
      for (const ext of ALLOWED_EXTENSIONS) {
        const ossKey = `enterprise/${fileId}${ext}`;
        if (await ossObjectExists(ossKey)) {
          const signedUrl = await getSignedUrl(ossKey);
          if (signedUrl) {
            return NextResponse.redirect(signedUrl, { status: 302 });
          }
        }
      }
      return NextResponse.json(
        { success: false, message: '文件不存在' },
        { status: 404 }
      );
    }

    const fileInfo = await findFile(fileId);
    if (!fileInfo) {
      return NextResponse.json(
        { success: false, message: '文件不存在' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(fileInfo.path);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': getMimeType(fileInfo.ext),
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  } catch (error) {
    logger.error('企业营业执照访问失败:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}
