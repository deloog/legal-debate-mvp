/**
 * GET /api/contracts/[id]/pdf
 * 生成/下载合同PDF
 * 支持缓存机制，提升生成速度
 *
 * 查询参数：
 * - force: 是否强制重新生成（忽略缓存）
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateContractPDF,
  contractFileExists,
} from '@/lib/contract/contract-pdf-generator';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const forceRegenerate = searchParams.get('force') === 'true';

    // 生成PDF（支持缓存）
    const filePath = await generateContractPDF(id, forceRegenerate);
    const absolutePath = path.join(process.cwd(), 'public', filePath);

    // 检查文件是否存在
    const exists = await contractFileExists(filePath);
    if (!exists) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'PDF文件不存在',
          },
        },
        { status: 404 }
      );
    }

    // 读取文件
    const fileBuffer = await fs.promises.readFile(absolutePath);

    // 返回PDF文件
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="contract-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('生成合同PDF失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PDF_GENERATION_FAILED',
          message: error instanceof Error ? error.message : '生成PDF失败',
        },
      },
      { status: 500 }
    );
  }
}
