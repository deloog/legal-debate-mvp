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
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证身份
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 验证合同所有权（律师 / 委托方 / 管理员）
    const [contract, dbUser] = await Promise.all([
      prisma.contract.findUnique({
        where: { id },
        select: { lawyerId: true, case: { select: { userId: true } } },
      }),
      prisma.user.findUnique({
        where: { id: user.userId },
        select: { role: true },
      }),
    ]);
    if (!contract) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '合同不存在' } },
        { status: 404 }
      );
    }
    // 从 DB 实时读取角色，防止 stale JWT 绕过管理员豁免
    const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';
    const isLawyer = contract.lawyerId === user.userId;
    const isClient = contract.case?.userId === user.userId;
    if (!isAdmin && !isLawyer && !isClient) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: '无权访问此合同' },
        },
        { status: 403 }
      );
    }

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
    logger.error('生成合同PDF失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PDF_GENERATION_FAILED',
          message: '生成PDF失败',
        },
      },
      { status: 500 }
    );
  }
}
