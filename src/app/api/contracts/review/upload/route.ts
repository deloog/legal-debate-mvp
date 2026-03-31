/**
 * 合同上传API
 * POST /api/contracts/review/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import type { ContractUploadResponse } from '@/types/contract-review';
import { logger } from '@/lib/logger';
import { uploadFile } from '@/lib/storage/storage-service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

// Magic bytes 签名校验（防止伪造 Content-Type）
// text/plain 无固定 magic bytes，跳过校验（validateFileMagicBytes 遇到未知类型返回 true）
const FILE_MAGIC_BYTES: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'application/msword': [0xd0, 0xcf, 0x11, 0xe0],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    0x50, 0x4b, 0x03, 0x04,
  ],
};

function validateFileMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const magic = FILE_MAGIC_BYTES[mimeType];
  if (!magic) return true;
  return magic.every((byte, i) => buffer[i] === byte);
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ContractUploadResponse>> {
  try {
    // 强制身份验证（不再允许匿名上传）
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_FILE',
            message: '请选择要上传的文件',
          },
        },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: '不支持的文件类型，仅支持PDF、DOC、DOCX格式',
          },
        },
        { status: 400 }
      );
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: '文件大小超过限制（最大10MB）',
          },
        },
        { status: 400 }
      );
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop();
    const fileName = `contract-${timestamp}-${randomStr}.${ext}`;

    // 读取文件并验证
    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic bytes 验证（防止伪造 Content-Type 绕过类型检查）
    if (!validateFileMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FILE_CONTENT',
            message: '文件内容与声明的类型不符',
          },
        },
        { status: 400 }
      );
    }

    // 上传文件（本地或OSS）
    await uploadFile(buffer, `contracts/${fileName}`, {
      isPrivate: true,
      contentType: file.type,
    });

    // 创建合同记录（使用已认证用户 ID）
    const contract = await prisma.contract.create({
      data: {
        contractNumber: `HT${timestamp}`,
        clientName: '待审查',
        clientType: 'INDIVIDUAL',
        caseType: '待确定',
        caseSummary: '待审查',
        scope: '待确定',
        lawFirmName: '待确定',
        lawyerName: '待确定',
        lawyerId: authUser.userId,
        feeType: 'FIXED',
        totalFee: 0,
        paidAmount: 0,
        status: 'DRAFT',
        filePath: `contracts/${fileName}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        contractId: contract.id,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('上传合同失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: '上传合同失败',
        },
      },
      { status: 500 }
    );
  }
}
