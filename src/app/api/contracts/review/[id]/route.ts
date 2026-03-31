/**
 * 合同审查API
 * GET /api/contracts/review/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { resolve, sep } from 'path';
import { prisma } from '@/lib/db/prisma';
import { reviewContract } from '@/lib/ai/contract-reviewer';
import type {
  ContractReviewResponse,
  ReviewReport,
} from '@/types/contract-review';
import { logger } from '@/lib/logger';
import {
  resolveContractUserId,
  unauthorizedResponse,
} from '@/app/api/lib/middleware/contract-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ContractReviewResponse>> {
  // ─── 认证 ─────────────────────────────────────────────────────────────────
  const userId = resolveContractUserId(request);
  if (!userId) {
    return unauthorizedResponse() as NextResponse<ContractReviewResponse>;
  }

  try {
    const contractId = (await params).id;

    // 查找合同
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONTRACT_NOT_FOUND',
            message: '合同不存在',
          },
        },
        { status: 404 }
      );
    }

    // 校验合同归属（律师或案件所有人）
    let isAuthorized = contract.lawyerId === userId;
    if (!isAuthorized && contract.caseId) {
      const caseData = await prisma.case.findUnique({
        where: { id: contract.caseId },
        select: { userId: true },
      });
      isAuthorized = caseData?.userId === userId;
    }
    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: '无权访问此合同' },
        },
        { status: 403 }
      );
    }

    if (!contract.filePath) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_FILE',
            message: '合同文件不存在',
          },
        },
        { status: 400 }
      );
    }

    // ─── 路径安全验证（防路径穿越） ───────────────────────────────────────────
    // 本地存储写入 private_uploads/；剥掉开头的 / 或 \ 防止 resolve() 覆盖基准目录
    const uploadsDir = resolve(process.cwd(), 'private_uploads');
    const relativePath = contract.filePath.replace(/^[/\\]+/, '');
    const resolvedFilePath = resolve(uploadsDir, relativePath);
    if (!resolvedFilePath.startsWith(uploadsDir + sep)) {
      logger.warn('路径穿越尝试被拦截', {
        contractId,
        filePath: contract.filePath,
      });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FILE_PATH',
            message: '文件路径无效',
          },
        },
        { status: 400 }
      );
    }

    // ─── 读取合同文件内容 ─────────────────────────────────────────────────────
    let content: string;
    let fileSize: number;
    try {
      const [buffer, fileStats] = await Promise.all([
        readFile(resolvedFilePath),
        stat(resolvedFilePath),
      ]);
      content = buffer.toString('utf-8');
      fileSize = fileStats.size;
    } catch (error) {
      logger.error('读取合同文件失败:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_READ_ERROR',
            message: '合同文件读取失败，请确认文件是否存在',
          },
        },
        { status: 500 }
      );
    }

    // 调用AI审查服务
    const reviewResult = await reviewContract(
      contractId,
      contract.filePath,
      content
    );

    // 计算风险统计
    const risks: ReviewReport['risks'] = reviewResult.risks ?? [];
    const totalRisks = risks.length;
    const criticalRisks = risks.filter(r => r.level === 'CRITICAL').length;
    const highRisks = risks.filter(r => r.level === 'HIGH').length;
    const mediumRisks = risks.filter(r => r.level === 'MEDIUM').length;
    const lowRisks = risks.filter(r => r.level === 'LOW').length;

    // 构建完整的审查报告
    const report: ReviewReport = {
      id: `review-${Date.now()}`,
      contractId: contract.id,
      fileName: contract.filePath.split('/').pop() || 'unknown',
      fileSize,
      uploadedAt: contract.createdAt,
      reviewedAt: new Date(),
      status: 'COMPLETED',
      ...reviewResult,
      totalRisks,
      criticalRisks,
      highRisks,
      mediumRisks,
      lowRisks,
    };

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('审查合同失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'REVIEW_FAILED',
          message: '审查合同失败',
        },
      },
      { status: 500 }
    );
  }
}
