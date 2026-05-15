/**
 * 系统配置读取工具
 *
 * 从数据库 SystemConfig 表读取运行时可调参数，带内存缓存（TTL 60秒）。
 * 仅用于服务端（API路由、服务层），不可在客户端组件中引用。
 *
 * 用法：
 *   import { getConfig, getFeatureFlag } from '@/lib/config/system-config';
 *
 *   const temperature = await getConfig('ai.temperature', 0.7);
 *   const paymentEnabled = await getFeatureFlag('enable_payment');
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

// =============================================================================
// 缓存
// =============================================================================

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60秒

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key: string, value: unknown): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** 手动清除配置缓存（管理员更新配置后调用） */
export function clearConfigCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// =============================================================================
// 核心读取函数
// =============================================================================

/**
 * 读取系统配置值，带类型安全默认值
 * @param key 配置键，如 'ai.temperature'
 * @param defaultValue 读取失败时的回退值
 */
export async function getConfig<T>(key: string, defaultValue: T): Promise<T> {
  // 先查缓存
  const cached = getCached(key);
  if (cached !== null) return cached as T;

  try {
    const systemConfigModel = (
      prisma as typeof prisma & {
        systemConfig?: {
          findUnique: (args: { where: { key: string } }) => Promise<{
            value: unknown;
          } | null>;
        };
      }
    ).systemConfig;

    if (!systemConfigModel?.findUnique) {
      return defaultValue;
    }

    const record = await systemConfigModel.findUnique({ where: { key } });
    if (!record) return defaultValue;

    const value = record.value as T;
    setCached(key, value);
    return value;
  } catch (error) {
    logger.warn(`读取系统配置失败 [${key}]，使用默认值:`, error);
    return defaultValue;
  }
}

/**
 * 读取功能开关（feature.xxx 类别）
 * @param featureName 功能名，如 'enable_payment'（不含前缀 feature.）
 * @param defaultValue 默认值（找不到时用）
 */
export async function getFeatureFlag(
  featureName: string,
  defaultValue = false
): Promise<boolean> {
  return getConfig<boolean>(`feature.${featureName}`, defaultValue);
}

/**
 * 读取数字类配置
 */
export async function getNumberConfig(
  key: string,
  defaultValue: number
): Promise<number> {
  const value = await getConfig<unknown>(key, defaultValue);
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

// =============================================================================
// 常用配置快捷函数（带明确类型和默认值）
// =============================================================================

/** AI 温度参数（0~2，默认0.7） */
export async function getAiTemperature(): Promise<number> {
  return getNumberConfig('ai.temperature', 0.7);
}

/** AI 最大输出token数（默认2000） */
export async function getAiMaxTokens(): Promise<number> {
  return getNumberConfig('ai.max_tokens', 2000);
}

/** 辩论默认轮数（默认3） */
export async function getDebateDefaultRounds(): Promise<number> {
  return getNumberConfig('ai.debate_default_rounds', 3);
}

/** 是否开启AI质量审核（默认true） */
export async function isAiReviewEnabled(): Promise<boolean> {
  return getConfig<boolean>('ai.enable_quality_review', true);
}

/** 是否开启支付功能（默认false） */
export async function isPaymentEnabled(): Promise<boolean> {
  return getFeatureFlag('enable_payment', false);
}

/** 是否开启律师资质认证（默认true） */
export async function isLawyerQualificationEnabled(): Promise<boolean> {
  return getFeatureFlag('enable_lawyer_qualification', true);
}

/** 是否开启企业认证（默认true） */
export async function isEnterpriseEnabled(): Promise<boolean> {
  return getFeatureFlag('enable_enterprise', true);
}

/** 是否处于维护模式（默认false） */
export async function isMaintenanceMode(): Promise<boolean> {
  return getFeatureFlag('maintenance_mode', false);
}

/** 免费用户每月辩论次数上限（默认5） */
export async function getFreeDebateMonthlyLimit(): Promise<number> {
  return getNumberConfig('business.free_debate_monthly_limit', 5);
}

/** 免费用户AI配额（默认100） */
export async function getFreeAiQuota(): Promise<number> {
  return getNumberConfig('business.ai_quota_free_monthly', 100);
}

/** 企业用户AI配额（默认10000） */
export async function getEnterpriseAiQuota(): Promise<number> {
  return getNumberConfig('business.ai_quota_enterprise_monthly', 10000);
}

/** 律师用户AI配额（默认2000） */
export async function getLawyerAiQuota(): Promise<number> {
  return getNumberConfig('business.ai_quota_lawyer_monthly', 2000);
}

/** 律师认证宽限期（天，默认7） */
export async function getLawyerGracePeriodDays(): Promise<number> {
  return getNumberConfig('business.lawyer_grace_period_days', 7);
}
