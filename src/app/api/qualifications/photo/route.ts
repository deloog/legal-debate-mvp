/**
 * 律师资质证件照上传
 * POST /api/qualifications/photo
 * Content-Type: multipart/form-data
 * 返回 { success: true, data: { url: string, fileId: string } }
 *
 * 安全特性：
 * - 文件存储在 uploads/qualifications 目录，需通过 API 验证访问
 * - 生成随机文件名防止枚举攻击
 * - 限制文件大小和类型
 * - 验证文件内容（魔数检查防止 MIME 伪装）
 * - 记录上传审计日志
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { recognizeLicensePhoto } from '@/lib/qualification/service';
import { uploadFile } from '@/lib/storage/storage-service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * 生成安全的随机文件名
 */
function generateSecureFileName(ext: string): string {
  // 使用加密安全的随机字节
  const randomPart = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  return `qual-${timestamp}-${randomPart}.${ext}`;
}

/**
 * 验证文件内容是否为真实图片（基础验证）
 * 检查文件头部魔数（Magic Numbers）
 */
function validateImageContent(buffer: Buffer, mimeType: string): boolean {
  // JPEG: FF D8 FF
  const jpegMagic = Buffer.from([0xff, 0xd8, 0xff]);
  // PNG: 89 50 4E 47
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  // WebP: RIFF....WEBP
  const webpMagicRiff = Buffer.from([0x52, 0x49, 0x46, 0x46]);
  const webpMagicWebp = Buffer.from([0x57, 0x45, 0x42, 0x50]);

  switch (mimeType) {
    case 'image/jpeg':
      return buffer.slice(0, 3).equals(jpegMagic);
    case 'image/png':
      return buffer.slice(0, 4).equals(pngMagic);
    case 'image/webp':
      return (
        buffer.slice(0, 4).equals(webpMagicRiff) &&
        buffer.slice(8, 12).equals(webpMagicWebp)
      );
    default:
      return false;
  }
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, message: '未授权' },
      { status: 401 }
    );
  }

  const { userId } = authUser;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      logger.warn('上传失败: 缺少文件', { userId });
      return NextResponse.json(
        { success: false, message: '请选择要上传的文件' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      logger.warn('上传失败: 不支持的文件类型', {
        userId,
        mimeType: file.type,
      });
      return NextResponse.json(
        { success: false, message: '仅支持 JPG、PNG、WebP 格式' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      logger.warn('上传失败: 文件过大', { userId, fileSize: file.size });
      return NextResponse.json(
        { success: false, message: '文件大小不能超过 5MB' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer());

    // 验证文件内容（防止 MIME 伪装攻击）
    if (!validateImageContent(buffer, file.type)) {
      logger.warn('上传失败: 文件内容验证失败', {
        userId,
        mimeType: file.type,
      });
      return NextResponse.json(
        { success: false, message: '文件内容验证失败，请上传有效的图片文件' },
        { status: 400 }
      );
    }

    // 生成安全文件名
    const ext = MIME_TO_EXT[file.type];
    if (!ext) {
      logger.warn('上传失败: 无法确定文件扩展名', {
        userId,
        mimeType: file.type,
      });
      return NextResponse.json(
        { success: false, message: '无法处理此文件类型' },
        { status: 400 }
      );
    }

    const fileName = generateSecureFileName(ext);

    // 上传文件（本地或OSS）
    await uploadFile(buffer, `qualifications/${fileName}`, {
      isPrivate: true,
      contentType: file.type,
    });

    // 生成文件 ID（用于后续通过 API 访问）
    const fileId = fileName.replace(/\.[^/.]+$/, '');

    // 上传成功后自动触发 OCR 识别
    let ocrResult = null;
    let ocrError = null;

    try {
      const result = await recognizeLicensePhoto({
        base64: buffer.toString('base64'),
        mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
      });

      if (result.success) {
        ocrResult = result.data;
      } else {
        ocrError = result.error;
      }
    } catch (ocrErr) {
      logger.warn('OCR 识别失败:', ocrErr);
      ocrError = 'OCR 识别失败';
    }

    logger.info('证件照上传成功', {
      userId,
      fileName,
      fileSize: file.size,
      mimeType: file.type,
    });

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        fileName,
        // 返回 API URL 而非直接路径，强制通过认证访问
        url: `/api/qualifications/photo/${fileId}`,
        ocr: ocrResult,
        ocrError: ocrError || undefined,
      },
    });
  } catch (error) {
    logger.error('证件照上传失败:', error);
    return NextResponse.json(
      { success: false, message: '上传失败，请重试' },
      { status: 500 }
    );
  }
}
