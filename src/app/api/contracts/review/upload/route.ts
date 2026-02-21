/**
 * 合同上传API
 * POST /api/contracts/review/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { prisma } from '@/lib/db/prisma';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth/jwt';
import type { ContractUploadResponse } from '@/types/contract-review';
import { logger } from '@/lib/logger';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'contracts');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export async function POST(
  request: NextRequest
): Promise<NextResponse<ContractUploadResponse>> {
  try {
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

    // 确保上传目录存在
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop();
    const fileName = `contract-${timestamp}-${randomStr}.${ext}`;
    const filePath = join(UPLOAD_DIR, fileName);

    // 保存文件
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // 尝试从 Authorization header 获取上传用户 ID
    const authHeader = request.headers.get('authorization');
    const token = authHeader ? extractTokenFromHeader(authHeader) : null;
    const tokenResult = token ? verifyToken(token) : null;
    const uploaderUserId =
      tokenResult?.valid && tokenResult.payload
        ? tokenResult.payload.userId
        : 'anonymous';

    // 创建合同记录
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
        lawyerId: uploaderUserId,
        feeType: 'FIXED',
        totalFee: 0,
        paidAmount: 0,
        status: 'DRAFT',
        filePath: `/uploads/contracts/${fileName}`,
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
