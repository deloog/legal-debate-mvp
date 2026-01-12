/**
 * 企业认证服务
 */

import { prisma } from '@/lib/db/prisma';
import type { EnterpriseAccountPublic } from '@/types/enterprise';
import { EnterpriseStatus, EnterpriseReviewAction } from '@/types/enterprise';
import { UserRole } from '@/types/auth';

// =============================================================================
// 企业注册服务
// =============================================================================

/**
 * 创建企业账号
 * @param userId 用户ID
 * @param data 企业注册数据
 * @returns 企业账号信息
 */
export async function createEnterpriseAccount(
  userId: string,
  data: {
    enterpriseName: string;
    creditCode: string;
    legalPerson: string;
    industryType: string;
    businessLicense?: string;
  }
): Promise<EnterpriseAccountPublic> {
  // 检查统一社会信用代码是否已存在
  const existingAccount = await prisma.enterpriseAccount.findUnique({
    where: { creditCode: data.creditCode },
  });

  if (existingAccount) {
    throw new Error('统一社会信用代码已被注册');
  }

  // 检查用户是否已有企业账号
  const userEnterpriseAccount = await prisma.enterpriseAccount.findUnique({
    where: { userId },
  });

  if (userEnterpriseAccount) {
    throw new Error('该用户已注册企业账号');
  }

  // 创建企业账号
  const enterpriseAccount = await prisma.enterpriseAccount.create({
    data: {
      userId,
      enterpriseName: data.enterpriseName,
      creditCode: data.creditCode,
      legalPerson: data.legalPerson,
      industryType: data.industryType,
      businessLicense: data.businessLicense || null,
    },
  });

  // 更新用户角色为企业用户
  await prisma.user.update({
    where: { id: userId },
    data: { role: 'ENTERPRISE' as UserRole },
  });

  return toPublicEnterpriseAccount(enterpriseAccount);
}

// =============================================================================
// 企业信息查询服务
// =============================================================================

/**
 * 根据企业ID获取企业账号信息
 * @param enterpriseId 企业ID
 * @returns 企业账号信息或null
 */
export async function getEnterpriseAccountById(
  enterpriseId: string
): Promise<EnterpriseAccountPublic | null> {
  const enterpriseAccount = await prisma.enterpriseAccount.findUnique({
    where: { id: enterpriseId },
  });

  if (!enterpriseAccount) {
    return null;
  }

  return toPublicEnterpriseAccount(enterpriseAccount);
}

/**
 * 根据用户ID获取企业账号信息
 * @param userId 用户ID
 * @returns 企业账号信息或null
 */
export async function getEnterpriseAccountByUserId(
  userId: string
): Promise<EnterpriseAccountPublic | null> {
  const enterpriseAccount = await prisma.enterpriseAccount.findUnique({
    where: { userId },
  });

  if (!enterpriseAccount) {
    return null;
  }

  return toPublicEnterpriseAccount(enterpriseAccount);
}

// =============================================================================
// 企业资质上传服务
// =============================================================================

/**
 * 更新企业营业执照
 * @param userId 用户ID
 * @param businessLicense 营业执照图片路径
 * @returns 更新后的企业账号信息
 */
export async function updateBusinessLicense(
  userId: string,
  businessLicense: string
): Promise<EnterpriseAccountPublic> {
  const enterpriseAccount = await prisma.enterpriseAccount.update({
    where: { userId },
    data: { businessLicense },
  });

  return toPublicEnterpriseAccount(enterpriseAccount);
}

// =============================================================================
// 企业审核服务
// =============================================================================

/**
 * 审核企业账号
 * @param enterpriseId 企业ID
 * @param reviewerId 审核人ID
 * @param action 审核操作
 * @param reviewNotes 审核备注
 * @returns 更新后的企业账号信息
 */
export async function reviewEnterpriseAccount(
  enterpriseId: string,
  reviewerId: string,
  action: EnterpriseReviewAction,
  reviewNotes?: string
): Promise<EnterpriseAccountPublic> {
  // 确定审核后的状态
  const newStatus = getReviewStatus(action);

  // 更新企业账号状态
  const enterpriseAccount = await prisma.enterpriseAccount.update({
    where: { id: enterpriseId },
    data: {
      status: newStatus,
      reviewedAt: new Date(),
      reviewerId,
      reviewNotes: reviewNotes || null,
      expiresAt:
        newStatus === EnterpriseStatus.APPROVED
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1年有效期
          : null,
    },
  });

  // 创建审核记录
  await prisma.enterpriseReview.create({
    data: {
      enterpriseId,
      reviewerId,
      reviewAction: action,
      reviewNotes: reviewNotes || null,
    },
  });

  // 如果审核通过，更新用户角色
  if (action === EnterpriseReviewAction.APPROVE) {
    const enterprise = await prisma.enterpriseAccount.findUnique({
      where: { id: enterpriseId },
      include: { user: true },
    });
    if (enterprise) {
      await prisma.user.update({
        where: { id: enterprise.userId },
        data: { role: 'ENTERPRISE' as UserRole },
      });
    }
  }

  return toPublicEnterpriseAccount(enterpriseAccount);
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 将 Prisma 企业账号转换为公开信息格式
 * @param account 企业账号
 * @returns 公开信息
 */
function toPublicEnterpriseAccount(account: unknown): EnterpriseAccountPublic {
  const acc = account as {
    id: string;
    userId: string;
    enterpriseName: string;
    creditCode: string;
    legalPerson: string;
    industryType: string;
    status: string;
    submittedAt: Date;
    expiresAt: Date | null;
  };

  return {
    id: acc.id,
    userId: acc.userId,
    enterpriseName: acc.enterpriseName,
    creditCode: acc.creditCode,
    legalPerson: acc.legalPerson,
    industryType: acc.industryType,
    status: acc.status as EnterpriseStatus,
    submittedAt: acc.submittedAt,
    expiresAt: acc.expiresAt,
  };
}

/**
 * 根据审核操作获取对应的状态
 * @param action 审核操作
 * @returns 企业状态
 */
function getReviewStatus(action: EnterpriseReviewAction): EnterpriseStatus {
  switch (action) {
    case EnterpriseReviewAction.APPROVE:
      return EnterpriseStatus.APPROVED;
    case EnterpriseReviewAction.REJECT:
      return EnterpriseStatus.REJECTED;
    case EnterpriseReviewAction.SUSPEND:
      return EnterpriseStatus.SUSPENDED;
    case EnterpriseReviewAction.REACTIVATE:
      return EnterpriseStatus.APPROVED;
    default:
      return EnterpriseStatus.PENDING;
  }
}
