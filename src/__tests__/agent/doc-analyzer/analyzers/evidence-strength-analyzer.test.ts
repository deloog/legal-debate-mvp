/**
 * EvidenceStrengthAnalyzer 测试
 * 目标：证据强度评估准确性
 */

import { EvidenceStrengthAnalyzer } from '@/lib/agent/doc-analyzer/analyzers/evidence-strength-analyzer';
import type { ClassifiedEvidence } from '@/lib/agent/doc-analyzer/core/types';

describe('EvidenceStrengthAnalyzer', () => {
  let analyzer: EvidenceStrengthAnalyzer;

  beforeEach(() => {
    analyzer = new EvidenceStrengthAnalyzer();
  });

  describe('calculateStrength', () => {
    it('应该评估直接证据的强度', () => {
      const evidence = '合同原件';
      const type = 'DOCUMENTARY_EVIDENCE';
      const strength = analyzer.calculateStrength(evidence, type);

      expect(strength).toBeGreaterThanOrEqual(1);
      expect(strength).toBeLessThanOrEqual(5);
    });

    it('应该评估证人证言的强度', () => {
      const evidence = '证人张三的证言';
      const type = 'WITNESS_TESTIMONY';
      const strength = analyzer.calculateStrength(evidence, type);

      expect(strength).toBeGreaterThanOrEqual(1);
      expect(strength).toBeLessThanOrEqual(5);
    });

    it('应该评估鉴定意见的强度', () => {
      const evidence = '鉴定机构的评估报告';
      const type = 'EXPERT_OPINION';
      const strength = analyzer.calculateStrength(evidence, type);

      expect(strength).toBeGreaterThanOrEqual(1);
      expect(strength).toBeLessThanOrEqual(5);
    });

    it('应该处理空文本', () => {
      const evidence = '';
      const type = 'DOCUMENTARY_EVIDENCE';
      const strength = analyzer.calculateStrength(evidence, type);

      // 空文本会根据类型返回基础分（DOCUMENTARY_EVIDENCE为2 + 类型权重3 = 5，再减去长度扣分0.5 = 4.5）
      expect(strength).toBeGreaterThanOrEqual(1);
      expect(strength).toBeLessThanOrEqual(5);
    });
  });

  describe('calculateReliability', () => {
    it('应该评估证据可靠性', () => {
      const evidence = '经过公证的合同书';
      const reliability = analyzer.calculateReliability(evidence);

      expect(reliability).toBeGreaterThanOrEqual(0);
      expect(reliability).toBeLessThanOrEqual(1);
    });

    it('应该降低模糊证据的可靠性', () => {
      const vagueEvidence = '据称有一些证据';
      const reliability = analyzer.calculateReliability(vagueEvidence);

      expect(reliability).toBeLessThan(0.8);
    });

    it('应该提高具体证据的可靠性', () => {
      const specificEvidence = '编号为ABC-2024-001的合同原件';
      const reliability = analyzer.calculateReliability(specificEvidence);

      expect(reliability).toBeGreaterThanOrEqual(0.5);
    });

    it('应该处理空文本', () => {
      const reliability = analyzer.calculateReliability('');
      // 空文本返回基础可靠性0.5
      expect(reliability).toBe(0.5);
    });
  });

  describe('assessQuality', () => {
    it('应该评估证据整体质量', () => {
      const evidence: ClassifiedEvidence = {
        id: 'ev_1',
        type: 'DOCUMENTARY_EVIDENCE',
        content: '经过公证的合同原件',
        source: '诉讼请求证据',
        strength: 5,
        reliability: 0.9,
        relatedTo: [],
      };

      const result = analyzer.assessQuality(evidence);

      expect(result.strength).toBe(5);
      expect(result.reliability).toBe(0.9);
      expect(result.qualityScore).toBeGreaterThan(0.5);
      expect(result.qualityScore).toBeLessThanOrEqual(1);
      expect(['STRONG', 'MODERATE', 'WEAK'].includes(result.grade)).toBe(true);
    });

    it('应该评估弱证据', () => {
      const evidence: ClassifiedEvidence = {
        id: 'ev_1',
        type: 'DOCUMENTARY_EVIDENCE',
        content: '复印件',
        source: '争议焦点证据',
        strength: 1,
        reliability: 0.5,
        relatedTo: [],
      };

      const result = analyzer.assessQuality(evidence);

      expect(result.strength).toBe(1);
      expect(result.reliability).toBe(0.5);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(0.5);
      expect(result.grade).toBe('WEAK');
    });
  });

  describe('generateSuggestions', () => {
    it('应该生成证据质量建议', () => {
      const evidence: ClassifiedEvidence = {
        id: 'ev_1',
        type: 'DOCUMENTARY_EVIDENCE',
        content: '复印件',
        source: '诉讼请求证据',
        strength: 2,
        reliability: 0.4,
        relatedTo: [],
      };

      const suggestions = analyzer.generateSuggestions(evidence);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('应该为书证提供具体建议', () => {
      const evidence: ClassifiedEvidence = {
        id: 'ev_1',
        type: 'DOCUMENTARY_EVIDENCE',
        content: '打印件',
        source: '诉讼请求证据',
        strength: 3,
        reliability: 0.6,
        relatedTo: [],
      };

      const suggestions = analyzer.generateSuggestions(evidence);

      expect(
        suggestions.some(s => s.includes('原件') || s.includes('公证'))
      ).toBe(true);
    });

    it('应该为证人证言提供具体建议', () => {
      const evidence: ClassifiedEvidence = {
        id: 'ev_1',
        type: 'WITNESS_TESTIMONY',
        content: '证人张三的口头证言',
        source: '争议焦点证据',
        strength: 3,
        reliability: 0.6,
        relatedTo: [],
      };

      const suggestions = analyzer.generateSuggestions(evidence);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('书面'))).toBe(true);
    });
  });

  describe('边界情况', () => {
    it('应该处理特殊字符', () => {
      const reliability =
        analyzer.calculateReliability('证据包含\n\t\r特殊字符！');
      expect(reliability).toBeDefined();
      expect(reliability).toBeGreaterThanOrEqual(0);
      expect(reliability).toBeLessThanOrEqual(1);
    });

    it('应该处理超长文本', () => {
      const longText = '证据描述'.repeat(1000);
      const strength = analyzer.calculateStrength(
        longText,
        'DOCUMENTARY_EVIDENCE'
      );
      expect(strength).toBeGreaterThanOrEqual(1);
      expect(strength).toBeLessThanOrEqual(5);
    });
  });
});
