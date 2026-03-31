/**
 * 此端点已废弃，论点生成由 /api/v1/debates/[id]/stream 统一处理
 * 废弃原因：SSE 路由已整合完整的生成流程（法条检索、图谱增强、论点生成、状态管理）
 *           统一入口消除了双路径并发生成的竞态风险
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  _request: NextRequest,
  _context: { params: Promise<{ id: string; roundId: string }> }
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'GONE',
        message:
          '此端点已废弃，论点生成由 /api/v1/debates/[id]/stream 统一处理',
      },
    },
    { status: 410 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
