/**
 * 法律法规数据验证器测试
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { LawDataValidator } from '@/lib/crawler/data-validator';
import { CrawledLawArticle } from '@/lib/crawler/types';
import { LawCategory, LawType, LawStatus } from '@prisma/client';

describe('LawDataValidator', () => {
  let validator: LawDataValidator;

  beforeAll(() => {
    validator = new LawDataValidator();
  });

  describe('validate', () => {
    it('应该验证通过有效的法条数据', () => {
      const validData: CrawledLawArticle = {
        source: 'npc',
        sourceId: 'law-001',
        sourceUrl: 'http://example.com/law/1',
        lawName: '中华人民共和国民法典',
        articleNumber: '第1条',
        fullText:
          '为了保护民事主体的合法权益，调整民事关系，维护社会和经济秩序，适应中国特色社会主义发展要求，弘扬社会主义核心价值观，根据宪法，制定本法。',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
        status: LawStatus.VALID,
        issuingAuthority: '全国人民代表大会',
        effectiveDate: new Date('2021-01-01'),
        crawledAt: new Date(),
      };

      const result = validator.validate(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.quality.completeness).toBeGreaterThan(0.9);
    });

    it('应该拒绝缺少必填字段的数据', () => {
      const invalidData: Partial<CrawledLawArticle> = {
        lawName: '中华人民共和国民法典',
      };

      const result = validator.validate(invalidData as CrawledLawArticle);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该检测内容过短的情况', () => {
      const shortData: CrawledLawArticle = {
        source: 'npc',
        sourceId: 'law-001',
        lawName: '测试法律',
        articleNumber: '第1条',
        fullText: '短内容',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
        status: LawStatus.VALID,
        issuingAuthority: '全国人大',
        effectiveDate: new Date('2021-01-01'),
        crawledAt: new Date(),
      };

      const result = validator.validate(shortData);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('应该计算正确的数据质量分数', () => {
      const completeData: CrawledLawArticle = {
        source: 'npc',
        sourceId: 'law-001',
        sourceUrl: 'http://example.com/law/1',
        lawName: '中华人民共和国民法典',
        articleNumber: '第1条',
        fullText: '这是完整的法律条文内容，应该足够长以通过验证。'.repeat(10),
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
        subCategory: '总则',
        tags: ['民法', '基本法'],
        keywords: ['民事', '主体', '权利'],
        status: LawStatus.VALID,
        issuingAuthority: '全国人民代表大会',
        jurisdiction: '全国',
        effectiveDate: new Date('2021-01-01'),
        crawledAt: new Date(),
      };

      const result = validator.validate(completeData);

      expect(result.quality.completeness).toBeGreaterThanOrEqual(0.9);
      expect(result.quality.accuracy).toBe(1);
    });
  });

  describe('validateMany', () => {
    it('应该批量验证数据', () => {
      const datas: CrawledLawArticle[] = [
        {
          source: 'npc',
          sourceId: 'law-001',
          lawName: '法律1',
          articleNumber: '第1条',
          fullText: '内容1',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          status: LawStatus.VALID,
          issuingAuthority: '全国人大',
          effectiveDate: new Date('2021-01-01'),
          crawledAt: new Date(),
        },
        {
          source: 'npc',
          sourceId: 'law-002',
          lawName: '法律2',
          articleNumber: '第2条',
          fullText: '内容2',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          status: LawStatus.VALID,
          issuingAuthority: '全国人大',
          effectiveDate: new Date('2021-01-01'),
          crawledAt: new Date(),
        },
      ];

      const results = validator.validateMany(datas);

      expect(results.length).toBe(2);
      expect(results.every(r => r.isValid)).toBe(true);
    });
  });
});
