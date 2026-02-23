/**
 * API路由模板
 * 位置: src/app/api/v1/{module}/{action}/route.ts
 *
 * 使用说明:
 * 1. 复制此模板到目标位置
 * 2. 修改路径参数和业务逻辑
 * 3. 确保遵循错误处理规范
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// ============ 类型定义 ============

interface RequestParams {
  id: string;
}

// 响应类型
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============ 请求验证 Schema ============

const requestSchema = z.object({
  // 添加请求参数验证规则
  // name: z.string().min(1),
  // email: z.string().email(),
});

// ============ 业务逻辑 ============

/**
 * 处理API请求的核心逻辑
 * 提取为独立函数，便于测试
 */
async function processRequest(params: RequestParams, body: unknown): Promise<ApiResponse> {
  // 验证请求体
  const validatedBody = requestSchema.parse(body);

  // TODO: 实现业务逻辑

  return {
    success: true,
    data: {
      // 返回数据
      id: params.id,
    },
  };
}

// ============ GET 处理 ============

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RequestParams> }
): Promise<NextResponse<ApiResponse>> {
  try {
    const resolvedParams = await params;

    logger.info('API: GET request received', {
      path: resolvedParams.id,
    });

    const result = await processRequest(resolvedParams, {});

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('API: GET request failed', { error });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 }
    );
  }
}

// ============ POST 处理 ============

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RequestParams> }
): Promise<NextResponse<ApiResponse>> {
  try {
    const resolvedParams = await params;
    const body = await request.json();

    logger.info('API: POST request received', {
      path: resolvedParams.id,
    });

    const result = await processRequest(resolvedParams, body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logger.error('API: POST request failed', { error });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============ 其他HTTP方法 ============

// PUT: 更新资源
// export async function PUT(
//   request: NextRequest,
//   { params }: { params: Promise<RequestParams> }
// ): Promise<NextResponse<ApiResponse>> { ... }

// DELETE: 删除资源
// export async function DELETE(
//   request: NextRequest,
//   { params }: { params: Promise<RequestParams> }
// ): Promise<NextResponse<ApiResponse>> { ... }
