/**
 * 兼容旧入口：统一复用 PUT /api/orders/[id] 的取消逻辑
 */

import { NextRequest, NextResponse } from 'next/server';
import { PUT as updateOrder } from '../route';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));

  const delegatedRequest = new NextRequest(request.url, {
    method: 'PUT',
    headers: request.headers,
    body: JSON.stringify({
      action: 'cancel',
      reason: (body as { reason?: string }).reason,
    }),
  });

  return updateOrder(delegatedRequest, { params });
}
