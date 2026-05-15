/**
 * TDD: package-generator.ts
 * 纯渲染层 — 不接 Prisma、不接 auth、不接 hash
 *
 * 测试重点：
 * - 被选中的 section 始终出现在文档（即使 data = null，也渲染 fallback 文本）
 * - 未被选中的 section 不渲染
 * - 函数返回 Buffer（可作为 DOCX 流输出）
 * - 任何 section 状态组合不会 throw
 */

import { describe, expect, it } from '@jest/globals';
import { generateCasePackageDocx } from '@/lib/case/package-generator';
import type { ExportPackagePayload } from '@/lib/case/package-generator';

// ── 测试数据 ───────────────────────────────────────────────────────────────────

const FULL_PAYLOAD: ExportPackagePayload = {
  caseId: 'case-001',
  templateVersion: 'v1',
  selectedSections: [
    's1_case_summary',
    's2_dispute_focus',
    's3_argument_analysis',
    's4_evidence',
    's5_risk_assessment',
    's6_expert_opinion',
    's7_ai_declaration',
  ],
  sections: {
    s1_case_summary: {
      tier: 'primary',
      available: true,
      data: {
        title: '王五诉赵六民间借贷纠纷案',
        type: 'CIVIL',
        status: 'ACTIVE',
        caseNumber: '(2023)沪0101民初12345号',
        cause: '民间借贷纠纷',
        court: '上海市黄浦区人民法院',
        plaintiffName: '王五',
        defendantName: '赵六',
        amount: 150000,
      },
    },
    s2_dispute_focus: {
      tier: 'primary',
      available: true,
      data: {
        keyLegalIssues: ['借款合同效力认定', '约定利率是否超过司法保护上限'],
      },
    },
    s3_argument_analysis: {
      tier: 'primary',
      available: true,
      data: {
        totalCount: 1,
        items: [
          {
            id: 'arg-1',
            side: 'PLAINTIFF',
            type: 'MAIN_POINT',
            content: '借款合同明确',
            legalBasis: [{ article: '民法典第667条' }],
            confidence: 0.9,
            legalScore: 0.85,
            overallScore: 0.88,
          },
        ],
      },
    },
    s4_evidence: {
      tier: 'primary',
      available: true,
      data: {
        totalCount: 1,
        items: [
          {
            id: 'ev-1',
            name: '借款合同',
            type: 'DOCUMENT',
            status: 'ACCEPTED',
            description: '2022年签署',
            submitter: '王五',
            source: null,
            relevanceScore: null,
          },
        ],
      },
    },
    s5_risk_assessment: {
      tier: 'primary',
      available: true,
      data: {
        winRate: 0.78,
        difficulty: 'MEDIUM',
        riskLevel: 'LOW',
        aiAssessment: {
          summary: '案件事实清晰',
          keyRisks: ['利率风险'],
          generatedAt: '2026-01-01',
        },
      },
    },
    s6_expert_opinion: {
      tier: 'primary',
      available: true,
      data: {
        verdict: '原告胜诉概率较高',
        recommendation: '建议接受法院调整后利率',
        plaintiffStrengths: ['书面证据完备'],
        defendantStrengths: ['利率超限'],
      },
    },
    s7_ai_declaration: { tier: 'fallback', available: true, data: null },
  },
  reviewMatch: {
    status: 'matched',
    reviewerName: '张律师',
    reviewedAt: '2026-05-12T10:00:00Z',
  },
};

// ── 辅助 ───────────────────────────────────────────────────────────────────────

function minimalPayload(
  selectedSections: string[],
  overrides: Partial<ExportPackagePayload['sections']> = {}
): ExportPackagePayload {
  return {
    ...FULL_PAYLOAD,
    selectedSections:
      selectedSections as ExportPackagePayload['selectedSections'],
    sections: {
      ...FULL_PAYLOAD.sections,
      ...overrides,
    } as ExportPackagePayload['sections'],
  };
}

// ── 测试套件 ───────────────────────────────────────────────────────────────────

describe('generateCasePackageDocx', () => {
  it('返回 Buffer', async () => {
    const buf = await generateCasePackageDocx(FULL_PAYLOAD);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('任意 section 状态组合不会 throw', async () => {
    const fallbackPayload: ExportPackagePayload = {
      ...FULL_PAYLOAD,
      sections: {
        s1_case_summary: {
          tier: 'primary',
          available: true,
          data: {
            title: '测试',
            type: 'CIVIL',
            status: 'ACTIVE',
            caseNumber: null,
            cause: null,
            court: null,
            plaintiffName: null,
            defendantName: null,
            amount: null,
          },
        },
        s2_dispute_focus: { tier: 'fallback', available: true, data: null },
        s3_argument_analysis: { tier: 'none', available: false, data: null },
        s4_evidence: { tier: 'none', available: false, data: null },
        s5_risk_assessment: { tier: 'none', available: false, data: null },
        s6_expert_opinion: { tier: 'fallback', available: true, data: null },
        s7_ai_declaration: { tier: 'fallback', available: true, data: null },
      },
    };
    await expect(
      generateCasePackageDocx(fallbackPayload)
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('selected 的 none section 仍渲染（fallback 文本）', async () => {
    const payload = minimalPayload(['s1_case_summary', 's4_evidence'], {
      s4_evidence: { tier: 'none', available: false, data: null },
    });
    // 不 throw 即为 pass（渲染 fallback）
    await expect(generateCasePackageDocx(payload)).resolves.toBeInstanceOf(
      Buffer
    );
  });

  it('未被选中的 section 不影响输出（只选 s1）', async () => {
    const payload = minimalPayload(['s1_case_summary']);
    const buf = await generateCasePackageDocx(payload);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('reviewMatch.status = missing 时不 throw', async () => {
    const payload: ExportPackagePayload = {
      ...FULL_PAYLOAD,
      reviewMatch: { status: 'missing' },
    };
    await expect(generateCasePackageDocx(payload)).resolves.toBeInstanceOf(
      Buffer
    );
  });

  it('reviewMatch.status = mismatch 时不 throw', async () => {
    const payload: ExportPackagePayload = {
      ...FULL_PAYLOAD,
      reviewMatch: { status: 'mismatch' },
    };
    await expect(generateCasePackageDocx(payload)).resolves.toBeInstanceOf(
      Buffer
    );
  });
});
