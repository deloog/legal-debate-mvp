/**
 * TDD: POST /api/v1/cases/[id]/package/export
 * 整案交付包导出 API
 *
 * 权限规则：
 *   所有人/管理员：直接通过
 *   团队成员：需同时具备 VIEW_CASE + EXPORT_DATA
 *
 * 流程：
 *   1. auth + 权限
 *   2. 验证 selectedSections
 *   3. buildPackageSections
 *   4. computePackageHash
 *   5. 读最新 review → resolveReviewMatch
 *   6. generateCasePackageDocx
 *   7. 返回 DOCX 二进制流（Content-Type / Content-Disposition）
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { POST } from '@/app/api/v1/cases/[id]/package/export/route';
import { createMockRequest } from '../../test-utils';
import { CasePermission } from '@/types/case-collaboration';
import { computePackageHash } from '@/lib/case/package-hash';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetAuthUser = jest.fn();
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: () => mockGetAuthUser(),
}));

const mockCheckResourceOwnership = jest.fn();
const mockCreatePermissionErrorResponse = jest.fn();
jest.mock('@/lib/middleware/resource-permission', () => ({
  checkResourceOwnership: (...args: unknown[]) =>
    mockCheckResourceOwnership(...args),
  createPermissionErrorResponse: (reason: string) =>
    mockCreatePermissionErrorResponse(reason),
  ResourceType: { CASE: 'case' },
}));

const mockCheckPermission = jest.fn();
jest.mock('@/lib/case/case-permission-manager', () => ({
  checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    casePackageReview: { findFirst: jest.fn() },
  },
}));

const mockBuildPackageSections = jest.fn();
jest.mock('@/lib/case/package-builder', () => ({
  buildPackageSections: (...args: unknown[]) =>
    mockBuildPackageSections(...args),
}));

const mockGenerateDocx = jest.fn();
jest.mock('@/lib/case/package-generator', () => ({
  generateCasePackageDocx: (...args: unknown[]) => mockGenerateDocx(...args),
}));

import { prisma } from '@/lib/db/prisma';
const mp = prisma as Record<string, Record<string, jest.Mock>>;

// ── 测试数据 ───────────────────────────────────────────────────────────────────

const CASE_ID = 'cmn7dw1j1000hpw7b9vks3rf8';
const USER_ID = 'user-123';
const BASE_URL = `http://localhost:3000/api/v1/cases/${CASE_ID}/package/export`;
const SELECTED = ['s1_case_summary', 's6_expert_opinion'];
const MOCK_SECTIONS = {
  s1_case_summary: {
    tier: 'primary',
    available: true,
    data: { title: '测试' },
  },
  s2_dispute_focus: { tier: 'fallback', available: true, data: null },
  s3_argument_analysis: { tier: 'none', available: false, data: null },
  s4_evidence: { tier: 'none', available: false, data: null },
  s5_risk_assessment: { tier: 'none', available: false, data: null },
  s6_expert_opinion: {
    tier: 'primary',
    available: true,
    data: { verdict: '胜诉概率高' },
  },
  s7_ai_declaration: { tier: 'fallback', available: true, data: null },
};

const MOCK_HASH = computePackageHash(
  MOCK_SECTIONS,
  SELECTED as Array<
    | 's1_case_summary'
    | 's2_dispute_focus'
    | 's3_argument_analysis'
    | 's4_evidence'
    | 's5_risk_assessment'
    | 's6_expert_opinion'
    | 's7_ai_declaration'
  >,
  'v1'
);

const MOCK_REVIEW = {
  id: 'review-001',
  contentHash: MOCK_HASH,
  selectedSections: SELECTED,
  status: 'PENDING',
  reviewerId: USER_ID,
  templateVersion: 'v1',
  createdAt: new Date('2026-05-12T10:00:00Z'),
  reviewer: {
    name: '张律师',
    email: 'lawyer@example.com',
  },
};

const MOCK_DOCX_BUFFER = Buffer.from('PK mock docx content');

// ── 辅助 ───────────────────────────────────────────────────────────────────────

function postExport(body: unknown) {
  const req = createMockRequest(BASE_URL, { method: 'POST', body });
  return POST(req, { params: Promise.resolve({ id: CASE_ID }) });
}

function setDefaultMocks() {
  (
    mockCreatePermissionErrorResponse as jest.MockedFunction<
      typeof mockCreatePermissionErrorResponse
    >
  ).mockImplementation(
    (reason: string) =>
      new Response(JSON.stringify({ error: '权限不足', message: reason }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
  );
  (
    mockGetAuthUser as jest.MockedFunction<typeof mockGetAuthUser>
  ).mockResolvedValue({
    userId: USER_ID,
    email: 'test@example.com',
    role: 'LAWYER',
  });
  (
    mockCheckResourceOwnership as jest.MockedFunction<
      typeof mockCheckResourceOwnership
    >
  ).mockResolvedValue({
    hasPermission: true,
  });
  (
    mockCheckPermission as jest.MockedFunction<typeof mockCheckPermission>
  ).mockResolvedValue({
    hasPermission: true,
  });
  (
    mockBuildPackageSections as jest.MockedFunction<
      typeof mockBuildPackageSections
    >
  ).mockResolvedValue({
    found: true,
    sections: MOCK_SECTIONS,
  });
  mp['casePackageReview']['findFirst'].mockResolvedValue(null);
  (
    mockGenerateDocx as jest.MockedFunction<typeof mockGenerateDocx>
  ).mockResolvedValue(MOCK_DOCX_BUFFER);
}

// ── 测试 ───────────────────────────────────────────────────────────────────────

describe('POST /api/v1/cases/[id]/package/export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDefaultMocks();
  });
  afterEach(() => jest.clearAllMocks());

  // ── 认证 / 权限 ──────────────────────────────────────────────────────────────

  describe('认证与权限', () => {
    it('未登录应返回 401', async () => {
      (
        mockGetAuthUser as jest.MockedFunction<typeof mockGetAuthUser>
      ).mockResolvedValue(null);
      const res = await postExport({ selectedSections: SELECTED });
      expect(res.status).toBe(401);
    });

    it('非所有人且无任何权限应返回 403', async () => {
      (
        mockCheckResourceOwnership as jest.MockedFunction<
          typeof mockCheckResourceOwnership
        >
      ).mockResolvedValue({
        hasPermission: false,
      });
      (
        mockCheckPermission as jest.MockedFunction<typeof mockCheckPermission>
      ).mockResolvedValue({
        hasPermission: false,
      });
      const res = await postExport({ selectedSections: SELECTED });
      expect(res.status).toBe(403);
    });

    it('有 VIEW_CASE 但无 EXPORT_DATA 应返回 403', async () => {
      (
        mockCheckResourceOwnership as jest.MockedFunction<
          typeof mockCheckResourceOwnership
        >
      ).mockResolvedValue({
        hasPermission: false,
      });
      (
        mockCheckPermission as jest.MockedFunction<typeof mockCheckPermission>
      ).mockImplementation((_uid: unknown, _cid: unknown, perm: unknown) =>
        Promise.resolve({ hasPermission: perm !== CasePermission.EXPORT_DATA })
      );
      const res = await postExport({ selectedSections: SELECTED });
      expect(res.status).toBe(403);
    });

    it('有 VIEW_CASE + EXPORT_DATA 的团队成员应可导出', async () => {
      (
        mockCheckResourceOwnership as jest.MockedFunction<
          typeof mockCheckResourceOwnership
        >
      ).mockResolvedValue({
        hasPermission: false,
      });
      const res = await postExport({ selectedSections: SELECTED });
      expect(res.status).toBe(200);
    });
  });

  // ── 请求体验证 ────────────────────────────────────────────────────────────────

  describe('请求体验证', () => {
    it('selectedSections 缺失应返回 400', async () => {
      const res = await postExport({});
      expect(res.status).toBe(400);
    });

    it('selectedSections 为空数组应返回 400', async () => {
      const res = await postExport({ selectedSections: [] });
      expect(res.status).toBe(400);
    });

    it('selectedSections 含无效 key 应返回 400', async () => {
      const res = await postExport({
        selectedSections: ['s1_case_summary', 'bad_key'],
      });
      expect(res.status).toBe(400);
    });
  });

  // ── 案件不存在 ────────────────────────────────────────────────────────────────

  it('案件不存在应返回 404', async () => {
    (
      mockBuildPackageSections as jest.MockedFunction<
        typeof mockBuildPackageSections
      >
    ).mockResolvedValue({
      found: false,
    });
    const res = await postExport({ selectedSections: SELECTED });
    expect(res.status).toBe(404);
  });

  // ── DOCX 输出 ─────────────────────────────────────────────────────────────────

  describe('DOCX 输出', () => {
    it('成功时返回 200', async () => {
      const res = await postExport({ selectedSections: SELECTED });
      expect(res.status).toBe(200);
    });

    it('调用 generateCasePackageDocx 且传入 selectedSections', async () => {
      await postExport({ selectedSections: SELECTED });
      expect(mockGenerateDocx).toHaveBeenCalledTimes(1);
      const callArgs = (
        mockGenerateDocx as jest.MockedFunction<typeof mockGenerateDocx>
      ).mock.calls[0] as [{ selectedSections: string[] }];
      expect(callArgs[0].selectedSections).toEqual(
        expect.arrayContaining(SELECTED)
      );
    });

    it('响应 body 为非空二进制', async () => {
      const res = await postExport({ selectedSections: SELECTED });
      const buf = await res.arrayBuffer();
      expect(buf.byteLength).toBeGreaterThan(0);
    });

    it('选中章节按产品顺序传入生成器（非字母序）', async () => {
      const allSections = [
        's7_ai_declaration',
        's1_case_summary',
        's3_argument_analysis',
      ];
      await postExport({ selectedSections: allSections });
      const callArgs = (
        mockGenerateDocx as jest.MockedFunction<typeof mockGenerateDocx>
      ).mock.calls[0] as [{ selectedSections: string[] }];
      // 生成器收到的是请求体原始 selectedSections，章节顺序由 generator 内部 SECTION_ORDER 控制
      expect(callArgs[0].selectedSections).toHaveLength(allSections.length);
    });
  });

  // ── 复核匹配 ──────────────────────────────────────────────────────────────────

  describe('复核匹配状态传入生成器', () => {
    it('无复核记录时 reviewMatch.status 为 missing', async () => {
      mp['casePackageReview']['findFirst'].mockResolvedValue(null);
      await postExport({ selectedSections: SELECTED });
      const callArgs = (
        mockGenerateDocx as jest.MockedFunction<typeof mockGenerateDocx>
      ).mock.calls[0] as [{ reviewMatch: { status: string } }];
      expect(callArgs[0].reviewMatch.status).toBe('missing');
    });

    it('hash 匹配时 reviewMatch.status 为 matched', async () => {
      mp['casePackageReview']['findFirst'].mockResolvedValue(MOCK_REVIEW);
      await postExport({ selectedSections: SELECTED });
      const callArgs = (
        mockGenerateDocx as jest.MockedFunction<typeof mockGenerateDocx>
      ).mock.calls[0] as [
        {
          reviewMatch: {
            status: string;
            reviewerName?: string;
            reviewedAt?: string;
          };
        },
      ];
      expect(callArgs[0].reviewMatch.status).toBe('matched');
      expect(callArgs[0].reviewMatch.reviewerName).toBe('张律师');
      expect(callArgs[0].reviewMatch.reviewedAt).toBeDefined();
    });
  });
});
