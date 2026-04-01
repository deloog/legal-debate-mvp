/** @legacy 优先使用 /api/v1/consultations，此路由保留以向后兼容 */
/**
 * 咨询API路由
 * GET /api/consultations - 获取咨询列表
 * POST /api/consultations - 创建咨询记录
 */
import { prisma } from '@/lib/db/prisma';
import {
  getFirstZodError,
  validateCreateConsultation,
} from '@/lib/validations/consultation';
import { ErrorResponse, SuccessResponse } from '@/types/api-response';
import {
  ConsultationListItem,
  ConsultationQueryParams,
  ConsultationType,
  ConsultStatus,
  generateConsultNumber,
  isValidConsultationType,
  isValidConsultStatus,
} from '@/types/consultation';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * GET /api/consultations
 * 获取咨询列表，支持分页、筛选和搜索
 */
export async function GET(
  request: NextRequest
): Promise<
  NextResponse<
    | (SuccessResponse<ConsultationListItem[]> & { pagination?: object })
    | ErrorResponse
  >
> {
  try {
    // 认证
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '未授权，请先登录' },
        },
        { status: 401 }
      );
    }
    const userId = authUser.userId;

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const params: ConsultationQueryParams & Record<string, string | undefined> =
      Object.fromEntries(searchParams);

    // 解析分页参数
    let page = parseInt((params.page || '1') as string, 10);
    let pageSize = parseInt((params.pageSize || '20') as string, 10);

    // 限制pageSize范围
    if (pageSize < 1) pageSize = 1;
    if (pageSize > 100) pageSize = 100;

    if (page < 1) page = 1;

    // 解析筛选参数
    const {
      status,
      consultType,
      caseType,
      startDate,
      endDate,
      keyword,
      sortBy,
      sortOrder,
    } = params;

    // 验证status参数
    if (status && !isValidConsultStatus(status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: '无效的咨询状态',
          },
        },
        { status: 400 }
      );
    }

    // 验证consultType参数
    if (consultType && !isValidConsultationType(consultType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CONSULT_TYPE',
            message: '无效的咨询类型',
          },
        },
        { status: 400 }
      );
    }

    // 解析日期参数
    let startDateObj: Date | null = null;
    let endDateObj: Date | null = null;

    if (startDate) {
      startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_DATE_FORMAT',
              message: '开始日期格式无效',
            },
          },
          { status: 400 }
        );
      }
    }

    if (endDate) {
      endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_DATE_FORMAT',
              message: '结束日期格式无效',
            },
          },
          { status: 400 }
        );
      }
    }

    // 构建查询条件
    const where: Record<string, unknown> = {
      deletedAt: null, // 排除已删除的记录
      userId, // 只返回当前用户的咨询
    };

    if (status) {
      where.status = status;
    }

    if (consultType) {
      where.consultType = consultType;
    }

    if (caseType) {
      where.caseType = caseType;
    }

    // 日期范围筛选
    if (startDateObj || endDateObj) {
      const consultTimeCondition: Record<string, Date> = {};
      if (startDateObj) {
        consultTimeCondition.gte = startDateObj;
      }
      if (endDateObj) {
        consultTimeCondition.lte = endDateObj;
      }
      where.consultTime = consultTimeCondition;
    }

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { clientName: { contains: keyword } },
        { clientPhone: { contains: keyword } },
      ];
    }

    // 构建排序条件
    const orderByField = sortBy || 'consultTime';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const orderBy: Record<string, 'asc' | 'desc'> = {};
    if (['consultTime', 'createdAt', 'followUpDate'].includes(orderByField)) {
      orderBy[orderByField] = orderDirection;
    } else {
      orderBy.consultTime = 'desc';
    }

    // 计算跳过数量
    const skip = (page - 1) * pageSize;

    // 查询总数
    const total = await prisma.consultation.count({ where });

    // 查询咨询列表
    const consultations = await prisma.consultation.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 计算总页数
    const totalPages = Math.ceil(total / pageSize);

    // 转换响应数据
    const responseData: ConsultationListItem[] = consultations.map(
      consultation => ({
        id: consultation.id,
        consultNumber: consultation.consultNumber,
        clientName: consultation.clientName,
        clientPhone: consultation.clientPhone,
        clientEmail: consultation.clientEmail,
        consultType: consultation.consultType as ConsultationType,
        consultTime: consultation.consultTime,
        caseType: consultation.caseType,
        status: consultation.status as ConsultStatus,
        followUpDate: consultation.followUpDate,
        winRate: consultation.winRate,
        difficulty: consultation.difficulty,
        riskLevel: consultation.riskLevel,
        suggestedFee: consultation.suggestedFee
          ? Number(consultation.suggestedFee)
          : null,
        userId: consultation.userId,
        createdAt: consultation.createdAt,
        updatedAt: consultation.updatedAt,
      })
    );

    // 返回成功响应
    return NextResponse.json({
      success: true,
      data: responseData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logger.error('获取咨询列表失败:', error);

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
 * POST /api/consultations
 * 创建咨询记录
 */
export async function POST(
  request: NextRequest
): Promise<
  NextResponse<SuccessResponse<ConsultationListItem> | ErrorResponse>
> {
  try {
    // 认证
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '未授权，请先登录',
          },
        },
        { status: 401 }
      );
    }
    const userId = authUser.userId;

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
    const validationResult = validateCreateConsultation(body);
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

    // 生成唯一咨询编号（带重试机制处理并发冲突）
    // 使用基于时间戳+随机数的序列号，避免 findFirst+create 的 race condition
    const today = new Date();
    let consultation = null;
    let retryCount = 0;
    const maxRetries = 10;

    while (retryCount < maxRetries && !consultation) {
      try {
        // 基于时间戳和随机数生成序列号，极大降低并发冲突概率
        const timestamp = Date.now();
        const randomOffset = Math.floor(Math.random() * 10000);
        const sequence = (timestamp % 100000) + randomOffset + retryCount;

        const consultNumber = generateConsultNumber(today, sequence);

        // 创建咨询记录
        consultation = await prisma.consultation.create({
          data: {
            consultNumber,
            consultType: data.consultType,
            consultTime: data.consultTime,
            clientName: data.clientName,
            clientPhone: data.clientPhone || null,
            clientEmail: data.clientEmail || null,
            clientCompany: data.clientCompany || null,
            caseType: data.caseType || null,
            caseSummary: data.caseSummary,
            clientDemand: data.clientDemand || null,
            followUpDate: data.followUpDate || null,
            followUpNotes: data.followUpNotes || null,
            status: ConsultStatus.PENDING,
            userId,
          },
        });
      } catch (createError) {
        // 如果是唯一约束冲突，则重试
        if (
          createError &&
          typeof createError === 'object' &&
          'code' in createError &&
          createError.code === 'P2002'
        ) {
          retryCount++;
          logger.warn(`咨询编号冲突，正在进行第 ${retryCount} 次重试...`);
          if (retryCount >= maxRetries) {
            throw createError;
          }
        } else {
          throw createError;
        }
      }
    }

    // 如果 consultation 为 null，说明创建失败
    if (!consultation) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CREATE_FAILED',
            message: '创建咨询记录失败，请稍后重试',
          },
        },
        { status: 500 }
      );
    }

    // 转换响应数据
    const responseData: ConsultationListItem = {
      id: consultation.id,
      consultNumber: consultation.consultNumber,
      clientName: consultation.clientName,
      clientPhone: consultation.clientPhone,
      clientEmail: consultation.clientEmail,
      consultType: consultation.consultType as ConsultationType,
      consultTime: consultation.consultTime,
      caseType: consultation.caseType,
      status: consultation.status as ConsultStatus,
      followUpDate: consultation.followUpDate,
      winRate: consultation.winRate,
      difficulty: consultation.difficulty,
      riskLevel: consultation.riskLevel,
      suggestedFee: consultation.suggestedFee
        ? Number(consultation.suggestedFee)
        : null,
      userId: consultation.userId,
      createdAt: consultation.createdAt,
      updatedAt: consultation.updatedAt,
    };

    // 返回成功响应
    return NextResponse.json(
      {
        success: true,
        data: responseData,
      },
      { status: 201, headers: { 'Cache-Control': 'no-cache' } }
    );
  } catch (error) {
    logger.error('创建咨询记录失败:', error);

    // 处理Prisma错误
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as {
        code: string;
        message: string;
        meta?: { target?: string[] };
      };
      // P2002: 唯一约束冲突
      if (prismaError.code === 'P2002') {
        const target = prismaError.meta?.target?.join(', ') || '未知字段';
        logger.error('创建咨询记录失败：咨询编号重复', { target });
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DUPLICATE_ENTRY',
              message: '咨询编号已存在，请重试',
            },
          },
          { status: 409 }
        );
      }
      // P1001: 数据库连接失败
      if (prismaError.code === 'P1001') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DATABASE_ERROR',
              message: '数据库连接失败',
            },
          },
          { status: 500 }
        );
      }
    }

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
