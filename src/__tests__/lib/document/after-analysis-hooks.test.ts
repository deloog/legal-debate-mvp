/**
 * after-analysis-hooks 单元测试
 *
 * 覆盖：
 * §A 正常触发路径
 * §B 错误隔离（一个钩子失败不影响另一个）
 * §C 函数本身不向调用方抛出异常
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockShouldTriggerExtraction = jest.fn();
const mockRunCaseExtraction = jest.fn();
jest.mock('@/lib/case/case-extraction-service', () => ({
  shouldTriggerExtraction: (...a: unknown[]) =>
    mockShouldTriggerExtraction(...a),
  runCaseExtraction: (...a: unknown[]) => mockRunCaseExtraction(...a),
}));

const mockUpsertAutoEvidenceDrafts = jest.fn();
jest.mock('@/lib/evidence/auto-evidence-draft-service', () => ({
  upsertAutoEvidenceDrafts: (...a: unknown[]) =>
    mockUpsertAutoEvidenceDrafts(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── 导入被测模块 ────────────────────────────────────────────────────────────────

import { runAfterAnalysisHooks } from '@/lib/document/after-analysis-hooks';

// ── 辅助 ────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetAllMocks();
  mockShouldTriggerExtraction.mockResolvedValue(false);
  mockUpsertAutoEvidenceDrafts.mockResolvedValue({
    drafts: [],
    created: 0,
    updated: 0,
    skippedManual: 0,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §A — 正常触发路径
// ══════════════════════════════════════════════════════════════════════════════

describe('runAfterAnalysisHooks — 正常触发路径', () => {
  it('总是触发 upsertAutoEvidenceDrafts', async () => {
    await runAfterAnalysisHooks('case-1');
    expect(mockUpsertAutoEvidenceDrafts).toHaveBeenCalledTimes(1);
    expect(mockUpsertAutoEvidenceDrafts).toHaveBeenCalledWith('case-1');
  });

  it('满足提炼阈值时触发 runCaseExtraction', async () => {
    mockShouldTriggerExtraction.mockResolvedValue(true);
    mockRunCaseExtraction.mockResolvedValue(null);

    await runAfterAnalysisHooks('case-2');

    expect(mockShouldTriggerExtraction).toHaveBeenCalledWith('case-2');
    expect(mockRunCaseExtraction).toHaveBeenCalledWith('case-2');
  });

  it('未满足提炼阈值时不触发 runCaseExtraction', async () => {
    mockShouldTriggerExtraction.mockResolvedValue(false);

    await runAfterAnalysisHooks('case-3');

    expect(mockRunCaseExtraction).not.toHaveBeenCalled();
  });

  it('两个钩子并发执行（Promise.allSettled），互不阻塞', async () => {
    const order: string[] = [];
    mockShouldTriggerExtraction.mockImplementation(async () => {
      order.push('extraction-check');
      return false;
    });
    mockUpsertAutoEvidenceDrafts.mockImplementation(async () => {
      order.push('evidence-draft');
      return { drafts: [], created: 0, updated: 0, skippedManual: 0 };
    });

    await runAfterAnalysisHooks('case-4');

    expect(order).toContain('extraction-check');
    expect(order).toContain('evidence-draft');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §B — 错误隔离
// ══════════════════════════════════════════════════════════════════════════════

describe('runAfterAnalysisHooks — 错误隔离', () => {
  it('案件提炼失败时，证据草稿钩子仍被执行', async () => {
    mockShouldTriggerExtraction.mockRejectedValue(
      new Error('extraction error')
    );

    await runAfterAnalysisHooks('case-5');

    expect(mockUpsertAutoEvidenceDrafts).toHaveBeenCalledTimes(1);
  });

  it('runCaseExtraction 失败时，证据草稿钩子仍被执行', async () => {
    mockShouldTriggerExtraction.mockResolvedValue(true);
    mockRunCaseExtraction.mockRejectedValue(
      new Error('case extraction failed')
    );

    await runAfterAnalysisHooks('case-6');

    expect(mockUpsertAutoEvidenceDrafts).toHaveBeenCalledTimes(1);
  });

  it('证据草稿生成失败时，不影响案件提炼钩子', async () => {
    mockShouldTriggerExtraction.mockResolvedValue(true);
    mockRunCaseExtraction.mockResolvedValue(null);
    mockUpsertAutoEvidenceDrafts.mockRejectedValue(
      new Error('evidence draft error')
    );

    await runAfterAnalysisHooks('case-7');

    expect(mockRunCaseExtraction).toHaveBeenCalledTimes(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §C — 调用方安全（函数本身不抛出）
// ══════════════════════════════════════════════════════════════════════════════

describe('runAfterAnalysisHooks — 调用方安全', () => {
  it('两个钩子均失败时，函数自身不抛出异常', async () => {
    mockShouldTriggerExtraction.mockRejectedValue(new Error('fail'));
    mockUpsertAutoEvidenceDrafts.mockRejectedValue(new Error('fail'));

    await expect(runAfterAnalysisHooks('case-8')).resolves.toBeUndefined();
  });
});
