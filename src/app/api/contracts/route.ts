/**
 * 合同API路由
 * GET /api/contracts - 获取合同列表
 * POST /api/contracts - 创建合同
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ContractStatus } from '@/types/contract';
import {
  validateCreateContract,
  validateContractListQuery,
  getFirstZodError,
} from '@/lib/validations/contract';

/**
 * 标准成功响应格式
 */
interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * 标准错误响应格式
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * 生成合同编号
 * 格式: HT + 日期(YYYYMMDD) + 序号(3位)
 */
async function generateContractNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  // 查询今天已有的合同数量
  const count = await prisma.contract.count({
    where: {
      contractNumber: {
        startsWith: `HT${dateStr}`,
      },
    },
  });

  // 生成序号（3位，不足补0）
  const sequence = (count + 1).toString().padStart(3, '0');

  return `HT${dateStr}${sequence}`;
}

/**
 * GET /api/contracts
 * 获取合同列表
 */
export async function GET(request: NextRequest): Promise<
  NextResponse<
    | SuccessResponse<{
        items: unknown[];
        total: number;
        page: number;
        pageSize: number;
      }>
    | ErrorResponse
  >
> {
  try {
    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '20',
      status: searchParams.get('status') || undefined,
      keyword: searchParams.get('keyword') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    // 验证查询参数
    const validationResult = validateContractListQuery(queryParams);
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

    const { page, pageSize, status, keyword, startDate, endDate } =
      validationResult.data;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    // 状态筛选
    if (status) {
      where.status = status;
    }

    // 关键词搜索（客户名称或合同编号）
    if (keyword) {
      where.OR = [
        { clientName: { contains: keyword, mode: 'insensitive' } },
        { contractNumber: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    // 日期范围筛选
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDateTime;
      }
    }

    // 查询总数
    const total = await prisma.contract.count({ where });

    // 查询列表数据（优化：只查询需要的字段）
    const contracts = await prisma.contract.findMany({
      where,
      select: {
        id: true,
        contractNumber: true,
        clientName: true,
        clientType: true,
        caseType: true,
        totalFee: true,
        paidAmount: true,
        status: true,
        signedAt: true,
        createdAt: true,
        case: {
          select: {
            id: true,
            title: true,
            caseNumber: true,
          },
        },
        payments: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 转换响应数据
    const items = contracts.map(contract => ({
      id: contract.id,
      contractNumber: contract.contractNumber,
      clientName: contract.clientName,
      clientType: contract.clientType,
      caseType: contract.caseType,
      totalFee: Number(contract.totalFee),
      paidAmount: Number(contract.paidAmount),
      status: contract.status,
      signedAt: contract.signedAt,
      createdAt: contract.createdAt,
      case: contract.case,
      paymentCount: contract.payments.length,
      paidPaymentCount: contract.payments.filter(p => p.status === 'PAID')
        .length,
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('获取合同列表失败:', error);

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
 * POST /api/contracts
 * 创建合同
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SuccessResponse<unknown> | ErrorResponse>> {
  try {
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
    const validationResult = validateCreateContract(body);
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

    // 生成合同编号
    const contractNumber = await generateContractNumber();

    // 创建合同
    const contract = await prisma.contract.create({
      data: {
        contractNumber,
        caseId: data.caseId || null,
        consultationId: data.consultationId || null,
        clientType: data.clientType,
        clientName: data.clientName,
        clientIdNumber: data.clientIdNumber || null,
        clientAddress: data.clientAddress || null,
        clientContact: data.clientContact || null,
        lawFirmName: data.lawFirmName,
        lawyerName: data.lawyerName,
        lawyerId: data.lawyerId,
        caseType: data.caseType,
        caseSummary: data.caseSummary,
        scope: data.scope,
        feeType: data.feeType,
        totalFee: data.totalFee,
        feeDetails: data.feeDetails || null,
        terms: data.terms || null,
        specialTerms: data.specialTerms || null,
        status: ContractStatus.DRAFT,
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            caseNumber: true,
          },
        },
      },
    });

    // 如果提供了付款计划，创建付款记录
    if (data.payments && Array.isArray(data.payments)) {
      for (let i = 0; i < data.payments.length; i++) {
        const payment = data.payments[i];
        const paymentNumber = `${contractNumber}-${(i + 1).toString().padStart(2, '0')}`;

        await prisma.contractPayment.create({
          data: {
            contractId: contract.id,
            paymentNumber,
            amount: payment.amount,
            paymentType: payment.paymentType,
            status: 'PENDING',
          },
        });
      }
    }

    // 转换响应数据
    const responseData = {
      id: contract.id,
      contractNumber: contract.contractNumber,
      clientName: contract.clientName,
      clientType: contract.clientType,
      caseType: contract.caseType,
      totalFee: Number(contract.totalFee),
      paidAmount: Number(contract.paidAmount),
      status: contract.status,
      createdAt: contract.createdAt,
      case: contract.case,
    };

    return NextResponse.json(
      {
        success: true,
        data: responseData,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('创建合同失败:', error);

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
