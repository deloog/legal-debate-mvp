/**
 * 系统配置初始化种子脚本
 *
 * 写入运行时可动态调整的业务参数。以下内容不在此处管理：
 * - 数据库地址、JWT密钥、API Key —— 在服务器 .env 环境变量中
 * - 固定的业务逻辑 —— 在代码中
 *
 * 使用方法：
 *   npx tsx prisma/seed-configs.ts
 *
 * 此脚本使用 upsert，可安全重复执行：已存在的配置不会被覆盖（value不变），
 * 不存在的配置会被创建为默认值。
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ConfigSeed {
  key: string;
  value: unknown;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
  category: string;
  description: string;
  isPublic: boolean;
  isRequired: boolean;
  defaultValue: unknown;
}

const CONFIGS: ConfigSeed[] = [
  // ==========================================================================
  // AI 模型参数
  // ==========================================================================
  {
    key: 'ai.temperature',
    value: 0.7,
    type: 'NUMBER',
    category: 'ai',
    description:
      'AI生成温度，控制输出的随机性。范围 0~2，越高越有创意但越不稳定，建议 0.5~0.9',
    isPublic: false,
    isRequired: true,
    defaultValue: 0.7,
  },
  {
    key: 'ai.max_tokens',
    value: 2000,
    type: 'NUMBER',
    category: 'ai',
    description:
      '单次AI请求的最大输出token数。增大可获得更长的回答，但会增加费用和响应时间',
    isPublic: false,
    isRequired: true,
    defaultValue: 2000,
  },
  {
    key: 'ai.debate_default_rounds',
    value: 3,
    type: 'NUMBER',
    category: 'ai',
    description: '新建辩论时的默认轮数（1~10）。用户可在创建时调整',
    isPublic: false,
    isRequired: true,
    defaultValue: 3,
  },
  {
    key: 'ai.enable_quality_review',
    value: true,
    type: 'BOOLEAN',
    category: 'ai',
    description:
      '是否开启AI论点质量自动审核。开启后每条AI论点生成后会自动评分，关闭可加快生成速度',
    isPublic: false,
    isRequired: true,
    defaultValue: true,
  },
  {
    key: 'ai.balance_strictness',
    value: 'medium',
    type: 'STRING',
    category: 'ai',
    description:
      '辩论双方平衡严格程度：low（宽松）/ medium（均衡）/ high（严格）。影响AI对双方论点的平衡控制力度',
    isPublic: false,
    isRequired: true,
    defaultValue: 'medium',
  },

  // ==========================================================================
  // 功能开关
  // ==========================================================================
  {
    key: 'feature.enable_payment',
    value: false,
    type: 'BOOLEAN',
    category: 'feature',
    description: '启用支付功能。MVP试用阶段设为false（关闭），正式商业化后开启',
    isPublic: false,
    isRequired: true,
    defaultValue: false,
  },
  {
    key: 'feature.enable_lawyer_qualification',
    value: true,
    type: 'BOOLEAN',
    category: 'feature',
    description: '启用律师资质认证功能。关闭后用户无法提交律师认证申请',
    isPublic: false,
    isRequired: true,
    defaultValue: true,
  },
  {
    key: 'feature.enable_enterprise',
    value: true,
    type: 'BOOLEAN',
    category: 'feature',
    description: '启用企业认证功能。关闭后企业用户无法提交认证申请',
    isPublic: false,
    isRequired: true,
    defaultValue: true,
  },
  {
    key: 'feature.enable_knowledge_graph',
    value: true,
    type: 'BOOLEAN',
    category: 'feature',
    description:
      '启用知识图谱功能（法条关联分析、图谱可视化）。关闭后相关页面不可用',
    isPublic: false,
    isRequired: true,
    defaultValue: true,
  },
  {
    key: 'feature.enable_contract_ai_review',
    value: true,
    type: 'BOOLEAN',
    category: 'feature',
    description: '启用AI合同审查功能。关闭后合同审查页面不可用',
    isPublic: false,
    isRequired: true,
    defaultValue: true,
  },
  {
    key: 'feature.maintenance_mode',
    value: false,
    type: 'BOOLEAN',
    category: 'feature',
    description:
      '系统维护模式。开启后前端显示维护提示，所有API返回503。部署升级时临时开启',
    isPublic: true,
    isRequired: true,
    defaultValue: false,
  },

  // ==========================================================================
  // 业务参数
  // ==========================================================================
  {
    key: 'business.free_debate_monthly_limit',
    value: 5,
    type: 'NUMBER',
    category: 'business',
    description: '免费用户每月可创建的辩论次数上限。超出后提示升级会员',
    isPublic: false,
    isRequired: true,
    defaultValue: 5,
  },
  {
    key: 'business.free_case_limit',
    value: 10,
    type: 'NUMBER',
    category: 'business',
    description: '免费用户可创建的案件总数上限',
    isPublic: false,
    isRequired: true,
    defaultValue: 10,
  },
  {
    key: 'business.lawyer_grace_period_days',
    value: 7,
    type: 'NUMBER',
    category: 'business',
    description:
      '律师认证审核宽限期（天）。注册后该天数内可使用律师功能，到期未通过认证则降级',
    isPublic: false,
    isRequired: true,
    defaultValue: 7,
  },
  {
    key: 'business.ai_quota_free_monthly',
    value: 100,
    type: 'NUMBER',
    category: 'business',
    description: '免费用户每月AI配额次数（包含辩论生成、合同分析等所有AI调用）',
    isPublic: false,
    isRequired: true,
    defaultValue: 100,
  },
  {
    key: 'business.ai_quota_basic_monthly',
    value: 500,
    type: 'NUMBER',
    category: 'business',
    description: '基础会员每月AI配额次数',
    isPublic: false,
    isRequired: true,
    defaultValue: 500,
  },
  {
    key: 'business.ai_quota_professional_monthly',
    value: 2000,
    type: 'NUMBER',
    category: 'business',
    description: '专业会员每月AI配额次数',
    isPublic: false,
    isRequired: true,
    defaultValue: 2000,
  },
  {
    key: 'business.ai_quota_enterprise_monthly',
    value: 10000,
    type: 'NUMBER',
    category: 'business',
    description: '企业会员每月AI配额次数',
    isPublic: false,
    isRequired: true,
    defaultValue: 10000,
  },
  {
    key: 'business.ai_quota_lawyer_monthly',
    value: 2000,
    type: 'NUMBER',
    category: 'business',
    description: '律师会员每月AI配额次数',
    isPublic: false,
    isRequired: true,
    defaultValue: 2000,
  },
  {
    key: 'business.ai_quota_free_daily',
    value: 10,
    type: 'NUMBER',
    category: 'business',
    description: '免费用户每日AI配额次数',
    isPublic: false,
    isRequired: true,
    defaultValue: 10,
  },
  {
    key: 'business.ai_quota_basic_daily',
    value: 50,
    type: 'NUMBER',
    category: 'business',
    description: '基础会员每日AI配额次数',
    isPublic: false,
    isRequired: true,
    defaultValue: 50,
  },
  {
    key: 'business.ai_quota_professional_daily',
    value: 200,
    type: 'NUMBER',
    category: 'business',
    description: '专业会员每日AI配额次数',
    isPublic: false,
    isRequired: true,
    defaultValue: 200,
  },
  {
    key: 'business.ai_quota_enterprise_daily',
    value: 500,
    type: 'NUMBER',
    category: 'business',
    description: '企业会员每日AI配额次数',
    isPublic: false,
    isRequired: true,
    defaultValue: 500,
  },
  {
    key: 'business.ai_quota_lawyer_daily',
    value: 100,
    type: 'NUMBER',
    category: 'business',
    description: '律师会员每日AI配额次数',
    isPublic: false,
    isRequired: true,
    defaultValue: 100,
  },
  {
    key: 'business.ai_quota_free_per_request',
    value: 1000,
    type: 'NUMBER',
    category: 'business',
    description: '免费用户单次请求最大AI Token限制',
    isPublic: false,
    isRequired: true,
    defaultValue: 1000,
  },
  {
    key: 'business.ai_quota_basic_per_request',
    value: 2000,
    type: 'NUMBER',
    category: 'business',
    description: '基础会员单次请求最大AI Token限制',
    isPublic: false,
    isRequired: true,
    defaultValue: 2000,
  },
  {
    key: 'business.ai_quota_professional_per_request',
    value: 4000,
    type: 'NUMBER',
    category: 'business',
    description: '专业会员单次请求最大AI Token限制',
    isPublic: false,
    isRequired: true,
    defaultValue: 4000,
  },
  {
    key: 'business.ai_quota_enterprise_per_request',
    value: 8000,
    type: 'NUMBER',
    category: 'business',
    description: '企业会员单次请求最大AI Token限制',
    isPublic: false,
    isRequired: true,
    defaultValue: 8000,
  },
  {
    key: 'business.ai_quota_lawyer_per_request',
    value: 3000,
    type: 'NUMBER',
    category: 'business',
    description: '律师会员单次请求最大AI Token限制',
    isPublic: false,
    isRequired: true,
    defaultValue: 3000,
  },

  // ==========================================================================
  // 通知设置
  // ==========================================================================
  {
    key: 'notification.admin_on_qualification',
    value: true,
    type: 'BOOLEAN',
    category: 'notification',
    description: '律师认证申请提交时，发送邮件通知管理员',
    isPublic: false,
    isRequired: false,
    defaultValue: true,
  },
  {
    key: 'notification.admin_on_enterprise',
    value: true,
    type: 'BOOLEAN',
    category: 'notification',
    description: '企业认证申请提交时，发送邮件通知管理员',
    isPublic: false,
    isRequired: false,
    defaultValue: true,
  },
  {
    key: 'notification.admin_on_report',
    value: true,
    type: 'BOOLEAN',
    category: 'notification',
    description: '用户举报提交时，发送邮件通知管理员',
    isPublic: false,
    isRequired: false,
    defaultValue: true,
  },

  // ==========================================================================
  // 通用/公开设置
  // ==========================================================================
  {
    key: 'general.site_name',
    value: '律伴助手',
    type: 'STRING',
    category: 'general',
    description: '网站名称，显示在页面标题和邮件中',
    isPublic: true,
    isRequired: true,
    defaultValue: '律伴助手',
  },
  {
    key: 'general.contact_email',
    value: '',
    type: 'STRING',
    category: 'general',
    description: '官方联系邮箱，显示在用户端帮助页面',
    isPublic: true,
    isRequired: false,
    defaultValue: '',
  },
  {
    key: 'general.icp_beian',
    value: '',
    type: 'STRING',
    category: 'general',
    description: 'ICP备案号，显示在网站底部。示例：京ICP备XXXXXXXX号',
    isPublic: true,
    isRequired: false,
    defaultValue: '',
  },
];

async function main() {
  console.log('开始写入系统配置种子数据...');
  let created = 0;
  let skipped = 0;

  for (const config of CONFIGS) {
    const existing = await prisma.systemConfig.findUnique({
      where: { key: config.key },
    });

    if (existing) {
      // 已存在：只更新 description/category/type/isPublic/isRequired/defaultValue
      // 不覆盖 value，保留管理员之前设置的值
      await prisma.systemConfig.update({
        where: { key: config.key },
        data: {
          description: config.description,
          category: config.category,
          type: config.type,
          isPublic: config.isPublic,
          isRequired: config.isRequired,
          defaultValue: config.defaultValue as never,
        },
      });
      skipped++;
    } else {
      await prisma.systemConfig.create({
        data: {
          key: config.key,
          value: config.value as never,
          type: config.type,
          category: config.category,
          description: config.description,
          isPublic: config.isPublic,
          isRequired: config.isRequired,
          defaultValue: config.defaultValue as never,
        },
      });
      created++;
    }
  }

  console.log(
    `✅ 完成：新建 ${created} 条，已存在跳过 ${skipped} 条（value保持不变）`
  );
}

main()
  .catch(e => {
    console.error('种子数据写入失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
