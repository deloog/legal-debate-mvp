/**
 * 单个咨询API路由
 * GET /api/consultations/[id] - 获取咨询详情
 * PUT /api/consultations/[id] - 更新咨询记录
 * DELETE /api/consultations/[id] - 删除咨询记录（软删除）
 */
import { prisma } from '@/lib/db/prisma';
import {
  getFirstZodError,
  validateUpdateConsultation,
} from '@/lib/validations/consultation';
import { ErrorResponse, SuccessResponse } from '@/types/api-response';
import {
  ConsultationDetailResponse,
  ConsultationType,
  ConsultStatus,
} from '@/types/consultation';
import { NextRequest, NextResponse } from 'next/server';

export type { ErrorResponse, SuccessResponse };

// ConsultationDetailResponse 已从 @/types/consultation 导入
// 不再需要本地定义

/**
 * GET /api/consultations/[id]
 * 获取咨询详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<
  NextResponse<SuccessResponse<ConsultationDetailResponse> | ErrorResponse>
> {
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
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        followUps: {
          orderBy: {
            followUpTime: 'desc',
          },
        },
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

    // 转换响应数据
    const responseData: ConsultationDetailResponse = {
      id: consultation.id,
      consultNumber: consultation.consultNumber,
      clientName: consultation.clientName,
      clientPhone: consultation.clientPhone,
      clientEmail: consultation.clientEmail,
      clientCompany: consultation.clientCompany,
      consultType: consultation.consultType as ConsultationType,
      consultTime: consultation.consultTime,
      caseType: consultation.caseType,
      caseSummary: consultation.caseSummary,
      clientDemand: consultation.clientDemand,
      status: consultation.status as ConsultStatus,
      followUpDate: consultation.followUpDate,
      followUpNotes: consultation.followUpNotes,
      aiAssessment: consultation.aiAssessment,
      winRate: consultation.winRate,
      difficulty: consultation.difficulty,
      riskLevel: consultation.riskLevel,
      suggestedFee: consultation.suggestedFee
        ? Number(consultation.suggestedFee)
        : null,
      convertedToCaseId: consultation.convertedToCaseId,
      convertedAt: consultation.convertedAt,
      userId: consultation.userId,
      user: consultation.user,
      followUps: consultation.followUps.map(followUp => ({
        id: followUp.id,
        followUpTime: followUp.followUpTime,
        followUpType: followUp.followUpType,
        content: followUp.content,
        result: followUp.result,
        nextFollowUp: followUp.nextFollowUp,
        createdBy: followUp.createdBy,
        createdAt: followUp.createdAt,
      })),
      createdAt: consultation.createdAt,
      updatedAt: consultation.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('获取咨询详情失败:', error);

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

/**
 * PUT /api/consultations/[id]
 * 更新咨询记录
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<
  NextResponse<SuccessResponse<ConsultationDetailResponse> | ErrorResponse>
> {
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

    // 检查记录是否存在
    const existing = await prisma.consultation.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!existing) {
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

    // 解析请求体
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: '请求体格式错误',
          },
        },
        { status: 400 }
      );
    }

    // 验证请求数据
    const validationResult = validateUpdateConsultation(body);
    if (!validationResult.success) {
      const errorMessage = getFirstZodError(validationResult);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: errorMessage,
          },
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // 构建更新数据
    const updateData: Record<string, unknown> = {};

    if (data.consultType !== undefined)
      updateData.consultType = data.consultType;
    if (data.consultTime !== undefined)
      updateData.consultTime = data.consultTime;
    if (data.clientName !== undefined) updateData.clientName = data.clientName;
    if (data.clientPhone !== undefined)
      updateData.clientPhone = data.clientPhone || null;
    if (data.clientEmail !== undefined)
      updateData.clientEmail = data.clientEmail || null;
    if (data.clientCompany !== undefined)
      updateData.clientCompany = data.clientCompany || null;
    if (data.caseType !== undefined)
      updateData.caseType = data.caseType || null;
    if (data.caseSummary !== undefined)
      updateData.caseSummary = data.caseSummary;
    if (data.clientDemand !== undefined)
      updateData.clientDemand = data.clientDemand || null;
    if (data.followUpDate !== undefined)
      updateData.followUpDate = data.followUpDate || null;
    if (data.followUpNotes !== undefined)
      updateData.followUpNotes = data.followUpNotes || null;

    // 处理状态变更（需要单独处理body中的status字段）
    if ('status' in body && typeof body.status === 'string') {
      const validStatuses = Object.values(ConsultStatus);
      if (validStatuses.includes(body.status as ConsultStatus)) {
        updateData.status = body.status;
      }
    }

    // 更新咨询记录
    const consultation = await prisma.consultation.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        followUps: {
          orderBy: {
            followUpTime: 'desc',
          },
        },
      },
    });

    // 转换响应数据
    const responseData: ConsultationDetailResponse = {
      id: consultation.id,
      consultNumber: consultation.consultNumber,
      clientName: consultation.clientName,
      clientPhone: consultation.clientPhone,
      clientEmail: consultation.clientEmail,
      clientCompany: consultation.clientCompany,
      consultType: consultation.consultType as ConsultationType,
      consultTime: consultation.consultTime,
      caseType: consultation.caseType,
      caseSummary: consultation.caseSummary,
      clientDemand: consultation.clientDemand,
      status: consultation.status as ConsultStatus,
      followUpDate: consultation.followUpDate,
      followUpNotes: consultation.followUpNotes,
      aiAssessment: consultation.aiAssessment,
      winRate: consultation.winRate,
      difficulty: consultation.difficulty,
      riskLevel: consultation.riskLevel,
      suggestedFee: consultation.suggestedFee
        ? Number(consultation.suggestedFee)
        : null,
      convertedToCaseId: consultation.convertedToCaseId,
      convertedAt: consultation.convertedAt,
      userId: consultation.userId,
      user: consultation.user,
      followUps: consultation.followUps.map(followUp => ({
        id: followUp.id,
        followUpTime: followUp.followUpTime,
        followUpType: followUp.followUpType,
        content: followUp.content,
        result: followUp.result,
        nextFollowUp: followUp.nextFollowUp,
        createdBy: followUp.createdBy,
        createdAt: followUp.createdAt,
      })),
      createdAt: consultation.createdAt,
      updatedAt: consultation.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('更新咨询记录失败:', error);

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

/**
 * DELETE /api/consultations/[id]
 * 删除咨询记录（软删除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<{ id: string }> | ErrorResponse>> {
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

    // 检查记录是否存在
    const existing = await prisma.consultation.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!existing) {
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

    // 软删除咨询记录
    await prisma.consultation.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('删除咨询记录失败:', error);

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
