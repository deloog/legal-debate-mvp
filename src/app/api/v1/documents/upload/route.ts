import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// 支持的文档类型
const SUPPORTED_TYPES = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/msword': 'DOC',
  'text/plain': 'TXT',
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'image/jpg': 'IMAGE'
};

// 最大文件大小 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 文档上传目录
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'documents');

// =============================================================================
// API处理函数
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // 检查Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { 
          success: false,
          error: '不支持的Content-Type，请使用multipart/form-data'
        },
        { status: 400 }
      );
    }

    // 解析表单数据
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { 
          success: false,
          error: '未找到文件，请确保包含file字段'
        },
        { status: 400 }
      );
    }

    // 验证文件类型
    const fileType = SUPPORTED_TYPES[file.type];
    if (!fileType) {
      return NextResponse.json(
        { 
          success: false,
          error: `不支持的文件类型: ${file.type}，支持的类型: ${Object.keys(SUPPORTED_TYPES).join(', ')}`
        },
        { status: 400 }
      );
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          success: false,
          error: `文件大小超过限制: ${file.size} bytes，最大允许: ${MAX_FILE_SIZE} bytes`
        },
        { status: 400 }
      );
    }

    // 确保上传目录存在
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}_${randomString}.${fileExtension}`;
    const filePath = join(UPLOAD_DIR, fileName);

    // 保存文件
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);

    // 生成文档ID
    const documentId = `doc_${timestamp}_${randomString}`;

    // 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        documentId,
        fileName: file.name,
        storedFileName: fileName,
        filePath: `/uploads/documents/${fileName}`,
        fileType,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded'
      }
    });

  } catch (error) {
    console.error('文档上传失败:', error);
    return NextResponse.json(
      { 
        success: false,
        error: `文档上传失败: ${error instanceof Error ? error.message : '未知错误'}`
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// OPTIONS方法 - 处理CORS预检请求
// =============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
