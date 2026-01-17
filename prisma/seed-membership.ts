/**
 * 会员等级权限配置种子数据初始化脚本
 * 用于初始化会员等级系统的默认配置，包括：
 * - 四个会员等级（FREE、BASIC、PROFESSIONAL、ENTERPRISE）
 * - 每个等级的权限配置
 * - 每个等级的使用量限制
 */

import {
  MEMBERSHIP_TIERS,
  type TierPermissionConfig,
} from './membership-tier-config';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =============================================================================
// 主函数
// =============================================================================

async function main() {
  console.log('开始初始化会员等级配置...\n');

  // 第一步：创建会员等级
  console.log('1. 创建会员等级...');
  let tiersCount = 0;
  const createdTiers: Record<string, string> = {};

  for (const tierDef of MEMBERSHIP_TIERS) {
    try {
      const tier = await prisma.membershipTier.upsert({
        where: { name: tierDef.name },
        update: {
          displayName: tierDef.displayName,
          description: tierDef.description,
          price: new Prisma.Decimal(tierDef.price),
          features: tierDef.features,
          permissions: tierDef.permissions as unknown as Prisma.JsonObject,
          isActive: tierDef.isActive,
          sortOrder: tierDef.sortOrder,
        },
        create: {
          name: tierDef.name,
          displayName: tierDef.displayName,
          description: tierDef.description,
          tier: tierDef.tier as
            | 'FREE'
            | 'BASIC'
            | 'PROFESSIONAL'
            | 'ENTERPRISE',
          price: new Prisma.Decimal(tierDef.price),
          currency: tierDef.currency,
          billingCycle: tierDef.billingCycle as
            | 'MONTHLY'
            | 'QUARTERLY'
            | 'YEARLY'
            | 'LIFETIME',
          features: tierDef.features,
          permissions: tierDef.permissions as unknown as Prisma.JsonObject,
          isActive: tierDef.isActive,
          sortOrder: tierDef.sortOrder,
        },
      });

      createdTiers[tierDef.name] = tier.id;
      tiersCount++;
      console.log(
        `   ✓ 创建/更新会员等级: ${tier.displayName} (${tierDef.tier})`
      );
    } catch (error) {
      console.error(`   ✗ 创建会员等级失败: ${tierDef.name}`, error);
      throw error;
    }
  }
  console.log(`   总计创建/更新 ${tiersCount} 个会员等级\n`);

  // 第二步：创建等级限制
  console.log('2. 创建等级限制...');
  let limitsCount = 0;

  for (const tierDef of MEMBERSHIP_TIERS) {
    const tierId = createdTiers[tierDef.name];
    if (!tierId) {
      console.warn(`   ⚠ 未找到等级ID: ${tierDef.name}`);
      continue;
    }

    console.log(`   配置 ${tierDef.displayName} 的限制...`);

    for (const limitDef of tierDef.limits) {
      try {
        await prisma.tierLimit.upsert({
          where: {
            tierId_limitType: {
              tierId,
              limitType: limitDef.limitType,
            },
          },
          update: {
            limitValue: limitDef.limitValue,
            period: limitDef.period,
            description: limitDef.description,
          },
          create: {
            tierId,
            limitType: limitDef.limitType,
            limitValue: limitDef.limitValue,
            period: limitDef.period,
            description: limitDef.description,
          },
        });
        limitsCount++;
        console.log(
          `      ✓ ${limitDef.limitType}: ${limitDef.limitValue ?? '无限制'}`
        );
      } catch (error) {
        console.error(`      ✗ 创建限制失败: ${limitDef.limitType}`, error);
        throw error;
      }
    }
  }
  console.log(`   总计创建/更新 ${limitsCount} 个等级限制\n`);

  // 第三步：统计信息
  console.log('================ 初始化完成 ================');
  const tierCount = await prisma.membershipTier.count({
    where: { isActive: true },
  });
  const limitCount = await prisma.tierLimit.count();

  console.log(`- 会员等级总数: ${tierCount}`);
  console.log(`- 等级限制总数: ${limitCount}`);
  console.log('==============================================\n');

  // 第四步：打印会员等级详情
  printTierDetails();
}

/**
 * 打印会员等级详情
 */
async function printTierDetails(): Promise<void> {
  console.log('4. 会员等级详情:');

  for (const tierDef of MEMBERSHIP_TIERS) {
    const tier = await prisma.membershipTier.findUnique({
      where: { name: tierDef.name },
      include: {
        tierLimits: true,
      },
    });

    if (tier) {
      console.log(`\n${tier.displayName} (${tierDef.tier})`);
      console.log(`  描述: ${tier.description}`);
      console.log(
        `  价格: ¥${tier.price}/${tier.billingCycle === 'MONTHLY' ? '月' : tier.billingCycle === 'YEARLY' ? '年' : '永久'}`
      );
      console.log(`  功能 (${tier.features.length}个):`);
      tier.features.forEach(f => console.log(`    • ${f}`));
      console.log(`  限制 (${tier.tierLimits.length}个):`);
      tier.tierLimits.forEach(l => {
        const value = l.limitValue ?? '无限制';
        console.log(
          `    • ${l.limitType}: ${value}${l.period ? ` (${l.period})` : ''}`
        );
      });
      console.log('  权限:');
      const permissions = tier.permissions as unknown as TierPermissionConfig;
      console.log(`    • 创建案件: ${permissions.canCreateCase ? '✓' : '✗'}`);
      console.log(`    • 创建辩论: ${permissions.canCreateDebate ? '✓' : '✗'}`);
      console.log(
        `    • 文档分析: ${permissions.canAnalyzeDocument ? '✓' : '✗'}`
      );
      console.log(
        `    • 高级功能: ${permissions.canUseAdvancedFeatures ? '✓' : '✗'}`
      );
      console.log(
        `    • 批量处理: ${permissions.canUseBatchProcessing ? '✓' : '✗'}`
      );
      console.log(`    • 优先支持: ${permissions.prioritySupport ? '✓' : '✗'}`);
      console.log(
        `    • 专属客服: ${permissions.dedicatedSupport ? '✓' : '✗'}`
      );
    }
  }

  console.log('\n会员等级权限配置初始化完成！');
}

// =============================================================================
// 执行脚本
// =============================================================================

// 导出main函数供测试使用
export { main };

// 如果直接运行此文件，则执行main函数
if (require.main === module) {
  main()
    .catch(e => {
      console.error('❌ 会员等级权限配置初始化失败:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
