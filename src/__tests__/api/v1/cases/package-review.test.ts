/**
 * TDD: Phase 2 整案交付包复核 API
 *
 * POST /api/v1/cases/[id]/package/review
 *   — 服务端重建 sections、计算 contentHash（排除 generatedAt）、写入 CasePackageReview
 *
 * GET /api/v1/cases/[id]/package/review/latest
 *   — 返回最新一条复核记录（无则 data: null）
 *
 * 权限规则：
 *   POST review（责任确认动作）：所有人/管理员直接通过；团队成员须具备 EDIT_CASE
 *   GET latest：所有人/管理员直接通过；团队成员须具备 VIEW_CASE + EXPORT_DATA
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { POST } from '@/app/api/v1/cases/[id]/package/review/route';
import { GET } from '@/app/api/v1/cases/[id]/package/review/latest/route';
import { createMockRequest } from '../../test-utils';
import { CasePermission } from '@/types/case-collaboration';

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
    case: { findUnique: jest.fn() },
    debate: { findFirst: jest.fn() },
    argument: { findMany: jest.fn() },
    evidence: { findMany: jest.fn(), count: jest.fn() },
    conversation: { findFirst: jest.fn() },
    casePackageReview: { create: jest.fn(), findFirst: jest.fn() },
  },
}));

import { prisma } from '@/lib/db/prisma';
const mp = prisma as Record<string, Record<string, jest.Mock>>;

// ── 测试数据 ───────────────────────────────────────────────────────────────────

const CASE_ID = 'cmn7dw1j1000hpw7b9vks3rf8';
const USER_ID = 'user-123';
const BASE_URL = `http://localhost:3000/api/v1/cases/${CASE_ID}/package`;

const MOCK_CASE = {
  title: '王五诉赵六民间借贷纠纷案',
  type: 'CIVIL',
  status: 'ACTIVE',
  caseNumber: '(2023)沪0101民初12345号',
  cause: '民间借贷纠纷',
  court: '上海市黄浦区人民法院',
  plaintiffName: '王五',
  defendantName: '赵六',
  amount: 150000,
  metadata: {
    winRate: 0.78,
    difficulty: 'MEDIUM',
    riskLevel: 'LOW',
    aiAssessment: {
      summary: '案件事实清晰',
      keyRisks: ['约定利率超过LPR四倍'],
      generatedAt: '2026-01-01T00:00:00Z',
    },
  },
};

const MOCK_DEBATE_SUMMARY = {
  verdict: '原告胜诉概率较高',
  recommendation: '建议原告接受法院调整后利率',
  keyLegalIssues: ['借款合同效力认定'],
  plaintiffStrengths: ['借款合同书面证据完备'],
  defendantStrengths: ['约定利率超过LPR四倍'],
};

const MOCK_REVIEW = {
  id: 'review-001',
  caseId: CASE_ID,
  reviewerId: USER_ID,
  contentHash: 'a'.repeat(64),
  selectedSections: ['s1_case_summary', 's6_expert_opinion'],
  status: 'PENDING',
  reviewNotes: null,
  createdAt: new Date('2026-05-12T10:00:00Z'),
  updatedAt: new Date('2026-05-12T10:00:00Z'),
};

const SELECTED_SECTIONS = [
  's1_case_summary',
  's4_evidence',
  's6_expert_opinion',
];

// ── 辅助函数 ───────────────────────────────────────────────────────────────────

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

  mp['case']['findUnique'].mockResolvedValue(MOCK_CASE);
  mp['debate']['findFirst'].mockResolvedValue({ summary: MOCK_DEBATE_SUMMARY });
  mp['argument']['findMany'].mockResolvedValue([]);
  mp['evidence']['findMany'].mockResolvedValue([]);
  mp['evidence']['count'].mockResolvedValue(0);
  mp['conversation']['findFirst'].mockResolvedValue(null);
  mp['casePackageReview']['create'].mockResolvedValue(MOCK_REVIEW);
  mp['casePackageReview']['findFirst'].mockResolvedValue(null);
}

function postReview(body: unknown) {
  const req = createMockRequest(`${BASE_URL}/review`, {
    method: 'POST',
    body,
  });
  return POST(req, { params: Promise.resolve({ id: CASE_ID }) });
}

function getLatest() {
  const req = createMockRequest(`${BASE_URL}/review/latest`);
  return GET(req, { params: Promise.resolve({ id: CASE_ID }) });
}

// ── POST /review 测试 ──────────────────────────────────────────────────────────

describe('POST /api/v1/cases/[id]/package/review', () => {
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
      const res = await postReview({ selectedSections: SELECTED_SECTIONS });
      expect(res.status).toBe(401);
    });

    it('非所有人且无权限应返回 403', async () => {
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
      const res = await postReview({ selectedSections: SELECTED_SECTIONS });
      expect(res.status).toBe(403);
    });

    it('团队成员无 EDIT_CASE 应返回 403', async () => {
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
      const res = await postReview({ selectedSections: SELECTED_SECTIONS });
      expect(res.status).toBe(403);
      expect(mockCheckPermission).toHaveBeenCalledWith(
        USER_ID,
        CASE_ID,
        CasePermission.EDIT_CASE
      );
    });

    it('团队成员有 EDIT_CASE 应返回 201', async () => {
      (
        mockCheckResourceOwnership as jest.MockedFunction<
          typeof mockCheckResourceOwnership
        >
      ).mockResolvedValue({
        hasPermission: false,
      });
      // beforeEach 已设置 mockCheckPermission → { hasPermission: true }
      const res = await postReview({ selectedSections: SELECTED_SECTIONS });
      expect(res.status).toBe(201);
    });
  });

  // ── 请求体验证 ────────────────────────────────────────────────────────────────

  describe('请求体验证', () => {
    it('selectedSections 缺失应返回 400', async () => {
      const res = await postReview({});
      expect(res.status).toBe(400);
    });

    it('selectedSections 为空数组应返回 400', async () => {
      const res = await postReview({ selectedSections: [] });
      expect(res.status).toBe(400);
    });

    it('selectedSections 含无效 key 应返回 400', async () => {
      const res = await postReview({
        selectedSections: ['s1_case_summary', 'invalid_section'],
      });
      expect(res.status).toBe(400);
    });
  });

  // ── 案件不存在 ────────────────────────────────────────────────────────────────

  it('案件不存在应返回 404', async () => {
    mp['case']['findUnique'].mockResolvedValue(null);
    const res = await postReview({ selectedSections: SELECTED_SECTIONS });
    expect(res.status).toBe(404);
  });

  // ── 成功复核 ──────────────────────────────────────────────────────────────────

  describe('成功提交复核', () => {
    it('成功应返回 201', async () => {
      const res = await postReview({ selectedSections: SELECTED_SECTIONS });
      expect(res.status).toBe(201);
    });

    it('响应体含 id / caseId / reviewerId / contentHash / selectedSections / status', async () => {
      const res = await postReview({ selectedSections: SELECTED_SECTIONS });
      const body = (await res.json()) as {
        success: boolean;
        data: Record<string, unknown>;
      };
      expect(body.success).toBe(true);
      expect(body.data['id']).toBeDefined();
      expect(body.data['caseId']).toBe(CASE_ID);
      expect(body.data['reviewerId']).toBe(USER_ID);
      expect(body.data['contentHash']).toBeDefined();
      expect(body.data['selectedSections']).toBeDefined();
      expect(body.data['status']).toBe('PENDING');
    });

    it('contentHash 是 64 位十六进制字符串（SHA-256）', async () => {
      let capturedHash = '';
      mp['casePackageReview']['create'].mockImplementation((args: unknown) => {
        const a = args as { data: { contentHash: string } };
        capturedHash = a.data.contentHash;
        return Promise.resolve({ ...MOCK_REVIEW, contentHash: capturedHash });
      });
      await postReview({ selectedSections: SELECTED_SECTIONS });
      expect(capturedHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('contentHash 不含 generatedAt（两次提交数据不变则 hash 相同）', async () => {
      const hashSet = new Set<string>();
      mp['casePackageReview']['create'].mockImplementation((args: unknown) => {
        const a = args as { data: { contentHash: string } };
        hashSet.add(a.data.contentHash);
        return Promise.resolve({
          ...MOCK_REVIEW,
          contentHash: a.data.contentHash,
        });
      });
      await postReview({ selectedSections: SELECTED_SECTIONS });
      await postReview({ selectedSections: SELECTED_SECTIONS });
      expect(hashSet.size).toBe(1);
    });

    it('templateVersion 纳入 contentHash（v1 与 v2 产生不同 hash）', async () => {
      const hashes: string[] = [];
      mp['casePackageReview']['create'].mockImplementation((args: unknown) => {
        const a = args as { data: { contentHash: string } };
        hashes.push(a.data.contentHash);
        return Promise.resolve({
          ...MOCK_REVIEW,
          contentHash: a.data.contentHash,
        });
      });
      // 当前路由固定使用 'v1'；此处验证 hash 工具函数对不同 templateVersion 的区分
      const { computePackageHash } = await import('@/lib/case/package-hash');
      const h1 = computePackageHash({}, ['s1_case_summary'], 'v1');
      const h2 = computePackageHash({}, ['s1_case_summary'], 'v2');
      expect(h1).not.toBe(h2);
      expect(h1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('仅覆盖 selectedSections 中的章节（create 调用携带正确的 selectedSections）', async () => {
      await postReview({ selectedSections: SELECTED_SECTIONS });
      const callArgs = mp['casePackageReview']['create'].mock.calls[0] as [
        { data: { selectedSections: string[] } },
      ];
      expect(callArgs[0].data.selectedSections).toEqual(
        expect.arrayContaining(SELECTED_SECTIONS)
      );
      expect(callArgs[0].data.selectedSections).toHaveLength(
        SELECTED_SECTIONS.length
      );
    });

    it('可附带 reviewNotes', async () => {
      await postReview({
        selectedSections: SELECTED_SECTIONS,
        reviewNotes: '请律师复核',
      });
      const callArgs = mp['casePackageReview']['create'].mock.calls[0] as [
        { data: { reviewNotes: string } },
      ];
      expect(callArgs[0].data.reviewNotes).toBe('请律师复核');
    });
  });
});

// ── GET /review/latest 测试 ───────────────────────────────────────────────────

describe('GET /api/v1/cases/[id]/package/review/latest', () => {
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
      const res = await getLatest();
      expect(res.status).toBe(401);
    });

    it('无权限应返回 403', async () => {
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
      const res = await getLatest();
      expect(res.status).toBe(403);
    });
  });

  // ── 数据返回 ──────────────────────────────────────────────────────────────────

  describe('数据返回', () => {
    it('无复核记录时返回 200 且 data 为 null', async () => {
      mp['casePackageReview']['findFirst'].mockResolvedValue(null);
      const res = await getLatest();
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: null };
      expect(body.success).toBe(true);
      expect(body.data).toBeNull();
    });

    it('有复核记录时返回最新一条，含 contentHash', async () => {
      mp['casePackageReview']['findFirst'].mockResolvedValue(MOCK_REVIEW);
      const res = await getLatest();
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: Record<string, unknown>;
      };
      expect(body.success).toBe(true);
      expect(body.data['id']).toBe('review-001');
      expect(body.data['contentHash']).toBeDefined();
      expect(body.data['status']).toBe('PENDING');
    });

    it('查询时按 createdAt desc 取最新', async () => {
      mp['casePackageReview']['findFirst'].mockResolvedValue(MOCK_REVIEW);
      await getLatest();
      const callArgs = mp['casePackageReview']['findFirst'].mock.calls[0] as [
        { where: { caseId: string }; orderBy: { createdAt: string } },
      ];
      expect(callArgs[0].where.caseId).toBe(CASE_ID);
      expect(callArgs[0].orderBy.createdAt).toBe('desc');
    });
  });
});
