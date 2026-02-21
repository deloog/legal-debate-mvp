/**
 * 会员服务统一入口
 *
 * 整合原先分散在各模块的会员相关逻辑：
 * - src/lib/usage/record-usage.ts    → 使用量记录与查询
 * - src/lib/order/update-order-paid.ts → 订单支付后的会员激活
 * - src/lib/middleware/check-usage-limit.ts → 使用量限制校验
 * - src/lib/notification/user-notification-service.ts → 会员通知
 */

import { prisma } from '@/lib/db/prisma';
import { MembershipStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// 使用量记录（re-export）
// ---------------------------------------------------------------------------
export {
  recordUsage,
  batchRecordUsage,
  getUsageStats,
  checkUsageLimit,
} from '@/lib/usage/record-usage';
export type { RecordUsageParams } from '@/lib/usage/record-usage';

// ---------------------------------------------------------------------------
// 使用量限制校验（re-export）
// ---------------------------------------------------------------------------
export {
  checkUsageLimitForRequest,
  enforceUsageLimit,
  createUsageLimitErrorResponse,
  validateUsageLimit,
  checkAndRecordUsage,
} from '@/lib/middleware/check-usage-limit';
export type { UsageLimitCheckResult } from '@/lib/middleware/check-usage-limit';

// ---------------------------------------------------------------------------
// 订单支付后的会员激活（re-export）
// ---------------------------------------------------------------------------
export {
  updateOrderPaid,
  batchUpdateOrdersPaid,
  getOrderPaymentStatus,
  isValidOrderStatusTransition,
} from '@/lib/order/update-order-paid';

// ---------------------------------------------------------------------------
// 会员查询工具函数（新增）
// ---------------------------------------------------------------------------

/**
 * 获取用户当前有效会员信息
 */
export async function getActiveMembership(userId: string) {
  return prisma.userMembership.findFirst({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      endDate: { gte: new Date() },
    },
    include: {
      tier: true,
    },
    orderBy: { endDate: 'desc' },
  });
}

/**
 * 获取用户会员历史
 */
export async function getMembershipHistory(userId: string, limit = 10) {
  return prisma.membershipHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * 检查用户是否拥有有效会员
 */
export async function hasActiveMembership(userId: string): Promise<boolean> {
  const count = await prisma.userMembership.count({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      endDate: { gte: new Date() },
    },
  });
  return count > 0;
}

/**
 * 获取所有会员套餐
 */
export async function getMembershipTiers() {
  return prisma.membershipTier.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });
}
