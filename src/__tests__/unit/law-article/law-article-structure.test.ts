import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { PrismaClient, LawType, LawCategory, LawStatus, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

describe('LawArticle表结构验证测试', () => {
  beforeEach(async () => {
    // 每个测试前清理数据
    await prisma.lawArticle.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('基础字段验证', () => {
    it('应该能够创建完整的法条记录', async () => {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '中华人民共和国民法典',
          articleNumber: '第一百八十八条',
          fullText: '民事主体从事民事活动，应当遵循诚信原则，秉持诚实，恪守承诺。',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          subCategory: '总则编',
          tags: ['诚信原则', '民事活动'],
          keywords: ['诚信', '承诺'],
          version: '1.0',
          effectiveDate: new Date('2021-01-01'),
          expiryDate: null,
          status: LawStatus.VALID,
          amendmentHistory: { changes: [] },
          parentId: null,
          chapterNumber: '第一章',
          sectionNumber: '第一节',
          level: 0,
          issuingAuthority: '全国人民代表大会',
          jurisdiction: '全国',
          relatedArticles: [],
          legalBasis: '宪法',
          searchableText: '民事主体从事民事活动应当遵循诚信原则秉持诚实恪守承诺',
          viewCount: 0,
          referenceCount: 0,
        },
      });

      expect(article.id).toBeDefined();
      expect(article.lawName).toBe('中华人民共和国民法典');
      expect(article.articleNumber).toBe('第一百八十八条');
      expect(article.fullText).toContain('诚信原则');
    });

    it('应该支持nullable字段为空', async () => {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '中华人民共和国刑法',
          articleNumber: '第一条',
          fullText: '为了惩罚犯罪，保护人民，根据宪法，结合我国同犯罪作斗争的具体经验及实际情况，制定本法。',
          lawType: LawType.LAW,
          category: LawCategory.CRIMINAL,
          tags: ['犯罪', '惩罚'],
          keywords: ['犯罪', '保护人民'],
          version: '1.0',
          effectiveDate: new Date('2020-07-01'),
          status: LawStatus.VALID,
          issuingAuthority: '全国人民代表大会',
          searchableText: '为了惩罚犯罪保护人民根据宪法结合我国同犯罪作斗争的具体经验及实际情况制定本法',
        },
      });

      expect(article.subCategory).toBeNull();
      expect(article.expiryDate).toBeNull();
      expect(article.parentId).toBeNull();
      expect(article.chapterNumber).toBeNull();
      expect(article.sectionNumber).toBeNull();
      expect(article.jurisdiction).toBeNull();
      expect(article.legalBasis).toBeNull();
    });
  });

  describe('枚举类型验证', () => {
    it('应该支持所有LawType枚举值', async () => {
      const lawTypes = [
        LawType.CONSTITUTION,
        LawType.LAW,
        LawType.ADMINISTRATIVE_REGULATION,
        LawType.LOCAL_REGULATION,
        LawType.JUDICIAL_INTERPRETATION,
        LawType.DEPARTMENTAL_RULE,
        LawType.OTHER,
      ];

      for (const lawType of lawTypes) {
        await prisma.lawArticle.create({
          data: {
            lawName: `测试法律_${lawType}`,
            articleNumber: '第一条',
            fullText: '测试法条内容',
            lawType,
            category: LawCategory.CIVIL,
            tags: ['测试'],
            keywords: ['测试'],
            version: '1.0',
            effectiveDate: new Date(),
            status: LawStatus.VALID,
            issuingAuthority: '测试机构',
            searchableText: '测试法条内容',
          },
        });
      }

      const count = await prisma.lawArticle.count({
        where: { lawType: { in: lawTypes } },
      });
      expect(count).toBe(lawTypes.length);
    });

    it('应该支持所有LawCategory枚举值', async () => {
      const categories = [
        LawCategory.CIVIL,
        LawCategory.CRIMINAL,
        LawCategory.ADMINISTRATIVE,
        LawCategory.COMMERCIAL,
        LawCategory.ECONOMIC,
        LawCategory.LABOR,
        LawCategory.INTELLECTUAL_PROPERTY,
        LawCategory.PROCEDURE,
        LawCategory.OTHER,
      ];

      for (const category of categories) {
        await prisma.lawArticle.create({
          data: {
            lawName: `测试法律_${category}`,
            articleNumber: '第一条',
            fullText: '测试法条内容',
            lawType: LawType.LAW,
            category,
            tags: ['测试'],
            keywords: ['测试'],
            version: '1.0',
            effectiveDate: new Date(),
            status: LawStatus.VALID,
            issuingAuthority: '测试机构',
            searchableText: '测试法条内容',
          },
        });
      }

      const count = await prisma.lawArticle.count({
        where: { category: { in: categories } },
      });
      expect(count).toBe(categories.length);
    });

    it('应该支持所有LawStatus枚举值', async () => {
      const statuses = [
        LawStatus.DRAFT,
        LawStatus.VALID,
        LawStatus.AMENDED,
        LawStatus.REPEALED,
        LawStatus.EXPIRED,
      ];

      for (const status of statuses) {
        await prisma.lawArticle.create({
          data: {
            lawName: `测试法律_${status}`,
            articleNumber: '第一条',
            fullText: '测试法条内容',
            lawType: LawType.LAW,
            category: LawCategory.CIVIL,
            tags: ['测试'],
            keywords: ['测试'],
            version: '1.0',
            effectiveDate: new Date(),
            status,
            issuingAuthority: '测试机构',
            searchableText: '测试法条内容',
          },
        });
      }

      const count = await prisma.lawArticle.count({
        where: { status: { in: statuses } },
      });
      expect(count).toBe(statuses.length);
    });
  });

  describe('数组字段验证', () => {
    it('应该支持tags数组', async () => {
      const tags = ['诚信原则', '民事活动', '法律义务'];
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags,
          keywords: ['诚信'],
          version: '1.0',
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '测试机构',
          searchableText: '测试法条内容',
        },
      });

      expect(article.tags).toEqual(expect.arrayContaining(tags));
    });

    it('应该支持keywords数组', async () => {
      const keywords = ['诚信', '承诺', '民事'];
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['测试'],
          keywords,
          version: '1.0',
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '测试机构',
          searchableText: '测试法条内容',
        },
      });

      expect(article.keywords).toEqual(expect.arrayContaining(keywords));
    });

    it('应该支持relatedArticles数组', async () => {
      const relatedArticles = ['cuid1', 'cuid2', 'cuid3'];
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['测试'],
          keywords: ['测试'],
          version: '1.0',
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '测试机构',
          searchableText: '测试法条内容',
          relatedArticles,
        },
      });

      expect(article.relatedArticles).toEqual(expect.arrayContaining(relatedArticles));
    });
  });

  describe('JSON字段验证', () => {
    it('应该支持amendmentHistory JSON字段', async () => {
      const amendmentHistory = {
        version: '2.0',
        amendedDate: '2023-01-01',
        changes: ['修改了第一条', '增加了第二条'],
      };

      const article = await prisma.lawArticle.create({
        data: {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['测试'],
          keywords: ['测试'],
          version: '1.0',
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '测试机构',
          amendmentHistory,
          searchableText: '测试法条内容',
        },
      });

      expect(article.amendmentHistory).toEqual(amendmentHistory);
    });
  });

  describe('时间戳字段验证', () => {
    it('应该自动设置createdAt和updatedAt', async () => {
      const beforeCreate = new Date();
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['测试'],
          keywords: ['测试'],
          version: '1.0',
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '测试机构',
          searchableText: '测试法条内容',
        },
      });

      expect(article.createdAt).toBeDefined();
      expect(article.updatedAt).toBeDefined();
      expect(article.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(article.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    });

    it('应该在更新时自动更新updatedAt', async () => {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['测试'],
          keywords: ['测试'],
          version: '1.0',
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '测试机构',
          searchableText: '测试法条内容',
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100)); // 等待100ms

      const updated = await prisma.lawArticle.update({
        where: { id: article.id },
        data: { viewCount: 1 },
      });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(article.updatedAt.getTime());
    });
  });

  describe('层级关系验证', () => {
    it('应该支持父级法条关联', async () => {
      const parent = await prisma.lawArticle.create({
        data: {
          lawName: '中华人民共和国民法典',
          articleNumber: '第一章',
          fullText: '第一章内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['总则'],
          keywords: ['总则'],
          version: '1.0',
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '全国人民代表大会',
          level: 0,
          searchableText: '第一章内容',
        },
      });

      const child = await prisma.lawArticle.create({
        data: {
          lawName: '中华人民共和国民法典',
          articleNumber: '第一节',
          fullText: '第一节内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['基本规定'],
          keywords: ['基本规定'],
          version: '1.0',
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '全国人民代表大会',
          parentId: parent.id,
          level: 1,
          searchableText: '第一节内容',
        },
      });

      expect(child.parentId).toBe(parent.id);
    });

    it('应该支持子法条关联', async () => {
      const parent = await prisma.lawArticle.create({
        data: {
          lawName: '中华人民共和国民法典',
          articleNumber: '第一章',
          fullText: '第一章内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['总则'],
          keywords: ['总则'],
          version: '1.0',
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '全国人民代表大会',
          level: 0,
          searchableText: '第一章内容',
        },
      });

      await prisma.lawArticle.create({
        data: {
          lawName: '中华人民共和国民法典',
          articleNumber: '第一节',
          fullText: '第一节内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['基本规定'],
          keywords: ['基本规定'],
          version: '1.0',
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '全国人民代表大会',
          parentId: parent.id,
          level: 1,
          searchableText: '第一节内容',
        },
      });

      const children = await prisma.lawArticle.findMany({
        where: { parentId: parent.id },
      });

      expect(children.length).toBe(1);
      expect(children[0].parentId).toBe(parent.id);
    });
  });

  describe('默认值验证', () => {
    it('应该设置version默认值为1.0', async () => {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['测试'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '测试机构',
          searchableText: '测试法条内容',
        },
      });

      expect(article.version).toBe('1.0');
    });

    it('应该设置status默认值为VALID', async () => {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['测试'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          issuingAuthority: '测试机构',
          searchableText: '测试法条内容',
        },
      });

      expect(article.status).toBe(LawStatus.VALID);
    });

    it('应该设置level默认值为0', async () => {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['测试'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '测试机构',
          searchableText: '测试法条内容',
        },
      });

      expect(article.level).toBe(0);
    });

    it('应该设置viewCount默认值为0', async () => {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['测试'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '测试机构',
          searchableText: '测试法条内容',
        },
      });

      expect(article.viewCount).toBe(0);
    });

    it('应该设置referenceCount默认值为0', async () => {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['测试'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: LawStatus.VALID,
          issuingAuthority: '测试机构',
          searchableText: '测试法条内容',
        },
      });

      expect(article.referenceCount).toBe(0);
    });
  });

  describe('必需字段验证', () => {
    const requiredFields = [
      'lawName',
      'articleNumber',
      'fullText',
      'lawType',
      'category',
      'effectiveDate',
      'issuingAuthority',
      'searchableText',
    ];

    requiredFields.forEach((field) => {
      it(`应该要求${field}字段`, async () => {
        const data: any = {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          effectiveDate: new Date(),
          issuingAuthority: '测试机构',
          searchableText: '测试法条内容',
        };

        delete data[field];

        await expect(
          prisma.lawArticle.create({ data }),
        ).rejects.toThrow();
      });
    });

    it('应该允许tags数组为空', async () => {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: [],
          keywords: [],
          effectiveDate: new Date(),
          issuingAuthority: '测试机构',
          searchableText: '测试法条内容',
        },
      });

      expect(article.tags).toEqual([]);
    });

    it('应该允许keywords数组为空', async () => {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '测试法律',
          articleNumber: '第一条',
          fullText: '测试法条内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: [],
          keywords: [],
          effectiveDate: new Date(),
          issuingAuthority: '测试机构',
          searchableText: '测试法条内容',
        },
      });

      expect(article.keywords).toEqual([]);
    });
  });
});
