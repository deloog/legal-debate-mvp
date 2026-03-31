/**
 * 此端点已废弃，统一使用 /api/v1/debates/[id]/stream
 * 原因：权限检查存在漏洞（检查 case.userId 而非 debate.userId），功能与新路由重复
 */
import { NextRequest } from 'next/server';

export async function GET(_request: NextRequest) {
  return new Response(
    JSON.stringify({
      error: '此端点已废弃，请使用 /api/v1/debates/[id]/stream',
      code: 'GONE',
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  );
}
