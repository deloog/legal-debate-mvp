/**
 * TDD: GET /api/v1/cases/[id]/package/preview
 * 合同版本：v2.1-final
 *
 * 章节定义（7 节）：
 *   §1 s1_case_summary    — Case 主体，始终 primary
 *   §2 s2_dispute_focus   — keyLegalIssues / CaseCrystal / fallback
 *   §3 s3_argument_analysis — Argument.legalBasis[]
 *   §4 s4_evidence        — Evidence 列表
 *   §5 s5_risk_assessment — Case.metadata 完整快照
 *   §6 s6_expert_opinion  — Debate.summary / fallback
 *   §7 s7_ai_declaration  — 始终 fallback（静态 AI 免责声明）
 *
 * 不存在 s5_legal_references 独立章节。
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { GET } from '@/app/api/v1/cases/[id]/package/preview/route';
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
mockCreatePermissionErrorResponse.mockImplementation(
  (reason: string) =>
    new Response(JSON.stringify({ error: '权限不足', message: reason }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
);

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
  },
}));

import { prisma } from '@/lib/db/prisma';
const mp = prisma as Record<string, Record<string, jest.Mock>>;

// ── 测试数据 ───────────────────────────────────────────────────────────────────

const CASE_ID = 'cmn7dw1j1000hpw7b9vks3rf8';
const USER_ID = 'user-123';
const BASE_URL = `http://localhost:3000/api/v1/cases/${CASE_ID}/package/preview`;

const MOCK_CASE = {
  id: CASE_ID,
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
      summary: '案件事实清晰，主要风险来自利率调整',
      keyRisks: ['约定利率超过LPR四倍'],
      generatedAt: '2026-01-01T00:00:00Z',
    },
  },
};

const MOCK_DEBATE_SUMMARY = {
  verdict: '原告胜诉概率较高',
  recommendation: '建议原告接受法院调整后利率',
  keyLegalIssues: ['借款合同效力认定', '约定利率是否超过司法保护上限'],
  plaintiffStrengths: ['借款合同书面证据完备'],
  defendantStrengths: ['约定利率超过LPR四倍'],
};

const MOCK_CASE_CRYSTAL = {
  version: 3,
  core_dispute: '被告是否应偿还借款本金15万元',
  parties: { plaintiff: '王五', defendant: '赵六' },
  established_facts: ['2022年3月15日原告转账15万元'],
  uncertain_facts: ['被告主张另有现金还款2万元'],
  open_questions: ['约定利率超过LPR四倍的处理方式'],
};

const MOCK_ARGUMENT = {
  id: 'arg-1',
  side: 'PLAINTIFF',
  type: 'MAIN_POINT',
  content: '借款合同明确',
  legalBasis: [{ article: '民法典第667条', content: '借款合同规定...' }],
  confidence: 0.9,
  legalScore: 0.85,
  overallScore: 0.88,
};

const MOCK_EVIDENCE = {
  id: 'ev-1',
  name: '借款合同',
  type: 'DOCUMENT',
  status: 'ACCEPTED',
  description: '2022年3月15日签署',
  submitter: '王五',
  source: null,
  relevanceScore: null,
};

// ── 辅助函数 ───────────────────────────────────────────────────────────────────

async function callPreview() {
  const req = createMockRequest(BASE_URL);
  const res = await GET(req, { params: Promise.resolve({ id: CASE_ID }) });
  const body = (await res.json()) as {
    success: boolean;
    data: {
      caseId: string;
      templateVersion: string;
      generatedAt: string;
      sections: Record<
        string,
        { tier: string; available: boolean; data: unknown }
      >;
      meta: { totalAvailable: number; totalSections: number };
      reviewStatus: null;
    };
  };
  return { res, body };
}

// ── 测试套件 ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/cases/[id]/package/preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // createPermissionErrorResponse 需在每次 clearAllMocks 后重新注册，
    // 因为 Jest 30 clearAllMocks 会清除 mockResolvedValue/mockImplementation
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

    // 默认：已登录的律师，案件所有人
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

    // 默认 DB 数据（全部就绪）
    mp['case']['findUnique'].mockResolvedValue(MOCK_CASE);
    mp['debate']['findFirst'].mockResolvedValue({
      summary: MOCK_DEBATE_SUMMARY,
    });
    mp['argument']['findMany'].mockResolvedValue([MOCK_ARGUMENT]);
    mp['evidence']['findMany'].mockResolvedValue([MOCK_EVIDENCE]);
    mp['evidence']['count'].mockResolvedValue(1);
    mp['conversation']['findFirst'].mockResolvedValue({
      caseContext: MOCK_CASE_CRYSTAL,
    });
  });

  afterEach(() => jest.clearAllMocks());

  // ── 认证 / 权限 ─────────────────────────────────────────────────────────────

  describe('认证与权限', () => {
    it('未登录应返回 401', async () => {
      (
        mockGetAuthUser as jest.MockedFunction<typeof mockGetAuthUser>
      ).mockResolvedValue(null);
      const req = createMockRequest(BASE_URL);
      const res = await GET(req, { params: Promise.resolve({ id: CASE_ID }) });
      expect(res.status).toBe(401);
    });

    it('非所有人且无权限应返回 403', async () => {
      (
        mockCheckResourceOwnership as jest.MockedFunction<
          typeof mockCheckResourceOwnership
        >
      ).mockResolvedValue({
        hasPermission: false,
        reason: '非案件所有者',
      });
      (
        mockCheckPermission as jest.MockedFunction<typeof mockCheckPermission>
      ).mockResolvedValue({
        hasPermission: false,
      });
      const req = createMockRequest(BASE_URL);
      const res = await GET(req, { params: Promise.resolve({ id: CASE_ID }) });
      expect(res.status).toBe(403);
    });

    it('团队成员有 EXPORT_DATA 但无 VIEW_CASE 应返回 403', async () => {
      (
        mockCheckResourceOwnership as jest.MockedFunction<
          typeof mockCheckResourceOwnership
        >
      ).mockResolvedValue({
        hasPermission: false,
        reason: '非所有者',
      });
      // VIEW_CASE → false，EXPORT_DATA → true（VIEW_CASE 先被拒绝，不应进入 EXPORT_DATA）
      (
        mockCheckPermission as jest.MockedFunction<typeof mockCheckPermission>
      ).mockImplementation((_uid: unknown, _cid: unknown, perm: unknown) =>
        Promise.resolve({
          hasPermission: perm !== CasePermission.VIEW_CASE,
        })
      );
      const req = createMockRequest(BASE_URL);
      const res = await GET(req, { params: Promise.resolve({ id: CASE_ID }) });
      expect(res.status).toBe(403);
      expect(mockCheckPermission).toHaveBeenCalledWith(
        USER_ID,
        CASE_ID,
        CasePermission.VIEW_CASE
      );
    });

    it('团队成员有 VIEW_CASE 但无 EXPORT_DATA 应返回 403', async () => {
      (
        mockCheckResourceOwnership as jest.MockedFunction<
          typeof mockCheckResourceOwnership
        >
      ).mockResolvedValue({
        hasPermission: false,
        reason: '非所有者',
      });
      // VIEW_CASE → true，EXPORT_DATA → false
      (
        mockCheckPermission as jest.MockedFunction<typeof mockCheckPermission>
      ).mockImplementation((_uid: unknown, _cid: unknown, perm: unknown) =>
        Promise.resolve({
          hasPermission: perm !== CasePermission.EXPORT_DATA,
        })
      );
      const req = createMockRequest(BASE_URL);
      const res = await GET(req, { params: Promise.resolve({ id: CASE_ID }) });
      expect(res.status).toBe(403);
    });

    it('团队成员同时有 VIEW_CASE + EXPORT_DATA 应返回 200', async () => {
      (
        mockCheckResourceOwnership as jest.MockedFunction<
          typeof mockCheckResourceOwnership
        >
      ).mockResolvedValue({
        hasPermission: false,
      });
      // beforeEach 已设置 mockCheckPermission.mockResolvedValue({ hasPermission: true })
      const { res } = await callPreview();
      expect(res.status).toBe(200);
    });
  });

  // ── 响应结构 ────────────────────────────────────────────────────────────────

  describe('响应结构', () => {
    it('包含 sections 而非 sectionsAvailability', async () => {
      const { body } = await callPreview();
      expect(body.success).toBe(true);
      expect(body.data.sections).toBeDefined();
      expect(
        (body.data as unknown as Record<string, unknown>)[
          'sectionsAvailability'
        ]
      ).toBeUndefined();
    });

    it('templateVersion 为 v1，reviewStatus 为 null', async () => {
      const { body } = await callPreview();
      expect(body.data.templateVersion).toBe('v1');
      expect(body.data.reviewStatus).toBeNull();
    });

    it('meta.totalSections 固定为 7', async () => {
      const { body } = await callPreview();
      expect(body.data.meta.totalSections).toBe(7);
    });

    it('meta.totalAvailable 与实际 available=true 的章节数一致', async () => {
      const { body } = await callPreview();
      const actual = Object.values(body.data.sections).filter(
        s => (s as { available: boolean }).available
      ).length;
      expect(body.data.meta.totalAvailable).toBe(actual);
    });

    it('不含 s5_legal_references 字段', async () => {
      const { body } = await callPreview();
      expect(
        (body.data.sections as Record<string, unknown>)['s5_legal_references']
      ).toBeUndefined();
    });

    it('每个 section 包含 tier / available / data 三字段', async () => {
      const { body } = await callPreview();
      for (const s of Object.values(body.data.sections)) {
        const section = s as {
          tier: string;
          available: boolean;
          data: unknown;
        };
        expect(section).toHaveProperty('tier');
        expect(section).toHaveProperty('available');
        expect(section).toHaveProperty('data');
      }
    });
  });

  // ── §1 案情摘要 ─────────────────────────────────────────────────────────────

  describe('§1 案情摘要', () => {
    it('始终为 primary tier，available = true', async () => {
      const { body } = await callPreview();
      const s1 = body.data.sections['s1_case_summary'] as {
        tier: string;
        available: boolean;
        data: Record<string, unknown>;
      };
      expect(s1.tier).toBe('primary');
      expect(s1.available).toBe(true);
    });

    it('data 包含 Case 核心字段', async () => {
      const { body } = await callPreview();
      const s1 = body.data.sections['s1_case_summary'] as {
        data: Record<string, unknown>;
      };
      expect(s1.data['title']).toBe(MOCK_CASE.title);
      expect(s1.data['plaintiffName']).toBe('王五');
      expect(s1.data['defendantName']).toBe('赵六');
      expect(s1.data['type']).toBe('CIVIL');
    });

    it('有 CaseCrystal 时 data 附加 established_facts', async () => {
      const { body } = await callPreview();
      const s1 = body.data.sections['s1_case_summary'] as {
        data: Record<string, unknown>;
      };
      expect(s1.data['established_facts']).toEqual(
        MOCK_CASE_CRYSTAL.established_facts
      );
    });

    it('无 CaseCrystal 时 data 不含 established_facts', async () => {
      mp['conversation']['findFirst'].mockResolvedValue(null);
      const { body } = await callPreview();
      const s1 = body.data.sections['s1_case_summary'] as {
        data: Record<string, unknown>;
      };
      expect(s1.data['established_facts']).toBeUndefined();
    });
  });

  // ── §2 争议焦点 ─────────────────────────────────────────────────────────────

  describe('§2 争议焦点', () => {
    it('有 Debate.summary.keyLegalIssues 时为 primary', async () => {
      const { body } = await callPreview();
      const s2 = body.data.sections['s2_dispute_focus'] as {
        tier: string;
        data: Record<string, unknown>;
      };
      expect(s2.tier).toBe('primary');
      expect(s2.data['keyLegalIssues']).toEqual(
        MOCK_DEBATE_SUMMARY.keyLegalIssues
      );
    });

    it('无 Debate.summary 但有 CaseCrystal.core_dispute 时为 enhanced', async () => {
      mp['debate']['findFirst'].mockResolvedValue(null);
      const { body } = await callPreview();
      const s2 = body.data.sections['s2_dispute_focus'] as {
        tier: string;
        data: Record<string, unknown>;
      };
      expect(s2.tier).toBe('enhanced');
      expect(s2.data['core_dispute']).toBe(MOCK_CASE_CRYSTAL.core_dispute);
    });

    it('无任何数据时为 fallback，available = true，data = null', async () => {
      mp['debate']['findFirst'].mockResolvedValue(null);
      mp['conversation']['findFirst'].mockResolvedValue(null);
      const { body } = await callPreview();
      const s2 = body.data.sections['s2_dispute_focus'] as {
        tier: string;
        available: boolean;
        data: unknown;
      };
      expect(s2.tier).toBe('fallback');
      expect(s2.available).toBe(true);
      expect(s2.data).toBeNull();
    });
  });

  // ── §3 论点分析 ─────────────────────────────────────────────────────────────

  describe('§3 论点分析', () => {
    it('有含 legalBasis 的论点时为 primary', async () => {
      const { body } = await callPreview();
      const s3 = body.data.sections['s3_argument_analysis'] as {
        tier: string;
        available: boolean;
        data: { items: Array<{ legalBasis: unknown[] }>; totalCount: number };
      };
      expect(s3.tier).toBe('primary');
      expect(s3.available).toBe(true);
      expect(Array.isArray(s3.data.items)).toBe(true);
      expect(s3.data.items[0].legalBasis).toBeDefined();
      expect(s3.data.totalCount).toBeGreaterThan(0);
    });

    it('只有无 legalBasis 的论点时为 enhanced', async () => {
      mp['argument']['findMany'].mockResolvedValue([
        { ...MOCK_ARGUMENT, legalBasis: null },
      ]);
      const { body } = await callPreview();
      const s3 = body.data.sections['s3_argument_analysis'] as {
        tier: string;
        available: boolean;
      };
      expect(s3.tier).toBe('enhanced');
      expect(s3.available).toBe(true);
    });

    it('无论点时 available = false，tier = none', async () => {
      mp['argument']['findMany'].mockResolvedValue([]);
      const { body } = await callPreview();
      const s3 = body.data.sections['s3_argument_analysis'] as {
        tier: string;
        available: boolean;
        data: null;
      };
      expect(s3.available).toBe(false);
      expect(s3.tier).toBe('none');
      expect(s3.data).toBeNull();
    });
  });

  // ── §4 证据清单 ─────────────────────────────────────────────────────────────

  describe('§4 证据清单', () => {
    it('有证据时为 primary，data 包含 items 和 totalCount', async () => {
      const { body } = await callPreview();
      const s4 = body.data.sections['s4_evidence'] as {
        tier: string;
        available: boolean;
        data: { items: unknown[]; totalCount: number };
      };
      expect(s4.tier).toBe('primary');
      expect(s4.available).toBe(true);
      expect(s4.data.totalCount).toBe(1);
      expect(s4.data.items[0]).toMatchObject({
        name: '借款合同',
        type: 'DOCUMENT',
      });
    });

    it('无证据时 available = false，tier = none', async () => {
      mp['evidence']['findMany'].mockResolvedValue([]);
      mp['evidence']['count'].mockResolvedValue(0);
      const { body } = await callPreview();
      const s4 = body.data.sections['s4_evidence'] as {
        tier: string;
        available: boolean;
        data: null;
      };
      expect(s4.available).toBe(false);
      expect(s4.tier).toBe('none');
      expect(s4.data).toBeNull();
    });
  });

  // ── §5 风险评估 ─────────────────────────────────────────────────────────────

  describe('§5 风险评估', () => {
    it('metadata 含 winRate / difficulty / riskLevel / aiAssessment 时为 primary', async () => {
      const { body } = await callPreview();
      const s5 = body.data.sections['s5_risk_assessment'] as {
        tier: string;
        available: boolean;
        data: Record<string, unknown>;
      };
      expect(s5.tier).toBe('primary');
      expect(s5.available).toBe(true);
      expect(s5.data['winRate']).toBe(0.78);
      expect(s5.data['difficulty']).toBe('MEDIUM');
      expect(s5.data['riskLevel']).toBe('LOW');
      expect(s5.data['aiAssessment']).toBeDefined();
    });

    it('metadata 缺少 aiAssessment 时 available = false', async () => {
      mp['case']['findUnique'].mockResolvedValue({
        ...MOCK_CASE,
        metadata: { winRate: 0.5, difficulty: 'LOW', riskLevel: 'LOW' },
      });
      const { body } = await callPreview();
      const s5 = body.data.sections['s5_risk_assessment'] as {
        available: boolean;
      };
      expect(s5.available).toBe(false);
    });

    it('metadata 为 null 时 available = false，tier = none', async () => {
      mp['case']['findUnique'].mockResolvedValue({
        ...MOCK_CASE,
        metadata: null,
      });
      const { body } = await callPreview();
      const s5 = body.data.sections['s5_risk_assessment'] as {
        tier: string;
        available: boolean;
      };
      expect(s5.available).toBe(false);
      expect(s5.tier).toBe('none');
    });
  });

  // ── §6 专业意见 ─────────────────────────────────────────────────────────────

  describe('§6 专业意见', () => {
    it('有 Debate.summary 时为 primary，data 含 verdict', async () => {
      const { body } = await callPreview();
      const s6 = body.data.sections['s6_expert_opinion'] as {
        tier: string;
        available: boolean;
        data: Record<string, unknown>;
      };
      expect(s6.tier).toBe('primary');
      expect(s6.available).toBe(true);
      expect(s6.data['verdict']).toBe(MOCK_DEBATE_SUMMARY.verdict);
      expect(s6.data['recommendation']).toBe(
        MOCK_DEBATE_SUMMARY.recommendation
      );
    });

    it('无 Debate.summary 时为 fallback，available = true，data = null', async () => {
      mp['debate']['findFirst'].mockResolvedValue(null);
      const { body } = await callPreview();
      const s6 = body.data.sections['s6_expert_opinion'] as {
        tier: string;
        available: boolean;
        data: null;
      };
      expect(s6.tier).toBe('fallback');
      expect(s6.available).toBe(true);
      expect(s6.data).toBeNull();
    });
  });

  // ── §7 AI 声明 ───────────────────────────────────────────────────────────────

  describe('§7 AI 声明', () => {
    it('始终为 fallback tier，available = true', async () => {
      // 即使所有 DB 数据为空，§7 也始终可用
      mp['debate']['findFirst'].mockResolvedValue(null);
      mp['argument']['findMany'].mockResolvedValue([]);
      mp['evidence']['findMany'].mockResolvedValue([]);
      mp['evidence']['count'].mockResolvedValue(0);
      mp['conversation']['findFirst'].mockResolvedValue(null);
      mp['case']['findUnique'].mockResolvedValue({
        ...MOCK_CASE,
        metadata: null,
      });
      const { body } = await callPreview();
      const s7 = body.data.sections['s7_ai_declaration'] as {
        tier: string;
        available: boolean;
      };
      expect(s7.tier).toBe('fallback');
      expect(s7.available).toBe(true);
    });

    it('data 为 null（静态声明由前端渲染）', async () => {
      const { body } = await callPreview();
      const s7 = body.data.sections['s7_ai_declaration'] as { data: null };
      expect(s7.data).toBeNull();
    });
  });
});
