/**
 * 首页配置系统测试
 *
 * 测试覆盖：
 * 1. 律师版首页配置
 * 2. 企业法务版首页配置
 * 3. 普通用户版首页配置
 * 4. 配置完整性验证
 * 5. 配置获取函数
 */

import {
  HomepageConfig,
  HOMEPAGE_CONFIGS,
  getHomepageConfig,
  validateHomepageConfig,
} from '@/config/homepage-config';
import { HomepageRole } from '@/lib/user/role-detector';

// =============================================================================
// 测试套件
// =============================================================================

describe('首页配置系统', () => {
  describe('HOMEPAGE_CONFIGS - 配置常量', () => {
    it('应该包含三个角色的配置', () => {
      expect(HOMEPAGE_CONFIGS).toHaveProperty(HomepageRole.LAWYER);
      expect(HOMEPAGE_CONFIGS).toHaveProperty(HomepageRole.ENTERPRISE);
      expect(HOMEPAGE_CONFIGS).toHaveProperty(HomepageRole.GENERAL);
    });

    it('应该只包含三个角色的配置', () => {
      const keys = Object.keys(HOMEPAGE_CONFIGS);
      expect(keys).toHaveLength(3);
    });
  });

  describe('律师版首页配置', () => {
    const lawyerConfig = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];

    it('应该有正确的角色标识', () => {
      expect(lawyerConfig.role).toBe(HomepageRole.LAWYER);
    });

    it('应该有完整的hero区域配置', () => {
      expect(lawyerConfig.hero).toBeDefined();
      expect(lawyerConfig.hero.title).toBeTruthy();
      expect(lawyerConfig.hero.subtitle).toBeTruthy();
      expect(lawyerConfig.hero.description).toBeTruthy();
      expect(lawyerConfig.hero.primaryCTA).toBeDefined();
      expect(lawyerConfig.hero.primaryCTA.text).toBeTruthy();
      expect(lawyerConfig.hero.primaryCTA.href).toBeTruthy();
      expect(lawyerConfig.hero.secondaryCTA).toBeDefined();
      expect(lawyerConfig.hero.secondaryCTA.text).toBeTruthy();
      expect(lawyerConfig.hero.secondaryCTA.href).toBeTruthy();
    });

    it('应该有统计数据配置', () => {
      expect(lawyerConfig.stats).toBeDefined();
      expect(Array.isArray(lawyerConfig.stats)).toBe(true);
      expect(lawyerConfig.stats.length).toBeGreaterThan(0);

      lawyerConfig.stats.forEach(stat => {
        expect(stat.label).toBeTruthy();
        expect(stat.value).toBeTruthy();
        expect(stat.description).toBeTruthy();
      });
    });

    it('应该有功能特性配置', () => {
      expect(lawyerConfig.features).toBeDefined();
      expect(Array.isArray(lawyerConfig.features)).toBe(true);
      expect(lawyerConfig.features.length).toBeGreaterThan(0);

      lawyerConfig.features.forEach(feature => {
        expect(feature.id).toBeTruthy();
        expect(feature.title).toBeTruthy();
        expect(feature.description).toBeTruthy();
        expect(feature.icon).toBeTruthy();
        expect(feature.href).toBeTruthy();
      });
    });

    it('应该有用户评价配置', () => {
      expect(lawyerConfig.testimonials).toBeDefined();
      expect(Array.isArray(lawyerConfig.testimonials)).toBe(true);
      expect(lawyerConfig.testimonials.length).toBeGreaterThan(0);

      lawyerConfig.testimonials.forEach(testimonial => {
        expect(testimonial.id).toBeTruthy();
        expect(testimonial.content).toBeTruthy();
        expect(testimonial.author).toBeTruthy();
        expect(testimonial.role).toBeTruthy();
        expect(testimonial.avatar).toBeTruthy();
      });
    });

    it('应该有CTA区域配置', () => {
      expect(lawyerConfig.cta).toBeDefined();
      expect(lawyerConfig.cta.title).toBeTruthy();
      expect(lawyerConfig.cta.description).toBeTruthy();
      expect(lawyerConfig.cta.primaryButton).toBeDefined();
      expect(lawyerConfig.cta.primaryButton.text).toBeTruthy();
      expect(lawyerConfig.cta.primaryButton.href).toBeTruthy();
      expect(lawyerConfig.cta.secondaryButton).toBeDefined();
      expect(lawyerConfig.cta.secondaryButton.text).toBeTruthy();
      expect(lawyerConfig.cta.secondaryButton.href).toBeTruthy();
    });

    it('律师版应该包含律师专属功能', () => {
      const featureIds = lawyerConfig.features.map(f => f.id);
      expect(featureIds).toContain('case-management');
      expect(featureIds).toContain('ai-debate');
    });
  });

  describe('企业法务版首页配置', () => {
    const enterpriseConfig = HOMEPAGE_CONFIGS[HomepageRole.ENTERPRISE];

    it('应该有正确的角色标识', () => {
      expect(enterpriseConfig.role).toBe(HomepageRole.ENTERPRISE);
    });

    it('应该有完整的hero区域配置', () => {
      expect(enterpriseConfig.hero).toBeDefined();
      expect(enterpriseConfig.hero.title).toBeTruthy();
      expect(enterpriseConfig.hero.subtitle).toBeTruthy();
      expect(enterpriseConfig.hero.description).toBeTruthy();
      expect(enterpriseConfig.hero.primaryCTA).toBeDefined();
      expect(enterpriseConfig.hero.secondaryCTA).toBeDefined();
    });

    it('应该有统计数据配置', () => {
      expect(enterpriseConfig.stats).toBeDefined();
      expect(Array.isArray(enterpriseConfig.stats)).toBe(true);
      expect(enterpriseConfig.stats.length).toBeGreaterThan(0);
    });

    it('应该有功能特性配置', () => {
      expect(enterpriseConfig.features).toBeDefined();
      expect(Array.isArray(enterpriseConfig.features)).toBe(true);
      expect(enterpriseConfig.features.length).toBeGreaterThan(0);
    });

    it('应该有用户评价配置', () => {
      expect(enterpriseConfig.testimonials).toBeDefined();
      expect(Array.isArray(enterpriseConfig.testimonials)).toBe(true);
      expect(enterpriseConfig.testimonials.length).toBeGreaterThan(0);
    });

    it('应该有CTA区域配置', () => {
      expect(enterpriseConfig.cta).toBeDefined();
      expect(enterpriseConfig.cta.title).toBeTruthy();
      expect(enterpriseConfig.cta.description).toBeTruthy();
    });

    it('企业法务版应该包含企业专属功能', () => {
      const featureIds = enterpriseConfig.features.map(f => f.id);
      expect(featureIds).toContain('contract-management');
      expect(featureIds).toContain('compliance-check');
    });

    it('企业法务版内容应该与律师版不同', () => {
      const lawyerConfig = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      expect(enterpriseConfig.hero.title).not.toBe(lawyerConfig.hero.title);
      expect(enterpriseConfig.hero.description).not.toBe(
        lawyerConfig.hero.description
      );
    });
  });

  describe('普通用户版首页配置', () => {
    const generalConfig = HOMEPAGE_CONFIGS[HomepageRole.GENERAL];

    it('应该有正确的角色标识', () => {
      expect(generalConfig.role).toBe(HomepageRole.GENERAL);
    });

    it('应该有完整的hero区域配置', () => {
      expect(generalConfig.hero).toBeDefined();
      expect(generalConfig.hero.title).toBeTruthy();
      expect(generalConfig.hero.subtitle).toBeTruthy();
      expect(generalConfig.hero.description).toBeTruthy();
      expect(generalConfig.hero.primaryCTA).toBeDefined();
      expect(generalConfig.hero.secondaryCTA).toBeDefined();
    });

    it('应该有统计数据配置', () => {
      expect(generalConfig.stats).toBeDefined();
      expect(Array.isArray(generalConfig.stats)).toBe(true);
      expect(generalConfig.stats.length).toBeGreaterThan(0);
    });

    it('应该有功能特性配置', () => {
      expect(generalConfig.features).toBeDefined();
      expect(Array.isArray(generalConfig.features)).toBe(true);
      expect(generalConfig.features.length).toBeGreaterThan(0);
    });

    it('应该有用户评价配置', () => {
      expect(generalConfig.testimonials).toBeDefined();
      expect(Array.isArray(generalConfig.testimonials)).toBe(true);
      expect(generalConfig.testimonials.length).toBeGreaterThan(0);
    });

    it('应该有CTA区域配置', () => {
      expect(generalConfig.cta).toBeDefined();
      expect(generalConfig.cta.title).toBeTruthy();
      expect(generalConfig.cta.description).toBeTruthy();
    });

    it('普通用户版应该包含通用功能', () => {
      const featureIds = generalConfig.features.map(f => f.id);
      expect(featureIds).toContain('ai-consultation');
      expect(featureIds).toContain('document-analysis');
    });

    it('普通用户版CTA应该引导注册或认证', () => {
      expect(
        generalConfig.cta.primaryButton.href.includes('register') ||
          generalConfig.cta.primaryButton.href.includes('qualification')
      ).toBe(true);
    });
  });

  describe('getHomepageConfig - 配置获取函数', () => {
    it('应该正确返回律师版配置', () => {
      const config = getHomepageConfig(HomepageRole.LAWYER);
      expect(config.role).toBe(HomepageRole.LAWYER);
    });

    it('应该正确返回企业法务版配置', () => {
      const config = getHomepageConfig(HomepageRole.ENTERPRISE);
      expect(config.role).toBe(HomepageRole.ENTERPRISE);
    });

    it('应该正确返回普通用户版配置', () => {
      const config = getHomepageConfig(HomepageRole.GENERAL);
      expect(config.role).toBe(HomepageRole.GENERAL);
    });

    it('应该为无效角色返回普通用户版配置', () => {
      const config = getHomepageConfig('INVALID' as HomepageRole);
      expect(config.role).toBe(HomepageRole.GENERAL);
    });

    it('应该为null返回普通用户版配置', () => {
      const config = getHomepageConfig(null as unknown as HomepageRole);
      expect(config.role).toBe(HomepageRole.GENERAL);
    });

    it('应该为undefined返回普通用户版配置', () => {
      const config = getHomepageConfig(undefined as unknown as HomepageRole);
      expect(config.role).toBe(HomepageRole.GENERAL);
    });
  });

  describe('validateHomepageConfig - 配置验证函数', () => {
    it('应该验证律师版配置有效', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      const result = validateHomepageConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证企业法务版配置有效', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.ENTERPRISE];
      const result = validateHomepageConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证普通用户版配置有效', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.GENERAL];
      const result = validateHomepageConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测缺少role字段', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        role: undefined,
      } as unknown as HomepageConfig;
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('role'))).toBe(true);
    });

    it('应该检测缺少hero字段', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        hero: undefined,
      } as unknown as HomepageConfig;
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('hero'))).toBe(true);
    });

    it('应该检测缺少stats字段', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        stats: undefined,
      } as unknown as HomepageConfig;
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('stats'))).toBe(true);
    });

    it('应该检测缺少features字段', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        features: undefined,
      } as unknown as HomepageConfig;
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('features'))).toBe(true);
    });

    it('应该检测空的stats数组', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        stats: [],
      };
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('stats'))).toBe(true);
    });

    it('应该检测空的features数组', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        features: [],
      };
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('features'))).toBe(true);
    });

    it('应该检测空的testimonials数组', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        testimonials: [],
      };
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('testimonials'))).toBe(true);
    });

    it('应该检测hero.title为空字符串', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        hero: {
          ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER].hero,
          title: '',
        },
      };
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('title'))).toBe(true);
    });

    it('应该检测hero.subtitle为空字符串', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        hero: {
          ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER].hero,
          subtitle: '',
        },
      };
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('subtitle'))).toBe(true);
    });

    it('应该检测hero.description为空字符串', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        hero: {
          ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER].hero,
          description: '',
        },
      };
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('description'))).toBe(true);
    });

    it('应该检测cta.title为空字符串', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        cta: {
          ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER].cta,
          title: '',
        },
      };
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('title'))).toBe(true);
    });

    it('应该检测cta.description为空字符串', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        cta: {
          ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER].cta,
          description: '',
        },
      };
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('description'))).toBe(true);
    });

    it('应该检测stats不是数组', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        stats: 'not an array',
      } as unknown as HomepageConfig;
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('stats'))).toBe(true);
    });

    it('应该检测features不是数组', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        features: 'not an array',
      } as unknown as HomepageConfig;
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('features'))).toBe(true);
    });

    it('应该检测testimonials不是数组', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        testimonials: 'not an array',
      } as unknown as HomepageConfig;
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('testimonials'))).toBe(true);
    });

    it('应该检测缺少hero.primaryCTA字段', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        hero: {
          ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER].hero,
          primaryCTA: undefined,
        },
      } as unknown as HomepageConfig;
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('primaryCTA'))).toBe(true);
    });

    it('应该检测缺少hero.secondaryCTA字段', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        hero: {
          ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER].hero,
          secondaryCTA: undefined,
        },
      } as unknown as HomepageConfig;
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('secondaryCTA'))).toBe(true);
    });

    it('应该检测缺少cta.primaryButton字段', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        cta: {
          ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER].cta,
          primaryButton: undefined,
        },
      } as unknown as HomepageConfig;
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('primaryButton'))).toBe(true);
    });

    it('应该检测缺少cta.secondaryButton字段', () => {
      const invalidConfig = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        cta: {
          ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER].cta,
          secondaryButton: undefined,
        },
      } as unknown as HomepageConfig;
      const result = validateHomepageConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('secondaryButton'))).toBe(true);
    });
  });

  describe('配置内容差异性', () => {
    it('三个角色的hero标题应该不同', () => {
      const lawyerTitle = HOMEPAGE_CONFIGS[HomepageRole.LAWYER].hero.title;
      const enterpriseTitle =
        HOMEPAGE_CONFIGS[HomepageRole.ENTERPRISE].hero.title;
      const generalTitle = HOMEPAGE_CONFIGS[HomepageRole.GENERAL].hero.title;

      expect(lawyerTitle).not.toBe(enterpriseTitle);
      expect(lawyerTitle).not.toBe(generalTitle);
      expect(enterpriseTitle).not.toBe(generalTitle);
    });

    it('三个角色的功能特性应该有差异', () => {
      const lawyerFeatures = HOMEPAGE_CONFIGS[HomepageRole.LAWYER].features.map(
        f => f.id
      );
      const enterpriseFeatures = HOMEPAGE_CONFIGS[
        HomepageRole.ENTERPRISE
      ].features.map(f => f.id);
      const generalFeatures = HOMEPAGE_CONFIGS[
        HomepageRole.GENERAL
      ].features.map(f => f.id);

      // 律师版和企业版应该有不同的功能
      const lawyerEnterpriseOverlap = lawyerFeatures.filter(id =>
        enterpriseFeatures.includes(id)
      );
      expect(lawyerEnterpriseOverlap.length).toBeLessThan(
        Math.min(lawyerFeatures.length, enterpriseFeatures.length)
      );

      // 律师版和普通用户版应该有不同的功能
      const lawyerGeneralOverlap = lawyerFeatures.filter(id =>
        generalFeatures.includes(id)
      );
      expect(lawyerGeneralOverlap.length).toBeLessThan(
        Math.min(lawyerFeatures.length, generalFeatures.length)
      );
    });

    it('三个角色的CTA按钮文本应该有差异', () => {
      const lawyerCTA =
        HOMEPAGE_CONFIGS[HomepageRole.LAWYER].cta.primaryButton.text;
      const enterpriseCTA =
        HOMEPAGE_CONFIGS[HomepageRole.ENTERPRISE].cta.primaryButton.text;
      const generalCTA =
        HOMEPAGE_CONFIGS[HomepageRole.GENERAL].cta.primaryButton.text;

      // 至少有两个不同
      const uniqueTexts = new Set([lawyerCTA, enterpriseCTA, generalCTA]);
      expect(uniqueTexts.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('配置完整性', () => {
    it('所有配置的features应该有唯一的id', () => {
      Object.values(HOMEPAGE_CONFIGS).forEach(config => {
        const ids = config.features.map(f => f.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      });
    });

    it('所有配置的testimonials应该有唯一的id', () => {
      Object.values(HOMEPAGE_CONFIGS).forEach(config => {
        const ids = config.testimonials.map(t => t.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      });
    });

    it('所有配置的stats应该有唯一的label', () => {
      Object.values(HOMEPAGE_CONFIGS).forEach(config => {
        const labels = config.stats.map(s => s.label);
        const uniqueLabels = new Set(labels);
        expect(uniqueLabels.size).toBe(labels.length);
      });
    });

    it('所有href链接应该以/开头', () => {
      Object.values(HOMEPAGE_CONFIGS).forEach(config => {
        expect(config.hero.primaryCTA.href).toMatch(/^\//);
        expect(config.hero.secondaryCTA.href).toMatch(/^\//);
        expect(config.cta.primaryButton.href).toMatch(/^\//);
        expect(config.cta.secondaryButton.href).toMatch(/^\//);
        config.features.forEach(feature => {
          expect(feature.href).toMatch(/^\//);
        });
      });
    });
  });
});
