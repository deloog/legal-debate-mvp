/**
 * 合同付款记录API路由
 * GET /api/contracts/[id]/payments - 获取付款记录列表
 * POST /api/contracts/[id]/payments - 创建付款记录
 */
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { getContractAccess } from '@/app/api/lib/middleware/contract-auth';
import {
  getFirstZodError,
  validateCreatePayment,
} from '@/lib/validations/contract';
import type { ErrorResponse, SuccessResponse } from '@/types/api-response';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * 校验合同访问权限（律师 / 委托方 / 管理员）
 * 返回合同对象，或 null 表示无权访问。
 */
/**
 * GET /api/contracts/[id]/payments
 * 获取合同的付款记录列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<unknown[]> | ErrorResponse>> {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const { id } = await params;

    const access = await getContractAccess(id, authUser.userId);
    if (!access.exists) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: '合同记录不存在' },
        },
        { status: 404 }
      );
    }
    if (!access.canRead) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: '无权访问此合同' },
        },
        { status: 403 }
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
    logger.error('获取付款记录失败:', error);

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
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const { id } = await params;

    const access = await getContractAccess(id, authUser.userId);
    if (!access.exists) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: '合同记录不存在' },
        },
        { status: 404 }
      );
    }
    if (!access.canManage) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: '无权访问此合同' },
        },
        { status: 403 }
      );
    }

    // 重新查询完整合同字段（contractNumber 用于生成付款编号）
    const fullContract = await prisma.contract.findUnique({ where: { id } });
    if (!fullContract) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: '合同记录不存在' },
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
    const isPaid = !!data.paidAt;

    // 使用事务：生成唯一编号 + 创建记录 + 原子更新已付金额，防止并发丢失更新
    const payment = await prisma.$transaction(async tx => {
      const paymentCount = await tx.contractPayment.count({
        where: { contractId: id },
      });
      const paymentNumber = `${fullContract.contractNumber}-${(paymentCount + 1).toString().padStart(2, '0')}`;

      const created = await tx.contractPayment.create({
        data: {
          contractId: id,
          paymentNumber,
          amount: data.amount,
          paymentType: data.paymentType,
          paymentMethod: data.paymentMethod || null,
          status: isPaid ? 'PAID' : 'PENDING',
          paidAt: data.paidAt || null,
          note: data.note || null,
        },
      });

      // 若已付款，用原子 increment 更新合同已付金额，避免先读后写的竞态
      if (isPaid) {
        await tx.contract.update({
          where: { id },
          data: { paidAmount: { increment: data.amount } },
        });
      }

      return created;
    });

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
    logger.error('创建付款记录失败:', error);

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
