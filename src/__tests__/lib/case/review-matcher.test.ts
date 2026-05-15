/**
 * TDD: resolveReviewMatch
 * 复核状态匹配函数 — 纯函数，无 DB 依赖
 *
 * 匹配规则：
 *   missing  — 无 review 记录
 *   matched  — contentHash / selectedSections（排序后）/ templateVersion 三者全相同
 *   mismatch — 有记录但任一条件不满足
 */

import { describe, expect, it } from '@jest/globals';
import { resolveReviewMatch } from '@/lib/case/review-matcher';

const BASE_HASH = 'a'.repeat(64);
const BASE_SECTIONS = ['s1_case_summary', 's4_evidence'];
const TEMPLATE_V1 = 'v1';

const BASE_REVIEW = {
  id: 'review-001',
  contentHash: BASE_HASH,
  selectedSections: BASE_SECTIONS,
  status: 'PENDING',
  reviewerId: 'user-123',
  reviewNotes: null,
  createdAt: new Date('2026-05-12T10:00:00Z'),
};

describe('resolveReviewMatch', () => {
  it('无复核记录时返回 missing', () => {
    const result = resolveReviewMatch({
      latestReview: null,
      currentHash: BASE_HASH,
      selectedSections: BASE_SECTIONS,
      templateVersion: TEMPLATE_V1,
    });
    expect(result.status).toBe('missing');
  });

  it('三项全匹配时返回 matched', () => {
    const result = resolveReviewMatch({
      latestReview: BASE_REVIEW,
      currentHash: BASE_HASH,
      selectedSections: BASE_SECTIONS,
      templateVersion: TEMPLATE_V1,
    });
    expect(result.status).toBe('matched');
  });

  it('selectedSections 顺序不同但内容相同时仍为 matched', () => {
    const result = resolveReviewMatch({
      latestReview: {
        ...BASE_REVIEW,
        selectedSections: ['s4_evidence', 's1_case_summary'],
      },
      currentHash: BASE_HASH,
      selectedSections: ['s1_case_summary', 's4_evidence'],
      templateVersion: TEMPLATE_V1,
    });
    expect(result.status).toBe('matched');
  });

  it('contentHash 不同时返回 mismatch', () => {
    const result = resolveReviewMatch({
      latestReview: BASE_REVIEW,
      currentHash: 'b'.repeat(64),
      selectedSections: BASE_SECTIONS,
      templateVersion: TEMPLATE_V1,
    });
    expect(result.status).toBe('mismatch');
  });

  it('selectedSections 内容不同时返回 mismatch', () => {
    const result = resolveReviewMatch({
      latestReview: BASE_REVIEW,
      currentHash: BASE_HASH,
      selectedSections: ['s1_case_summary'],
      templateVersion: TEMPLATE_V1,
    });
    expect(result.status).toBe('mismatch');
  });

  it('templateVersion 变化导致 hash 不同时返回 mismatch', () => {
    // templateVersion 编码在 contentHash 内（computePackageHash 第三参数），
    // 版本变更会产生不同 hash，因此通过 hash 不匹配来检测版本漂移。
    const result = resolveReviewMatch({
      latestReview: { ...BASE_REVIEW, contentHash: 'b'.repeat(64) }, // 旧版本 hash
      currentHash: BASE_HASH, // 新版本 hash（不同）
      selectedSections: BASE_SECTIONS,
      templateVersion: TEMPLATE_V1,
    });
    expect(result.status).toBe('mismatch');
  });

  it('matched 时 message 包含复核提示', () => {
    const result = resolveReviewMatch({
      latestReview: BASE_REVIEW,
      currentHash: BASE_HASH,
      selectedSections: BASE_SECTIONS,
      templateVersion: TEMPLATE_V1,
    });
    expect(result.message).toContain('复核');
  });

  it('mismatch 时 message 包含变更提示', () => {
    const result = resolveReviewMatch({
      latestReview: BASE_REVIEW,
      currentHash: 'b'.repeat(64),
      selectedSections: BASE_SECTIONS,
      templateVersion: TEMPLATE_V1,
    });
    expect(result.message).toContain('变更');
  });

  it('missing 时 message 包含待复核提示', () => {
    const result = resolveReviewMatch({
      latestReview: null,
      currentHash: BASE_HASH,
      selectedSections: BASE_SECTIONS,
      templateVersion: TEMPLATE_V1,
    });
    expect(result.message).toContain('待');
  });
});
