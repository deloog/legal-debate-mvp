/** @legacy 优先使用 /api/payments/query，此路由保留以向后兼容 */
/**
 * 支付宝订单查询API（兼容旧入口）
 * POST /api/payments/alipay/query
 *
 * 说明：
 * - 旧入口使用 POST + body(orderId/orderNo)
 * - 统一入口使用 GET /api/payments/query?orderId=...&orderNo=...&syncFromPayment=true
 * - 此处做参数转换并转发到统一实现，避免支付查询语义分叉
 */

import { NextRequest } from 'next/server';
import { GET as queryPayment } from '@/app/api/payments/query/route';

export async function POST(request: NextRequest) {
  let orderId: string | undefined;
  let orderNo: string | undefined;

  try {
    const body = (await request.json()) as {
      orderId?: string;
      orderNo?: string;
    };
    orderId = body.orderId;
    orderNo = body.orderNo;
  } catch {
    // 让统一入口负责参数校验并返回标准错误
  }

  const url = new URL(request.url);
  const forwarded = new URL('/api/payments/query', url.origin);

  if (orderId) {
    forwarded.searchParams.set('orderId', orderId);
  }
  if (orderNo) {
    forwarded.searchParams.set('orderNo', orderNo);
  }
  forwarded.searchParams.set('syncFromPayment', 'true');

  const forwardedRequest = new NextRequest(forwarded, {
    method: 'GET',
    headers: request.headers,
  });

  return queryPayment(forwardedRequest);
}
