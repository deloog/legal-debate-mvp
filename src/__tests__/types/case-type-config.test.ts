import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  CaseTypeCategory,
  CASE_TYPE_CATEGORY_LABELS,
  type MaterialList,
  type MaterialItem,
  isValidCaseTypeCategory,
  isValidMaterialList,
  getCaseTypeCategoryLabel,
  getComplexityLevelLabel,
  calculateBaseFee,
  calculateRiskFee,
  calculateHourlyFee,
  estimateCaseDuration,
  isValidCaseTypeCode,
  generateCaseTypeCode,
  getRecommendedLawyerCount,
} from '@/types/case-type-config';

const testPrisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

describe('CaseTypeCategory 枚举', () => {
  it('应该包含所有案件类型大类', () => {
    const expectedCategories = [
      CaseTypeCategory.CIVIL,
      CaseTypeCategory.CRIMINAL,
      CaseTypeCategory.ADMINISTRATIVE,
      CaseTypeCategory.NON_LITIGATION,
    ];

    expect(Object.values(CaseTypeCategory)).toEqual(expectedCategories);
  });

  it('应该包含所有案件类型大类标签', () => {
    expect(CASE_TYPE_CATEGORY_LABELS).toEqual({
      [CaseTypeCategory.CIVIL]: '民事',
      [CaseTypeCategory.CRIMINAL]: '刑事',
      [CaseTypeCategory.ADMINISTRATIVE]: '行政',
      [CaseTypeCategory.NON_LITIGATION]: '非诉',
    });
  });
});

describe('类型守卫函数', () => {
  describe('isValidCaseTypeCategory', () => {
    it('应该验证有效的案件类型大类', () => {
      expect(isValidCaseTypeCategory('CIVIL')).toBe(true);
      expect(isValidCaseTypeCategory('CRIMINAL')).toBe(true);
      expect(isValidCaseTypeCategory('ADMINISTRATIVE')).toBe(true);
      expect(isValidCaseTypeCategory('NON_LITIGATION')).toBe(true);
    });

    it('应该拒绝无效的案件类型大类', () => {
      expect(isValidCaseTypeCategory('INVALID')).toBe(false);
      expect(isValidCaseTypeCategory('')).toBe(false);
      expect(isValidCaseTypeCategory('123')).toBe(false);
    });

    it('应该拒绝 undefined 和 null', () => {
      expect(isValidCaseTypeCategory(undefined as unknown as string)).toBe(
        false
      );
      expect(isValidCaseTypeCategory(null as unknown as string)).toBe(false);
    });
  });

  describe('isValidMaterialList', () => {
    it('应该验证有效的材料清单', () => {
      const validList: MaterialList = {
        materials: [
          { name: '身份证', description: '身份证明', copies: 1 },
          { name: '合同', description: '合同原件', copies: 2 },
        ],
        requirements: ['必须提供原件'],
      };

      expect(isValidMaterialList(validList)).toBe(true);
    });

    it('应该拒绝无效的材料清单 - 缺少 materials', () => {
      expect(isValidMaterialList(null)).toBe(false);
      expect(isValidMaterialList(undefined)).toBe(false);
      expect(isValidMaterialList({})).toBe(false);
    });

    it('应该拒绝无效的材料清单 - materials 不是数组', () => {
      expect(isValidMaterialList({ materials: 'not an array' })).toBe(false);
      expect(isValidMaterialList({ materials: {} })).toBe(false);
    });

    it('应该接受copies为0的材料项', () => {
      expect(
        isValidMaterialList({
          materials: [{ name: '身份证', description: '身份证明', copies: 0 }],
        })
      ).toBe(true);
    });

    it('应该拒绝copies为负数的材料项', () => {
      expect(
        isValidMaterialList({
          materials: [{ name: '身份证', description: '身份证明', copies: -1 }],
        })
      ).toBe(false);

      expect(
        isValidMaterialList({
          materials: [{ name: '身份证', description: '身份证明', copies: '1' }],
        })
      ).toBe(false);
    });

    it('应该拒绝无效的材料项 - copies 为负数', () => {
      expect(
        isValidMaterialList({
          materials: [{ name: '身份证', description: '身份证明', copies: -1 }],
        })
      ).toBe(false);
    });

    it('应该接受有效的可选字段', () => {
      const listWithOptional: MaterialList = {
        materials: [
          {
            name: '合同',
            description: '合同原件',
            copies: 1,
            templateUrl: '/templates/contract.pdf',
            notes: '必须盖公章',
          },
        ],
        notes: ['重要提示'],
        requirements: ['原件', '复印件'],
      };

      expect(isValidMaterialList(listWithOptional)).toBe(true);
    });
  });
});

describe('获取标签函数', () => {
  describe('getCaseTypeCategoryLabel', () => {
    it('应该返回正确的案件类型大类标签', () => {
      expect(getCaseTypeCategoryLabel(CaseTypeCategory.CIVIL)).toBe('民事');
      expect(getCaseTypeCategoryLabel(CaseTypeCategory.CRIMINAL)).toBe('刑事');
      expect(getCaseTypeCategoryLabel(CaseTypeCategory.ADMINISTRATIVE)).toBe(
        '行政'
      );
      expect(getCaseTypeCategoryLabel(CaseTypeCategory.NON_LITIGATION)).toBe(
        '非诉'
      );
    });
  });

  describe('getComplexityLevelLabel', () => {
    it('应该返回正确的复杂度等级标签', () => {
      expect(getComplexityLevelLabel(1)).toBe('非常简单');
      expect(getComplexityLevelLabel(2)).toBe('简单');
      expect(getComplexityLevelLabel(3)).toBe('中等');
      expect(getComplexityLevelLabel(4)).toBe('复杂');
      expect(getComplexityLevelLabel(5)).toBe('非常复杂');
    });

    it('应该处理边界值', () => {
      expect(getComplexityLevelLabel(0)).toBe('未知');
      expect(getComplexityLevelLabel(6)).toBe('未知');
      expect(getComplexityLevelLabel(-1)).toBe('未知');
    });

    it('应该处理小数 - 向下取整', () => {
      expect(getComplexityLevelLabel(1.5)).toBe('非常简单'); // Math.floor(1.5) = 1
      expect(getComplexityLevelLabel(3.7)).toBe('中等'); // Math.floor(3.7) = 3
    });
  });
});

describe('费用计算函数', () => {
  describe('calculateBaseFee', () => {
    it('应该正确计算基础收费', () => {
      expect(calculateBaseFee(5000, 2)).toBe(5000); // 复杂度2为基准
      expect(calculateBaseFee(5000, 3)).toBe(6000); // 复杂度3增加20%
      expect(calculateBaseFee(10000, 4)).toBe(14000); // 复杂度4增加40%
    });

    it('应该处理低复杂度', () => {
      expect(calculateBaseFee(5000, 1)).toBe(4000); // 复杂度1减少20%
    });

    it('应该处理高复杂度', () => {
      expect(calculateBaseFee(10000, 5)).toBe(16000); // 复杂度5增加60%
    });
  });

  describe('calculateRiskFee', () => {
    it('应该正确计算风险代理费用', () => {
      const baseFee = 5000;
      const amount = 100000;
      const riskFeeRate = 0.3;

      expect(calculateRiskFee(amount, riskFeeRate, baseFee)).toBe(30000);
    });

    it('应该不低于基础收费的50%', () => {
      const baseFee = 10000;
      const amount = 10000;
      const riskFeeRate = 0.3;

      // 风险代理费用为3000，但基础收费50%为5000，应返回5000
      expect(calculateRiskFee(amount, riskFeeRate, baseFee)).toBe(5000);
    });

    it('应该处理零比例', () => {
      const baseFee = 5000;
      const amount = 100000;
      const riskFeeRate = 0;

      expect(calculateRiskFee(amount, riskFeeRate, baseFee)).toBe(0);
    });

    it('应该处理负比例', () => {
      const baseFee = 5000;
      const amount = 100000;
      const riskFeeRate = -0.1;

      expect(calculateRiskFee(amount, riskFeeRate, baseFee)).toBe(0);
    });
  });

  describe('calculateHourlyFee', () => {
    it('应该正确计算计时收费', () => {
      expect(calculateHourlyFee(500, 10)).toBe(5000);
      expect(calculateHourlyFee(800, 20)).toBe(16000);
      expect(calculateHourlyFee(1000, 5)).toBe(5000);
    });

    it('应该处理零小时', () => {
      expect(calculateHourlyFee(500, 0)).toBe(0);
    });
  });
});

describe('估算函数', () => {
  describe('estimateCaseDuration', () => {
    it('应该使用平均办案周期如果提供', () => {
      expect(estimateCaseDuration(120, 3)).toBe(120);
      expect(estimateCaseDuration(90, 2)).toBe(90);
    });

    it('应该根据复杂度估算周期', () => {
      expect(estimateCaseDuration(null, 1)).toBe(30);
      expect(estimateCaseDuration(null, 2)).toBe(60);
      expect(estimateCaseDuration(null, 3)).toBe(90);
      expect(estimateCaseDuration(null, 4)).toBe(120);
      expect(estimateCaseDuration(null, 5)).toBe(180);
    });

    it('应该处理 undefined 和零值', () => {
      expect(estimateCaseDuration(undefined, 2)).toBe(60);
      expect(estimateCaseDuration(0, 2)).toBe(60);
    });

    it('应该默认返回90天', () => {
      expect(estimateCaseDuration(null, 0)).toBe(90);
      expect(estimateCaseDuration(null, 10)).toBe(90);
    });
  });
});

describe('代码生成和验证', () => {
  describe('isValidCaseTypeCode', () => {
    it('应该验证有效的案件类型代码', () => {
      expect(isValidCaseTypeCode('LABOR_DISPUTE')).toBe(true);
      expect(isValidCaseTypeCode('CONTRACT_DISPUTE')).toBe(true);
      expect(isValidCaseTypeCode('CRIMINAL_DEFENSE')).toBe(true);
      expect(isValidCaseTypeCode('LEGAL_COUNSEL')).toBe(true);
    });

    it('应该拒绝无效的案件类型代码', () => {
      expect(isValidCaseTypeCode('labor_dispute')).toBe(false); // 小写
      expect(isValidCaseTypeCode('LABOR-DISPUTE')).toBe(false); // 连字符
      expect(isValidCaseTypeCode('LABOR DISPUTE')).toBe(false); // 空格
      expect(isValidCaseTypeCode('')).toBe(false);
      expect(isValidCaseTypeCode('123')).toBe(false);
    });

    it('应该接受数字', () => {
      expect(isValidCaseTypeCode('LABOR_123')).toBe(true);
    });
  });

  describe('generateCaseTypeCode', () => {
    it('应该生成正确的案件类型代码 - 已知词汇', () => {
      // 完全匹配的词汇
      expect(generateCaseTypeCode('劳动争议')).toBe('LABOR_DISPUTE');
      expect(generateCaseTypeCode('合同纠纷')).toBe('CONTRACT_DISPUTE');
      expect(generateCaseTypeCode('婚姻家庭')).toBe('MARRIAGE_FAMILY');
    });

    it('应该处理未知词汇', () => {
      // 部分未知
      expect(generateCaseTypeCode('未知案件')).toContain('未知案件');
      // 完全未知
      expect(generateCaseTypeCode('XYZ')).toBe('XYZ');
    });

    it('应该移除多余下划线', () => {
      expect(generateCaseTypeCode('劳动__争议')).toBe('LABOR_DISPUTE');
      expect(generateCaseTypeCode('_劳动争议')).toBe('LABOR_DISPUTE');
      expect(generateCaseTypeCode('劳动争议_')).toBe('LABOR_DISPUTE');
    });

    it('应该处理混合词汇', () => {
      expect(generateCaseTypeCode('劳动合同纠纷')).toBe(
        'LABOR_CONTRACT_DISPUTE'
      );
    });
  });
});

describe('律师人数推荐', () => {
  describe('getRecommendedLawyerCount', () => {
    it('应该为简单案件推荐1名律师', () => {
      expect(getRecommendedLawyerCount(1)).toBe(1);
      expect(getRecommendedLawyerCount(2)).toBe(1);
    });

    it('应该为复杂案件推荐2名律师', () => {
      expect(getRecommendedLawyerCount(3)).toBe(2);
      expect(getRecommendedLawyerCount(4)).toBe(2);
    });

    it('应该为非常复杂案件推荐3名律师', () => {
      expect(getRecommendedLawyerCount(5)).toBe(3);
      expect(getRecommendedLawyerCount(10)).toBe(3);
    });

    it('应该处理边界值', () => {
      expect(getRecommendedLawyerCount(0)).toBe(1);
      expect(getRecommendedLawyerCount(-1)).toBe(1);
    });
  });
});

describe('CaseTypeConfig 数据库操作', () => {
  let createdConfigId: string | undefined = undefined;

  beforeEach(async () => {
    // 清理测试数据
    await testPrisma.caseTypeConfig.deleteMany({});
  });

  afterEach(async () => {
    // 清理测试数据
    if (createdConfigId) {
      await testPrisma.caseTypeConfig.deleteMany({
        where: { id: createdConfigId },
      });
      createdConfigId = undefined;
    }
  });

  describe('创建案件类型配置', () => {
    it('应该成功创建案件类型配置', async () => {
      const requiredDocs: MaterialList = {
        materials: [{ name: '合同', description: '合同原件', copies: 1 }],
      };

      const config = await testPrisma.caseTypeConfig.create({
        data: {
          code: 'TEST_TYPE',
          name: '测试案件类型',
          category: CaseTypeCategory.CIVIL,
          baseFee: 5000,
          riskFeeRate: 0.2,
          hourlyRate: 500,
          requiredDocs: requiredDocs as never,
          optionalDocs: null,
          avgDuration: 90,
          complexityLevel: 2,
          isActive: true,
          sortOrder: 0,
        },
      });

      createdConfigId = config.id;

      expect(config).toBeDefined();
      expect(config.code).toBe('TEST_TYPE');
      expect(config.name).toBe('测试案件类型');
      expect(config.category).toBe(CaseTypeCategory.CIVIL);
      expect(String(config.baseFee)).toBe('5000');
      expect(config.riskFeeRate).toBe(0.2);
      expect(String(config.hourlyRate)).toBe('500');
      expect(config.avgDuration).toBe(90);
      expect(config.complexityLevel).toBe(2);
      expect(config.isActive).toBe(true);
      expect(config.sortOrder).toBe(0);
    });

    it('应该允许可选字段为 null', async () => {
      const requiredDocs: MaterialList = {
        materials: [{ name: '合同', description: '合同原件', copies: 1 }],
      };

      const config = await testPrisma.caseTypeConfig.create({
        data: {
          code: 'TEST_TYPE_2',
          name: '测试案件类型2',
          category: CaseTypeCategory.CRIMINAL,
          baseFee: 10000,
          riskFeeRate: null,
          hourlyRate: null,
          requiredDocs: requiredDocs as never,
          optionalDocs: null,
          avgDuration: null,
          complexityLevel: 3,
          isActive: true,
          sortOrder: 1,
        },
      });

      createdConfigId = config.id;

      expect(config.riskFeeRate).toBeNull();
      expect(config.hourlyRate).toBeNull();
      expect(config.avgDuration).toBeNull();
    });

    it('应该要求 code 唯一', async () => {
      const requiredDocs: MaterialList = {
        materials: [{ name: '合同', description: '合同原件', copies: 1 }],
      };

      await testPrisma.caseTypeConfig.create({
        data: {
          code: 'DUPLICATE',
          name: '第一个',
          category: CaseTypeCategory.CIVIL,
          baseFee: 5000,
          requiredDocs: requiredDocs as never,
          optionalDocs: null,
          complexityLevel: 2,
        },
      });

      await expect(
        testPrisma.caseTypeConfig.create({
          data: {
            code: 'DUPLICATE',
            name: '第二个',
            category: CaseTypeCategory.CIVIL,
            baseFee: 5000,
            requiredDocs: requiredDocs as never,
            optionalDocs: null,
            complexityLevel: 2,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('查询案件类型配置', () => {
    beforeEach(async () => {
      // 创建测试数据
      const requiredDocs: MaterialList = {
        materials: [{ name: '合同', description: '合同原件', copies: 1 }],
      };

      const configs = [
        {
          code: 'TYPE_1',
          name: '类型1',
          category: CaseTypeCategory.CIVIL,
          baseFee: 5000,
          requiredDocs: requiredDocs as never,
          optionalDocs: null,
          complexityLevel: 2,
          isActive: true,
          sortOrder: 1,
        },
        {
          code: 'TYPE_2',
          name: '类型2',
          category: CaseTypeCategory.CRIMINAL,
          baseFee: 10000,
          requiredDocs: requiredDocs as never,
          optionalDocs: null,
          complexityLevel: 3,
          isActive: false,
          sortOrder: 2,
        },
      ];

      for (const configData of configs) {
        const config = await testPrisma.caseTypeConfig.create({
          data: configData,
        });
        if (!createdConfigId) createdConfigId = config.id;
      }
    });

    it('应该能够按类别查询', async () => {
      const civilConfigs = await testPrisma.caseTypeConfig.findMany({
        where: { category: CaseTypeCategory.CIVIL },
      });

      expect(civilConfigs.length).toBeGreaterThan(0);
      expect(civilConfigs[0].category).toBe(CaseTypeCategory.CIVIL);
    });

    it('应该能够按激活状态查询', async () => {
      const activeConfigs = await testPrisma.caseTypeConfig.findMany({
        where: { isActive: true },
      });

      expect(activeConfigs.length).toBeGreaterThan(0);
      activeConfigs.forEach(config => {
        expect(config.isActive).toBe(true);
      });
    });

    it('应该能够按代码查询', async () => {
      const config = await testPrisma.caseTypeConfig.findUnique({
        where: { code: 'TYPE_1' },
      });

      expect(config).toBeDefined();
      expect(config?.code).toBe('TYPE_1');
    });
  });

  describe('更新案件类型配置', () => {
    it('应该成功更新案件类型配置', async () => {
      const requiredDocs: MaterialList = {
        materials: [{ name: '合同', description: '合同原件', copies: 1 }],
      };

      const config = await testPrisma.caseTypeConfig.create({
        data: {
          code: 'UPDATE_TEST',
          name: '原始名称',
          category: CaseTypeCategory.CIVIL,
          baseFee: 5000,
          requiredDocs: requiredDocs as never,
          optionalDocs: null,
          complexityLevel: 2,
        },
      });

      createdConfigId = config.id;

      const updated = await testPrisma.caseTypeConfig.update({
        where: { id: config.id },
        data: {
          name: '更新名称',
          baseFee: 8000,
          complexityLevel: 4,
        },
      });

      expect(updated.name).toBe('更新名称');
      expect(String(updated.baseFee)).toBe('8000');
      expect(updated.complexityLevel).toBe(4);
    });

    it('应该更新 updatedAt 字段', async () => {
      const requiredDocs: MaterialList = {
        materials: [{ name: '合同', description: '合同原件', copies: 1 }],
      };

      const config = await testPrisma.caseTypeConfig.create({
        data: {
          code: 'TIMESTAMP_TEST',
          name: '时间戳测试',
          category: CaseTypeCategory.CIVIL,
          baseFee: 5000,
          requiredDocs: requiredDocs as never,
          optionalDocs: null,
          complexityLevel: 2,
        },
      });

      createdConfigId = config.id;

      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 100));

      await testPrisma.caseTypeConfig.update({
        where: { id: config.id },
        data: { name: '更新名称' },
      });

      const updated = await testPrisma.caseTypeConfig.findUnique({
        where: { id: config.id },
      });

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        config.updatedAt.getTime()
      );
    });
  });

  describe('删除案件类型配置', () => {
    it('应该成功删除案件类型配置', async () => {
      const requiredDocs: MaterialList = {
        materials: [{ name: '合同', description: '合同原件', copies: 1 }],
      };

      const config = await testPrisma.caseTypeConfig.create({
        data: {
          code: 'DELETE_TEST',
          name: '删除测试',
          category: CaseTypeCategory.CIVIL,
          baseFee: 5000,
          requiredDocs: requiredDocs as never,
          optionalDocs: null,
          complexityLevel: 2,
        },
      });

      const id = config.id;

      await testPrisma.caseTypeConfig.delete({
        where: { id },
      });

      const deleted = await testPrisma.caseTypeConfig.findUnique({
        where: { id },
      });

      expect(deleted).toBeNull();
    });
  });
});
