/**
 * 企业资质上传API
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import {
  updateBusinessLicense,
  getEnterpriseAccountByUserId,
} from '@/lib/enterprise/service';
import { uploadFile } from '@/lib/storage/storage-service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function generateSecureFileName(ext: string): string {
  const randomPart = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  return `entqual-${timestamp}-${randomPart}.${ext}`;
}

/**
 * 更新企业营业执照
 * @param request Next.js请求对象
 * @returns Next.js响应对象
 */
export async function POST(request: NextRequest) {
  try {
    // 获取认证用户信息
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: '未登录',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // 检查用户是否已注册企业账号
    const existingAccount = await getEnterpriseAccountByUserId(user.userId);
    if (!existingAccount) {
      return NextResponse.json(
        {
          success: false,
          message: '未找到企业账号，请先注册',
          error: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // 解析请求体
    const body: { businessLicense: string } = await request.json();
    const { businessLicense } = body;

    // 验证营业执照数据
    if (!businessLicense || typeof businessLicense !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: '营业执照数据无效',
          error: 'INVALID_DATA',
        },
        { status: 400 }
      );
    }

    // 检查是否为合法 data URL 格式，并白名单 MIME 类型
    const dataUrlMatch = businessLicense.match(
      /^data:([^;]+);base64,([\s\S]+)$/
    );
    if (!dataUrlMatch) {
      return NextResponse.json(
        {
          success: false,
          message: '营业执照必须为Base64格式的图片',
          error: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }
    const mimeType = dataUrlMatch[1];
    const base64Data = dataUrlMatch[2];
    if (!ALLOWED_MIME.includes(mimeType)) {
      return NextResponse.json(
        {
          success: false,
          message: '仅支持 JPEG、PNG、WebP 格式的图片',
          error: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }

    // 限制图片大小（Base64 字符数 ≈ 原始字节数 × 4/3）
    if (base64Data.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: '营业执照图片大小不能超过5MB',
          error: 'FILE_TOO_LARGE',
        },
        { status: 400 }
      );
    }

    // 验证文件魔数（防止 MIME 类型伪造）
    const MAGIC_BYTES: Record<string, number[]> = {
      'image/jpeg': [0xff, 0xd8, 0xff],
      'image/png': [0x89, 0x50, 0x4e, 0x47],
      'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
    };
    try {
      const buf = Buffer.from(base64Data, 'base64');
      const magic = MAGIC_BYTES[mimeType];
      const isValidMagic = magic.every((byte, i) => buf[i] === byte);
      if (!isValidMagic) {
        return NextResponse.json(
          {
            success: false,
            message: '图片文件内容与声明的格式不匹配',
            error: 'INVALID_FORMAT',
          },
          { status: 400 }
        );
      }
      const ext = MIME_TO_EXT[mimeType];
      const fileName = generateSecureFileName(ext);
      await uploadFile(buf, `enterprise/${fileName}`, {
        isPrivate: true,
        contentType: mimeType,
      });
      const fileId = fileName.replace(/\.[^/.]+$/, '');
      const storedLicenseUrl = `/api/enterprise/qualification/${fileId}`;

      // 更新营业执照
      const enterpriseAccount = await updateBusinessLicense(
        user.userId,
        storedLicenseUrl
      );

      return NextResponse.json(
        {
          success: true,
          message: '营业执照上传成功',
          data: {
            ...enterpriseAccount,
            businessLicense: storedLicenseUrl,
          },
        },
        { status: 200 }
      );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: '营业执照数据无效',
          error: 'INVALID_DATA',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('企业资质上传失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '资质上传失败，请稍后重试',
        error: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
