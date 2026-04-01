/**
 * GET/POST /api/cases
 *
 * @deprecated 此路由已废弃，请使用 /api/v1/cases
 * 将在 2026-12-31 后移除
 *
 * 代理到 /api/v1/cases，保持 API 版本统一。
 * 完整实现见 src/app/api/v1/cases/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  GET as v1GET,
  POST as v1POST,
  OPTIONS as v1OPTIONS,
} from '@/app/api/v1/cases/route';
import { addDeprecationHeaders } from '@/lib/middleware/api-version';

const V1_ALTERNATIVE = '/api/v1/cases';
const SUNSET_DATE = '2026-12-31';

export async function GET(request: NextRequest) {
  const response = await v1GET(request);
  return addDeprecationHeaders(
    response as NextResponse,
    SUNSET_DATE,
    V1_ALTERNATIVE,
    `This endpoint is deprecated. Please use ${V1_ALTERNATIVE} instead.`
  );
}

export async function POST(request: NextRequest) {
  const response = await v1POST(request);
  return addDeprecationHeaders(
    response as NextResponse,
    SUNSET_DATE,
    V1_ALTERNATIVE,
    `This endpoint is deprecated. Please use ${V1_ALTERNATIVE} instead.`
  );
}

export async function OPTIONS(request: NextRequest) {
  const response = await v1OPTIONS(request);
  return addDeprecationHeaders(
    response as NextResponse,
    SUNSET_DATE,
    V1_ALTERNATIVE,
    `This endpoint is deprecated. Please use ${V1_ALTERNATIVE} instead.`
  );
}
