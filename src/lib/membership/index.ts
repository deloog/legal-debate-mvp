/**
 * 会员服务统一入口
 *
 * 整合原先分散在各模块的会员相关逻辑：
 * - src/lib/usage/record-usage.ts       → usage-tracker.ts（使用量记录与查询）
 * - src/lib/order/update-order-paid.ts  → membership-service.ts（订单支付后的会员激活）
 * - src/lib/middleware/check-usage-limit.ts → 通过 usage-tracker.ts 的 checkUsageLimit
 * - audit-logger.ts                     → 已存在，保留
 *
 * 重构目标：
 * 1. 将会员激活逻辑从 order 模块迁移到 membership 模块
 * 2. 将用量记录逻辑从 usage 模块迁移到 membership 模块
 * 3. 提供统一的 API 接口，保持向后兼容
 */

// =============================================================================
// 会员核心服务（新增）
// =============================================================================
export {
  // 会员激活与管理
  activateMembership,
  upgradeMembership,
  extendMembership,
  cancelMembership,
  getMembershipDetails,
  getMembershipHistory,
  hasActiveMembership,
  getMembershipTiers,
  calculateEndDate,

  // 类型导出
  type ActivateMembershipParams,
  type UpgradeMembershipParams,
  type ExtendMembershipParams,
  type CancelMembershipParams,
  type MembershipDetails,
  type BillingCycle,
} from './membership-service';

// =============================================================================
// 使用量追踪（从 usage 模块迁移）
// =============================================================================
export {
  // 用量记录
  recordUsage,
  batchRecordUsage,

  // 用量查询与统计
  getUsageStats,
  checkUsageLimit,
  getUsageHistory,
  resetUsagePeriod,

  // 类型导出
  type UsageType,
  type RecordUsageParams,
  type UsageStats,
  type UsageHistoryOptions,
} from './usage-tracker';

// =============================================================================
// 审计日志（已存在）
// =============================================================================
export {
  logAuditEvent,
  logMembershipChange,
  logRoleChange,
  logExportOperation,
  type AuditLogParams,
} from './audit-logger';

// =============================================================================
// 向后兼容 - 从旧模块 re-export（标记为 deprecated）
// =============================================================================

// 这些导出保持向后兼容，但建议直接使用新的统一入口
// TODO: 后续版本移除这些 re-export

// 从旧 usage 模块 re-export（已迁移到 usage-tracker.ts）
export {
  recordUsage as recordUsageLegacy,
  batchRecordUsage as batchRecordUsageLegacy,
  getUsageStats as getUsageStatsLegacy,
  checkUsageLimit as checkUsageLimitLegacy,
} from '@/lib/usage/record-usage';

// 从旧 order 模块 re-export（已迁移到 membership-service.ts）
export {
  updateOrderPaid,
  batchUpdateOrdersPaid,
  getOrderPaymentStatus,
  isValidOrderStatusTransition,
} from '@/lib/order/update-order-paid';

// 从中间件 re-export
export {
  checkUsageLimitForRequest,
  enforceUsageLimit,
  createUsageLimitErrorResponse,
  validateUsageLimit,
  checkAndRecordUsage,
  type UsageLimitCheckResult,
} from '@/lib/middleware/check-usage-limit';

// =============================================================================
// 统一服务类（可选的高阶封装）
// =============================================================================

// 导入用于 MembershipService 类（这些在类方法中使用）
import {
  getMembershipDetails,
  hasActiveMembership,
} from './membership-service';
import { recordUsage, getUsageStats, checkUsageLimit } from './usage-tracker';

/**
 * 会员服务统一类
 * 提供链式调用和更便捷的使用方式
 *
 * @example
 * ```typescript
 * const service = new MembershipService('user-123');
 * const canCreate = await service.checkLimit('CASE_CREATED');
 * if (canCreate) {
 *   await service.recordUsage('CASE_CREATED', 1, { resourceId: 'case-456' });
 * }
 * ```
 */
export class MembershipService {
  constructor(private userId: string) {}

  /**
   * 检查使用量限制
   */
  async checkLimit(
    usageType: UsageType,
    quantity: number = 1
  ): Promise<boolean> {
    const result = await checkUsageLimit(this.userId, usageType, quantity);
    return !result.exceeded;
  }

  /**
   * 记录使用量
   */
  async recordUsage(
    usageType: UsageType,
    quantity: number,
    options?: {
      resourceId?: string;
      resourceType?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    return recordUsage({
      userId: this.userId,
      usageType,
      quantity,
      ...options,
    });
  }

  /**
   * 获取使用量统计
   */
  async getStats() {
    return getUsageStats(this.userId);
  }

  /**
   * 获取会员详情
   */
  async getDetails() {
    return getMembershipDetails(this.userId);
  }

  /**
   * 检查是否拥有有效会员
   */
  async isActive(): Promise<boolean> {
    return hasActiveMembership(this.userId);
  }
}

// 类型导入用于 Service 类
import type { UsageType } from './usage-tracker';
