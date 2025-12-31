import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { unlink } from "fs/promises";
import { join } from "path";

/**
 * 获取文档详情
 * GET /api/v1/documents/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const document = await prisma.document.findUnique({
      where: { id: params.id },
      include: {
        case: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "文档不存在" },
        { status: 404 },
      );
    }

    // 格式化分析结果以符合E2E测试期望
    let analysisResult: Record<string, unknown> | null = null;
    if (document.analysisResult && document.analysisStatus === "COMPLETED") {
      const result = document.analysisResult as {
        extractedData?: Record<string, unknown>;
      } | null;
      analysisResult = {
        parties: result?.extractedData?.parties || [],
        claims: result?.extractedData?.claims || [],
        facts: result?.extractedData?.keyFacts || [],
        disputeFocuses: result?.extractedData?.disputeFocuses || [],
        timeline: result?.extractedData?.timeline || [],
        summary: result?.extractedData?.summary || null,
      };
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
    console.error("获取文档详情失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取文档详情失败",
      },
      { status: 500 },
    );
  }
}

/**
 * 删除文档
 * DELETE /api/v1/documents/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const document = await prisma.document.findUnique({
      where: { id: params.id },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "文档不存在" },
        { status: 404 },
      );
    }

    // 删除物理文件
    const filePath = join(process.cwd(), "public", document.filePath);
    try {
      await unlink(filePath);
    } catch (error) {
      console.warn("删除物理文件失败:", error);
    }

    // 删除数据库记录
    await prisma.document.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: "文档删除成功",
    });
  } catch (error) {
    console.error("删除文档失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "删除文档失败",
      },
      { status: 500 },
    );
  }
}
