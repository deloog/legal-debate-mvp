import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import { canAccessSharedCase } from '@/lib/case/share-permission-validator';
import { CasePermission } from '@/types/case-collaboration';
import { deleteStoredFile } from '@/lib/storage/storage-service';

async function loadDocument(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId },
    include: {
      case: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });
}

function formatAnalysisResult(
  document: Awaited<ReturnType<typeof loadDocument>>
): Record<string, unknown> | null {
  if (!document?.analysisResult || document.analysisStatus !== 'COMPLETED') {
    return null;
  }

  try {
    const result = document.analysisResult as {
      extractedData?: Record<string, unknown>;
    } | null;
    const extractedData = result?.extractedData;

    return {
      extractedData: {
        parties: Array.isArray(extractedData?.parties)
          ? extractedData.parties
          : [],
        claims: Array.isArray(extractedData?.claims)
          ? extractedData.claims
          : [],
        keyFacts: Array.isArray(extractedData?.keyFacts)
          ? extractedData.keyFacts
          : [],
        disputeFocuses: Array.isArray(extractedData?.disputeFocuses)
          ? extractedData.disputeFocuses
          : [],
        timeline: Array.isArray(extractedData?.timeline)
          ? extractedData.timeline
          : [],
        summary: extractedData?.summary || null,
      },
    } as Record<string, unknown>;
  } catch (error) {
    logger.error('处理analysisResult时出错:', error);
    return null;
  }
}

/**
 * 获取文档详情
 * GET /api/v1/documents/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id: documentId } = await params;
    const document = await loadDocument(documentId);

    if (!document || document.deletedAt) {
      return NextResponse.json(
        { success: false, error: '文档不存在' },
        { status: 404 }
      );
    }

    const access = await canAccessSharedCase(
      authUser.userId,
      document.caseId,
      CasePermission.VIEW_DOCUMENTS
    );
    if (!access.hasAccess) {
      return NextResponse.json(
        { success: false, error: access.reason || '无权访问此文档' },
        { status: 403 }
      );
    }

    logger.info(`查询文档详情 [${documentId}]`);
    logger.info(`查询文档结果:`, document.id, document.analysisStatus);

    return NextResponse.json({
      success: true,
      data: {
        id: document.id,
        filename: document.filename,
        filePath: document.filePath,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        fileType: document.fileType,
        analysisStatus: document.analysisStatus,
        analysisResult: formatAnalysisResult(document),
        analysisError: document.analysisError,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
        case: document.case,
      },
    });
  } catch (error) {
    logger.error('获取文档详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取文档详情失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 删除文档
 * DELETE /api/v1/documents/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id: documentId } = await params;
    const document = await loadDocument(documentId);

    if (!document || document.deletedAt) {
      return NextResponse.json(
        { success: false, error: '文档不存在' },
        { status: 404 }
      );
    }

    const access = await canAccessSharedCase(
      authUser.userId,
      document.caseId,
      CasePermission.DELETE_DOCUMENTS
    );
    if (!access.hasAccess) {
      return NextResponse.json(
        { success: false, error: access.reason || '无权删除此文档' },
        { status: 403 }
      );
    }

    await deleteStoredFile(document.filePath);

    await prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('删除文档失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '删除文档失败',
      },
      { status: 500 }
    );
  }
}
