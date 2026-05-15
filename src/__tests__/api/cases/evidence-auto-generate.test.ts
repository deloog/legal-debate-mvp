/**
 * POST /api/v1/cases/[id]/evidence/auto-generate — 最小 route 测试
 *
 * 覆盖：401 / 403 / 404 / 503 / 200 成功路径
 */

import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGetAuthUser = jest.fn();
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: (...a: unknown[]) => mockGetAuthUser(...a),
}));

const mockCheckResourceOwnership = jest.fn();
const mockCreatePermissionErrorResponse = jest.fn();
jest.mock('@/lib/middleware/resource-permission', () => ({
  checkResourceOwnership: (...a: unknown[]) => mockCheckResourceOwnership(...a),
  createPermissionErrorResponse: (...a: unknown[]) =>
    mockCreatePermissionErrorResponse(...a),
  ResourceType: { CASE: 'CASE' },
}));

const mockCheckPermission = jest.fn();
jest.mock('@/lib/case/case-permission-manager', () => ({
  checkPermission: (...a: unknown[]) => mockCheckPermission(...a),
}));

jest.mock('@/types/case-collaboration', () => ({
  CasePermission: { EDIT_CASE: 'EDIT_CASE' },
}));

const mockCaseFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: { findUnique: (...a: unknown[]) => mockCaseFindUnique(...a) },
  },
}));

const mockUpsertAutoEvidenceDrafts = jest.fn();
jest.mock('@/lib/evidence/auto-evidence-draft-service', () => ({
  upsertAutoEvidenceDrafts: (...a: unknown[]) =>
    mockUpsertAutoEvidenceDrafts(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── 导入被测路由 ────────────────────────────────────────────────────────────────

import { POST } from '@/app/api/v1/cases/[id]/evidence/auto-generate/route';

// ── 辅助 ────────────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new NextRequest(
    'http://localhost/api/v1/cases/case-1/evidence/auto-generate',
    {
      method: 'POST',
    }
  );
}

function makeParams(id = 'case-1') {
  return { params: Promise.resolve({ id }) };
}

const AUTH_USER = { userId: 'user-1', email: 'test@example.com', name: 'Test' };

beforeEach(() => {
  jest.resetAllMocks();
  mockCreatePermissionErrorResponse.mockReturnValue(
    new Response(JSON.stringify({ success: false, error: '无权限' }), {
      status: 403,
    })
  );
});

// ══════════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/cases/[id]/evidence/auto-generate', () => {
  it('401 — 未登录时拒绝', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('403 — 无 EDIT_CASE 权限时拒绝', async () => {
    mockGetAuthUser.mockResolvedValue(AUTH_USER);
    mockCheckResourceOwnership.mockResolvedValue({ hasPermission: false });
    mockCheckPermission.mockResolvedValue({ hasPermission: false });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it('404 — 案件不存在时返回 404', async () => {
    mockGetAuthUser.mockResolvedValue(AUTH_USER);
    mockCheckResourceOwnership.mockResolvedValue({ hasPermission: true });
    mockCaseFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/案件不存在/);
  });

  it('503 — AI 服务失败时返回 503', async () => {
    mockGetAuthUser.mockResolvedValue(AUTH_USER);
    mockCheckResourceOwnership.mockResolvedValue({ hasPermission: true });
    mockCaseFindUnique.mockResolvedValue({ id: 'case-1' });
    mockUpsertAutoEvidenceDrafts.mockRejectedValue(new Error('AI timeout'));

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('AI_UNAVAILABLE');
  });

  it('200 — 成功时返回 drafts + created + updated + skippedManual', async () => {
    mockGetAuthUser.mockResolvedValue(AUTH_USER);
    mockCheckResourceOwnership.mockResolvedValue({ hasPermission: true });
    mockCaseFindUnique.mockResolvedValue({ id: 'case-1' });
    mockUpsertAutoEvidenceDrafts.mockResolvedValue({
      drafts: [{ normalizedName: '借条与借款协议', type: 'DOCUMENT' }],
      created: 1,
      updated: 0,
      skippedManual: 0,
    });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.created).toBe(1);
    expect(body.data.skippedManual).toBe(0);
    expect(body.data.drafts).toHaveLength(1);
  });
});
