/**
 * 咨询跟进记录API路由
 * GET /api/consultations/[id]/follow-ups - 获取跟进记录列表
 * POST /api/consultations/[id]/follow-ups - 添加跟进记录
 */
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { ErrorResponse, SuccessResponse } from '@/types/api-response';
import {
  ConsultStatus,
  CreateFollowUpRequest,
  FollowUpResponse,
} from '@/types/consultation';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/consultations/[id]/follow-ups
 * 获取跟进记录列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<FollowUpResponse[]> | ErrorResponse>> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
      { status: 401 }
    );
  }

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

    // 检查咨询记录是否存在
    const consultation = await prisma.consultation.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

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

    // 查询跟进记录
    const followUps = await prisma.consultationFollowUp.findMany({
      where: {
        consultationId: id,
      },
      orderBy: {
        followUpTime: 'desc',
      },
    });

    // 转换响应数据
    const responseData: FollowUpResponse[] = followUps.map(followUp => ({
      id: followUp.id,
      consultationId: followUp.consultationId,
      followUpTime: followUp.followUpTime,
      followUpType: followUp.followUpType,
      content: followUp.content,
      result: followUp.result,
      nextFollowUp: followUp.nextFollowUp,
      createdBy: followUp.createdBy,
      createdAt: followUp.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error('获取跟进记录失败:', error);

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
 * POST /api/consultations/[id]/follow-ups
 * 添加跟进记录
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<FollowUpResponse> | ErrorResponse>> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
      { status: 401 }
    );
  }

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

    // 检查咨询记录是否存在
    const consultation = await prisma.consultation.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

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

    // 解析请求体
    let body: CreateFollowUpRequest;
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

    // 验证必填字段
    if (!body.followUpType || typeof body.followUpType !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请选择跟进方式',
          },
        },
        { status: 400 }
      );
    }

    if (
      !body.content ||
      typeof body.content !== 'string' ||
      body.content.length < 5
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '跟进内容至少需要5个字符',
          },
        },
        { status: 400 }
      );
    }

    // 验证跟进方式
    const validFollowUpTypes = ['电话', '微信', '邮件', '面谈', '其他'];
    if (!validFollowUpTypes.includes(body.followUpType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '无效的跟进方式',
          },
        },
        { status: 400 }
      );
    }

    // 解析下次跟进日期
    let nextFollowUp: Date | null = null;
    if (body.nextFollowUp) {
      nextFollowUp = new Date(body.nextFollowUp);
      if (isNaN(nextFollowUp.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: '下次跟进日期格式无效',
            },
          },
          { status: 400 }
        );
      }
    }

    // 创建跟进记录
    const followUp = await prisma.consultationFollowUp.create({
      data: {
        consultationId: id,
        followUpTime: new Date(),
        followUpType: body.followUpType,
        content: body.content,
        result: body.result || null,
        nextFollowUp,
        // 从session获取真实用户ID
        createdBy: authUser.userId,
      },
    });

    // 更新咨询记录的状态和下次跟进日期
    const updateData: Record<string, unknown> = {};

    // 如果当前是待跟进状态，更新为跟进中
    if (consultation.status === ConsultStatus.PENDING) {
      updateData.status = ConsultStatus.FOLLOWING;
    }

    // 更新下次跟进日期
    if (nextFollowUp) {
      updateData.followUpDate = nextFollowUp;
      updateData.followUpNotes =
        `[${body.followUpType}] ${body.result || body.content}`.slice(0, 200);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.consultation.update({
        where: { id },
        data: updateData,
      });
    }

    // 转换响应数据
    const responseData: FollowUpResponse = {
      id: followUp.id,
      consultationId: followUp.consultationId,
      followUpTime: followUp.followUpTime,
      followUpType: followUp.followUpType,
      content: followUp.content,
      result: followUp.result,
      nextFollowUp: followUp.nextFollowUp,
      createdBy: followUp.createdBy,
      createdAt: followUp.createdAt,
    };

    return NextResponse.json(
      {
        success: true,
        data: responseData,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('创建跟进记录失败:', error);

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
