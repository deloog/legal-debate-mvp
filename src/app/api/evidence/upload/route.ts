/**
 * POST /api/evidence/upload
 * 上传证据文件，返回 { fileUrl, fileName }
 * 文件保存至本地 public/uploads/evidence/
 *
 * 安全措施：
 * 1. MIME类型白名单验证
 * 2. 文件扩展名与MIME类型一致性检查
 * 3. 文件内容签名验证（魔数检查）
 * 4. 文件名安全处理（去除特殊字符）
 * 5. 文件大小限制
 * 6. 上传频率限制（内存级，生产环境建议使用Redis）
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import { uploadFile } from '@/lib/storage/storage-service';

// 允许的文件类型映射（MIME类型 -> 扩展名）
const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'docx',
  ],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/plain': ['txt'],
  'video/mp4': ['mp4'],
  'audio/mpeg': ['mp3'],
  'audio/wav': ['wav'],
};

// 文件签名（魔数）验证
const FILE_SIGNATURES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_MINUTE = 10; // 每分钟最大上传数

// 上传频率限制（内存级，生产环境建议使用Redis）
const uploadLimits = new Map<string, { count: number; resetTime: number }>();

/**
 * 检查上传频率限制
 */
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1分钟窗口

  const limit = uploadLimits.get(userId);
  if (!limit || now > limit.resetTime) {
    uploadLimits.set(userId, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (limit.count >= MAX_FILES_PER_MINUTE) {
    return false;
  }

  limit.count++;
  return true;
}

/**
 * 验证文件签名（魔数）
 */
function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  const signature = FILE_SIGNATURES[mimeType];
  if (!signature) {
    // 对于没有定义签名的类型，跳过验证
    return true;
  }

  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

/**
 * 获取安全的文件扩展名
 */
function getSafeExtension(filename: string, mimeType: string): string {
  // 从文件名提取扩展名
  const extFromName = filename.split('.').pop()?.toLowerCase() || '';

  // 获取该MIME类型允许的扩展名
  const allowedExts = ALLOWED_FILE_TYPES[mimeType];
  if (!allowedExts) {
    return 'bin'; // 默认扩展名
  }

  // 检查文件名扩展名是否在允许列表中
  if (allowedExts.includes(extFromName)) {
    return extFromName;
  }

  // 如果不匹配，返回该MIME类型的第一个允许扩展名
  return allowedExts[0];
}

/**
 * 清理文件名中的特殊字符
 */
function sanitizeFilename(filename: string): string {
  // 移除路径分隔符和特殊字符
  return filename
    .replace(/[/\\]/g, '_') // 替换路径分隔符
    .replace(/[<>:"|?*]/g, '_') // 替换Windows不允许的字符
    .replace(/\s+/g, '_') // 替换空格
    .substring(0, 200); // 限制长度
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, message: '未认证' },
      { status: 401 }
    );
  }

  // 上传频率限制检查
  if (!checkRateLimit(authUser.userId)) {
    return NextResponse.json(
      { success: false, message: '上传过于频繁，请稍后再试' },
      { status: 429 }
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

    // 文件大小检查
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: '文件大小不能超过10MB' },
        { status: 400 }
      );
    }

    // MIME类型检查
    if (!ALLOWED_FILE_TYPES[file.type]) {
      logger.warn('不支持的文件类型:', {
        type: file.type,
        userId: authUser.userId,
      });
      return NextResponse.json(
        { success: false, message: '不支持的文件类型' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer());

    // 文件签名验证（防止伪造MIME类型）
    if (!validateFileSignature(buffer, file.type)) {
      logger.warn('文件签名验证失败:', {
        type: file.type,
        expected: FILE_SIGNATURES[file.type],
        actual: Array.from(buffer.slice(0, 4)),
        userId: authUser.userId,
      });
      return NextResponse.json(
        { success: false, message: '文件内容验证失败，可能是不支持的文件格式' },
        { status: 400 }
      );
    }

    // 获取安全的文件扩展名
    const safeExt = getSafeExtension(file.name, file.type);
    const safeName = sanitizeFilename(file.name);
    const savedName = `${uuidv4()}.${safeExt}`;

    // 上传文件（本地或OSS）
    await uploadFile(buffer, `evidence/${savedName}`, {
      isPrivate: true,
      contentType: file.type,
    });

    // 通过认证代理路由访问，而非直接暴露静态文件
    const fileUrl = `/api/evidence/file/${savedName}`;

    logger.info('证据文件上传成功:', {
      userId: authUser.userId,
      originalName: safeName,
      savedName,
      mimeType: file.type,
      size: file.size,
    });

    return NextResponse.json({
      success: true,
      message: '文件上传成功',
      fileUrl,
      fileName: safeName,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (error) {
    logger.error('证据文件上传失败:', error);
    return NextResponse.json(
      { success: false, message: '文件上传失败' },
      { status: 500 }
    );
  }
}
