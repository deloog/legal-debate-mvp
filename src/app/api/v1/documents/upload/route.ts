import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/db/prisma";
import { DocAnalyzerAgentAdapter } from "@/lib/agent/doc-analyzer/adapter";
import { AgentContext, TaskPriority } from "@/types/agent";
import { Prisma } from "@prisma/client";

/**
 * 文件上传API
 * POST /api/v1/documents/upload
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    const file = formData.get("file") as File;
    const caseId = formData.get("caseId") as string;
    const fileId = formData.get("fileId") as string;

    // 验证参数
    if (!file || !caseId || !fileId) {
      return NextResponse.json(
        { success: false, error: "缺少必要参数" },
        { status: 400 },
      );
    }

    // 验证案件是否存在
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!existingCase) {
      return NextResponse.json(
        { success: false, error: "案件不存在" },
        { status: 404 },
      );
    }

    // 验证文件大小（10MB）
    const maxFileSize = 10 * 1024 * 1024;
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { success: false, error: `文件大小超过${maxFileSize / 1024 / 1024}MB` },
        { status: 400 },
      );
    }

    // 验证文件类型
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "image/jpeg",
      "image/png",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `不支持的文件类型: ${file.type}` },
        { status: 400 },
      );
    }

    // 生成存储路径
    const uploadDir = join(process.cwd(), "public", "uploads", caseId);
    await mkdir(uploadDir, { recursive: true });

    // 生成文件名（避免文件名冲突）
    const extension = file.name.split(".").pop() || "";
    const fileName = `${uuidv4()}.${extension}`;
    const filePath = join(uploadDir, fileName);

    // 读取文件内容
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 写入文件
    await writeFile(filePath, buffer);

    // 保存到数据库
    const document = await prisma.document.create({
      data: {
        caseId,
        userId: existingCase.userId,
        filename: file.name,
        filePath: `/uploads/${caseId}/${fileName}`,
        fileType: extension,
        fileSize: file.size,
        mimeType: file.type,
        analysisStatus: "PENDING",
      },
    });

    // 异步触发文档分析
    triggerDocumentAnalysis(document.id, filePath, extension).catch((error) => {
      console.error(`文档分析异步触发失败 [${document.id}]:`, error);
      // 更新文档状态为失败
      prisma.document
        .update({
          where: { id: document.id },
          data: {
            analysisStatus: "FAILED",
            analysisError: `分析触发失败: ${error instanceof Error ? error.message : "未知错误"}`,
          },
        })
        .catch((err) => console.error("更新文档分析状态失败:", err));
    });

    return NextResponse.json({
      success: true,
      data: {
        id: document.id,
        filename: document.filename,
        filePath: document.filePath,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        analysisStatus: document.analysisStatus,
        createdAt: document.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("文件上传失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "上传失败",
      },
      { status: 500 },
    );
  }
}

/**
 * 异步触发文档分析
 * @param documentId 文档ID
 * @param filePath 文件路径
 * @param fileType 文件类型
 */
async function triggerDocumentAnalysis(
  documentId: string,
  filePath: string,
  fileType: string,
): Promise<void> {
  try {
    // 更新状态为分析中
    await prisma.document.update({
      where: { id: documentId },
      data: { analysisStatus: "PROCESSING" },
    });

    // 构建完整文件路径
    const fullFilePath = join(
      process.cwd(),
      "public",
      filePath.startsWith("/") ? filePath.substring(1) : filePath,
    );

    // 创建DocAnalyzer Agent实例
    const agent = new DocAnalyzerAgentAdapter();
    await agent.initialize();

    // 构建Agent执行上下文
    const context: AgentContext = {
      task: "document_analysis",
      taskType: "document_parse",
      priority: TaskPriority.MEDIUM,
      data: {
        documentId,
        filePath: fullFilePath,
        fileType: fileType.toUpperCase() as
          | "PDF"
          | "DOCX"
          | "DOC"
          | "TXT"
          | "IMAGE",
        options: {
          extractParties: true,
          extractClaims: true,
          extractTimeline: true,
          generateSummary: false,
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

    // 执行文档分析
    const result = await agent.execute(context);

    // 清理Agent资源
    await agent.cleanup();

    // 更新文档分析结果
    if (result.success) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          analysisStatus: "COMPLETED",
          analysisResult: result.data as unknown as Prisma.JsonValue,
          analysisError: null,
          updatedAt: new Date(),
        },
      });
      console.log(`文档分析完成 [${documentId}]:`, result.data);
    } else {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          analysisStatus: "FAILED",
          analysisError: result.error?.message || "文档分析失败",
        },
      });
      console.error(`文档分析失败 [${documentId}]:`, result.error);
    }
  } catch (error) {
    console.error(`文档分析异常 [${documentId}]:`, error);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        analysisStatus: "FAILED",
        analysisError: `分析异常: ${error instanceof Error ? error.message : "未知错误"}`,
      },
    });
  }
}
