import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { DocAnalyzerAgentAdapter } from '@/lib/agent/doc-analyzer/adapter';
import { AgentContext, TaskPriority } from '@/types/agent';
import { join } from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { retryDocAnalysis } from '@/lib/ai/retry-handler';
import { getAuthUser } from '@/lib/middleware/auth';
import { checkAIQuota, recordAIUsage } from '@/lib/ai/quota';
import { prisma } from '@/lib/db';
import { logAIAction } from '@/lib/audit/logger';
import { logger } from '@/lib/logger';
import { moderateRateLimiter } from '@/lib/middleware/rate-limit';
import { canAccessSharedCase } from '@/lib/case/share-permission-validator';
import { CasePermission } from '@/types/case-collaboration';
import { runAfterAnalysisHooks } from '@/lib/document/after-analysis-hooks';
import { inspectPdfText } from '@/lib/ocr/pdf';

function toUserFriendlyError(raw: string): string {
  if (
    /文档内容为空|无法从文档中提取有效文本内容|OCR质量不合格|PDF文件解析失败/i.test(
      raw
    )
  ) {
    return '未能从 PDF 中提取可分析文本。若该 PDF 为扫描件，请先转为可复制文本，或补充 OCR 能力后再试。';
  }
  if (/fetch failed|ECONNREFUSED|ETIMEDOUT|timeout|network|socket/i.test(raw)) {
    return 'AI 服务暂时不可用，请稍候重试';
  }
  if (/rate.?limit|quota|429|too many/i.test(raw)) {
    return 'AI 服务请求过于频繁，请稍候重试';
  }
  if (/unauthorized|401|api.?key|invalid.*key/i.test(raw)) {
    return 'AI 服务配置异常，请联系管理员';
  }
  return 'AI 分析失败，请稍候重试';
}

async function resolveDocumentContext(
  authUserId: string,
  documentId: string
): Promise<
  | {
      ok: true;
      document: {
        id: string;
        caseId: string;
        filePath: string;
        fileType: string;
      };
    }
  | { ok: false; response: NextResponse }
> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      caseId: true,
      filePath: true,
      fileType: true,
      deletedAt: true,
    },
  });

  if (!document || document.deletedAt) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '文档不存在' },
        { status: 404 }
      ),
    };
  }

  const access = await canAccessSharedCase(
    authUserId,
    document.caseId,
    CasePermission.VIEW_DOCUMENTS
  );
  if (!access.hasAccess) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: access.reason || '无权限分析该文档' },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    document: {
      id: document.id,
      caseId: document.caseId,
      filePath: document.filePath,
      fileType: document.fileType,
    },
  };
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await moderateRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    const userRole = dbUser?.role ?? 'FREE';

    const quotaCheck = await checkAIQuota(authUser.userId, userRole);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        { success: false, error: quotaCheck.reason },
        { status: 429 }
      );
    }

    const body = await request.json();
    const documentId = body?.documentId as string | undefined;
    const options = body?.options as Record<string, unknown> | undefined;

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数: documentId' },
        { status: 400 }
      );
    }

    const contextResult = await resolveDocumentContext(
      authUser.userId,
      documentId
    );
    if (!contextResult.ok) {
      return contextResult.response;
    }

    const { document } = contextResult;
    const fileType = document.fileType.toUpperCase();
    const supportedTypes = ['PDF', 'DOCX', 'DOC', 'TXT', 'IMAGE'];
    if (!supportedTypes.includes(fileType)) {
      return NextResponse.json(
        {
          success: false,
          error: `不支持的文件类型: ${fileType}，支持的类型: ${supportedTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const fullFilePath = join(
      process.cwd(),
      'private_uploads',
      document.filePath
    );
    if (!existsSync(fullFilePath)) {
      return NextResponse.json(
        {
          success: false,
          error: `文件不存在: ${fullFilePath}`,
        },
        { status: 404 }
      );
    }

    if (fileType === 'PDF') {
      const buffer = await readFile(fullFilePath);
      const inspection = await inspectPdfText(buffer);
      if (inspection.scannedLike) {
        await prisma.document.update({
          where: { id: documentId },
          data: {
            analysisStatus: 'FAILED',
            analysisError:
              '该 PDF 更像扫描件，当前主流程优先支持文本型 PDF、Word、TXT。扫描件 OCR 能力后续补充。',
            updatedAt: new Date(),
          },
        });

        return NextResponse.json(
          {
            success: false,
            error:
              '该 PDF 更像扫描件，当前主流程优先支持文本型 PDF、Word、TXT。扫描件 OCR 能力后续补充。',
          },
          { status: 400 }
        );
      }
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { analysisStatus: 'PROCESSING', analysisError: null },
    });

    const useMock =
      process.env.NODE_ENV === 'test' || process.env.USE_MOCK_AI === 'true';
    const agent = new DocAnalyzerAgentAdapter(useMock);
    await agent.initialize();

    const context: AgentContext = {
      task: 'document_analysis',
      taskType: 'document_parse',
      priority: TaskPriority.MEDIUM,
      data: {
        documentId,
        filePath: fullFilePath,
        fileType: fileType as 'PDF' | 'DOCX' | 'DOC' | 'TXT' | 'IMAGE',
        options: {
          extractParties: options?.extractParties !== false,
          extractClaims: options?.extractClaims !== false,
          extractTimeline: options?.extractTimeline !== false,
          generateSummary: options?.generateSummary === true,
        },
      },
      metadata: {
        documentId,
        fileType,
        timestamp: new Date().toISOString(),
      },
      options: {
        timeout: 60000,
        retryAttempts: 2,
      },
    };

    const startTime = Date.now();
    const retryResult = await retryDocAnalysis(async () => {
      return await agent.execute(context);
    });
    const processingTime = Date.now() - startTime;
    await agent.cleanup();

    if (retryResult.success) {
      const result = retryResult.result;
      const analysisResult = (result.data ??
        null) as unknown as Prisma.InputJsonValue;
      await prisma.document.update({
        where: { id: documentId },
        data: {
          analysisStatus: 'COMPLETED',
          analysisResult,
          analysisError: null,
          updatedAt: new Date(),
        },
      });

      await recordAIUsage({
        userId: authUser.userId,
        type: 'document_analysis',
        provider: 'system',
        tokensUsed: result.tokensUsed || 0,
        duration: processingTime,
        success: true,
      });

      await logAIAction({
        userId: authUser.userId,
        actionType: 'ANALYZE_DOCUMENT',
        resourceId: documentId,
        description: `分析文档: ${documentId}`,
        request,
        responseStatus: 200,
        executionTime: processingTime,
      });

      runAfterAnalysisHooks(document.caseId).catch(err => {
        logger.warn(
          `[documents/analyze] 后置钩子 fire-and-forget 失败 [caseId=${document.caseId}]:`,
          err
        );
      });

      return NextResponse.json({
        success: true,
        data: {
          documentId,
          analysisResult: result.data,
          processingTime,
          executedAt: new Date().toISOString(),
          metadata: {
            executionTime: result.executionTime,
            tokensUsed: result.tokensUsed,
            confidence: result.data?.confidence ?? 0,
          },
        },
      });
    }

    const errorMessage = retryResult.error?.message || '文档分析失败';
    await prisma.document.update({
      where: { id: documentId },
      data: {
        analysisStatus: 'FAILED',
        analysisError: toUserFriendlyError(errorMessage),
        updatedAt: new Date(),
      },
    });

    await recordAIUsage({
      userId: authUser.userId,
      type: 'document_analysis',
      provider: 'system',
      tokensUsed: 0,
      duration: processingTime,
      success: false,
      error: errorMessage,
    });

    return NextResponse.json(
      {
        success: false,
        error: toUserFriendlyError(errorMessage),
        details: {
          documentId,
          processingTime,
          isFallback: retryResult.isFallback,
          attempts: retryResult.attempts,
        },
      },
      { status: 500 }
    );
  } catch (error) {
    logger.error('文档分析API错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误',
        details: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');

  if (!documentId) {
    return NextResponse.json(
      {
        success: false,
        error: '缺少documentId参数',
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      documentId,
      status: 'ready',
      message: '文档分析服务已就绪，请使用POST方法提交分析请求',
      supportedFormats: ['PDF', 'DOCX', 'DOC', 'TXT'],
      ocrSupported: false,
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
