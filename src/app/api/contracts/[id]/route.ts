/**
 * 单个合同API路由
 * GET /api/contracts/[id] - 获取合同详情
 * PUT /api/contracts/[id] - 更新合同记录
 */
import { clearContractPDFCache } from '@/lib/contract/contract-pdf-generator';
import { prisma } from '@/lib/db/prisma';
import {
  getFirstZodError,
  validateUpdateContract,
} from '@/lib/validations/contract';
import type { ErrorResponse, SuccessResponse } from '@/types/api-response';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  resolveContractUserId,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/app/api/lib/middleware/contract-auth';

/**
 * GET /api/contracts/[id]
 * 获取合同详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<unknown> | ErrorResponse>> {
  // ─── 认证 ─────────────────────────────────────────────────────────────────
  const userId = resolveContractUserId(request);
  if (!userId) return unauthorizedResponse();

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

    // 查询合同记录
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            caseNumber: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // 检查是否存在
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

    // 转换响应数据
    const responseData = {
      id: contract.id,
      contractNumber: contract.contractNumber,
      caseId: contract.caseId,
      consultationId: contract.consultationId,
      clientType: contract.clientType,
      clientName: contract.clientName,
      clientIdNumber: contract.clientIdNumber,
      clientAddress: contract.clientAddress,
      clientContact: contract.clientContact,
      lawFirmName: contract.lawFirmName,
      lawyerName: contract.lawyerName,
      lawyerId: contract.lawyerId,
      caseType: contract.caseType,
      caseSummary: contract.caseSummary,
      scope: contract.scope,
      feeType: contract.feeType,
      totalFee: Number(contract.totalFee),
      paidAmount: Number(contract.paidAmount),
      feeDetails: contract.feeDetails,
      terms: contract.terms,
      specialTerms: contract.specialTerms,
      status: contract.status,
      signedAt: contract.signedAt,
      signatureData: contract.signatureData,
      filePath: contract.filePath,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      case: contract.case,
      payments: contract.payments.map(payment => ({
        id: payment.id,
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
      })),
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error('获取合同详情失败:', error);

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
 * PUT /api/contracts/[id]
 * 更新合同记录
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<unknown> | ErrorResponse>> {
  // ─── 认证 ─────────────────────────────────────────────────────────────────
  const userId = resolveContractUserId(request);
  if (!userId) return unauthorizedResponse();

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

    // 检查记录是否存在，并验证所有权（lawyerId === userId）
    const existing = await prisma.contract.findUnique({
      where: { id },
    });

    if (!existing) {
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

    // ─── 所有权检查（只有合同归属律师可以修改） ─────────────────────────────
    if (existing.lawyerId !== userId) {
      return forbiddenResponse();
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
    const validationResult = validateUpdateContract(body);
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

    if (data.clientType !== undefined) updateData.clientType = data.clientType;
    if (data.clientName !== undefined) updateData.clientName = data.clientName;
    if (data.clientIdNumber !== undefined)
      updateData.clientIdNumber = data.clientIdNumber || null;
    if (data.clientAddress !== undefined)
      updateData.clientAddress = data.clientAddress || null;
    if (data.clientContact !== undefined)
      updateData.clientContact = data.clientContact || null;
    if (data.lawFirmName !== undefined)
      updateData.lawFirmName = data.lawFirmName;
    if (data.lawyerName !== undefined) updateData.lawyerName = data.lawyerName;
    if (data.caseType !== undefined) updateData.caseType = data.caseType;
    if (data.caseSummary !== undefined)
      updateData.caseSummary = data.caseSummary;
    if (data.scope !== undefined) updateData.scope = data.scope;
    if (data.feeType !== undefined) updateData.feeType = data.feeType;
    if (data.totalFee !== undefined) updateData.totalFee = data.totalFee;
    if (data.feeDetails !== undefined)
      updateData.feeDetails = data.feeDetails || null;
    if (data.terms !== undefined) updateData.terms = data.terms || null;
    if (data.specialTerms !== undefined)
      updateData.specialTerms = data.specialTerms || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.signedAt !== undefined)
      updateData.signedAt = data.signedAt || null;
    if (data.signatureData !== undefined)
      updateData.signatureData = data.signatureData || null;

    // 更新合同记录
    const contract = await prisma.contract.update({
      where: { id },
      data: updateData,
      include: {
        case: {
          select: {
            id: true,
            title: true,
            caseNumber: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // 清除PDF缓存（异步执行，不阻塞响应）
    clearContractPDFCache(id).catch(error => {
      logger.error('清除PDF缓存失败:', error);
    });

    // 转换响应数据
    const responseData = {
      id: contract.id,
      contractNumber: contract.contractNumber,
      caseId: contract.caseId,
      consultationId: contract.consultationId,
      clientType: contract.clientType,
      clientName: contract.clientName,
      clientIdNumber: contract.clientIdNumber,
      clientAddress: contract.clientAddress,
      clientContact: contract.clientContact,
      lawFirmName: contract.lawFirmName,
      lawyerName: contract.lawyerName,
      lawyerId: contract.lawyerId,
      caseType: contract.caseType,
      caseSummary: contract.caseSummary,
      scope: contract.scope,
      feeType: contract.feeType,
      totalFee: Number(contract.totalFee),
      paidAmount: Number(contract.paidAmount),
      feeDetails: contract.feeDetails,
      terms: contract.terms,
      specialTerms: contract.specialTerms,
      status: contract.status,
      signedAt: contract.signedAt,
      signatureData: contract.signatureData,
      filePath: contract.filePath,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      case: contract.case,
      payments: contract.payments.map(payment => ({
        id: payment.id,
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
      })),
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error('更新合同记录失败:', error);

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
