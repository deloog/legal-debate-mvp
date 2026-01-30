/**
 * 动态首页组件测试
 *
 * 测试覆盖：
 * 1. DynamicHomepage 主组件渲染
 * 2. HeroSection 组件渲染
 * 3. StatsSection 组件渲染
 * 4. FeaturesSection 组件渲染
 * 5. TestimonialsSection 组件渲染
 * 6. CTASection 组件渲染
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DynamicHomepage } from '@/components/homepage/DynamicHomepage';
import { HOMEPAGE_CONFIGS } from '@/config/homepage-config';
import { HomepageRole } from '@/lib/user/role-detector';

// =============================================================================
// 测试套件
// =============================================================================

describe('动态首页组件', () => {
  describe('DynamicHomepage - 主组件', () => {
    it('应该渲染律师版首页', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      // 验证hero标题
      expect(screen.getByText(config.hero.title)).toBeInTheDocument();
      expect(screen.getByText(config.hero.subtitle)).toBeInTheDocument();
    });

    it('应该渲染企业法务版首页', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.ENTERPRISE];
      render(<DynamicHomepage config={config} />);

      expect(screen.getByText(config.hero.title)).toBeInTheDocument();
      expect(screen.getByText(config.hero.subtitle)).toBeInTheDocument();
    });

    it('应该渲染普通用户版首页', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.GENERAL];
      render(<DynamicHomepage config={config} />);

      expect(screen.getByText(config.hero.title)).toBeInTheDocument();
      expect(screen.getByText(config.hero.subtitle)).toBeInTheDocument();
    });

    it('应该包含所有主要区域', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      // 验证各个区域存在
      expect(screen.getByTestId('hero-section')).toBeInTheDocument();
      expect(screen.getByTestId('stats-section')).toBeInTheDocument();
      expect(screen.getByTestId('features-section')).toBeInTheDocument();
      expect(screen.getByTestId('testimonials-section')).toBeInTheDocument();
      expect(screen.getByTestId('cta-section')).toBeInTheDocument();
    });
  });

  describe('HeroSection - Hero区域', () => {
    it('应该渲染完整的hero内容', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      expect(screen.getByText(config.hero.title)).toBeInTheDocument();
      expect(screen.getByText(config.hero.subtitle)).toBeInTheDocument();
      expect(screen.getByText(config.hero.description)).toBeInTheDocument();
    });

    it('应该渲染主要CTA按钮', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      const primaryButton = screen.getByRole('link', {
        name: config.hero.primaryCTA.text,
      });
      expect(primaryButton).toBeInTheDocument();
      expect(primaryButton).toHaveAttribute(
        'href',
        config.hero.primaryCTA.href
      );
    });

    it('应该渲染次要CTA按钮', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      const secondaryButton = screen.getByRole('link', {
        name: config.hero.secondaryCTA.text,
      });
      expect(secondaryButton).toBeInTheDocument();
      expect(secondaryButton).toHaveAttribute(
        'href',
        config.hero.secondaryCTA.href
      );
    });

    it('不同角色应该显示不同的hero内容', () => {
      const lawyerConfig = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      const enterpriseConfig = HOMEPAGE_CONFIGS[HomepageRole.ENTERPRISE];

      const { unmount } = render(<DynamicHomepage config={lawyerConfig} />);
      expect(screen.getByText(lawyerConfig.hero.title)).toBeInTheDocument();

      unmount();

      render(<DynamicHomepage config={enterpriseConfig} />);
      expect(screen.getByText(enterpriseConfig.hero.title)).toBeInTheDocument();
      expect(
        screen.queryByText(lawyerConfig.hero.title)
      ).not.toBeInTheDocument();
    });
  });

  describe('StatsSection - 统计数据区域', () => {
    it('应该渲染所有统计数据', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      config.stats.forEach(stat => {
        expect(screen.getByText(stat.label)).toBeInTheDocument();
        expect(screen.getByText(stat.value)).toBeInTheDocument();
        expect(screen.getByText(stat.description)).toBeInTheDocument();
      });
    });

    it('应该渲染正确数量的统计项', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      const statsSection = screen.getByTestId('stats-section');
      const statItems = statsSection.querySelectorAll('[data-testid^="stat-"]');
      expect(statItems).toHaveLength(config.stats.length);
    });

    it('不同角色应该显示不同的统计数据', () => {
      const lawyerConfig = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      const enterpriseConfig = HOMEPAGE_CONFIGS[HomepageRole.ENTERPRISE];

      const { unmount } = render(<DynamicHomepage config={lawyerConfig} />);
      expect(screen.getByText(lawyerConfig.stats[0].label)).toBeInTheDocument();

      unmount();

      render(<DynamicHomepage config={enterpriseConfig} />);
      expect(
        screen.getByText(enterpriseConfig.stats[0].label)
      ).toBeInTheDocument();
    });
  });

  describe('FeaturesSection - 功能特性区域', () => {
    it('应该渲染所有功能特性', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      config.features.forEach(feature => {
        expect(screen.getByText(feature.title)).toBeInTheDocument();
        expect(screen.getByText(feature.description)).toBeInTheDocument();
      });
    });

    it('应该渲染正确数量的功能卡片', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      const featuresSection = screen.getByTestId('features-section');
      const featureCards = featuresSection.querySelectorAll(
        '[data-testid^="feature-"]'
      );
      expect(featureCards).toHaveLength(config.features.length);
    });

    it('功能卡片应该包含链接', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      const featuresSection = screen.getByTestId('features-section');
      const featureLinks = featuresSection.querySelectorAll('a[href]');

      expect(featureLinks.length).toBe(config.features.length);

      config.features.forEach((feature, index) => {
        expect(featureLinks[index]).toHaveAttribute('href', feature.href);
      });
    });

    it('不同角色应该显示不同的功能特性', () => {
      const lawyerConfig = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      const enterpriseConfig = HOMEPAGE_CONFIGS[HomepageRole.ENTERPRISE];

      const { unmount } = render(<DynamicHomepage config={lawyerConfig} />);
      expect(
        screen.getByText(lawyerConfig.features[0].title)
      ).toBeInTheDocument();

      unmount();

      render(<DynamicHomepage config={enterpriseConfig} />);
      expect(
        screen.getByText(enterpriseConfig.features[0].title)
      ).toBeInTheDocument();
    });
  });

  describe('TestimonialsSection - 用户评价区域', () => {
    it('应该渲染所有用户评价', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      config.testimonials.forEach(testimonial => {
        // 使用正则表达式匹配引号内的内容
        expect(
          screen.getByText((content, element) => {
            return (
              element?.textContent === `"${testimonial.content}"` ||
              content.includes(testimonial.content)
            );
          })
        ).toBeInTheDocument();
        expect(screen.getByText(testimonial.author)).toBeInTheDocument();
        expect(screen.getByText(testimonial.role)).toBeInTheDocument();
      });
    });

    it('应该渲染正确数量的评价卡片', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      const testimonialsSection = screen.getByTestId('testimonials-section');
      const testimonialCards = testimonialsSection.querySelectorAll(
        '[data-testid^="testimonial-"]'
      );
      expect(testimonialCards).toHaveLength(config.testimonials.length);
    });

    it('不同角色应该显示不同的用户评价', () => {
      const lawyerConfig = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      const enterpriseConfig = HOMEPAGE_CONFIGS[HomepageRole.ENTERPRISE];

      const { unmount } = render(<DynamicHomepage config={lawyerConfig} />);
      expect(
        screen.getByText((content, element) => {
          return (
            element?.textContent ===
              `"${lawyerConfig.testimonials[0].content}"` ||
            content.includes(lawyerConfig.testimonials[0].content)
          );
        })
      ).toBeInTheDocument();

      unmount();

      render(<DynamicHomepage config={enterpriseConfig} />);
      expect(
        screen.getByText((content, element) => {
          return (
            element?.textContent ===
              `"${enterpriseConfig.testimonials[0].content}"` ||
            content.includes(enterpriseConfig.testimonials[0].content)
          );
        })
      ).toBeInTheDocument();
    });
  });

  describe('CTASection - CTA区域', () => {
    it('应该渲染完整的CTA内容', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      expect(screen.getByText(config.cta.title)).toBeInTheDocument();
      expect(screen.getByText(config.cta.description)).toBeInTheDocument();
    });

    it('应该渲染主要按钮', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      const primaryButton = screen.getAllByRole('link', {
        name: config.cta.primaryButton.text,
      })[0];
      expect(primaryButton).toBeInTheDocument();
      expect(primaryButton).toHaveAttribute(
        'href',
        config.cta.primaryButton.href
      );
    });

    it('应该渲染次要按钮', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      const secondaryButton = screen.getAllByRole('link', {
        name: config.cta.secondaryButton.text,
      })[0];
      expect(secondaryButton).toBeInTheDocument();
      expect(secondaryButton).toHaveAttribute(
        'href',
        config.cta.secondaryButton.href
      );
    });

    it('不同角色应该显示不同的CTA内容', () => {
      const lawyerConfig = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      const enterpriseConfig = HOMEPAGE_CONFIGS[HomepageRole.ENTERPRISE];

      const { unmount } = render(<DynamicHomepage config={lawyerConfig} />);
      expect(screen.getByText(lawyerConfig.cta.title)).toBeInTheDocument();

      unmount();

      render(<DynamicHomepage config={enterpriseConfig} />);
      expect(screen.getByText(enterpriseConfig.cta.title)).toBeInTheDocument();
      expect(
        screen.queryByText(lawyerConfig.cta.title)
      ).not.toBeInTheDocument();
    });
  });

  describe('响应式设计', () => {
    it('应该在所有区域添加响应式类名', () => {
      const config = HOMEPAGE_CONFIGS[HomepageRole.LAWYER];
      render(<DynamicHomepage config={config} />);

      const heroSection = screen.getByTestId('hero-section');
      expect(heroSection.className).toContain('container');

      const statsSection = screen.getByTestId('stats-section');
      expect(statsSection.className).toContain('container');

      const featuresSection = screen.getByTestId('features-section');
      expect(featuresSection.className).toContain('container');
    });
  });

  describe('边界情况', () => {
    it('应该处理空的stats数组', () => {
      const config = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        stats: [],
      };
      render(<DynamicHomepage config={config} />);

      const statsSection = screen.getByTestId('stats-section');
      const statItems = statsSection.querySelectorAll('[data-testid^="stat-"]');
      expect(statItems).toHaveLength(0);
    });

    it('应该处理空的features数组', () => {
      const config = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        features: [],
      };
      render(<DynamicHomepage config={config} />);

      const featuresSection = screen.getByTestId('features-section');
      const featureCards = featuresSection.querySelectorAll(
        '[data-testid^="feature-"]'
      );
      expect(featureCards).toHaveLength(0);
    });

    it('应该处理空的testimonials数组', () => {
      const config = {
        ...HOMEPAGE_CONFIGS[HomepageRole.LAWYER],
        testimonials: [],
      };
      render(<DynamicHomepage config={config} />);

      const testimonialsSection = screen.getByTestId('testimonials-section');
      const testimonialCards = testimonialsSection.querySelectorAll(
        '[data-testid^="testimonial-"]'
      );
      expect(testimonialCards).toHaveLength(0);
    });
  });
});
