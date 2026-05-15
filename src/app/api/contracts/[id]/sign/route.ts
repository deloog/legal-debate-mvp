/**
 * POST /api/contracts/[id]/sign
 * 提交电子签名
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { clearContractPDFCache } from '@/lib/contract/contract-pdf-generator';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit/logger';
import { verifyContractSigningToken } from '@/lib/contract/contract-signing-token';
import {
  resolveContractUserId,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/app/api/lib/middleware/contract-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ─── 认证：必须登录 ────────────────────────────────────────────────────────
  const currentUserId = resolveContractUserId(request);
  if (!currentUserId) return unauthorizedResponse();

  try {
    const { id } = await params;
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
      include: { case: { select: { userId: true } } },
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

    // ─── 授权：校验当前用户是否为合同当事人 ───────────────────────────────────
    if (body.role === 'lawyer') {
      // 律师必须与合同记录中的 lawyerId 匹配
      if (contract.lawyerId !== currentUserId) {
        logger.warn('[Sign] 非合同律师尝试签署:', {
          contractId: id,
          currentUserId,
          contractLawyerId: contract.lawyerId,
        });
        return forbiddenResponse('您不是此合同的签约律师');
      }
    } else {
      const signingToken =
        typeof body.signingToken === 'string' ? body.signingToken : '';
      const verifiedSigning = signingToken
        ? verifyContractSigningToken(signingToken)
        : null;

      if (
        !verifiedSigning ||
        verifiedSigning.contractId !== id ||
        verifiedSigning.role !== 'client'
      ) {
        logger.warn('[Sign] 缺少或无效的委托方签署令牌:', {
          contractId: id,
          currentUserId,
        });
        return forbiddenResponse('委托方签署链接无效或已失效');
      }
    }

    // ─── 状态机检查：只有审批通过（PENDING）的合同才允许签署 ──────────────────
    // DRAFT = 草稿未审批；PENDING = 审批完成待签署；其余状态均不可签
    if (contract.status !== 'PENDING') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message:
              contract.status === 'DRAFT'
                ? '合同尚未完成审批流程，无法签署'
                : `合同当前状态（${contract.status}）不允许签署`,
          },
        },
        { status: 400 }
      );
    }

    // 获取客户端IP和设备信息
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const now = new Date();

    // ─── 原子签署：事务内重新读取 + 写入，防止并发重复签署（TOCTOU）──────────
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

    let willBeFullySigned = false;
    let alreadySignedMsg: string | null = null;

    try {
      await prisma.$transaction(
        async tx => {
          // 在事务内重新读取最新签署状态，确保检查与写入的原子性
          const fresh = await tx.contract.findUnique({
            where: { id },
            select: { clientSignature: true, lawyerSignature: true },
          });

          const updateData: SignUpdateData = {};

          if (body.role === 'client') {
            if (fresh?.clientSignature) {
              throw Object.assign(new Error('ALREADY_SIGNED'), {
                alreadySigned: true,
                msg: '委托人已签署，无法重复签署',
              });
            }
            updateData.clientSignature = body.signature;
            updateData.clientSignedAt = now;
            updateData.clientSignedIp = ip;
            updateData.signatureDevice = userAgent;
            willBeFullySigned = !!fresh?.lawyerSignature;
          } else {
            if (fresh?.lawyerSignature) {
              throw Object.assign(new Error('ALREADY_SIGNED'), {
                alreadySigned: true,
                msg: '律师已签署，无法重复签署',
              });
            }
            updateData.lawyerSignature = body.signature;
            updateData.lawyerSignedAt = now;
            updateData.lawyerSignedIp = ip;
            updateData.signatureDevice = userAgent;
            willBeFullySigned = !!fresh?.clientSignature;
          }

          if (willBeFullySigned) {
            updateData.status = 'SIGNED';
            updateData.signedAt = now;
          }

          await tx.contract.update({ where: { id }, data: updateData });
        },
        { isolationLevel: 'Serializable' }
      );
    } catch (txErr) {
      const e = txErr as { alreadySigned?: boolean; msg?: string };
      if (e.alreadySigned) {
        alreadySignedMsg = e.msg ?? '已签署，无法重复签署';
      } else {
        throw txErr;
      }
    }

    if (alreadySignedMsg) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'ALREADY_SIGNED', message: alreadySignedMsg },
        },
        { status: 400 }
      );
    }

    // 记录合同签署审计日志（异步，不阻塞响应）
    createAuditLog({
      userId: currentUserId,
      actionType: 'UNKNOWN',
      actionCategory: 'DOCUMENT',
      description: `合同签署：role=${body.role}, isFullySigned=${willBeFullySigned}`,
      resourceType: 'Contract',
      resourceId: id,
      metadata: { role: body.role, isFullySigned: willBeFullySigned },
    }).catch(auditErr => {
      logger.error('合同签署审计日志记录失败:', auditErr);
    });

    // 清除PDF缓存（因为需要包含签名）
    clearContractPDFCache(id).catch(error => {
      logger.error('清除PDF缓存失败:', error);
    });

    // 记录签署版本（任何一方签署都需要留下快照）
    void import('@/lib/contract/contract-version-service').then(
      ({ contractVersionService }) => {
        contractVersionService
          .createVersion(id, 'SIGN', currentUserId)
          .catch(error => {
            logger.error('创建合同签署版本失败:', error);
          });
      }
    );

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
          message: '提交签名失败',
        },
      },
      { status: 500 }
    );
  }
}
