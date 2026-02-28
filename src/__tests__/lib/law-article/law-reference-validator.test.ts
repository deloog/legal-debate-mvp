/**
 * 法条引用强制验证机制 - 单元测试
 *
 * 测试 LawReferenceValidator 服务的功能：
 * 1. 验证法条存在性 - 检查引用的法条是否在数据库中存在
 * 2. 验证内容准确性 - 检查法条内容是否正确
 * 3. 验证效力状态 - 检查法条是否有效（VALID, EXPIRED, AMENDED, REPEALED）
 * 4. 无法验证时标记为"未经核实"
 *
 * @jest-environment node
 */

import { LawReferenceValidator } from '@/lib/law-article/law-reference-validator';
import { prisma } from '@/lib/db';
import { LawArticle, LegalReference, LegalReferenceStatus, LawStatus } from '@prisma/client';

describe('LawReferenceValidator', () => {
  let validator: LawReferenceValidator;

  // 测试数据
  const validLawArticle: LawArticle = {
    id: 'valid-article-1',
    lawName: '中华人民共和国民法典',
    articleNumber: '第一千一百七十三条',
    fullText: '被侵权人对同一损害的发生或者扩大有过错的，可以减轻侵权人的责任。',
    lawType: 'LAW' as const,
    category: 'CIVIL' as const,
    subCategory: null,
    tags: ['侵权', '过错'],
    keywords: ['侵权', '过错', '减轻责任'],
    version: '1.0',
    effectiveDate: new Date('2021-01-01'),
    expiryDate: null,
    status: LawStatus.VALID,
    amendmentHistory: null,
    parentId: null,
    chapterNumber: null,
    sectionNumber: null,
    level: 0,
    issuingAuthority: '全国人民代表大会',
    jurisdiction: null,
    relatedArticles: [],
    legalBasis: null,
    searchableText: '',
    viewCount: 0,
    referenceCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    dataSource: 'local',
    sourceId: null,
    importedAt: null,
    lastSyncedAt: null,
    syncStatus: 'SYNCED' as const,
  };

  const repealedLawArticle: LawArticle = {
    ...validLawArticle,
    id: 'repealed-article-1',
    lawName: '中华人民共和国民法通则',
    articleNumber: '第一百三十五条',
    fullText: '向人民法院请求保护民事权利的诉讼时效期间为二年，法律另有规定的除外。',
    status: LawStatus.REPEALED,
    effectiveDate: new Date('1987-01-01'),
    expiryDate: new Date('2021-01-01'),
  };

  const amendedLawArticle: LawArticle = {
    ...validLawArticle,
    id: 'amended-article-1',
    lawName: '中华人民共和国刑法',
    articleNumber: '第六十五条',
    fullText: '被判处有期徒刑以上刑罚的犯罪分子，刑罚执行完毕或者赦免以后，在五年以内再犯应当判处有期徒刑以上刑罚之罪的，是累犯，应当从重处罚，但是过失犯罪和不满十八周岁的人犯罪的除外。',
    status: LawStatus.AMENDED,
    effectiveDate: new Date('2015-08-29'),
    expiryDate: null,
  };

  const expiredLawArticle: LawArticle = {
    ...validLawArticle,
    id: 'expired-article-1',
    lawName: '某条例',
    articleNumber: '第十条',
    fullText: '临时性法规条款',
    status: LawStatus.EXPIRED,
    effectiveDate: new Date('2000-01-01'),
    expiryDate: new Date('2010-01-01'),
  };

  // DRAFT状态法条（用于测试）
  const draftLawArticle: LawArticle = {
    ...validLawArticle,
    id: 'draft-article-1',
    lawName: '某草案法',
    articleNumber: '第一条',
    fullText: '草案内容',
    status: LawStatus.DRAFT,
    effectiveDate: new Date('2030-01-01'),
    expiryDate: null,
  };

  // 未知状态法条（用于测试default分支）
  const unknownStatusArticle: LawArticle = {
    ...validLawArticle,
    id: 'unknown-article-1',
    lawName: '某法律',
    articleNumber: '第九十九条',
    fullText: '法律内容',
    status: 'UNKNOWN_STATUS' as LawStatus,
    effectiveDate: new Date('2020-01-01'),
    expiryDate: null,
  };

  beforeEach(() => {
    validator = new LawReferenceValidator();
    jest.resetAllMocks();
  });

  describe('1. 法条存在性验证', () => {
    it('应该验证通过：存在的有效法条引用', async () => {
      // Mock数据库返回存在的法条
      jest.spyOn(prisma.lawArticle, 'findFirst').mockResolvedValue(validLawArticle);

      const reference: Partial<LegalReference> = {
        id: 'ref-1',
        lawType: 'LAW',
        articleNumber: '第一千一百七十三条',
        content: '被侵权人对同一损害的发生或者扩大有过错的，可以减轻侵权人的责任。',
      };

      const result = await validator.validateReference(reference as LegalReference);

      expect(result.isValid).toBe(true);
      expect(result.validationStatus).toBe('VERIFIED');
      expect(result.articleId).toBe(validLawArticle.id);
      expect(result.errorMessage).toBeNull();
    });

    it('应该验证失败：不存在的法条引用', async () => {
      // Mock数据库返回null（法条不存在）
      jest.spyOn(prisma.lawArticle, 'findFirst').mockResolvedValue(null);

      const reference: Partial<LegalReference> = {
        id: 'ref-2',
        lawType: 'LAW',
        articleNumber: '不存在的法条',
        content: '一些法条内容',
      };

      const result = await validator.validateReference(reference as LegalReference);

      expect(result.isValid).toBe(false);
      expect(result.validationStatus).toBe('UNVERIFIED');
      expect(result.errorMessage).toContain('未找到');
    });

    it('应该验证失败：缺少法条编号', async () => {
      const reference: Partial<LegalReference> = {
        id: 'ref-3',
        lawType: 'LAW',
        articleNumber: '',
        content: '一些法条内容',
      };

      const result = await validator.validateReference(reference as LegalReference);

      expect(result.isValid).toBe(false);
      expect(result.validationStatus).toBe('INVALID');
      expect(result.errorMessage).toContain('法条编号');
    });
  });

  describe('2. 法条效力状态验证', () => {
    it('应该验证通过：有效法条', async () => {
      jest.spyOn(prisma.lawArticle, 'findFirst').mockResolvedValue(validLawArticle);

      const reference: Partial<LegalReference> = {
        id: 'ref-4',
        lawType: 'LAW',
        articleNumber: '第一千一百七十三条',
        content: validLawArticle.fullText,
      };

      const result = await validator.validateReference(reference as LegalReference);

      expect(result.isValid).toBe(true);
      expect(result.lawStatus).toBe('VALID');
    });

    it('应该验证失败：已废止法条', async () => {
      jest.spyOn(prisma.lawArticle, 'findFirst').mockResolvedValue(repealedLawArticle);

      const reference: Partial<LegalReference> = {
        id: 'ref-5',
        lawType: 'LAW',
        articleNumber: '第一百三十五条',
        content: repealedLawArticle.fullText,
      };

      const result = await validator.validateReference(reference as LegalReference);

      expect(result.isValid).toBe(false);
      expect(result.lawStatus).toBe('REPEALED');
      expect(result.errorMessage).toContain('废止');
    });

    it('应该验证失败：已修订法条', async () => {
      jest.spyOn(prisma.lawArticle, 'findFirst').mockResolvedValue(amendedLawArticle);

      const reference: Partial<LegalReference> = {
        id: 'ref-6',
        lawType: 'LAW',
        articleNumber: '第六十五条',
        content: amendedLawArticle.fullText,
      };

      const result = await validator.validateReference(reference as LegalReference);

      expect(result.isValid).toBe(false);
      expect(result.lawStatus).toBe('AMENDED');
      expect(result.errorMessage).toContain('修订');
    });

    it('应该验证失败：已过期法条', async () => {
      jest.spyOn(prisma.lawArticle, 'findFirst').mockResolvedValue(expiredLawArticle);

      const reference: Partial<LegalReference> = {
        id: 'ref-7',
        lawType: 'LAW',
        articleNumber: '第十条',
        content: expiredLawArticle.fullText,
      };

      const result = await validator.validateReference(reference as LegalReference);

      expect(result.isValid).toBe(false);
      expect(result.lawStatus).toBe('EXPIRED');
      expect(result.errorMessage).toContain('过期');
    });

    it('应该验证失败：草案法条', async () => {
      jest.spyOn(prisma.lawArticle, 'findFirst').mockResolvedValue(draftLawArticle);

      const reference: Partial<LegalReference> = {
        id: 'ref-draft',
        lawType: 'LAW',
        articleNumber: '第一条',
        content: draftLawArticle.fullText,
      };

      const result = await validator.validateReference(reference as LegalReference);

      expect(result.isValid).toBe(false);
      expect(result.lawStatus).toBe('DRAFT');
      expect(result.errorMessage).toContain('草案');
    });

    it('应该验证失败：未知状态法条', async () => {
      jest.spyOn(prisma.lawArticle, 'findFirst').mockResolvedValue(unknownStatusArticle);

      const reference: Partial<LegalReference> = {
        id: 'ref-unknown',
        lawType: 'LAW',
        articleNumber: '第九十九条',
        content: unknownStatusArticle.fullText,
      };

      const result = await validator.validateReference(reference as LegalReference);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('未知');
    });
  });

  describe('3. 法条内容准确性验证', () => {
    it('应该验证通过：内容完全匹配', async () => {
      jest.spyOn(prisma.lawArticle, 'findFirst').mockResolvedValue(validLawArticle);

      const reference: Partial<LegalReference> = {
        id: 'ref-8',
        lawType: 'LAW',
        articleNumber: '第一千一百七十三条',
        content: validLawArticle.fullText,
      };

      const result = await validator.validateReference(reference as LegalReference);

      expect(result.contentMatch).toBe(true);
      expect(result.similarityScore).toBe(1.0);
    });

    it('应该验证通过：内容部分匹配（相似度>0.8）', async () => {
      jest.spyOn(prisma.lawArticle, 'findFirst').mockResolvedValue(validLawArticle);

      const reference: Partial<LegalReference> = {
        id: 'ref-9',
        lawType: 'LAW',
        articleNumber: '第一千一百七十三条',
        content: '被侵权人对同一损害的发生有过错的，可以减轻侵权人的责任。', // 简化版本
      };

      const result = await validator.validateReference(reference as LegalReference);

      expect(result.contentMatch).toBe(true);
      expect(result.similarityScore).toBeGreaterThan(0.8);
    });

    it('应该验证失败：内容不匹配（相似度<0.5）', async () => {
      jest.spyOn(prisma.lawArticle, 'findFirst').mockResolvedValue(validLawArticle);

      const reference: Partial<LegalReference> = {
        id: 'ref-10',
        lawType: 'LAW',
        articleNumber: '第一千一百七十三条',
        content: '这是完全不同的法条内容，关于合同违约责任的规定。',
      };

      const result = await validator.validateReference(reference as LegalReference);

      expect(result.contentMatch).toBe(false);
      expect(result.similarityScore).toBeLessThan(0.5);
      expect(result.errorMessage).toContain('内容不匹配');
    });
  });

  describe('4. 批量验证', () => {
    it('应该批量验证多个法条引用', async () => {
      jest.spyOn(prisma.lawArticle, 'findFirst')
        .mockResolvedValueOnce(validLawArticle)
        .mockResolvedValueOnce(null);

      const references: Partial<LegalReference>[] = [
        {
          id: 'ref-11',
          lawType: 'LAW',
          articleNumber: '第一千一百七十三条',
          content: validLawArticle.fullText,
        },
        {
          id: 'ref-12',
          lawType: 'LAW',
          articleNumber: '不存在的法条',
          content: '一些内容',
        },
      ];

      const results = await validator.validateReferences(references as LegalReference[]);

      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
    });

    it('应该返回批量验证统计信息', async () => {
      // 调用顺序分析：
      // 1. ref-13: 精确匹配articleNumber="第一千一百七十三条" -> 返回validLawArticle -> 找到，停止
      // 2. ref-14: 精确匹配articleNumber="第一百三十五条" -> 返回null -> 继续模糊匹配
      // 3. ref-14: 模糊匹配 -> 返回repealedLawArticle -> 找到，停止
      // 4. ref-15: 精确匹配articleNumber="不存在" -> 返回null -> 继续模糊匹配
      // 5. ref-15: 模糊匹配 -> 返回null -> 没找到
      jest.spyOn(prisma.lawArticle, 'findFirst')
        .mockResolvedValueOnce(validLawArticle)   // ref-13 精确
        .mockResolvedValueOnce(null)              // ref-14 精确
        .mockResolvedValueOnce(repealedLawArticle) // ref-14 模糊
        .mockResolvedValueOnce(null)              // ref-15 精确
        .mockResolvedValueOnce(null);             // ref-15 模糊

      const references: Partial<LegalReference>[] = [
        {
          id: 'ref-13',
          lawType: 'LAW',
          articleNumber: '第一千一百七十三条',
          content: validLawArticle.fullText,
        },
        {
          id: 'ref-14',
          lawType: 'LAW',
          articleNumber: '第一百三十五条',
          content: repealedLawArticle.fullText,
        },
        {
          id: 'ref-15',
          lawType: 'LAW',
          articleNumber: '不存在',
          content: '内容',
        },
      ];

      const stats = await validator.getValidationStats(references as LegalReference[]);

      // 验证统计结果
      // ref-13: 有效法条 -> valid
      // ref-14: 已废止法条 -> invalid
      // ref-15: 找不到法条 -> unverified
      expect(stats.total).toBe(3);
      expect(stats.valid).toBe(1);
      expect(stats.invalid).toBe(1);
      expect(stats.unverified).toBe(1);
      expect(stats.verificationRate).toBeCloseTo(33.33, 1);
    });
  });

  describe('5. 错误处理', () => {
    it('应该处理数据库查询异常', async () => {
      jest.spyOn(prisma.lawArticle, 'findFirst').mockRejectedValue(new Error('数据库错误'));

      const reference: Partial<LegalReference> = {
        id: 'ref-16',
        lawType: 'LAW',
        articleNumber: '第一千一百七十三条',
        content: '内容',
      };

      await expect(validator.validateReference(reference as LegalReference)).rejects.toThrow('数据库错误');
    });

    it('应该处理空引用对象', async () => {
      const reference: Partial<LegalReference> = {
        id: 'ref-17',
      };

      const result = await validator.validateReference(reference as LegalReference);

      expect(result.isValid).toBe(false);
      expect(result.validationStatus).toBe('INVALID');
    });
  });
});
