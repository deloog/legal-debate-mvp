/**
 * POST /api/evidence/upload
 * 上传证据文件，返回 { fileUrl, fileName }
 * 文件保存至本地 public/uploads/evidence/
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'video/mp4',
  'audio/mpeg',
  'audio/wav',
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: '未认证' },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: '未找到上传文件' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: '文件大小不能超过10MB' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: '不支持的文件类型' },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop() ?? 'bin';
    const savedName = `${uuidv4()}.${ext}`;

    // 上传目录：public/uploads/evidence/
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'evidence');
    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(join(uploadDir, savedName), buffer);

    const fileUrl = `/uploads/evidence/${savedName}`;

    return NextResponse.json({
      success: true,
      message: '文件上传成功',
      fileUrl,
      fileName: file.name,
    });
  } catch (error) {
    logger.error('证据文件上传失败:', error);
    return NextResponse.json(
      { success: false, message: '文件上传失败' },
      { status: 500 }
    );
  }
}
