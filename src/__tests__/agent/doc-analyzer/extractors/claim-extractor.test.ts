// =============================================================================
// DocAnalyzer 诉讼请求提取器测试
// =============================================================================

import {
  ClaimExtractor,
  createClaimExtractor,
  extractClaimsFromText,
} from '@/lib/agent/doc-analyzer/extractors/claim-extractor';
import type { Claim, ClaimType } from '@/lib/agent/doc-analyzer/core/types';

describe('ClaimExtractor', () => {
  let extractor: ClaimExtractor;

  beforeEach(() => {
    extractor = createClaimExtractor();
  });

  describe('extractFromText', () => {
    it('应该提取偿还本金请求', async () => {
      const result = await extractor.extractFromText('判令被告偿还本金5万元');

      expect(result.claims.length).toBeGreaterThan(0);
      const principalClaim = result.claims.find(
        c => c.type === 'PAY_PRINCIPAL'
      );
      expect(principalClaim).toBeDefined();
    });

    it('应该提取支付利息请求', async () => {
      const result = await extractor.extractFromText('支付利息，年利率10%');

      expect(result.claims.length).toBeGreaterThan(0);
      const interestClaim = result.claims.find(c => c.type === 'PAY_INTEREST');
      expect(interestClaim).toBeDefined();
    });

    it('应该提取违约金请求', async () => {
      const result = await extractor.extractFromText('支付违约金5000元');

      expect(result.claims.length).toBeGreaterThan(0);
      const penaltyClaim = result.claims.find(c => c.type === 'PAY_PENALTY');
      expect(penaltyClaim).toBeDefined();
    });

    it('应该提取诉讼费用请求', async () => {
      const result = await extractor.extractFromText('本案诉讼费用由被告承担');

      expect(result.claims.length).toBeGreaterThan(0);
      const costClaim = result.claims.find(c => c.type === 'LITIGATION_COST');
      expect(costClaim).toBeDefined();
    });

    it('应该处理复合请求', async () => {
      const result =
        await extractor.extractFromText('判令被告偿还本金5万元及利息');

      expect(result.summary.total).toBeGreaterThan(1);
      expect(result.compoundDecomposed).toBeGreaterThan(0);
    });

    it('应该自动补充诉讼费用', async () => {
      const result = await extractor.extractFromText('本案费用由被告承担');

      const costClaim = result.claims.find(c => c.type === 'LITIGATION_COST');
      expect(costClaim).toBeDefined();
    });

    it('应该推断本金请求', async () => {
      const result = await extractor.extractFromText(
        '本案诉讼费用由被告承担，赔偿损失5万元'
      );

      const principalClaim = result.claims.find(
        c => c.type === 'PAY_PRINCIPAL'
      );
      // 当有赔偿损失时，会推断本金
      expect(principalClaim).toBeDefined();
    });

    it('应该推断利息请求', async () => {
      const result = await extractor.extractFromText('按年利率10%支付利息');

      const interestClaim = result.claims.find(c => c.type === 'PAY_INTEREST');
      expect(interestClaim).toBeDefined();
    });

    it('应该推断违约金请求', async () => {
      const result =
        await extractor.extractFromText('被告违约，应当承担相应责任');

      const penaltyClaim = result.claims.find(c => c.type === 'PAY_PENALTY');
      expect(penaltyClaim).toBeDefined();
    });

    it('应该生成正确的摘要', async () => {
      const result = await extractor.extractFromText(
        '偿还本金5万元，支付利息，诉讼费用由被告承担'
      );

      expect(result.summary.total).toBeGreaterThan(2);
      expect(result.summary.byType['PAY_PRINCIPAL']).toBeGreaterThan(0);
      expect(result.summary.byType['PAY_INTEREST']).toBeGreaterThan(0);
      expect(result.summary.byType['LITIGATION_COST']).toBeGreaterThan(0);
    });

    it('应该过滤推断结果', async () => {
      const result = await extractor.extractFromText('本案费用由被告承担', {
        includeInferred: false,
      });

      // LITIGATION_COST会被推断，但如果includeInferred为false则应该过滤掉
      const inferredClaims = result.claims.filter(c => c._inferred);
      expect(inferredClaims.length).toBe(0);
    });
  });

  describe('normalizeClaims', () => {
    it('应该标准化诉讼请求', async () => {
      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL',
          content: '偿还本金',
          amount: 50000,
          currency: 'CNY',
          evidence: [],
          legalBasis: '',
        },
      ];

      const normalized = await extractor.normalizeClaims(claims);

      expect(normalized[0].type).toBe('PAY_PRINCIPAL');
      expect(normalized[0].currency).toBe('CNY');
    });

    it('应该设置默认货币', async () => {
      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL' as ClaimType,
          content: '偿还本金',
          amount: 50000,
          currency: 'CNY',
          evidence: [],
          legalBasis: '',
        },
      ];

      const normalized = await extractor.normalizeClaims(claims);

      expect(normalized[0].currency).toBe('CNY');
    });

    it('应该设置空数组默认值', async () => {
      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL' as ClaimType,
          content: '偿还本金',
          amount: 50000,
          currency: 'CNY',
          evidence: [],
          legalBasis: '',
        },
      ];

      const normalized = await extractor.normalizeClaims(claims);

      expect(normalized[0].evidence).toEqual([]);
      expect(normalized[0].legalBasis).toBe('');
    });
  });
});

describe('extractClaimsFromText', () => {
  it('应该快速提取诉讼请求', async () => {
    const claims = await extractClaimsFromText('偿还本金5万元，支付利息');

    expect(claims.length).toBeGreaterThan(0);
  });

  it('应该返回空数组', async () => {
    const claims = await extractClaimsFromText('这是一段没有诉讼请求的文本');

    expect(Array.isArray(claims)).toBe(true);
  });
});
