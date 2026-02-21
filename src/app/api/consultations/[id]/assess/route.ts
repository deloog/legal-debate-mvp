/**
 * 咨询AI评估API路由
 * POST /api/consultations/[id]/assess - 执行AI案件评估
 */
import { createCaseAssessmentService } from '@/lib/consultation/case-assessment-service';
import { prisma } from '@/lib/db/prisma';
import { ErrorResponse, SuccessResponse } from '@/types/api-response';
import { AIAssessment } from '@/types/consultation';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/consultations/[id]/assess
 * 执行AI案件评估
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<AIAssessment> | ErrorResponse>> {
  try {
    const { id } = await params;

    // 验证ID格式
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的咨询ID',
          },
        },
        { status: 400 }
      );
    }

    // 查询咨询记录
    const consultation = await prisma.consultation.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    // 检查是否存在
    if (!consultation) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '咨询记录不存在',
          },
        },
        { status: 404 }
      );
    }

    // 检查案情摘要是否存在
    if (!consultation.caseSummary || consultation.caseSummary.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_DATA',
            message: '案情摘要信息不足，无法进行评估',
          },
        },
        { status: 400 }
      );
    }

    // 创建评估服务并执行评估
    const assessmentService = createCaseAssessmentService();
    const assessment = await assessmentService.assess({
      caseType: consultation.caseType || undefined,
      caseSummary: consultation.caseSummary,
      clientDemand: consultation.clientDemand || undefined,
      consultationType: consultation.consultType,
    });

    // 更新咨询记录的评估结果
    await prisma.consultation.update({
      where: { id },
      data: {
        aiAssessment: assessment as any,
        winRate: assessment.winRate,
        difficulty: assessment.difficulty,
        riskLevel: assessment.riskLevel,
        suggestedFee: assessment.suggestedFeeMax, // 使用最高费用作为建议
      },
    });

    return NextResponse.json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    logger.error('AI评估失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ASSESSMENT_FAILED',
          message: error instanceof Error ? error.message : '评估失败，请重试',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/consultations/[id]/assess
 * 获取已有的评估结果
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<AIAssessment | null> | ErrorResponse>> {
  try {
    const { id } = await params;

    // 验证ID格式
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的咨询ID',
          },
        },
        { status: 400 }
      );
    }

    // 查询咨询记录
    const consultation = await prisma.consultation.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        aiAssessment: true,
      },
    });

    // 检查是否存在
    if (!consultation) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '咨询记录不存在',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: consultation.aiAssessment as any,
    });
  } catch (error) {
    logger.error('获取评估结果失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '服务器内部错误',
        },
      },
      { status: 500 }
    );
  }
}
