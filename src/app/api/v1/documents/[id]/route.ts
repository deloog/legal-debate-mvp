import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkResourceOwnership,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { logger } from '@/lib/logger';

/**
 * 获取文档详情
 * GET /api/v1/documents/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // 获取认证用户
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    // Next.js 15+ 需要await params
    const resolvedParams = await params;
    const documentId = resolvedParams.id;

    // 检查资源所有权
    const permissionResult = await checkResourceOwnership(
      authUser.userId,
      documentId,
      ResourceType.DOCUMENT
    );

    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        { success: false, error: permissionResult.reason || '无权访问此文档' },
        { status: 403 }
      );
    }

    logger.info(`查询文档详情 [${documentId}]`);
    const document = await prisma.document.findUnique({
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

    logger.info(`查询文档结果:`, document?.id, document?.analysisStatus);

    if (!document) {
      return NextResponse.json(
        { success: false, error: '文档不存在' },
        { status: 404 }
      );
    }

    // 格式化分析结果以符合E2E测试期望
    let analysisResult: Record<string, unknown> | null = null;
    if (document.analysisResult && document.analysisStatus === 'COMPLETED') {
      try {
        logger.info(
          '处理文档分析结果:',
          JSON.stringify(document.analysisResult, null, 2)
        );

        const result = document.analysisResult as {
          extractedData?: Record<string, unknown>;
        } | null;

        // 安全访问嵌套属性，避免运行时错误
        const extractedData = result?.extractedData;

        analysisResult = {
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

        logger.info(
          '格式化后的analysisResult:',
          JSON.stringify(analysisResult, null, 2)
        );
      } catch (error) {
        logger.error('处理analysisResult时出错:', error);
        logger.error(
          '错误详情:',
          error instanceof Error ? error.message : String(error)
        );
        // 发生错误时设置为null，而不是让整个请求失败
        analysisResult = null;
      }
    }

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
        analysisResult,
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
    // 获取认证用户
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    // Next.js 15+ 需要await params
    const resolvedParams = await params;
    const documentId = resolvedParams.id;

    // 检查资源所有权
    const permissionResult = await checkResourceOwnership(
      authUser.userId,
      documentId,
      ResourceType.DOCUMENT
    );

    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        { success: false, error: permissionResult.reason || '无权删除此文档' },
        { status: 403 }
      );
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: '文档不存在' },
        { status: 404 }
      );
    }

    // 删除物理文件
    const filePath = join(process.cwd(), 'public', document.filePath);
    try {
      await unlink(filePath);
    } catch (error) {
      logger.warn('删除物理文件失败:', error);
    }

    // 软删除（设置deletedAt字段）
    await prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json(
      { success: true, message: '文档删除成功' },
      { status: 204 }
    );
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
