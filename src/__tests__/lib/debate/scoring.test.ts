/**
 * computeArgumentScores 单元测试
 *
 * 覆盖范围：
 * - logicScore：无推理/短推理/长推理 × 置信度
 * - legalScore：无法条/单条/多条 × 不同相关度
 * - overallScore：加权合并
 * - 精度：结果均为3位小数
 * - 边界：所有分项严格在 [0, 1] 范围内
 */

import { describe, it, expect } from '@jest/globals';
import { computeArgumentScores } from '@/lib/debate/scoring';

// ── 辅助工厂 ──────────────────────────────────────────────────────────────────

function makeBasis(relevance: number) {
  return { relevance };
}

// ── logicScore ────────────────────────────────────────────────────────────────

describe('logicScore', () => {
  it('无推理文本时等于 max(0.3, confidence×0.5)', () => {
    const high = computeArgumentScores({
      reasoning: null,
      legalBasis: [],
      confidence: 0.88,
    });
    expect(high.logicScore).toBeCloseTo(0.88 * 0.5, 3); // 0.44，但 max(0.3, 0.44) = 0.44

    const low = computeArgumentScores({
      reasoning: '',
      legalBasis: [],
      confidence: 0.4,
    });
    // max(0.3, 0.4×0.5=0.2) = 0.3
    expect(low.logicScore).toBeCloseTo(0.3, 3);
  });

  it('空白推理（仅空格）等同于无推理', () => {
    const result = computeArgumentScores({
      reasoning: '   ',
      legalBasis: [],
      confidence: 0.5,
    });
    // trim().length === 0
    expect(result.logicScore).toBeCloseTo(Math.max(0.3, 0.5 * 0.5), 3);
  });

  it('短推理（80字）产生中等 logicScore', () => {
    const reasoning = '甲'.repeat(80); // 80 字
    const result = computeArgumentScores({
      reasoning,
      legalBasis: [],
      confidence: 0.85,
    });
    // 0.55 + min(80/800, 0.3) + 0.85×0.1 = 0.55 + 0.1 + 0.085 = 0.735
    expect(result.logicScore).toBeGreaterThan(0.55);
    expect(result.logicScore).toBeLessThan(0.95);
  });

  it('长推理（800字）logicScore 接近上限', () => {
    const reasoning = '甲'.repeat(800);
    const result = computeArgumentScores({
      reasoning,
      legalBasis: [],
      confidence: 0.9,
    });
    // 0.55 + min(800/800=1, 0.3) + 0.9×0.1 = 0.55+0.3+0.09 = 0.94
    expect(result.logicScore).toBeCloseTo(0.94, 2);
  });

  it('超长推理（2000字）logicScore 不超过 0.95', () => {
    const reasoning = '甲'.repeat(2000);
    const result = computeArgumentScores({
      reasoning,
      legalBasis: [],
      confidence: 1.0,
    });
    expect(result.logicScore).toBeLessThanOrEqual(0.95);
  });

  it('logicScore 严格大于 0', () => {
    const result = computeArgumentScores({
      reasoning: null,
      legalBasis: [],
      confidence: 0,
    });
    expect(result.logicScore).toBeGreaterThan(0);
  });
});

// ── legalScore ────────────────────────────────────────────────────────────────

describe('legalScore', () => {
  it('无法条时 legalScore = 0.2', () => {
    const result = computeArgumentScores({
      reasoning: null,
      legalBasis: [],
      confidence: 0.88,
    });
    expect(result.legalScore).toBeCloseTo(0.2, 3);
  });

  it('legalBasis 非数组时 legalScore = 0.2', () => {
    const result = computeArgumentScores({
      reasoning: null,
      legalBasis: null,
      confidence: 0.88,
    });
    expect(result.legalScore).toBeCloseTo(0.2, 3);
  });

  it('单条高相关度法条产生合理 legalScore', () => {
    const result = computeArgumentScores({
      reasoning: null,
      legalBasis: [makeBasis(0.9)],
      confidence: 0.85,
    });
    // avgRelevance=0.9, bases.length=1
    // 0.9×0.75 + min(1/4, 0.2) = 0.675 + 0.2 = 0.875 → min(0.95, 0.875) = 0.875
    expect(result.legalScore).toBeCloseTo(0.875, 3);
  });

  it('4条满相关度法条 legalScore 接近上限', () => {
    const result = computeArgumentScores({
      reasoning: null,
      legalBasis: [makeBasis(1), makeBasis(1), makeBasis(1), makeBasis(1)],
      confidence: 0.85,
    });
    // avgRelevance=1, 1×0.75 + min(4/4=1, 0.2) = 0.75+0.2 = 0.95
    expect(result.legalScore).toBeCloseTo(0.95, 3);
  });

  it('4条低相关度法条 legalScore 较低', () => {
    const result = computeArgumentScores({
      reasoning: null,
      legalBasis: [
        makeBasis(0.2),
        makeBasis(0.2),
        makeBasis(0.2),
        makeBasis(0.2),
      ],
      confidence: 0.85,
    });
    // avgRelevance=0.2, 0.2×0.75 + 0.2 = 0.15+0.2 = 0.35
    expect(result.legalScore).toBeCloseTo(0.35, 3);
  });

  it('法条 relevance 缺失时按 0.75 计', () => {
    const result = computeArgumentScores({
      reasoning: null,
      legalBasis: [{}], // 无 relevance 字段
      confidence: 0.85,
    });
    // avgRelevance = 0.75, bases.length=1
    // 0.75×0.75 + min(1/4, 0.2) = 0.5625+0.2 = 0.7625 → 0.763
    expect(result.legalScore).toBeCloseTo(0.75 * 0.75 + 0.2, 3);
  });

  it('legalScore 不超过 0.95', () => {
    const result = computeArgumentScores({
      reasoning: null,
      legalBasis: Array.from({ length: 10 }, () => makeBasis(1)),
      confidence: 1,
    });
    expect(result.legalScore).toBeLessThanOrEqual(0.95);
  });
});

// ── overallScore ──────────────────────────────────────────────────────────────

describe('overallScore', () => {
  it('等于 logicScore×0.4 + legalScore×0.6（3位小数）', () => {
    const reasoning = '甲'.repeat(300);
    const legalBasis = [makeBasis(0.8), makeBasis(0.9)];
    const result = computeArgumentScores({
      reasoning,
      legalBasis,
      confidence: 0.88,
    });

    const expected = +(
      result.logicScore * 0.4 +
      result.legalScore * 0.6
    ).toFixed(3);
    expect(result.overallScore).toBe(expected);
  });

  it('overallScore 在 (0, 1] 区间内', () => {
    const result = computeArgumentScores({
      reasoning: null,
      legalBasis: [],
      confidence: 0,
    });
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(1);
  });
});

// ── 精度与返回结构 ────────────────────────────────────────────────────────────

describe('返回结构与精度', () => {
  it('返回对象包含 logicScore / legalScore / overallScore', () => {
    const result = computeArgumentScores({
      reasoning: '测试推理文本',
      legalBasis: [],
      confidence: 0.8,
    });
    expect(result).toHaveProperty('logicScore');
    expect(result).toHaveProperty('legalScore');
    expect(result).toHaveProperty('overallScore');
  });

  it('所有分项精度不超过3位小数', () => {
    const result = computeArgumentScores({
      reasoning: '甲'.repeat(150),
      legalBasis: [makeBasis(0.77), makeBasis(0.83)],
      confidence: 0.87,
    });

    const check = (v: number) => {
      const str = v.toString();
      const decimals = str.includes('.') ? str.split('.')[1].length : 0;
      return decimals <= 3;
    };

    expect(check(result.logicScore)).toBe(true);
    expect(check(result.legalScore)).toBe(true);
    expect(check(result.overallScore)).toBe(true);
  });

  it('所有分项均为 number 类型', () => {
    const result = computeArgumentScores({
      reasoning: null,
      legalBasis: null,
      confidence: 0.5,
    });
    expect(typeof result.logicScore).toBe('number');
    expect(typeof result.legalScore).toBe('number');
    expect(typeof result.overallScore).toBe('number');
  });
});

// ── 典型辩论论点场景 ──────────────────────────────────────────────────────────

describe('典型场景', () => {
  it('高质量论点（长推理 + 多高关联法条）综合分应 ≥ 0.8', () => {
    const result = computeArgumentScores({
      reasoning:
        '根据《民法典》第1165条第1款，一般侵权责任采过错责任原则。本案中被告…'.repeat(
          10
        ),
      legalBasis: [makeBasis(0.95), makeBasis(0.9), makeBasis(0.85)],
      confidence: 0.88,
    });
    expect(result.overallScore).toBeGreaterThanOrEqual(0.8);
  });

  it('低质量论点（无推理 + 无法条）综合分应 ≤ 0.4', () => {
    const result = computeArgumentScores({
      reasoning: null,
      legalBasis: [],
      confidence: 0.5,
    });
    // logicScore = max(0.3, 0.25) = 0.3, legalScore = 0.2
    // overall = 0.3×0.4 + 0.2×0.6 = 0.12+0.12 = 0.24
    expect(result.overallScore).toBeLessThanOrEqual(0.4);
  });

  it('重试论点（有推理，无法条）综合分介于中等', () => {
    const result = computeArgumentScores({
      reasoning:
        '被告实施了侵权行为，依据相关法律规定应当承担赔偿责任。'.repeat(5),
      legalBasis: [],
      confidence: 0.85,
    });
    expect(result.overallScore).toBeGreaterThan(0.2);
    expect(result.overallScore).toBeLessThan(0.7);
  });
});
