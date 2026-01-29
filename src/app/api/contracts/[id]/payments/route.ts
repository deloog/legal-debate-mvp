/**
 * 合同付款记录API路由
 * GET /api/contracts/[id]/payments - 获取付款记录列表
 * POST /api/contracts/[id]/payments - 创建付款记录
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  validateCreatePayment,
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
 * GET /api/contracts/[id]/payments
 * 获取合同的付款记录列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<unknown[]> | ErrorResponse>> {
  try {
    const { id } = await params;

    // 验证ID格式
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的合同ID',
          },
        },
        { status: 400 }
      );
    }

    // 检查合同是否存在
    const contract = await prisma.contract.findUnique({
      where: { id },
    });

    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '合同记录不存在',
          },
        },
        { status: 404 }
      );
    }

    // 查询付款记录
    const payments = await prisma.contractPayment.findMany({
      where: {
        contractId: id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 转换响应数据
    const responseData = payments.map(payment => ({
      id: payment.id,
      contractId: payment.contractId,
      paymentNumber: payment.paymentNumber,
      amount: Number(payment.amount),
      paymentType: payment.paymentType,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      paidAt: payment.paidAt,
      receiptNumber: payment.receiptNumber,
      invoiceId: payment.invoiceId,
      note: payment.note,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('获取付款记录失败:', error);

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
 * POST /api/contracts/[id]/payments
 * 创建付款记录
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<unknown> | ErrorResponse>> {
  try {
    const { id } = await params;

    // 验证ID格式
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的合同ID',
          },
        },
        { status: 400 }
      );
    }

    // 检查合同是否存在
    const contract = await prisma.contract.findUnique({
      where: { id },
    });

    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '合同记录不存在',
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

    // 添加合同ID到请求数据
    body.contractId = id;

    // 验证请求数据
    const validationResult = validateCreatePayment(body);
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

    // 生成付款编号
    const paymentCount = await prisma.contractPayment.count({
      where: {
        contractId: id,
      },
    });
    const paymentNumber = `${contract.contractNumber}-${(paymentCount + 1).toString().padStart(2, '0')}`;

    // 创建付款记录
    const payment = await prisma.contractPayment.create({
      data: {
        contractId: id,
        paymentNumber,
        amount: data.amount,
        paymentType: data.paymentType,
        paymentMethod: data.paymentMethod || null,
        status: data.paidAt ? 'PAID' : 'PENDING',
        paidAt: data.paidAt || null,
        note: data.note || null,
      },
    });

    // 如果付款已完成，更新合同的已付金额
    if (payment.status === 'PAID') {
      const totalPaid = await prisma.contractPayment.aggregate({
        where: {
          contractId: id,
          status: 'PAID',
        },
        _sum: {
          amount: true,
        },
      });

      await prisma.contract.update({
        where: { id },
        data: {
          paidAmount: totalPaid._sum.amount || 0,
        },
      });
    }

    // 转换响应数据
    const responseData = {
      id: payment.id,
      contractId: payment.contractId,
      paymentNumber: payment.paymentNumber,
      amount: Number(payment.amount),
      paymentType: payment.paymentType,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      paidAt: payment.paidAt,
      receiptNumber: payment.receiptNumber,
      invoiceId: payment.invoiceId,
      note: payment.note,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };

    return NextResponse.json(
      {
        success: true,
        data: responseData,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('创建付款记录失败:', error);

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
