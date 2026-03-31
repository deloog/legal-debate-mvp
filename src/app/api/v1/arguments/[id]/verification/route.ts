/**
 * 论点验证详情 API
 * GET /api/v1/arguments/[id]/verification
 *
 * 返回论点的三重验证详情（事实准确性、逻辑一致性、任务完成度）
 */

import { NextRequest, NextResponse } from 'next/server';
import { argumentVerificationService } from '@/lib/debate/argument-verification-service';
import { logger } from '@/lib/logger';

/**
 * 获取论点验证详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '论点ID不能为空' },
        { status: 400 }
      );
    }

    // 获取验证详情
    const verificationData =
      await argumentVerificationService.getVerificationDetails(id);

    if (!verificationData) {
      return NextResponse.json(
        {
          success: false,
          error: '该论点暂无验证数据',
          code: 'VERIFICATION_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // 格式化响应数据
    const response = {
      success: true,
      data: {
        // 验证概览
        overview: {
          overallScore: verificationData.verificationResult.overallScore,
          factualAccuracy: verificationData.verificationResult.factualAccuracy,
          logicalConsistency:
            verificationData.verificationResult.logicalConsistency,
          taskCompleteness:
            verificationData.verificationResult.taskCompleteness,
          passed: verificationData.verificationResult.passed,
          verifiedAt: verificationData.verifiedAt,
        },
        // 问题列表
        issues: {
          factual: verificationData.factualIssues,
          logical: verificationData.logicalIssues,
          completeness: verificationData.completenessIssues,
          total:
            verificationData.factualIssues.length +
            verificationData.logicalIssues.length +
            verificationData.completenessIssues.length,
        },
        // 改进建议
        suggestions: verificationData.verificationResult.suggestions,
        // 验证耗时
        verificationTime: verificationData.verificationResult.verificationTime,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('获取论点验证详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取验证详情失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
