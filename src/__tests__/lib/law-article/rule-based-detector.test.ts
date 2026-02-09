/**
 * 规则引擎测试
 * 测试基于规则的关系检测器
 * @jest-environment node
 */

import { RuleBasedDetector } from '../../../lib/law-article/relation-discovery/rule-based-detector';
import type { LawArticle } from '@prisma/client';
import type {
  CitesRelation,
  HierarchicalRelation,
  ConflictRelation,
  DetectionResult,
} from '../../../lib/law-article/relation-discovery/types';

describe('RuleBasedDetector', () => {
  describe('detectCitesRelation - 引用关系检测', () => {
    it('应该检测到"根据"引用模式', () => {
      const article = createMockArticle({
        fullText: '根据《民法典》第10条的规定，当事人应当遵守诚实信用原则。',
      });

      const relations = RuleBasedDetector.detectCitesRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].lawName).toBe('民法典');
      expect(relations[0].articleNumber).toBe('10');
      expect(relations[0].evidence).toContain('根据《民法典》第10条');
      expect(relations[0].confidence).toBe(0.95);
    });

    it('应该检测到"依照"引用模式', () => {
      const article = createMockArticle({
        fullText: '依照《合同法》第52条规定，合同无效。',
      });

      const relations = RuleBasedDetector.detectCitesRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].lawName).toBe('合同法');
      expect(relations[0].articleNumber).toBe('52');
    });

    it('应该检测到"按照"引用模式', () => {
      const article = createMockArticle({
        fullText:
          '按照《刑法》第234条的规定，故意伤害他人身体的，处三年以下有期徒刑。',
      });

      const relations = RuleBasedDetector.detectCitesRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].lawName).toBe('刑法');
      expect(relations[0].articleNumber).toBe('234');
    });

    it('应该检测到"参照"引用模式', () => {
      const article = createMockArticle({
        fullText: '参照《行政诉讼法》第25条执行。',
      });

      const relations = RuleBasedDetector.detectCitesRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].lawName).toBe('行政诉讼法');
      expect(relations[0].articleNumber).toBe('25');
    });

    it('应该检测到"适用"引用模式', () => {
      const article = createMockArticle({
        fullText: '适用《劳动法》第48条的规定。',
      });

      const relations = RuleBasedDetector.detectCitesRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].lawName).toBe('劳动法');
      expect(relations[0].articleNumber).toBe('48');
    });

    it('应该检测到多个引用关系', () => {
      const article = createMockArticle({
        fullText:
          '根据《民法典》第10条和依照《合同法》第52条的规定，参照《侵权责任法》第6条执行。',
      });

      const relations = RuleBasedDetector.detectCitesRelation(article);

      expect(relations).toHaveLength(3);
      expect(relations[0].lawName).toBe('民法典');
      expect(relations[1].lawName).toBe('合同法');
      expect(relations[2].lawName).toBe('侵权责任法');
    });

    it('应该处理没有书名号的法律名称', () => {
      const article = createMockArticle({
        fullText: '根据民法典第10条的规定。',
      });

      const relations = RuleBasedDetector.detectCitesRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].lawName).toBe('民法典');
    });

    it('应该处理没有"第"字的条款号', () => {
      const article = createMockArticle({
        fullText: '根据《民法典》10条的规定。',
      });

      const relations = RuleBasedDetector.detectCitesRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].articleNumber).toBe('10');
    });

    it('没有引用时应该返回空数组', () => {
      const article = createMockArticle({
        fullText: '这是一条没有引用其他法条的普通法条。',
      });

      const relations = RuleBasedDetector.detectCitesRelation(article);

      expect(relations).toHaveLength(0);
    });

    it('应该处理复杂的法律名称', () => {
      const article = createMockArticle({
        fullText: '根据《中华人民共和国民法典》第10条的规定。',
      });

      const relations = RuleBasedDetector.detectCitesRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].lawName).toBe('中华人民共和国民法典');
    });
  });

  describe('detectHierarchicalRelation - 层级关系检测', () => {
    it('应该检测到"根据...制定"模式', () => {
      const article = createMockArticle({
        fullText: '根据《中华人民共和国宪法》制定本法。',
      });

      const relations = RuleBasedDetector.detectHierarchicalRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].parentLawName).toBe('中华人民共和国宪法');
      expect(relations[0].relationType).toBe('IMPLEMENTS');
      expect(relations[0].confidence).toBe(0.85);
    });

    it('应该检测到"依据...制定"模式', () => {
      const article = createMockArticle({
        fullText: '依据《民法典》制定本实施细则。',
      });

      const relations = RuleBasedDetector.detectHierarchicalRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].parentLawName).toBe('民法典');
    });

    it('应该检测到"为实施..."模式', () => {
      const article = createMockArticle({
        fullText: '为实施《环境保护法》，制定本条例。',
      });

      const relations = RuleBasedDetector.detectHierarchicalRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].parentLawName).toBe('环境保护法');
    });

    it('应该检测到"为执行..."模式', () => {
      const article = createMockArticle({
        fullText: '为执行《劳动法》，特制定本规定。',
      });

      const relations = RuleBasedDetector.detectHierarchicalRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].parentLawName).toBe('劳动法');
    });

    it('应该检测到"根据...，制定本"模式', () => {
      const article = createMockArticle({
        fullText: '根据《中华人民共和国宪法》，制定本法。',
      });

      const relations = RuleBasedDetector.detectHierarchicalRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].parentLawName).toBe('中华人民共和国宪法');
    });

    it('没有层级关系时应该返回空数组', () => {
      const article = createMockArticle({
        fullText: '这是一条独立的法条，没有上位法。',
      });

      const relations = RuleBasedDetector.detectHierarchicalRelation(article);

      expect(relations).toHaveLength(0);
    });

    it('应该处理没有书名号的法律名称', () => {
      const article = createMockArticle({
        fullText: '根据宪法制定本法。',
      });

      const relations = RuleBasedDetector.detectHierarchicalRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].parentLawName).toBe('宪法');
    });
  });

  describe('detectConflictsRelation - 冲突关系检测', () => {
    it('应该检测到"与...规定不一致"模式', () => {
      const article = createMockArticle({
        fullText: '本条规定与《旧法》规定不一致的，以本法为准。',
      });

      const conflicts = RuleBasedDetector.detectConflictsRelation(article);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].targetLawName).toBe('旧法');
      expect(conflicts[0].confidence).toBe(0.8);
    });

    it('应该检测到"与...相抵触"模式', () => {
      const article = createMockArticle({
        fullText: '与《行政法》相抵触的规定无效。',
      });

      const conflicts = RuleBasedDetector.detectConflictsRelation(article);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].targetLawName).toBe('行政法');
    });

    it('应该检测到"与...冲突"模式', () => {
      const article = createMockArticle({
        fullText: '与《民法典》冲突的条款不予适用。',
      });

      const conflicts = RuleBasedDetector.detectConflictsRelation(article);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].targetLawName).toBe('民法典');
    });

    it('应该检测到"与...矛盾"模式', () => {
      const article = createMockArticle({
        fullText: '与《宪法》矛盾的法律无效。',
      });

      const conflicts = RuleBasedDetector.detectConflictsRelation(article);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].targetLawName).toBe('宪法');
    });

    it('没有冲突关系时应该返回空数组', () => {
      const article = createMockArticle({
        fullText: '这是一条正常的法条，没有冲突。',
      });

      const conflicts = RuleBasedDetector.detectConflictsRelation(article);

      expect(conflicts).toHaveLength(0);
    });

    it('应该处理没有书名号的法律名称', () => {
      const article = createMockArticle({
        fullText: '与民法典规定不一致。',
      });

      const conflicts = RuleBasedDetector.detectConflictsRelation(article);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].targetLawName).toBe('民法典');
    });
  });

  describe('detectSupersedesRelation - 替代关系检测', () => {
    it('应该检测到"同时废止"模式', () => {
      const articles = [
        createMockArticle({
          id: 'new-law-id',
          lawName: '新法',
          fullText: '本法自2024年1月1日起施行，《旧法》同时废止。',
          effectiveDate: new Date('2024-01-01'),
        }),
        createMockArticle({
          id: 'old-law-id',
          lawName: '旧法',
          effectiveDate: new Date('2020-01-01'),
        }),
      ];

      const relations = RuleBasedDetector.detectSupersedesRelation(articles);

      expect(relations.length).toBeGreaterThan(0);
      const supersede = relations.find(r => r.relationType === 'SUPERSEDES');
      expect(supersede).toBeDefined();
    });

    it('应该检测到同名法律的版本替代', () => {
      const articles = [
        createMockArticle({
          id: 'new-version-id',
          lawName: '民法典',
          version: '2.0',
          effectiveDate: new Date('2024-01-01'),
        }),
        createMockArticle({
          id: 'old-version-id',
          lawName: '民法典',
          version: '1.0',
          effectiveDate: new Date('2020-01-01'),
        }),
      ];

      const relations = RuleBasedDetector.detectSupersedesRelation(articles);

      expect(relations).toHaveLength(1);
      expect(relations[0].sourceId).toBe('new-version-id');
      expect(relations[0].targetId).toBe('old-version-id');
      expect(relations[0].relationType).toBe('SUPERSEDES');
      expect(relations[0].confidence).toBe(0.9);
    });

    it('应该按生效日期排序检测替代关系', () => {
      const articles = [
        createMockArticle({
          id: 'v3-id',
          lawName: '测试法',
          version: '3.0',
          effectiveDate: new Date('2024-01-01'),
        }),
        createMockArticle({
          id: 'v1-id',
          lawName: '测试法',
          version: '1.0',
          effectiveDate: new Date('2020-01-01'),
        }),
        createMockArticle({
          id: 'v2-id',
          lawName: '测试法',
          version: '2.0',
          effectiveDate: new Date('2022-01-01'),
        }),
      ];

      const relations = RuleBasedDetector.detectSupersedesRelation(articles);

      // v2替代v1, v3替代v2
      expect(relations).toHaveLength(2);
      expect(
        relations.some(r => r.sourceId === 'v2-id' && r.targetId === 'v1-id')
      ).toBe(true);
      expect(
        relations.some(r => r.sourceId === 'v3-id' && r.targetId === 'v2-id')
      ).toBe(true);
    });

    it('不同法律名称不应该产生替代关系', () => {
      const articles = [
        createMockArticle({
          id: 'law-a-id',
          lawName: '法律A',
          effectiveDate: new Date('2024-01-01'),
        }),
        createMockArticle({
          id: 'law-b-id',
          lawName: '法律B',
          effectiveDate: new Date('2020-01-01'),
        }),
      ];

      const relations = RuleBasedDetector.detectSupersedesRelation(articles);

      expect(relations).toHaveLength(0);
    });

    it('单个法律不应该产生替代关系', () => {
      const articles = [
        createMockArticle({
          id: 'single-law-id',
          lawName: '单一法律',
          effectiveDate: new Date('2024-01-01'),
        }),
      ];

      const relations = RuleBasedDetector.detectSupersedesRelation(articles);

      expect(relations).toHaveLength(0);
    });
  });

  describe('detectAllRelations - 综合检测', () => {
    it('应该同时检测多种关系', async () => {
      const article = createMockArticle({
        fullText:
          '根据《中华人民共和国宪法》制定本法。依照《民法典》第10条的规定，当事人应当遵守诚实信用原则。与《旧法》规定不一致的，以本法为准。',
      });

      const result = await RuleBasedDetector.detectAllRelations(article);

      expect(result.cites).toHaveLength(1);
      expect(result.hierarchical).toHaveLength(1);
      expect(result.conflicts).toHaveLength(1);
    });

    it('应该返回正确的数据结构', async () => {
      const article = createMockArticle({
        fullText: '根据《民法典》第10条的规定。',
      });

      const result = await RuleBasedDetector.detectAllRelations(article);

      expect(result).toHaveProperty('cites');
      expect(result).toHaveProperty('hierarchical');
      expect(result).toHaveProperty('conflicts');
      expect(Array.isArray(result.cites)).toBe(true);
      expect(Array.isArray(result.hierarchical)).toBe(true);
      expect(Array.isArray(result.conflicts)).toBe(true);
    });

    it('没有任何关系时应该返回空数组', async () => {
      const article = createMockArticle({
        fullText: '这是一条独立的法条。',
      });

      const result = await RuleBasedDetector.detectAllRelations(article);

      expect(result.cites).toHaveLength(0);
      expect(result.hierarchical).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('边界情况测试', () => {
    it('应该处理空文本', () => {
      const article = createMockArticle({ fullText: '' });

      const cites = RuleBasedDetector.detectCitesRelation(article);
      const hierarchical =
        RuleBasedDetector.detectHierarchicalRelation(article);
      const conflicts = RuleBasedDetector.detectConflictsRelation(article);

      expect(cites).toHaveLength(0);
      expect(hierarchical).toHaveLength(0);
      expect(conflicts).toHaveLength(0);
    });

    it('应该处理特殊字符', () => {
      const article = createMockArticle({
        fullText: '根据《民法典（2020年版）》第10条的规定。',
      });

      const relations = RuleBasedDetector.detectCitesRelation(article);

      expect(relations).toHaveLength(1);
      expect(relations[0].lawName).toContain('民法典');
    });

    it('应该处理超长文本', () => {
      const longText = '根据《民法典》第10条的规定。'.repeat(100);
      const article = createMockArticle({ fullText: longText });

      const relations = RuleBasedDetector.detectCitesRelation(article);

      expect(relations.length).toBeGreaterThan(0);
    });

    it('应该处理没有生效日期的法律', () => {
      const articles = [
        createMockArticle({
          id: 'no-date-id',
          lawName: '测试法',
          effectiveDate: null as unknown as Date,
        }),
      ];

      const relations = RuleBasedDetector.detectSupersedesRelation(articles);

      expect(relations).toHaveLength(0);
    });
  });
});

/**
 * 创建模拟的LawArticle对象
 */
function createMockArticle(overrides: Partial<LawArticle> = {}): LawArticle {
  return {
    id: overrides.id || 'test-article-id',
    lawName: overrides.lawName || '测试法律',
    articleNumber: overrides.articleNumber || '1',
    fullText: overrides.fullText || '这是测试法条内容',
    lawType: overrides.lawType || 'LAW',
    category: overrides.category || 'CIVIL',
    subCategory: overrides.subCategory || null,
    tags: overrides.tags || [],
    keywords: overrides.keywords || [],
    version: overrides.version || '1.0',
    effectiveDate: overrides.effectiveDate || new Date('2024-01-01'),
    expiryDate: overrides.expiryDate || null,
    status: overrides.status || 'VALID',
    amendmentHistory: overrides.amendmentHistory || null,
    parentId: overrides.parentId || null,
    chapterNumber: overrides.chapterNumber || null,
    sectionNumber: overrides.sectionNumber || null,
    level: overrides.level || 0,
    issuingAuthority: overrides.issuingAuthority || '测试机关',
    jurisdiction: overrides.jurisdiction || null,
    relatedArticles: overrides.relatedArticles || [],
    legalBasis: overrides.legalBasis || null,
    searchableText:
      overrides.searchableText || overrides.fullText || '这是测试法条内容',
    viewCount: overrides.viewCount || 0,
    referenceCount: overrides.referenceCount || 0,
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    dataSource: overrides.dataSource || 'local',
    sourceId: overrides.sourceId || null,
    importedAt: overrides.importedAt || null,
    lastSyncedAt: overrides.lastSyncedAt || null,
    syncStatus: overrides.syncStatus || 'SYNCED',
  };
}
