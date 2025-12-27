import { NextRequest, NextResponse } from 'next/server';
import { DocAnalyzerAgentAdapter } from '../../../../../lib/agent/doc-analyzer/adapter';
import { AgentContext, TaskPriority } from '../../../../../types/agent';
import { join } from 'path';
import { existsSync } from 'fs';

// =============================================================================
// API处理函数
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    
    const { documentId, filePath, fileType, options } = body;

    // 验证必需参数
    if (!documentId || !filePath || !fileType) {
      return NextResponse.json(
        { 
          success: false,
          error: '缺少必需参数: documentId, filePath, fileType'
        },
        { status: 400 }
      );
    }

    // 验证文件类型
    const supportedTypes = ['PDF', 'DOCX', 'DOC', 'TXT', 'IMAGE'];
    if (!supportedTypes.includes(fileType)) {
      return NextResponse.json(
        { 
          success: false,
          error: `不支持的文件类型: ${fileType}，支持的类型: ${supportedTypes.join(', ')}`
        },
        { status: 400 }
      );
    }

    // 构建完整文件路径
    const fullFilePath = join(process.cwd(), filePath.startsWith('/') ? filePath.substring(1) : filePath);
    
    // 检查文件是否存在
    if (!existsSync(fullFilePath)) {
      return NextResponse.json(
        { 
          success: false,
          error: `文件不存在: ${fullFilePath}`
        },
        { status: 404 }
      );
    }

    // 创建DocAnalyzer Agent实例
    const agent = new DocAnalyzerAgentAdapter();
    await agent.initialize();

    // 构建Agent执行上下文
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
          generateSummary: options?.generateSummary === true
        }
      },
      metadata: {
        documentId,
        fileType,
        timestamp: new Date().toISOString()
      },
      options: {
        timeout: 60000, // 60秒超时
        retryAttempts: 2
      }
    };

    // 执行文档分析
    const startTime = Date.now();
    const result = await agent.execute(context);
    const processingTime = Date.now() - startTime;

    // 清理Agent资源
    await agent.cleanup();

    // 返回分析结果
    if (result.success) {
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
            confidence: result.data?.confidence || 0
          }
        }
      });
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: result.error?.message || '文档分析失败',
          details: {
            documentId,
            processingTime,
            error: result.error
          }
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('文档分析API错误:', error);
    return NextResponse.json(
      { 
        success: false,
        error: `服务器内部错误: ${error instanceof Error ? error.message : '未知错误'}`,
        details: {
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET方法 - 获取分析状态（可选功能）
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');

  if (!documentId) {
    return NextResponse.json(
      { 
        success: false,
        error: '缺少documentId参数'
      },
      { status: 400 }
    );
  }

  // 这里可以实现查询分析状态的逻辑
  // 目前返回基本信息
  return NextResponse.json({
    success: true,
    data: {
      documentId,
      status: 'ready',
      message: '文档分析服务已就绪，请使用POST方法提交分析请求',
      supportedFormats: ['PDF', 'DOCX', 'DOC', 'TXT'],
      ocrSupported: false // 暂时不支持图片OCR
    }
  });
}

// =============================================================================
// OPTIONS方法 - 处理CORS预检请求
// =============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
