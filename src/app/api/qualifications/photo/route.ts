/**
 * 律师资质证件照上传
 * POST /api/qualifications/photo
 * Content-Type: multipart/form-data
 * 返回 { success: true, data: { url: string } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from '@/lib/logger';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth/jwt';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'qualifications');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(request: NextRequest) {
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

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: '请选择要上传的文件' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: '仅支持 JPG、PNG、WebP 格式' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: '文件大小不能超过 5MB' },
        { status: 400 }
      );
    }

    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    // 扩展名从服务端验证的 MIME 类型派生，不信任客户端文件名
    const ext = MIME_TO_EXT[file.type] ?? 'jpg';
    const fileName = `qual-${timestamp}-${randomStr}.${ext}`;
    const filePath = join(UPLOAD_DIR, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const url = `/uploads/qualifications/${fileName}`;

    return NextResponse.json({
      success: true,
      data: { url },
    });
  } catch (error) {
    logger.error('证件照上传失败:', error);
    return NextResponse.json(
      { success: false, message: '上传失败，请重试' },
      { status: 500 }
    );
  }
}
