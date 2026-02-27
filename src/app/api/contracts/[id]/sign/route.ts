/**
 * POST /api/contracts/[id]/sign
 * 提交电子签名
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { clearContractPDFCache } from '@/lib/contract/contract-pdf-generator';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // 验证必填字段
    if (!body.role || !body.signature) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: '缺少必填字段',
          },
        },
        { status: 400 }
      );
    }

    if (body.role !== 'client' && body.role !== 'lawyer') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ROLE',
            message: '无效的签名角色',
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
            code: 'CONTRACT_NOT_FOUND',
            message: '合同不存在',
          },
        },
        { status: 404 }
      );
    }

    // 获取客户端IP和设备信息
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 准备更新数据
    type SignUpdateData = {
      clientSignature?: string;
      clientSignedAt?: Date;
      clientSignedIp?: string;
      signatureDevice?: string;
      lawyerSignature?: string;
      lawyerSignedAt?: Date;
      lawyerSignedIp?: string;
      status?: string;
      signedAt?: Date;
    };
    const updateData: SignUpdateData = {};
    const now = new Date();

    if (body.role === 'client') {
      // 检查是否已签署
      if (contract.clientSignature) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ALREADY_SIGNED',
              message: '委托人已签署，无法重复签署',
            },
          },
          { status: 400 }
        );
      }

      updateData.clientSignature = body.signature;
      updateData.clientSignedAt = now;
      updateData.clientSignedIp = ip;
      updateData.signatureDevice = userAgent;
    } else {
      // 检查是否已签署
      if (contract.lawyerSignature) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ALREADY_SIGNED',
              message: '律师已签署，无法重复签署',
            },
          },
          { status: 400 }
        );
      }

      updateData.lawyerSignature = body.signature;
      updateData.lawyerSignedAt = now;
      updateData.lawyerSignedIp = ip;
      updateData.signatureDevice = userAgent;
    }

    // 检查是否双方都已签署
    const willBeFullySigned =
      (body.role === 'client' ? true : !!contract.clientSignature) &&
      (body.role === 'lawyer' ? true : !!contract.lawyerSignature);

    if (willBeFullySigned) {
      updateData.status = 'SIGNED';
      updateData.signedAt = now;
    }

    // 更新合同
    const ___updatedContract = await prisma.contract.update({
      where: { id },
      data: updateData,
    });

    // 清除PDF缓存（因为需要包含签名）
    clearContractPDFCache(id).catch(error => {
      logger.error('清除PDF缓存失败:', error);
    });

    // 如果双方都已签署，发送签署确认邮件
    if (willBeFullySigned) {
      // 异步发送邮件，不阻塞响应
      import('@/lib/email/contract-email-service').then(
        ({ contractEmailService }) => {
          contractEmailService.sendSignatureConfirmation(id).catch(error => {
            logger.error('发送签署确认邮件失败:', error);
          });
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        role: body.role,
        signedAt: now,
        isFullySigned: willBeFullySigned,
      },
      message: '签名成功',
    });
  } catch (error) {
    logger.error('提交签名失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '提交签名失败',
        },
      },
      { status: 500 }
    );
  }
}
