/**
 * 数据生成器测试
 * 遵循TDD原则：先测试后实现
 */

import { DataGenerator } from './data-generator';
import {
  TestArticle,
  TestRelation,
  DataScale,
} from './types';

describe('DataGenerator', () => {
  describe('generateArticles', () => {
    it('应该生成指定数量的法条', () => {
      const count = 100;
      const articles = DataGenerator.generateArticles(count);

      expect(articles).toHaveLength(count);
      expect(articles.every((art: TestArticle) => art.id)).toBeTruthy();
    });

    it('应该生成包含必要字段的法条', () => {
      const articles = DataGenerator.generateArticles(10);

      articles.forEach((article: TestArticle) => {
        expect(article).toHaveProperty('id');
        expect(article).toHaveProperty('lawName');
        expect(article).toHaveProperty('articleNumber');
        expect(article).toHaveProperty('category');
        expect(article).toHaveProperty('lawType');
        expect(article).toHaveProperty('fullText');
        expect(article).toHaveProperty('effectiveDate');
      });
    });

    it('应该生成有效的法条类别', () => {
      const articles = DataGenerator.generateArticles(100);
      const validCategories = [
        'CIVIL',
        'CRIMINAL',
        'ADMINISTRATIVE',
        'COMMERCIAL',
        'ECONOMIC',
        'LABOR',
        'INTELLECTUAL_PROPERTY',
        'PROCEDURE',
        'OTHER',
      ];

      articles.forEach((article: TestArticle) => {
        expect(validCategories).toContain(article.category);
      });
    });

    it('应该生成不同的法条ID', () => {
      const articles = DataGenerator.generateArticles(100);
      const ids = articles.map((art: TestArticle) => art.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(100);
    });

    it('应该生成合理的全文长度', () => {
      const articles = DataGenerator.generateArticles(10);

      articles.forEach((article: TestArticle) => {
        expect(article.fullText.length).toBeGreaterThan(50);
        expect(article.fullText.length).toBeLessThan(2000);
      });
    });
  });

  describe('generateRelations', () => {
    let testArticles: TestArticle[];

    beforeEach(() => {
      testArticles = DataGenerator.generateArticles(100);
    });

    it('应该生成指定数量的关系', () => {
      const count = 500;
      const relations = DataGenerator.generateRelations(count, testArticles);

      expect(relations).toHaveLength(count);
    });

    it('应该生成包含必要字段的关系', () => {
      const relations = DataGenerator.generateRelations(10, testArticles);

      relations.forEach((relation: TestRelation) => {
        expect(relation).toHaveProperty('id');
        expect(relation).toHaveProperty('sourceId');
        expect(relation).toHaveProperty('targetId');
        expect(relation).toHaveProperty('relationType');
        expect(relation).toHaveProperty('strength');
        expect(relation).toHaveProperty('confidence');
        expect(relation).toHaveProperty('verificationStatus');
      });
    });

    it('应该使用存在的法条ID', () => {
      const relations = DataGenerator.generateRelations(100, testArticles);
      const articleIds = new Set(testArticles.map((art: TestArticle) => art.id));

      relations.forEach((relation: TestRelation) => {
        expect(articleIds.has(relation.sourceId)).toBeTruthy();
        expect(articleIds.has(relation.targetId)).toBeTruthy();
      });
    });

    it('应该避免自引用', () => {
      const relations = DataGenerator.generateRelations(100, testArticles);

      relations.forEach((relation: TestRelation) => {
        expect(relation.sourceId).not.toBe(relation.targetId);
      });
    });

    it('应该生成有效的关系类型', () => {
      const relations = DataGenerator.generateRelations(100, testArticles);
      const validTypes = [
        'CITES',
        'CITED_BY',
        'CONFLICTS',
        'COMPLETES',
        'COMPLETED_BY',
        'SUPERSEDES',
        'SUPERSEDED_BY',
        'IMPLEMENTS',
        'IMPLEMENTED_BY',
        'RELATED',
      ];

      relations.forEach((relation: TestRelation) => {
        expect(validTypes).toContain(relation.relationType);
      });
    });

    it('应该生成有效的强度和置信度', () => {
      const relations = DataGenerator.generateRelations(100, testArticles);

      relations.forEach((relation: TestRelation) => {
        expect(relation.strength).toBeGreaterThanOrEqual(0);
        expect(relation.strength).toBeLessThanOrEqual(1);
        expect(relation.confidence).toBeGreaterThanOrEqual(0);
        expect(relation.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('generateTestDataset', () => {
    it('应该生成指定规模的数据集', () => {
      const scale: DataScale = {
        articleCount: 1000,
        relationCount: 10000,
        avgRelationsPerArticle: 10,
        averageDegree: 20,
      };

      const dataset = DataGenerator.generateTestDataset(scale);

      expect(dataset.articles).toHaveLength(scale.articleCount);
      expect(dataset.relations).toHaveLength(scale.relationCount);
    });

    it('应该生成完整的数据集', () => {
      const scale: DataScale = {
        articleCount: 100,
        relationCount: 500,
        avgRelationsPerArticle: 5,
        averageDegree: 10,
      };

      const dataset = DataGenerator.generateTestDataset(scale);

      expect(dataset).toHaveProperty('articles');
      expect(dataset).toHaveProperty('relations');
      expect(dataset.articles.length).toBeGreaterThan(0);
      expect(dataset.relations.length).toBeGreaterThan(0);
    });

    it('应该计算正确的平均度数', () => {
      const scale: DataScale = {
        articleCount: 100,
        relationCount: 500,
        avgRelationsPerArticle: 5,
        averageDegree: 10,
      };

      const dataset = DataGenerator.generateTestDataset(scale);

      // 计算实际平均度数
      const degreeMap = new Map<string, number>();
      dataset.relations.forEach((rel: TestRelation) => {
        degreeMap.set(rel.sourceId, (degreeMap.get(rel.sourceId) || 0) + 1);
        degreeMap.set(rel.targetId, (degreeMap.get(rel.targetId) || 0) + 1);
      });

      const avgDegree = Array.from(degreeMap.values()).reduce((sum, deg) => sum + deg, 0) / degreeMap.size;

      // 允许一定的误差范围
      expect(Math.abs(avgDegree - scale.averageDegree)).toBeLessThan(2);
    });
  });

  describe('generateLegalNames', () => {
    it('应该生成有效的法律名称', () => {
      const names = DataGenerator.generateLegalNames(10);

      expect(names).toHaveLength(10);
      names.forEach((name: string) => {
        expect(name.length).toBeGreaterThan(0);
        expect(name).toMatch(/^(.+)(法|条例|规定|规则|解释|办法)$/);
      });
    });

    it('应该生成不重复的法律名称', () => {
      const count = 100;
      const names = DataGenerator.generateLegalNames(count);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(count);
    });
  });

  describe('generateFullText', () => {
    it('应该生成合理的法条全文', () => {
      const fullText = DataGenerator.generateFullText();

      expect(fullText.length).toBeGreaterThan(50);
      expect(fullText.length).toBeLessThan(2000);
      expect(typeof fullText).toBe('string');
    });

    it('应该生成包含法律术语的全文', () => {
      const fullText = DataGenerator.generateFullText();
      const legalTerms = ['应当', '不得', '可以', '必须', '禁止', '依照', '按照'];

      const hasLegalTerm = legalTerms.some(term => fullText.includes(term));
      expect(hasLegalTerm).toBeTruthy();
    });
  });
});
