/**
 * 证据分类配置测试
 *
 * 测试覆盖：
 * - 证据分类数据结构
 * - 按案件类型获取分类
 * - 分类树形结构
 * - 分类查询功能
 * - 数据完整性验证
 */

import {
  EVIDENCE_CATEGORIES,
  getEvidenceCategoriesByCaseType,
  getAllCaseTypes,
  getCategoryByCode,
  searchCategories,
  validateCategoryStructure,
  type EvidenceCategory,
} from '@/lib/evidence/evidence-category-config';

describe('EvidenceCategoryConfig', () => {
  describe('数据结构验证', () => {
    it('应该包含劳动争议案件分类', () => {
      expect(EVIDENCE_CATEGORIES.LABOR_DISPUTE).toBeDefined();
      expect(Array.isArray(EVIDENCE_CATEGORIES.LABOR_DISPUTE)).toBe(true);
      expect(EVIDENCE_CATEGORIES.LABOR_DISPUTE.length).toBeGreaterThan(0);
    });

    it('应该包含合同纠纷案件分类', () => {
      expect(EVIDENCE_CATEGORIES.CONTRACT_DISPUTE).toBeDefined();
      expect(Array.isArray(EVIDENCE_CATEGORIES.CONTRACT_DISPUTE)).toBe(true);
      expect(EVIDENCE_CATEGORIES.CONTRACT_DISPUTE.length).toBeGreaterThan(0);
    });

    it('应该包含婚姻家庭案件分类', () => {
      expect(EVIDENCE_CATEGORIES.MARRIAGE_FAMILY).toBeDefined();
      expect(Array.isArray(EVIDENCE_CATEGORIES.MARRIAGE_FAMILY)).toBe(true);
      expect(EVIDENCE_CATEGORIES.MARRIAGE_FAMILY.length).toBeGreaterThan(0);
    });

    it('每个分类应该包含必要字段', () => {
      const categories = EVIDENCE_CATEGORIES.LABOR_DISPUTE;

      for (const category of categories) {
        expect(category.code).toBeDefined();
        expect(typeof category.code).toBe('string');
        expect(category.name).toBeDefined();
        expect(typeof category.name).toBe('string');
        expect(category.description).toBeDefined();
        expect(typeof category.description).toBe('string');
      }
    });

    it('分类应该支持子分类', () => {
      const categories = EVIDENCE_CATEGORIES.LABOR_DISPUTE;
      const categoryWithSub = categories.find(
        c => c.subCategories && c.subCategories.length > 0
      );

      expect(categoryWithSub).toBeDefined();
      if (categoryWithSub?.subCategories) {
        expect(Array.isArray(categoryWithSub.subCategories)).toBe(true);
        expect(categoryWithSub.subCategories.length).toBeGreaterThan(0);
      }
    });

    it('分类应该包含示例', () => {
      const categories = EVIDENCE_CATEGORIES.LABOR_DISPUTE;

      // 在所有分类（包括子分类）中查找包含示例的分类
      const findCategoryWithExamples = (
        cats: EvidenceCategory[]
      ): EvidenceCategory | undefined => {
        for (const cat of cats) {
          if (cat.examples && cat.examples.length > 0) {
            return cat;
          }
          if (cat.subCategories) {
            const found = findCategoryWithExamples(cat.subCategories);
            if (found) return found;
          }
        }
        return undefined;
      };

      const categoryWithExamples = findCategoryWithExamples(categories);

      expect(categoryWithExamples).toBeDefined();
      if (categoryWithExamples?.examples) {
        expect(Array.isArray(categoryWithExamples.examples)).toBe(true);
        expect(categoryWithExamples.examples.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getEvidenceCategoriesByCaseType - 按案件类型获取分类', () => {
    it('应该返回劳动争议案件分类', () => {
      const categories = getEvidenceCategoriesByCaseType('LABOR_DISPUTE');

      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    it('应该返回合同纠纷案件分类', () => {
      const categories = getEvidenceCategoriesByCaseType('CONTRACT_DISPUTE');

      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    it('应该返回婚姻家庭案件分类', () => {
      const categories = getEvidenceCategoriesByCaseType('MARRIAGE_FAMILY');

      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    it('不存在的案件类型应该返回空数组', () => {
      const categories = getEvidenceCategoriesByCaseType('INVALID_TYPE');

      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBe(0);
    });

    it('空字符串应该返回空数组', () => {
      const categories = getEvidenceCategoriesByCaseType('');

      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBe(0);
    });
  });

  describe('getAllCaseTypes - 获取所有案件类型', () => {
    it('应该返回所有案件类型', () => {
      const caseTypes = getAllCaseTypes();

      expect(caseTypes).toBeDefined();
      expect(Array.isArray(caseTypes)).toBe(true);
      expect(caseTypes.length).toBeGreaterThan(0);
    });

    it('应该包含劳动争议类型', () => {
      const caseTypes = getAllCaseTypes();

      expect(caseTypes).toContain('LABOR_DISPUTE');
    });

    it('应该包含合同纠纷类型', () => {
      const caseTypes = getAllCaseTypes();

      expect(caseTypes).toContain('CONTRACT_DISPUTE');
    });

    it('应该包含婚姻家庭类型', () => {
      const caseTypes = getAllCaseTypes();

      expect(caseTypes).toContain('MARRIAGE_FAMILY');
    });
  });

  describe('getCategoryByCode - 按代码获取分类', () => {
    it('应该能够获取指定代码的分类', () => {
      const categories = EVIDENCE_CATEGORIES.LABOR_DISPUTE;
      const firstCategory = categories[0];

      const result = getCategoryByCode('LABOR_DISPUTE', firstCategory.code);

      expect(result).toBeDefined();
      expect(result?.code).toBe(firstCategory.code);
    });

    it('应该能够获取子分类', () => {
      const categories = EVIDENCE_CATEGORIES.LABOR_DISPUTE;
      const categoryWithSub = categories.find(
        c => c.subCategories && c.subCategories.length > 0
      );

      if (
        categoryWithSub?.subCategories &&
        categoryWithSub.subCategories.length > 0
      ) {
        const subCategory = categoryWithSub.subCategories[0];
        const result = getCategoryByCode('LABOR_DISPUTE', subCategory.code);

        expect(result).toBeDefined();
        expect(result?.code).toBe(subCategory.code);
      }
    });

    it('不存在的代码应该返回null', () => {
      const result = getCategoryByCode('LABOR_DISPUTE', 'INVALID_CODE');

      expect(result).toBeNull();
    });

    it('不存在的案件类型应该返回null', () => {
      const result = getCategoryByCode('INVALID_TYPE', 'ANY_CODE');

      expect(result).toBeNull();
    });
  });

  describe('searchCategories - 搜索分类', () => {
    it('应该能够按名称搜索分类', () => {
      const results = searchCategories('LABOR_DISPUTE', '劳动');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('应该能够按描述搜索分类', () => {
      const results = searchCategories('LABOR_DISPUTE', '证明');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('搜索结果应该包含匹配的分类', () => {
      const results = searchCategories('LABOR_DISPUTE', '劳动');

      if (results.length > 0) {
        const hasMatch = results.some(
          r => r.name.includes('劳动') || r.description.includes('劳动')
        );
        expect(hasMatch).toBe(true);
      }
    });

    it('空搜索词应该返回所有分类', () => {
      const allCategories = getEvidenceCategoriesByCaseType('LABOR_DISPUTE');
      const results = searchCategories('LABOR_DISPUTE', '');

      expect(results.length).toBeGreaterThanOrEqual(allCategories.length);
    });

    it('不匹配的搜索词应该返回空数组', () => {
      const results = searchCategories('LABOR_DISPUTE', 'xyz不存在的关键词xyz');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('validateCategoryStructure - 验证分类结构', () => {
    it('应该验证有效的分类结构', () => {
      const validCategory: EvidenceCategory = {
        code: 'TEST_CODE',
        name: '测试分类',
        description: '测试描述',
      };

      const result = validateCategoryStructure(validCategory);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('应该检测缺少code字段', () => {
      const invalidCategory: any = {
        name: '测试分类',
        description: '测试描述',
      };

      const result = validateCategoryStructure(invalidCategory);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('code'))).toBe(true);
    });

    it('应该检测缺少name字段', () => {
      const invalidCategory: any = {
        code: 'TEST_CODE',
        description: '测试描述',
      };

      const result = validateCategoryStructure(invalidCategory);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('应该检测缺少description字段', () => {
      const invalidCategory: any = {
        code: 'TEST_CODE',
        name: '测试分类',
      };

      const result = validateCategoryStructure(invalidCategory);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('description'))).toBe(true);
    });

    it('应该验证子分类结构', () => {
      const categoryWithSub: EvidenceCategory = {
        code: 'TEST_CODE',
        name: '测试分类',
        description: '测试描述',
        subCategories: [
          {
            code: 'SUB_CODE',
            name: '子分类',
            description: '子分类描述',
          },
        ],
      };

      const result = validateCategoryStructure(categoryWithSub);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('应该检测无效的子分类', () => {
      const categoryWithInvalidSub: any = {
        code: 'TEST_CODE',
        name: '测试分类',
        description: '测试描述',
        subCategories: [
          {
            code: 'SUB_CODE',
            // 缺少name和description
          },
        ],
      };

      const result = validateCategoryStructure(categoryWithInvalidSub);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('数据完整性', () => {
    it('所有预置分类应该通过结构验证', () => {
      const allCaseTypes = getAllCaseTypes();

      for (const caseType of allCaseTypes) {
        const categories = getEvidenceCategoriesByCaseType(caseType);

        for (const category of categories) {
          const result = validateCategoryStructure(category);
          expect(result.isValid).toBe(true);
        }
      }
    });

    it('所有分类代码应该唯一', () => {
      const allCaseTypes = getAllCaseTypes();

      for (const caseType of allCaseTypes) {
        const categories = getEvidenceCategoriesByCaseType(caseType);
        const codes = new Set<string>();

        const checkUniqueness = (cats: EvidenceCategory[]) => {
          for (const cat of cats) {
            expect(codes.has(cat.code)).toBe(false);
            codes.add(cat.code);

            if (cat.subCategories) {
              checkUniqueness(cat.subCategories);
            }
          }
        };

        checkUniqueness(categories);
      }
    });

    it('所有分类名称应该非空', () => {
      const allCaseTypes = getAllCaseTypes();

      for (const caseType of allCaseTypes) {
        const categories = getEvidenceCategoriesByCaseType(caseType);

        const checkNames = (cats: EvidenceCategory[]) => {
          for (const cat of cats) {
            expect(cat.name.trim().length).toBeGreaterThan(0);

            if (cat.subCategories) {
              checkNames(cat.subCategories);
            }
          }
        };

        checkNames(categories);
      }
    });

    it('所有分类描述应该非空', () => {
      const allCaseTypes = getAllCaseTypes();

      for (const caseType of allCaseTypes) {
        const categories = getEvidenceCategoriesByCaseType(caseType);

        const checkDescriptions = (cats: EvidenceCategory[]) => {
          for (const cat of cats) {
            expect(cat.description.trim().length).toBeGreaterThan(0);

            if (cat.subCategories) {
              checkDescriptions(cat.subCategories);
            }
          }
        };

        checkDescriptions(categories);
      }
    });
  });

  describe('边界情况', () => {
    it('应该处理null参数', () => {
      expect(() => getEvidenceCategoriesByCaseType(null as any)).not.toThrow();
      expect(() => getCategoryByCode(null as any, null as any)).not.toThrow();
      expect(() => searchCategories(null as any, null as any)).not.toThrow();
    });

    it('应该处理undefined参数', () => {
      expect(() =>
        getEvidenceCategoriesByCaseType(undefined as any)
      ).not.toThrow();
      expect(() =>
        getCategoryByCode(undefined as any, undefined as any)
      ).not.toThrow();
      expect(() =>
        searchCategories(undefined as any, undefined as any)
      ).not.toThrow();
    });

    it('应该处理特殊字符搜索', () => {
      const results = searchCategories('LABOR_DISPUTE', '!@#$%^&*()');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
