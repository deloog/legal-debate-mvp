import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { uploadFile } from '@/lib/storage/storage-service';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/db/prisma';
import { DocAnalyzerAgentAdapter } from '@/lib/agent/doc-analyzer/adapter';
import { AgentContext, TaskPriority } from '@/types/agent';
import { Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkResourceOwnership,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { canAccessSharedCase } from '@/lib/case/share-permission-validator';
import { CasePermission } from '@/types/case-collaboration';
import { logger } from '@/lib/logger';
import { moderateRateLimiter } from '@/lib/middleware/rate-limit';
import { runAfterAnalysisHooks } from '@/lib/document/after-analysis-hooks';
import { inferMimeType } from '@/lib/chat/file-extractor';
import { inspectPdfText } from '@/lib/ocr/pdf';

/**
 * 文件上传API
 * POST /api/v1/documents/upload
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 速率限制（防止文件上传接口被滥用）
  const rateLimitResponse = await moderateRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // 获取认证用户
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    const file = formData.get('file') as File;
    const caseId = formData.get('caseId') as string;
    const fileId = formData.get('fileId') as string;

    // 验证参数
    if (!file || !caseId || !fileId) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证案件是否存在且用户有权限访问
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!existingCase) {
      return NextResponse.json(
        { success: false, error: '案件不存在' },
        { status: 404 }
      );
    }

    // 所有者/管理员直接通过；其余用户按案件协作权限检查
    const ownershipResult = await checkResourceOwnership(
      authUser.userId,
      caseId,
      ResourceType.CASE
    );
    const permissionResult = ownershipResult.hasPermission
      ? { hasAccess: true }
      : await canAccessSharedCase(
          authUser.userId,
          caseId,
          CasePermission.UPLOAD_DOCUMENTS
        );

    if (!permissionResult.hasAccess) {
      return NextResponse.json(
        { success: false, error: '无权上传文件到此案件' },
        { status: 403 }
      );
    }

    // 验证文件大小（10MB）- 先验证大小，再验证类型
    const maxFileSize = 10 * 1024 * 1024;
    if (file.size > maxFileSize) {
      return NextResponse.json(
        {
          success: false,
          error: `文件大小超过${maxFileSize / 1024 / 1024}MB限制`,
          code: 'PAYLOAD_TOO_LARGE',
        },
        { status: 413 } // Payload Too Large
      );
    }

    const normalizedMimeType = inferMimeType(file.type, file.name);

    // 验证文件类型
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
    ];

    if (!allowedTypes.includes(normalizedMimeType)) {
      return NextResponse.json(
        {
          success: false,
          error: `不支持的文件类型: ${normalizedMimeType || file.type || 'unknown'}`,
          code: 'UNSUPPORTED_FILE_TYPE',
        },
        { status: 400 }
      );
    }

    // 生成文件名（避免文件名冲突）
    const extension = file.name.split('.').pop() || '';
    const fileName = `${uuidv4()}.${extension}`;
    const ossKey = `documents/${caseId}/${fileName}`;

    // 读取文件内容
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Magic bytes 验证（防止伪造 Content-Type 绕过类型检查）
    const fileMagicMap: Record<string, number[]> = {
      'application/pdf': [0x25, 0x50, 0x44, 0x46],
      'application/msword': [0xd0, 0xcf, 0x11, 0xe0],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        [0x50, 0x4b, 0x03, 0x04],
      'image/jpeg': [0xff, 0xd8, 0xff],
      'image/png': [0x89, 0x50, 0x4e, 0x47],
    };
    const expectedMagic = fileMagicMap[normalizedMimeType];
    if (
      expectedMagic &&
      !expectedMagic.every((byte, i) => buffer[i] === byte)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: '文件内容与声明的类型不符',
          code: 'INVALID_FILE_CONTENT',
        },
        { status: 400 }
      );
    }

    // 上传文件（本地或OSS）
    await uploadFile(buffer, ossKey, {
      isPrivate: true,
      contentType: normalizedMimeType,
    });

    // 始终写入本地分析工作目录，保证手动/自动分析都能读取到源文件
    const uploadDir = join(
      process.cwd(),
      'private_uploads',
      'documents',
      caseId
    );
    await mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    // 保存到数据库
    const document = await prisma.document.create({
      data: {
        caseId,
        userId: authUser.userId,
        filename: file.name,
        filePath: ossKey,
        fileType: extension,
        fileSize: file.size,
        mimeType: normalizedMimeType,
        analysisStatus: 'PENDING',
      },
    });

    // E2E 测试专用：仅在测试模式下，对约定的测试文件名使用 Mock 数据
    // 注意：不能用 PDF 版本头（%PDF-1.4/%PDF-1.5）检测——所有合规 PDF 都包含此标记
    const isTestPDF =
      (process.env.NODE_ENV === 'test' || process.env.USE_MOCK_AI === 'true') &&
      file.name === 'test-document.pdf';

    if (isTestPDF) {
      // 虚拟测试PDF，直接使用Mock数据
      logger.info(`检测到虚拟测试PDF [${document.id}]，使用Mock数据`);
      const mockAnalysisResult = {
        extractedData: {
          parties: [
            {
              type: 'plaintiff',
              name: '测试原告',
              role: '原告',
              description: '原告为合同甲方，主张合同履行义务',
              contact: '13800138000',
              address: '北京市朝阳区',
            },
            {
              type: 'defendant',
              name: '测试被告',
              role: '被告',
              description: '被告为合同乙方，被指控未按时付款',
              contact: '010-12345678',
              address: '上海市浦东新区',
            },
          ],
          claims: [
            {
              type: 'PAY_PRINCIPAL',
              content: '判令被告支付货款100000元',
              description: '判令被告支付货款100000元',
              text: '判令被告支付货款100000元',
              amount: 100000,
              evidence: ['合同协议', '付款凭证'],
              legalBasis: '民法典第579条',
            },
            {
              type: 'PAY_INTEREST',
              content: '判令被告支付利息（按年利率6%计算）',
              description: '判令被告支付利息（按年利率6%计算）',
              text: '判令被告支付利息（按年利率6%计算）',
              amount: null,
              evidence: ['合同约定'],
              legalBasis: '民法典第676条',
            },
          ],
          timeline: [
            {
              date: '2024-01-15',
              event: '签订合同',
              description: '双方签订服务合同',
            },
            {
              date: '2024-06-20',
              event: '发生争议',
              description: '因合同履行问题产生纠纷',
            },
          ],
          summary: '本案为服务合同纠纷，原告请求被告支付货款及利息。',
          caseType: 'civil',
          keyFacts: [
            {
              date: '2024-01-15',
              description: '双方签订服务合同',
            },
            {
              date: '2024-06-20',
              description: '被告未按时支付货款',
            },
            {
              date: '2024-07-01',
              description: '原告多次催要无果',
            },
          ],
        },
        confidence: 0.95,
      };

      await prisma.document.update({
        where: { id: document.id },
        data: {
          analysisStatus: 'COMPLETED',
          analysisResult: mockAnalysisResult as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.document.update({
        where: { id: document.id },
        data: {
          analysisStatus: 'PROCESSING',
          analysisError: null,
        },
      });

      // 真实PDF文件，异步触发文档分析
      triggerDocumentAnalysis(document.id, caseId, ossKey, extension).catch(
        error => {
          logger.error(`文档分析异步触发失败 [${document.id}]:`, error);
          // 更新文档状态为失败
          prisma.document
            .update({
              where: { id: document.id },
              data: {
                analysisStatus: 'FAILED',
                analysisError: `分析触发失败: ${'未知错误'}`,
              },
            })
            .catch(err => logger.error('更新文档分析状态失败:', err));
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: document.id,
        filename: document.filename,
        filePath: document.filePath,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        analysisStatus: isTestPDF ? 'COMPLETED' : 'PROCESSING',
        createdAt: document.createdAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('文件上传失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '上传失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 异步触发文档分析，分析完成后若满足阈值则自动触发案件提炼
 * @param documentId 文档ID
 * @param caseId 所属案件ID
 * @param filePath 文件路径
 * @param fileType 文件类型
 */
async function triggerDocumentAnalysis(
  documentId: string,
  caseId: string,
  filePath: string,
  fileType: string
): Promise<void> {
  try {
    // 更新状态为分析中
    await prisma.document.update({
      where: { id: documentId },
      data: { analysisStatus: 'PROCESSING' },
    });

    // 构建完整文件路径（文件保存在 private_uploads/，不在 public/ 下）
    const fullFilePath = join(
      process.cwd(),
      'private_uploads',
      filePath.startsWith('/') ? filePath.substring(1) : filePath
    );

    if (fileType.toUpperCase() === 'PDF') {
      const buffer = await (await import('fs/promises')).readFile(fullFilePath);
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
        return;
      }
    }

    // 创建DocAnalyzer Agent实例（测试环境使用Mock）
    const useMock =
      process.env.NODE_ENV === 'test' || process.env.USE_MOCK_AI === 'true';
    const agent = new DocAnalyzerAgentAdapter(useMock);
    await agent.initialize();

    // 构建Agent执行上下文
    const context: AgentContext = {
      task: 'document_analysis',
      taskType: 'document_parse',
      priority: TaskPriority.MEDIUM,
      data: {
        documentId,
        filePath: fullFilePath,
        fileType: fileType.toUpperCase() as
          | 'PDF'
          | 'DOCX'
          | 'DOC'
          | 'TXT'
          | 'IMAGE',
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
          analysisStatus: 'COMPLETED',
          analysisResult: result.data as unknown as Prisma.InputJsonValue,
          analysisError: null,
          updatedAt: new Date(),
        },
      });
      logger.info(`文档分析完成 [${documentId}]:`, result.data);

      // 文档分析完成后，触发后置钩子（案件提炼 + 证据草稿落库），fire-and-forget
      runAfterAnalysisHooks(caseId).catch(err => {
        logger.warn(
          `[upload] 后置钩子 fire-and-forget 失败 [caseId=${caseId}]:`,
          err
        );
      });
    } else {
      const rawMsg = result.error?.message || '';
      logger.error(`文档分析失败 [${documentId}]:`, result.error);
      await prisma.document.update({
        where: { id: documentId },
        data: {
          analysisStatus: 'FAILED',
          analysisError: toUserFriendlyError(rawMsg),
        },
      });
    }
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    logger.error(`文档分析异常 [${documentId}]:`, error);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        analysisStatus: 'FAILED',
        analysisError: toUserFriendlyError(rawMsg),
      },
    });
  }
}

function toUserFriendlyError(raw: string): string {
  if (/SCANNED_PDF_DETECTED/i.test(raw)) {
    return '该 PDF 更像扫描件，当前主流程优先支持文本型 PDF、Word、TXT。扫描件 OCR 能力后续补充。';
  }
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
