/**
 * AI置信度阈值配置管理单元测试
 */

import { AIConfidenceConfig } from '@/lib/law-article/ai-confidence-config';
import { RelationType } from '@prisma/client';

describe('AIConfidenceConfig', () => {
  beforeEach(() => {
    // 清除自定义配置
    AIConfidenceConfig.resetThreshold();
  });

  describe('getThreshold', () => {
    it('应该返回默认阈值配置', () => {
      const config = AIConfidenceConfig.getThreshold(RelationType.CITES);

      expect(config.relationType).toBe(RelationType.CITES);
      expect(config.minimumThreshold).toBe(0.6);
      expect(config.recommendedThreshold).toBe(0.75);
      expect(config.requiresHumanReview).toBe(true);
      expect(config.autoAccept).toBe(false);
    });

    it('应该返回不同关系类型的默认配置', () => {
      const citesConfig = AIConfidenceConfig.getThreshold(RelationType.CITES);
      const conflictsConfig = AIConfidenceConfig.getThreshold(
        RelationType.CONFLICTS
      );
      const relatedConfig = AIConfidenceConfig.getThreshold(
        RelationType.RELATED
      );

      // 冲突关系阈值应该最高
      expect(conflictsConfig.minimumThreshold).toBeGreaterThan(
        citesConfig.minimumThreshold
      );
      expect(conflictsConfig.recommendedThreshold).toBeGreaterThan(
        citesConfig.recommendedThreshold
      );

      // 一般关联阈值应该最低
      expect(relatedConfig.minimumThreshold).toBeLessThan(
        citesConfig.minimumThreshold
      );
      expect(relatedConfig.autoAccept).toBe(true);
    });

    it('应该支持自定义阈值配置', () => {
      const customConfig = {
        relationType: RelationType.CITES,
        minimumThreshold: 0.5,
        recommendedThreshold: 0.7,
        requiresHumanReview: false,
        autoAccept: true,
      };

      AIConfidenceConfig.setThreshold(customConfig, {
        aiProvider: 'custom-provider',
      });

      const config = AIConfidenceConfig.getThreshold(
        RelationType.CITES,
        'custom-provider'
      );

      expect(config).toEqual(customConfig);
    });
  });

  describe('validateThreshold', () => {
    it('应该接受高于阈值的置信度', () => {
      const result = AIConfidenceConfig.validateThreshold(
        0.8,
        RelationType.CITES
      );

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(0.8);
      expect(result.action).toBe('REVIEW');
      expect(result.reason).toContain('达到阈值');
    });

    it('应该拒绝低于最小阈值的置信度', () => {
      const result = AIConfidenceConfig.validateThreshold(
        0.4,
        RelationType.CITES
      );

      expect(result.isValid).toBe(false);
      expect(result.action).toBe('REJECT');
      expect(result.reason).toContain('低于最小阈值');
    });

    it('应该将介于最小和推荐阈值之间的置信度标记为审核', () => {
      const result = AIConfidenceConfig.validateThreshold(
        0.65,
        RelationType.CITES
      );

      expect(result.isValid).toBe(false);
      expect(result.action).toBe('REVIEW');
      expect(result.reason).toContain('低于推荐阈值');
    });

    it('应该接受可自动接受的关系', () => {
      const result = AIConfidenceConfig.validateThreshold(
        0.6,
        RelationType.RELATED
      );

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('ACCEPT');
    });

    it('应该拒绝超出范围的置信度', () => {
      const result1 = AIConfidenceConfig.validateThreshold(
        -0.1,
        RelationType.CITES
      );
      expect(result1.isValid).toBe(false);
      expect(result1.reason).toBe('置信度必须在0-1之间');

      const result2 = AIConfidenceConfig.validateThreshold(
        1.5,
        RelationType.CITES
      );
      expect(result2.isValid).toBe(false);
      expect(result2.reason).toBe('置信度必须在0-1之间');
    });

    it('应该支持自定义阈值', () => {
      const result = AIConfidenceConfig.validateThreshold(
        0.7,
        RelationType.CITES,
        { customThreshold: 0.65 }
      );

      expect(result.isValid).toBe(true);
      expect(result.threshold).toBe(0.65);
    });
  });

  describe('setThreshold', () => {
    it('应该设置自定义阈值', () => {
      const customConfig = {
        relationType: RelationType.CITES,
        minimumThreshold: 0.5,
        recommendedThreshold: 0.7,
        requiresHumanReview: false,
        autoAccept: true,
      };

      AIConfidenceConfig.setThreshold(customConfig);

      const config = AIConfidenceConfig.getThreshold(RelationType.CITES);

      expect(config.recommendedThreshold).toBe(0.7);
    });

    it('应该支持提供商级别的自定义配置', () => {
      const openaiConfig = {
        relationType: RelationType.CITES,
        minimumThreshold: 0.7,
        recommendedThreshold: 0.85,
        requiresHumanReview: true,
        autoAccept: false,
      };

      AIConfidenceConfig.setThreshold(openaiConfig, {
        aiProvider: 'openai',
      });

      const openaiResult = AIConfidenceConfig.validateThreshold(
        0.8,
        RelationType.CITES,
        { aiProvider: 'openai' }
      );

      expect(openaiResult.isValid).toBe(false);

      const defaultResult = AIConfidenceConfig.validateThreshold(
        0.8,
        RelationType.CITES
      );

      expect(defaultResult.isValid).toBe(true);
    });

    it('应该支持模型级别的自定义配置', () => {
      const gpt4Config = {
        relationType: RelationType.CITES,
        minimumThreshold: 0.75,
        recommendedThreshold: 0.9,
        requiresHumanReview: true,
        autoAccept: false,
      };

      AIConfidenceConfig.setThreshold(gpt4Config, {
        aiProvider: 'openai',
        aiModel: 'gpt-4',
      });

      const gpt4Result = AIConfidenceConfig.validateThreshold(
        0.85,
        RelationType.CITES,
        { aiProvider: 'openai', aiModel: 'gpt-4' }
      );

      expect(gpt4Result.isValid).toBe(false);
    });
  });

  describe('setThresholds', () => {
    it('应该批量设置阈值', () => {
      const configs = [
        {
          relationType: RelationType.CITES,
          minimumThreshold: 0.5,
          recommendedThreshold: 0.7,
          requiresHumanReview: false,
          autoAccept: true,
        },
        {
          relationType: RelationType.CONFLICTS,
          minimumThreshold: 0.8,
          recommendedThreshold: 0.9,
          requiresHumanReview: true,
          autoAccept: false,
        },
      ];

      AIConfidenceConfig.setThresholds(configs);

      const citesConfig = AIConfidenceConfig.getThreshold(RelationType.CITES);
      const conflictsConfig = AIConfidenceConfig.getThreshold(
        RelationType.CONFLICTS
      );

      expect(citesConfig.recommendedThreshold).toBe(0.7);
      expect(conflictsConfig.recommendedThreshold).toBe(0.9);
    });
  });

  describe('resetThreshold', () => {
    it('应该重置特定关系类型的阈值', () => {
      const customConfig = {
        relationType: RelationType.CITES,
        minimumThreshold: 0.5,
        recommendedThreshold: 0.7,
        requiresHumanReview: false,
        autoAccept: true,
      };

      AIConfidenceConfig.setThreshold(customConfig);
      expect(
        AIConfidenceConfig.getThreshold(RelationType.CITES).recommendedThreshold
      ).toBe(0.7);

      AIConfidenceConfig.resetThreshold(RelationType.CITES);

      const defaultConfig = AIConfidenceConfig.getThreshold(RelationType.CITES);
      expect(defaultConfig.recommendedThreshold).toBe(0.75);
    });

    it('应该重置所有阈值', () => {
      const customConfig = {
        relationType: RelationType.CITES,
        minimumThreshold: 0.5,
        recommendedThreshold: 0.7,
        requiresHumanReview: false,
        autoAccept: true,
      };

      AIConfidenceConfig.setThreshold(customConfig);

      AIConfidenceConfig.resetThreshold();

      const config = AIConfidenceConfig.getThreshold(RelationType.CITES);
      expect(config.recommendedThreshold).toBe(0.75);
    });
  });

  describe('getAllThresholds', () => {
    it('应该返回所有阈值配置', () => {
      const allThresholds = AIConfidenceConfig.getAllThresholds();

      expect(allThresholds.size).toBe(Object.keys(RelationType).length);
      expect(allThresholds.has(RelationType.CITES)).toBe(true);
      expect(allThresholds.has(RelationType.CONFLICTS)).toBe(true);
      expect(allThresholds.has(RelationType.RELATED)).toBe(true);
    });
  });

  describe('exportConfig', () => {
    it('应该导出配置为JSON', () => {
      const config = AIConfidenceConfig.exportConfig();

      expect(typeof config).toBe('object');
      expect(config.CITES).toBeDefined();
      expect(config.CONFLICTS).toBeDefined();
      expect(config.RELATED).toBeDefined();
    });
  });

  describe('importConfig', () => {
    it('应该导入配置', () => {
      const configToImport = {
        CITES: {
          relationType: RelationType.CITES,
          minimumThreshold: 0.5,
          recommendedThreshold: 0.7,
          requiresHumanReview: false,
          autoAccept: true,
        },
      };

      AIConfidenceConfig.importConfig(configToImport);

      const config = AIConfidenceConfig.getThreshold(RelationType.CITES);
      expect(config.recommendedThreshold).toBe(0.7);
    });
  });

  describe('recommendThreshold', () => {
    it('应该在反馈不足时返回默认阈值', () => {
      const stats = {
        avgAccuracy: 0.9,
        avgConfidenceRating: 5,
        totalFeedbacks: 5, // 少于10
      };

      const recommended = AIConfidenceConfig.recommendThreshold(
        RelationType.CITES,
        stats
      );

      expect(recommended).toBe(0.75); // 默认阈值
    });

    it('应该在准确率高时降低阈值', () => {
      const stats = {
        avgAccuracy: 0.9,
        avgConfidenceRating: 4.5,
        totalFeedbacks: 20,
      };

      const recommended = AIConfidenceConfig.recommendThreshold(
        RelationType.CITES,
        stats
      );

      expect(recommended).toBeLessThan(0.75);
    });

    it('应该在准确率低时提高阈值', () => {
      const stats = {
        avgAccuracy: 0.4,
        avgConfidenceRating: 2.5,
        totalFeedbacks: 20,
      };

      const recommended = AIConfidenceConfig.recommendThreshold(
        RelationType.CITES,
        stats
      );

      expect(recommended).toBeGreaterThan(0.75);
    });

    it('应该在用户评分低时提高阈值', () => {
      const stats = {
        avgAccuracy: 0.7,
        avgConfidenceRating: 2, // 用户不满意
        totalFeedbacks: 20,
      };

      const recommended = AIConfidenceConfig.recommendThreshold(
        RelationType.CITES,
        stats
      );

      expect(recommended).toBeGreaterThan(0.75);
    });

    it('应该确保不低于最小阈值', () => {
      const stats = {
        avgAccuracy: 1.0,
        avgConfidenceRating: 5,
        totalFeedbacks: 20,
      };

      const recommended = AIConfidenceConfig.recommendThreshold(
        RelationType.CITES,
        stats
      );

      // 即使准确率很高，也不能低于最小阈值
      expect(recommended).toBeGreaterThanOrEqual(0.6);
    });
  });
});
