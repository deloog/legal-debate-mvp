/**
 * 动态首页组件
 *
 * 功能：
 * 1. 根据配置渲染不同角色的首页
 * 2. 包含Hero、Stats、Features、Testimonials、CTA等区域
 * 3. 响应式设计，适配各种屏幕尺寸
 */

'use client';

import Link from 'next/link';
import {
  HomepageConfig,
  HeroConfig,
  StatConfig,
  FeatureConfig,
  TestimonialConfig,
  CTAConfig,
} from '@/config/homepage-config';

// =============================================================================
// 类型定义
// =============================================================================

interface DynamicHomepageProps {
  config: HomepageConfig;
}

interface HeroSectionProps {
  hero: HeroConfig;
}

interface StatsSectionProps {
  stats: StatConfig[];
}

interface FeaturesSectionProps {
  features: FeatureConfig[];
}

interface TestimonialsSectionProps {
  testimonials: TestimonialConfig[];
}

interface CTASectionProps {
  cta: CTAConfig;
}

// =============================================================================
// Hero区域组件
// =============================================================================

function HeroSection({ hero }: HeroSectionProps) {
  return (
    <section
      data-testid='hero-section'
      className='container mx-auto px-4 py-16 md:py-24'
    >
      <div className='max-w-4xl mx-auto text-center'>
        <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4'>
          {hero.title}
        </h1>
        <p className='text-xl md:text-2xl text-blue-600 font-semibold mb-6'>
          {hero.subtitle}
        </p>
        <p className='text-lg text-gray-600 mb-8 max-w-2xl mx-auto'>
          {hero.description}
        </p>
        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
          <Link
            href={hero.primaryCTA.href}
            className='inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors'
          >
            {hero.primaryCTA.text}
          </Link>
          <Link
            href={hero.secondaryCTA.href}
            className='inline-block px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg border-2 border-blue-600 hover:bg-blue-50 transition-colors'
          >
            {hero.secondaryCTA.text}
          </Link>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// 统计数据区域组件
// =============================================================================

function StatsSection({ stats }: StatsSectionProps) {
  return (
    <section
      data-testid='stats-section'
      className='container mx-auto px-4 py-12 bg-gray-50'
    >
      <div className='grid grid-cols-2 md:grid-cols-4 gap-8'>
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            data-testid={`stat-${index}`}
            className='text-center'
          >
            <div className='text-3xl md:text-4xl font-bold text-blue-600 mb-2'>
              {stat.value}
            </div>
            <div className='text-sm md:text-base font-semibold text-gray-900 mb-1'>
              {stat.label}
            </div>
            <div className='text-xs md:text-sm text-gray-600'>
              {stat.description}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// =============================================================================
// 功能特性区域组件
// =============================================================================

function FeaturesSection({ features }: FeaturesSectionProps) {
  return (
    <section
      data-testid='features-section'
      className='container mx-auto px-4 py-16'
    >
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
        {features.map((feature, index) => (
          <Link
            key={feature.id}
            href={feature.href}
            data-testid={`feature-${index}`}
            className='block p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all'
          >
            <div className='flex items-center mb-4'>
              <div className='w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4'>
                <span className='text-2xl'>{getIconEmoji(feature.icon)}</span>
              </div>
              <h3 className='text-xl font-semibold text-gray-900'>
                {feature.title}
              </h3>
            </div>
            <p className='text-gray-600'>{feature.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

// =============================================================================
// 用户评价区域组件
// =============================================================================

function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  return (
    <section
      data-testid='testimonials-section'
      className='container mx-auto px-4 py-16 bg-gray-50'
    >
      <h2 className='text-3xl font-bold text-center text-gray-900 mb-12'>
        用户评价
      </h2>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
        {testimonials.map((testimonial, index) => (
          <div
            key={testimonial.id}
            data-testid={`testimonial-${index}`}
            className='bg-white p-6 rounded-lg shadow-md'
          >
            <p className='text-gray-700 mb-4 italic'>
              &quot;{testimonial.content}&quot;
            </p>
            <div className='flex items-center'>
              <div className='w-12 h-12 bg-gray-300 rounded-full mr-4 flex items-center justify-center'>
                <span className='text-xl'>👤</span>
              </div>
              <div>
                <div className='font-semibold text-gray-900'>
                  {testimonial.author}
                </div>
                <div className='text-sm text-gray-600'>{testimonial.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// =============================================================================
// CTA区域组件
// =============================================================================

function CTASection({ cta }: CTASectionProps) {
  return (
    <section data-testid='cta-section' className='container mx-auto px-4 py-16'>
      <div className='bg-blue-600 rounded-2xl p-12 text-center text-white'>
        <h2 className='text-3xl md:text-4xl font-bold mb-4'>{cta.title}</h2>
        <p className='text-lg md:text-xl mb-8 max-w-2xl mx-auto'>
          {cta.description}
        </p>
        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
          <Link
            href={cta.primaryButton.href}
            className='inline-block px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors'
          >
            {cta.primaryButton.text}
          </Link>
          <Link
            href={cta.secondaryButton.href}
            className='inline-block px-8 py-3 bg-transparent text-white font-semibold rounded-lg border-2 border-white hover:bg-white hover:text-blue-600 transition-colors'
          >
            {cta.secondaryButton.text}
          </Link>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// 主组件
// =============================================================================

export function DynamicHomepage({ config }: DynamicHomepageProps) {
  return (
    <div className='min-h-screen bg-white'>
      <HeroSection hero={config.hero} />
      <StatsSection stats={config.stats} />
      <FeaturesSection features={config.features} />
      <TestimonialsSection testimonials={config.testimonials} />
      <CTASection cta={config.cta} />
    </div>
  );
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 根据图标名称返回对应的emoji
 */
function getIconEmoji(icon: string): string {
  const iconMap: Record<string, string> = {
    briefcase: '💼',
    scale: '⚖️',
    document: '📄',
    'document-text': '📝',
    search: '🔍',
    users: '👥',
    team: '👨‍👩‍👧‍👦',
    'shield-check': '🛡️',
    annotation: '💬',
    'academic-cap': '🎓',
    'chart-bar': '📊',
    chat: '💬',
    'document-search': '🔎',
    'user-group': '👥',
    'book-open': '📖',
    'clipboard-list': '📋',
    calculator: '🧮',
    calendar: '📅',
  };

  return iconMap[icon] || '📌';
}
