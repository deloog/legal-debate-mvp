/**
 * 首页配置系统
 *
 * 功能：
 * 1. 为三个角色（律师、企业法务、普通用户）提供不同的首页配置
 * 2. 包含hero区域、统计数据、功能特性、用户评价、CTA区域等配置
 * 3. 提供配置获取和验证函数
 */

import { HomepageRole } from '@/lib/user/role-detector';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * CTA按钮配置
 */
export interface CTAButton {
  text: string;
  href: string;
}

/**
 * Hero区域配置
 */
export interface HeroConfig {
  title: string;
  subtitle: string;
  description: string;
  primaryCTA: CTAButton;
  secondaryCTA: CTAButton;
}

/**
 * 统计数据配置
 */
export interface StatConfig {
  label: string;
  value: string;
  description: string;
}

/**
 * 功能特性配置
 */
export interface FeatureConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
}

/**
 * 用户评价配置
 */
export interface TestimonialConfig {
  id: string;
  content: string;
  author: string;
  role: string;
  avatar: string;
}

/**
 * CTA区域配置
 */
export interface CTAConfig {
  title: string;
  description: string;
  primaryButton: CTAButton;
  secondaryButton: CTAButton;
}

/**
 * 首页配置
 */
export interface HomepageConfig {
  role: HomepageRole;
  hero: HeroConfig;
  stats: StatConfig[];
  features: FeatureConfig[];
  testimonials: TestimonialConfig[];
  cta: CTAConfig;
}

/**
 * 配置验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// =============================================================================
// 配置常量
// =============================================================================

/**
 * 律师版首页配置
 */
const LAWYER_CONFIG: HomepageConfig = {
  role: HomepageRole.LAWYER,
  hero: {
    title: '律师智能工作台',
    subtitle: '专为执业律师打造的AI法律助手',
    description:
      '利用AI技术提升办案效率，智能分析案件、生成法律文书、辅助辩论策略，让您专注于核心法律服务',
    primaryCTA: {
      text: '开始使用',
      href: '/cases',
    },
    secondaryCTA: {
      text: '了解更多',
      href: '/about',
    },
  },
  stats: [
    {
      label: '服务律师',
      value: '10,000+',
      description: '全国执业律师信赖之选',
    },
    {
      label: '案件分析',
      value: '50,000+',
      description: '累计处理案件数量',
    },
    {
      label: '准确率',
      value: '95%+',
      description: 'AI分析准确率',
    },
    {
      label: '效率提升',
      value: '3倍',
      description: '平均办案效率提升',
    },
  ],
  features: [
    {
      id: 'case-management',
      title: '智能案件管理',
      description: '全流程案件管理，自动提醒关键节点，智能归档整理',
      icon: 'briefcase',
      href: '/cases',
    },
    {
      id: 'ai-debate',
      title: 'AI辩论分析',
      description: '智能分析案件争议点，生成辩论策略，提供法律依据',
      icon: 'scale',
      href: '/debates',
    },
    {
      id: 'document-generation',
      title: '法律文书生成',
      description: '快速生成起诉状、答辩状等法律文书，提高文档处理效率',
      icon: 'document',
      href: '/document-templates',
    },
    {
      id: 'law-search',
      title: '法条智能检索',
      description: '快速检索相关法律法规，精准定位法律依据',
      icon: 'search',
      href: '/law-articles',
    },
    {
      id: 'client-management',
      title: '客户关系管理',
      description: '维护客户信息，记录沟通历史，管理跟进任务',
      icon: 'users',
      href: '/clients',
    },
    {
      id: 'team-collaboration',
      title: '团队协作',
      description: '与团队成员协作处理案件，共享资源和经验',
      icon: 'team',
      href: '/teams',
    },
  ],
  testimonials: [
    {
      id: 'testimonial-lawyer-1',
      content:
        '使用律伴助手后，我的办案效率提升了3倍，AI辅助分析让我能更快找到案件突破口。',
      author: '张律师',
      role: '资深刑事辩护律师',
      avatar: '/avatars/lawyer-1.jpg',
    },
    {
      id: 'testimonial-lawyer-2',
      content:
        '文书生成功能非常实用，节省了大量时间，让我能专注于案件策略的制定。',
      author: '李律师',
      role: '民商事诉讼律师',
      avatar: '/avatars/lawyer-2.jpg',
    },
    {
      id: 'testimonial-lawyer-3',
      content:
        'AI辩论分析功能帮助我发现了很多之前忽略的法律观点，大大提升了胜诉率。',
      author: '王律师',
      role: '知识产权律师',
      avatar: '/avatars/lawyer-3.jpg',
    },
  ],
  cta: {
    title: '开启您的智能办案之旅',
    description: '加入10,000+律师的选择，体验AI赋能的法律服务',
    primaryButton: {
      text: '立即开始',
      href: '/cases/new',
    },
    secondaryButton: {
      text: '预约演示',
      href: '/contact',
    },
  },
};

/**
 * 企业法务版首页配置
 */
const ENTERPRISE_CONFIG: HomepageConfig = {
  role: HomepageRole.ENTERPRISE,
  hero: {
    title: '企业法务智能平台',
    subtitle: '专为企业法务团队打造的合规管理系统',
    description:
      '全面管理企业合同、合规审查、纠纷处理，AI辅助法律风险预警，助力企业稳健发展',
    primaryCTA: {
      text: '开始使用',
      href: '/contracts',
    },
    secondaryCTA: {
      text: '了解方案',
      href: '/solutions/enterprise',
    },
  },
  stats: [
    {
      label: '服务企业',
      value: '5,000+',
      description: '覆盖各行业企业客户',
    },
    {
      label: '合同管理',
      value: '100,000+',
      description: '累计管理合同数量',
    },
    {
      label: '风险预警',
      value: '98%',
      description: '风险识别准确率',
    },
    {
      label: '成本节约',
      value: '40%',
      description: '平均法务成本降低',
    },
  ],
  features: [
    {
      id: 'contract-management',
      title: '智能合同管理',
      description: '统一管理企业合同，追踪履行状态，自动预警到期合同',
      icon: 'document-text',
      href: '/contracts',
    },
    {
      id: 'compliance-check',
      title: '合规自动审查',
      description: '企业合规自检，法规更新追踪，智能风险预警',
      icon: 'shield-check',
      href: '/compliance',
    },
    {
      id: 'dispute-management',
      title: '纠纷处理管理',
      description: '管理企业涉诉案件，协调内外部资源，降低法律风险',
      icon: 'scale',
      href: '/disputes',
    },
    {
      id: 'legal-opinion',
      title: '法律意见管理',
      description: '内部法律咨询记录，意见存档与检索，知识库建设',
      icon: 'annotation',
      href: '/legal-opinions',
    },
    {
      id: 'compliance-training',
      title: '合规培训',
      description: '法务知识库，员工合规培训管理，提升全员法律意识',
      icon: 'academic-cap',
      href: '/training',
    },
    {
      id: 'legal-reports',
      title: '法务数据报告',
      description: '生成法务工作报告，数据分析与展示，辅助决策',
      icon: 'chart-bar',
      href: '/reports',
    },
  ],
  testimonials: [
    {
      id: 'testimonial-enterprise-1',
      content: '律伴助手帮助我们建立了完善的合同管理体系，大大降低了合同风险。',
      author: '陈总监',
      role: '某科技公司法务总监',
      avatar: '/avatars/enterprise-1.jpg',
    },
    {
      id: 'testimonial-enterprise-2',
      content:
        '合规审查功能非常强大，帮助我们及时发现并规避了多个潜在法律风险。',
      author: '刘经理',
      role: '某制造企业法务经理',
      avatar: '/avatars/enterprise-2.jpg',
    },
    {
      id: 'testimonial-enterprise-3',
      content:
        '系统化的法务管理让我们的工作效率提升了50%，法务团队可以专注于更有价值的工作。',
      author: '赵主管',
      role: '某金融机构法务主管',
      avatar: '/avatars/enterprise-3.jpg',
    },
  ],
  cta: {
    title: '构建企业法务智能化体系',
    description: '加入5,000+企业的选择，开启法务数字化转型',
    primaryButton: {
      text: '申请试用',
      href: '/enterprise/trial',
    },
    secondaryButton: {
      text: '咨询方案',
      href: '/contact',
    },
  },
};

/**
 * 普通用户版首页配置
 */
const GENERAL_CONFIG: HomepageConfig = {
  role: HomepageRole.GENERAL,
  hero: {
    title: '律伴助手 - AI法律服务平台',
    subtitle: '让法律服务触手可及',
    description:
      '无论您是律师、企业法务还是普通用户，律伴助手都能为您提供专业的AI法律服务，让法律问题变得简单',
    primaryCTA: {
      text: '免费注册',
      href: '/register',
    },
    secondaryCTA: {
      text: '了解更多',
      href: '/about',
    },
  },
  stats: [
    {
      label: '注册用户',
      value: '50,000+',
      description: '覆盖全国各地用户',
    },
    {
      label: '法律咨询',
      value: '200,000+',
      description: '累计提供咨询服务',
    },
    {
      label: '满意度',
      value: '4.8/5',
      description: '用户平均评分',
    },
    {
      label: '响应时间',
      value: '<1分钟',
      description: 'AI即时响应',
    },
  ],
  features: [
    {
      id: 'ai-consultation',
      title: 'AI法律咨询',
      description: '24小时在线AI法律顾问，即时解答您的法律问题',
      icon: 'chat',
      href: '/consultation',
    },
    {
      id: 'document-analysis',
      title: '文档智能分析',
      description: '上传合同、协议等文档，AI自动分析风险点和关键条款',
      icon: 'document-search',
      href: '/document-analysis',
    },
    {
      id: 'lawyer-matching',
      title: '律师智能匹配',
      description: '根据您的需求，智能匹配最合适的专业律师',
      icon: 'user-group',
      href: '/lawyers',
    },
    {
      id: 'legal-knowledge',
      title: '法律知识库',
      description: '海量法律知识，通俗易懂的法律解读',
      icon: 'book-open',
      href: '/knowledge',
    },
    {
      id: 'case-reference',
      title: '案例参考',
      description: '查询相似案例，了解判决结果和法律依据',
      icon: 'clipboard-list',
      href: '/cases/reference',
    },
    {
      id: 'legal-tools',
      title: '法律工具',
      description: '提供各类法律计算器、文书模板等实用工具',
      icon: 'calculator',
      href: '/tools',
    },
  ],
  testimonials: [
    {
      id: 'testimonial-general-1',
      content:
        '作为普通用户，律伴助手让我第一次感觉法律问题不再遥不可及，AI咨询非常专业。',
      author: '张先生',
      role: '创业者',
      avatar: '/avatars/user-1.jpg',
    },
    {
      id: 'testimonial-general-2',
      content: '文档分析功能帮我发现了租房合同中的不合理条款，避免了潜在纠纷。',
      author: '李女士',
      role: '白领',
      avatar: '/avatars/user-2.jpg',
    },
    {
      id: 'testimonial-general-3',
      content: '通过律伴助手找到了专业的律师，解决了困扰我很久的法律问题。',
      author: '王先生',
      role: '个体户',
      avatar: '/avatars/user-3.jpg',
    },
  ],
  cta: {
    title: '开始您的法律服务之旅',
    description: '注册即可免费体验AI法律咨询，专业律师随时为您服务',
    primaryButton: {
      text: '免费注册',
      href: '/register',
    },
    secondaryButton: {
      text: '申请认证',
      href: '/qualification/apply',
    },
  },
};

/**
 * 首页配置映射
 */
export const HOMEPAGE_CONFIGS: Record<HomepageRole, HomepageConfig> = {
  [HomepageRole.LAWYER]: LAWYER_CONFIG,
  [HomepageRole.ENTERPRISE]: ENTERPRISE_CONFIG,
  [HomepageRole.GENERAL]: GENERAL_CONFIG,
};

// =============================================================================
// 配置获取函数
// =============================================================================

/**
 * 获取首页配置
 *
 * @param role 用户角色
 * @returns 首页配置
 */
export function getHomepageConfig(role: HomepageRole): HomepageConfig {
  return HOMEPAGE_CONFIGS[role] || HOMEPAGE_CONFIGS[HomepageRole.GENERAL];
}

// =============================================================================
// 配置验证函数
// =============================================================================

/**
 * 验证首页配置
 *
 * @param config 首页配置
 * @returns 验证结果
 */
export function validateHomepageConfig(
  config: HomepageConfig
): ValidationResult {
  const errors: string[] = [];

  // 验证role字段
  if (!config.role) {
    errors.push('配置缺少role字段');
  }

  // 验证hero字段
  if (!config.hero) {
    errors.push('配置缺少hero字段');
  } else {
    if (!config.hero.title) {
      errors.push('hero配置缺少title字段');
    }
    if (!config.hero.subtitle) {
      errors.push('hero配置缺少subtitle字段');
    }
    if (!config.hero.description) {
      errors.push('hero配置缺少description字段');
    }
    if (!config.hero.primaryCTA) {
      errors.push('hero配置缺少primaryCTA字段');
    }
    if (!config.hero.secondaryCTA) {
      errors.push('hero配置缺少secondaryCTA字段');
    }
  }

  // 验证stats字段
  if (!config.stats) {
    errors.push('配置缺少stats字段');
  } else if (!Array.isArray(config.stats)) {
    errors.push('stats字段必须是数组');
  } else if (config.stats.length === 0) {
    errors.push('stats数组不能为空');
  }

  // 验证features字段
  if (!config.features) {
    errors.push('配置缺少features字段');
  } else if (!Array.isArray(config.features)) {
    errors.push('features字段必须是数组');
  } else if (config.features.length === 0) {
    errors.push('features数组不能为空');
  }

  // 验证testimonials字段
  if (!config.testimonials) {
    errors.push('配置缺少testimonials字段');
  } else if (!Array.isArray(config.testimonials)) {
    errors.push('testimonials字段必须是数组');
  } else if (config.testimonials.length === 0) {
    errors.push('testimonials数组不能为空');
  }

  // 验证cta字段
  if (!config.cta) {
    errors.push('配置缺少cta字段');
  } else {
    if (!config.cta.title) {
      errors.push('cta配置缺少title字段');
    }
    if (!config.cta.description) {
      errors.push('cta配置缺少description字段');
    }
    if (!config.cta.primaryButton) {
      errors.push('cta配置缺少primaryButton字段');
    }
    if (!config.cta.secondaryButton) {
      errors.push('cta配置缺少secondaryButton字段');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
