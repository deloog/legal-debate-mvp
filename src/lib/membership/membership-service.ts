/**
 * 会员服务核心模块
 * 整合订单支付后的会员激活、升级、延期等逻辑
 * 从 src/lib/order/update-order-paid.ts 迁移并重构
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { MembershipStatus, MembershipTierType, Prisma } from '@prisma/client';

// =============================================================================
// 类型定义
// =============================================================================

export interface ActivateMembershipParams {
  orderId: string;
  userId: string;
  performedBy?: string;
}

export interface UpgradeMembershipParams {
  userId: string;
  newTierId: string;
  reason?: string;
  performedBy?: string;
}

export interface ExtendMembershipParams {
  userId: string;
  months: number;
  reason?: string;
  performedBy?: string;
}

export interface CancelMembershipParams {
  userId: string;
  immediate?: boolean;
  reason?: string;
  performedBy?: string;
}

export interface MembershipDetails {
  id: string;
  userId: string;
  tierId: string;
  status: MembershipStatus;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  tier: {
    tier: MembershipTierType;
    name: string;
    tierLimits: Array<{
      limitType: string;
      limitValue: number | null;
    }>;
  };
  limits: Array<{
    limitType: string;
    limitValue: number | null;
  }>;
  daysRemaining: number;
}

export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'LIFETIME';

// =============================================================================
// 常量定义
// =============================================================================

const MAX_EXTEND_MONTHS = 1200; // 最大100年
const MIN_EXTEND_MONTHS = 1;

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 校验激活会员参数
 */
function validateActivateMembershipParams(
  params: ActivateMembershipParams
): void {
  if (!params.orderId || params.orderId.trim() === '') {
    throw new Error('orderId 和 userId 不能为空');
  }
  if (!params.userId || params.userId.trim() === '') {
    throw new Error('orderId 和 userId 不能为空');
  }
}

/**
 * 校验延期会员参数
 */
function validateExtendMembershipParams(params: ExtendMembershipParams): void {
  if (!params.userId || params.userId.trim() === '') {
    throw new Error('userId 不能为空');
  }
  if (typeof params.months !== 'number' || isNaN(params.months)) {
    throw new Error('延期月数必须大于0');
  }
  if (params.months < MIN_EXTEND_MONTHS) {
    throw new Error('延期月数必须大于0');
  }
  if (params.months > MAX_EXTEND_MONTHS) {
    throw new Error('延期月数不能超过1200个月');
  }
}

/**
 * 计算会员到期日期
 * @param startDate 开始日期
 * @param billingCycle 计费周期
 * @returns 到期日期
 */
export function calculateEndDate(startDate: Date, billingCycle: string): Date {
  // 创建新日期对象避免修改原日期
  const baseDate = new Date(startDate);
  const endDate = new Date(baseDate);

  switch (billingCycle) {
    case 'MONTHLY':
      endDate.setMonth(baseDate.getMonth() + 1);
      break;
    case 'QUARTERLY':
      endDate.setMonth(baseDate.getMonth() + 3);
      break;
    case 'YEARLY':
      endDate.setFullYear(baseDate.getFullYear() + 1);
      break;
    case 'LIFETIME':
      endDate.setFullYear(baseDate.getFullYear() + 100);
      break;
    default:
      // 默认按月计费
      endDate.setMonth(baseDate.getMonth() + 1);
  }

  return endDate;
}

/**
 * 计算剩余天数
 */
function calculateDaysRemaining(endDate: Date): number {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

// =============================================================================
// 核心服务函数
// =============================================================================

/**
 * 激活会员
 * 根据订单信息创建新的会员记录
 * 如果用户已有活跃会员，则延长到期时间
 */
export async function activateMembership(
  params: ActivateMembershipParams
): Promise<{
  id: string;
  userId: string;
  tierId: string;
  status: MembershipStatus;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  tier: {
    tier: MembershipTierType;
    name: string;
  };
}> {
  // 输入校验
  validateActivateMembershipParams(params);

  const { orderId, userId, performedBy } = params;

  logger.info('[MembershipService] 开始激活会员:', { orderId, userId });

  // 1. 查询订单信息
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      membershipTier: true,
    },
  });

  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.userId !== userId) {
    throw new Error('订单不属于当前用户');
  }

  // 2. 查询会员套餐
  const tier = await prisma.membershipTier.findUnique({
    where: { id: order.membershipTierId },
  });

  if (!tier) {
    throw new Error('会员套餐不存在');
  }

  // 3. 解析订单元数据
  const metadata = (order.metadata as Record<string, unknown>) || {};
  const billingCycle = (metadata.billingCycle as BillingCycle) || 'MONTHLY';
  const autoRenew = (metadata.autoRenew as boolean) || false;

  // 4. 使用事务处理会员激活
  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const now = new Date();
      let endDate = calculateEndDate(now, billingCycle);

      // 查询当前有效的会员
      const currentMembership = await tx.userMembership.findFirst({
        where: {
          userId,
          status: MembershipStatus.ACTIVE,
        },
        orderBy: {
          endDate: 'desc',
        },
        include: {
          tier: true,
        },
      });

      // 如果当前会员未到期，则延长到期时间
      if (currentMembership && new Date(currentMembership.endDate) > now) {
        const currentEndDate = new Date(currentMembership.endDate);
        // 在现有到期时间上增加新的周期
        endDate = calculateEndDate(currentEndDate, billingCycle);
        logger.info('[MembershipService] 延长会员到期时间:', {
          currentEndDate,
          newEndDate: endDate,
        });
      }

      // 创建新的会员记录
      const membership = await tx.userMembership.create({
        data: {
          userId,
          tierId: order.membershipTierId,
          status: MembershipStatus.ACTIVE,
          startDate: now,
          endDate,
          autoRenew,
          notes: `通过订单${order.orderNo}开通会员`,
        },
        include: {
          tier: true,
        },
      });

      // 记录会员变更历史
      await tx.membershipHistory.create({
        data: {
          userId,
          membershipId: membership.id,
          changeType: currentMembership ? 'RENEW' : 'UPGRADE',
          fromTier:
            (currentMembership?.tier?.tier as MembershipTierType) || 'FREE',
          toTier: (membership.tier?.tier as MembershipTierType) || 'BASIC',
          fromStatus: currentMembership?.status || 'EXPIRED',
          toStatus: MembershipStatus.ACTIVE,
          reason: `通过订单${order.orderNo}开通会员`,
          performedBy: performedBy || userId,
          metadata: {
            orderId: order.id,
            orderNo: order.orderNo,
            billingCycle,
            amount: order.amount,
          },
        },
      });

      logger.info('[MembershipService] 会员激活成功:', {
        membershipId: membership.id,
        tier: membership.tier?.tier,
        endDate: membership.endDate,
      });

      return membership;
    }
  );

  return {
    id: result.id,
    userId: result.userId,
    tierId: result.tierId,
    status: result.status,
    startDate: result.startDate,
    endDate: result.endDate,
    autoRenew: result.autoRenew,
    tier: {
      tier: (result.tier?.tier as MembershipTierType) || 'BASIC',
      name: result.tier?.name || '',
    },
  };
}

/**
 * 升级会员套餐
 * 将用户会员升级到更高级别的套餐
 */
export async function upgradeMembership(
  params: UpgradeMembershipParams
): Promise<{
  id: string;
  userId: string;
  tierId: string;
  status: MembershipStatus;
  tier: {
    tier: MembershipTierType;
    name: string;
  };
}> {
  const { userId, newTierId, reason, performedBy } = params;

  logger.info('[MembershipService] 开始升级会员:', { userId, newTierId });

  // 查询当前会员
  const currentMembership = await prisma.userMembership.findFirst({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
    },
    include: {
      tier: true,
    },
    orderBy: {
      endDate: 'desc',
    },
  });

  if (!currentMembership) {
    throw new Error('用户没有活跃的会员');
  }

  // 查询新套餐
  const newTier = await prisma.membershipTier.findUnique({
    where: { id: newTierId },
  });

  if (!newTier) {
    throw new Error('目标会员套餐不存在');
  }

  // 检查是否同一套餐
  if (currentMembership.tierId === newTierId) {
    throw new Error('不能升级到相同套餐');
  }

  // 使用事务处理升级
  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // 更新会员套餐
      const updatedMembership = await tx.userMembership.update({
        where: { id: currentMembership.id },
        data: {
          tierId: newTierId,
        },
        include: {
          tier: true,
        },
      });

      // 记录变更历史
      await tx.membershipHistory.create({
        data: {
          userId,
          membershipId: currentMembership.id,
          changeType: 'UPGRADE',
          fromTier:
            (currentMembership.tier?.tier as MembershipTierType) || 'FREE',
          toTier:
            (updatedMembership.tier?.tier as MembershipTierType) || 'BASIC',
          fromStatus: currentMembership.status,
          toStatus: updatedMembership.status,
          reason: reason || '用户升级会员',
          performedBy: performedBy || userId,
          metadata: {
            fromTierId: currentMembership.tierId,
            toTierId: newTierId,
          },
        },
      });

      logger.info('[MembershipService] 会员升级成功:', {
        membershipId: updatedMembership.id,
        fromTier: currentMembership.tier?.tier,
        toTier: updatedMembership.tier?.tier,
      });

      return updatedMembership;
    }
  );

  return {
    id: result.id,
    userId: result.userId,
    tierId: result.tierId,
    status: result.status,
    tier: {
      tier: (result.tier?.tier as MembershipTierType) || 'BASIC',
      name: result.tier?.name || '',
    },
  };
}

/**
 * 延长会员有效期
 * 为活跃会员增加额外的使用时间
 */
export async function extendMembership(
  params: ExtendMembershipParams
): Promise<{
  id: string;
  userId: string;
  endDate: Date;
}> {
  // 输入校验
  validateExtendMembershipParams(params);

  const { userId, months, reason, performedBy } = params;

  logger.info('[MembershipService] 开始延长会员:', { userId, months });

  // 查询当前会员
  const currentMembership = await prisma.userMembership.findFirst({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
    },
    include: {
      tier: true,
    },
    orderBy: {
      endDate: 'desc',
    },
  });

  if (!currentMembership) {
    throw new Error('用户没有活跃的会员');
  }

  // 计算新的到期时间
  const currentEndDate = new Date(currentMembership.endDate);
  const newEndDate = new Date(currentEndDate);
  newEndDate.setMonth(newEndDate.getMonth() + months);

  // 更新会员
  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const updatedMembership = await tx.userMembership.update({
        where: { id: currentMembership.id },
        data: {
          endDate: newEndDate,
        },
      });

      // 记录变更历史
      await tx.membershipHistory.create({
        data: {
          userId,
          membershipId: currentMembership.id,
          changeType: 'RENEW',
          fromTier:
            (currentMembership.tier?.tier as MembershipTierType) || 'BASIC',
          toTier:
            (currentMembership.tier?.tier as MembershipTierType) || 'BASIC',
          fromStatus: currentMembership.status,
          toStatus: currentMembership.status,
          reason: reason || `会员延期${months}个月`,
          performedBy: performedBy || userId,
          metadata: {
            extendedMonths: months,
            oldEndDate: currentEndDate,
            newEndDate: newEndDate,
          },
        },
      });

      logger.info('[MembershipService] 会员延期成功:', {
        membershipId: updatedMembership.id,
        oldEndDate: currentEndDate,
        newEndDate: updatedMembership.endDate,
      });

      return updatedMembership;
    }
  );

  return {
    id: result.id,
    userId: result.userId,
    endDate: result.endDate,
  };
}

/**
 * 取消会员
 * 立即取消或设置到期不续费
 */
export async function cancelMembership(
  params: CancelMembershipParams
): Promise<{
  id: string;
  userId: string;
  status: MembershipStatus;
  autoRenew: boolean;
}> {
  const { userId, immediate = false, reason, performedBy } = params;

  logger.info('[MembershipService] 开始取消会员:', { userId, immediate });

  // 查询当前会员
  const currentMembership = await prisma.userMembership.findFirst({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
    },
    include: {
      tier: true,
    },
    orderBy: {
      endDate: 'desc',
    },
  });

  if (!currentMembership) {
    throw new Error('用户没有活跃的会员');
  }

  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      let updatedMembership;

      if (immediate) {
        // 立即取消
        updatedMembership = await tx.userMembership.update({
          where: { id: currentMembership.id },
          data: {
            status: MembershipStatus.CANCELLED,
            autoRenew: false,
          },
        });
      } else {
        // 到期取消（关闭自动续费）
        updatedMembership = await tx.userMembership.update({
          where: { id: currentMembership.id },
          data: {
            autoRenew: false,
          },
        });
      }

      // 记录变更历史
      await tx.membershipHistory.create({
        data: {
          userId,
          membershipId: currentMembership.id,
          changeType: 'DOWNGRADE',
          fromTier:
            (currentMembership.tier?.tier as MembershipTierType) || 'BASIC',
          toTier: 'FREE',
          fromStatus: currentMembership.status,
          toStatus: immediate
            ? MembershipStatus.CANCELLED
            : currentMembership.status,
          reason: reason || (immediate ? '立即取消会员' : '关闭自动续费'),
          performedBy: performedBy || userId,
          metadata: {
            immediate,
            cancelledAt: new Date(),
          },
        },
      });

      logger.info('[MembershipService] 会员取消成功:', {
        membershipId: updatedMembership.id,
        immediate,
        status: updatedMembership.status,
      });

      return updatedMembership;
    }
  );

  // 确保返回正确的状态值
  return {
    id: result.id,
    userId: result.userId,
    status: immediate ? MembershipStatus.CANCELLED : result.status,
    autoRenew: result.autoRenew ?? false,
  };
}

/**
 * 获取会员详情
 * 包含套餐限制、剩余天数等信息
 */
export async function getMembershipDetails(
  userId: string
): Promise<MembershipDetails | null> {
  const membership = await prisma.userMembership.findFirst({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      endDate: {
        gte: new Date(),
      },
    },
    include: {
      tier: {
        include: {
          tierLimits: true,
        },
      },
    },
    orderBy: {
      endDate: 'desc',
    },
  });

  if (!membership) {
    return null;
  }

  return {
    id: membership.id,
    userId: membership.userId,
    tierId: membership.tierId,
    status: membership.status,
    startDate: membership.startDate,
    endDate: membership.endDate,
    autoRenew: membership.autoRenew,
    tier: {
      tier: (membership.tier?.tier as MembershipTierType) || 'BASIC',
      name: membership.tier?.name || '',
      tierLimits:
        membership.tier?.tierLimits.map(limit => ({
          limitType: limit.limitType,
          limitValue: limit.limitValue,
        })) || [],
    },
    limits:
      membership.tier?.tierLimits.map(limit => ({
        limitType: limit.limitType,
        limitValue: limit.limitValue,
      })) || [],
    daysRemaining: calculateDaysRemaining(membership.endDate),
  };
}

/**
 * 获取用户会员历史
 */
export async function getMembershipHistory(
  userId: string,
  limit: number = 10
): Promise<
  Array<{
    id: string;
    changeType: string;
    fromTier: string;
    toTier: string;
    reason: string;
    createdAt: Date;
  }>
> {
  const history = await prisma.membershipHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return history.map(item => ({
    id: item.id,
    changeType: String(item.changeType),
    fromTier: String(item.fromTier ?? ''),
    toTier: String(item.toTier ?? ''),
    reason: item.reason || '',
    createdAt: item.createdAt,
  }));
}

/**
 * 检查用户是否拥有有效会员
 */
export async function hasActiveMembership(userId: string): Promise<boolean> {
  const count = await prisma.userMembership.count({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      endDate: {
        gte: new Date(),
      },
    },
  });

  return count > 0;
}

/**
 * 获取所有会员套餐
 */
export async function getMembershipTiers(): Promise<
  Array<{
    id: string;
    tier: MembershipTierType;
    name: string;
    description: string | null;
    price: number;
    billingCycle: string;
  }>
> {
  const tiers = await prisma.membershipTier.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });

  return tiers.map(tier => ({
    id: tier.id,
    tier: tier.tier as MembershipTierType,
    name: tier.name,
    description: tier.description,
    price: tier.price.toNumber(),
    billingCycle: tier.billingCycle,
  }));
}
