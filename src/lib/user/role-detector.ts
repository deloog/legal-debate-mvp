/**
 * 角色检测系统
 *
 * 功能：
 * 1. 检测用户的首页角色（律师/企业法务/普通用户）
 * 2. 构建用户上下文信息
 * 3. 支持角色切换（双重角色用户）
 * 4. 检测用户首选角色
 */

import { UserRole } from '@prisma/client';
import { QualificationStatus } from '@/types/qualification';
import { EnterpriseStatus } from '@/types/enterprise';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 首页角色枚举
 */
export enum HomepageRole {
  LAWYER = 'LAWYER', // 律师版首页
  ENTERPRISE = 'ENTERPRISE', // 企业法务版首页
  GENERAL = 'GENERAL', // 普通用户版首页
}

/**
 * 律师认证信息（简化）
 */
export interface LawyerQualificationInfo {
  id: string;
  licenseNumber: string;
  fullName: string;
  lawFirm: string;
  status: QualificationStatus;
}

/**
 * 企业账户信息（简化）
 */
export interface EnterpriseAccountInfo {
  id: string;
  enterpriseName: string;
  creditCode: string;
  legalPerson: string;
  industryType: string;
  status: EnterpriseStatus;
}

/**
 * 用户上下文
 */
export interface UserContext {
  userId: string;
  email: string;
  name: string | null;
  role: UserRole;
  homepageRole: HomepageRole;
  isLawyer: boolean;
  isEnterprise: boolean;
  isDualRole: boolean;
  lawyerQualification: LawyerQualificationInfo | null;
  enterpriseAccount: EnterpriseAccountInfo | null;
  availableRoles: HomepageRole[];
}

/**
 * 用户数据（从数据库查询）
 */
export interface UserWithQualifications {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  role: UserRole;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lawyerQualifications: Array<{
    id: string;
    userId: string;
    licenseNumber: string;
    fullName: string;
    idCardNumber: string;
    lawFirm: string;
    licensePhoto: string | null;
    status: QualificationStatus;
    submittedAt: Date;
    reviewedAt: Date | null;
    reviewerId: string | null;
    reviewNotes: string | null;
    verificationData: unknown | null;
    metadata: unknown | null;
  }>;
  enterpriseAccount: {
    id: string;
    userId: string;
    enterpriseName: string;
    creditCode: string;
    legalPerson: string;
    industryType: string;
    businessLicense: string | null;
    status: EnterpriseStatus;
    submittedAt: Date;
    reviewedAt: Date | null;
    reviewerId: string | null;
    reviewNotes: string | null;
    verificationData: unknown | null;
    expiresAt: Date | null;
    metadata: unknown | null;
  } | null;
}

/**
 * 角色切换结果
 */
export interface RoleSwitchResult {
  success: boolean;
  role: HomepageRole;
  message: string;
}

// =============================================================================
// 核心函数
// =============================================================================

/**
 * 检测用户的首页角色
 *
 * 规则：
 * 1. 如果有已批准的律师认证 -> LAWYER
 * 2. 如果有已批准的企业账户 -> ENTERPRISE
 * 3. 如果两者都有 -> LAWYER（默认优先律师）
 * 4. 其他情况 -> GENERAL
 *
 * @param user 用户数据
 * @returns 首页角色
 */
export function detectUserRole(user: UserWithQualifications): HomepageRole {
  // 检查律师认证
  const hasApprovedLawyerQualification = user.lawyerQualifications.some(
    qual => qual.status === QualificationStatus.APPROVED
  );

  // 检查企业账户
  const hasApprovedEnterpriseAccount =
    user.enterpriseAccount?.status === EnterpriseStatus.APPROVED;

  // 双重角色：优先律师
  if (hasApprovedLawyerQualification && hasApprovedEnterpriseAccount) {
    return HomepageRole.LAWYER;
  }

  // 单一律师角色
  if (hasApprovedLawyerQualification) {
    return HomepageRole.LAWYER;
  }

  // 单一企业角色
  if (hasApprovedEnterpriseAccount) {
    return HomepageRole.ENTERPRISE;
  }

  // 默认普通用户
  return HomepageRole.GENERAL;
}

/**
 * 构建用户上下文
 *
 * @param user 用户数据
 * @returns 用户上下文
 */
export function buildUserContext(user: UserWithQualifications): UserContext {
  // 获取已批准的律师认证
  const approvedLawyerQualification = user.lawyerQualifications.find(
    qual => qual.status === QualificationStatus.APPROVED
  );

  // 获取已批准的企业账户
  const approvedEnterpriseAccount =
    user.enterpriseAccount?.status === EnterpriseStatus.APPROVED
      ? user.enterpriseAccount
      : null;

  // 判断是否为律师
  const isLawyer = !!approvedLawyerQualification;

  // 判断是否为企业法务
  const isEnterprise = !!approvedEnterpriseAccount;

  // 判断是否为双重角色
  const isDualRole = isLawyer && isEnterprise;

  // 检测首页角色
  const homepageRole = detectUserRole(user);

  // 构建可用角色列表
  const availableRoles: HomepageRole[] = [];
  if (isLawyer) {
    availableRoles.push(HomepageRole.LAWYER);
  }
  if (isEnterprise) {
    availableRoles.push(HomepageRole.ENTERPRISE);
  }
  if (availableRoles.length === 0) {
    availableRoles.push(HomepageRole.GENERAL);
  }

  // 构建律师认证信息
  const lawyerQualification: LawyerQualificationInfo | null =
    approvedLawyerQualification
      ? {
          id: approvedLawyerQualification.id,
          licenseNumber: approvedLawyerQualification.licenseNumber,
          fullName: approvedLawyerQualification.fullName,
          lawFirm: approvedLawyerQualification.lawFirm,
          status: approvedLawyerQualification.status,
        }
      : null;

  // 构建企业账户信息
  const enterpriseAccount: EnterpriseAccountInfo | null =
    approvedEnterpriseAccount
      ? {
          id: approvedEnterpriseAccount.id,
          enterpriseName: approvedEnterpriseAccount.enterpriseName,
          creditCode: approvedEnterpriseAccount.creditCode,
          legalPerson: approvedEnterpriseAccount.legalPerson,
          industryType: approvedEnterpriseAccount.industryType,
          status: approvedEnterpriseAccount.status,
        }
      : null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    homepageRole,
    isLawyer,
    isEnterprise,
    isDualRole,
    lawyerQualification,
    enterpriseAccount,
    availableRoles,
  };
}

/**
 * 检测用户首选角色
 *
 * @param user 用户数据
 * @param preferredRole 用户偏好的角色（可能来自cookie或localStorage）
 * @returns 有效的首选角色
 */
export function detectPreferredRole(
  user: UserWithQualifications,
  preferredRole: HomepageRole | null | undefined
): HomepageRole {
  // 如果没有偏好，返回默认角色
  if (!preferredRole) {
    return detectUserRole(user);
  }

  // 构建用户上下文
  const context = buildUserContext(user);

  // 验证偏好角色是否在可用角色列表中
  if (context.availableRoles.includes(preferredRole)) {
    return preferredRole;
  }

  // 偏好角色无效，返回默认角色
  return context.homepageRole;
}

/**
 * 切换用户角色
 *
 * @param user 用户数据
 * @param targetRole 目标角色
 * @returns 切换结果
 */
export function switchUserRole(
  user: UserWithQualifications,
  targetRole: HomepageRole
): RoleSwitchResult {
  // 构建用户上下文
  const context = buildUserContext(user);

  // 检查目标角色是否在可用角色列表中
  if (!context.availableRoles.includes(targetRole)) {
    return {
      success: false,
      role: context.homepageRole,
      message: `无权限切换到${getRoleDisplayName(targetRole)}角色`,
    };
  }

  // 切换成功
  return {
    success: true,
    role: targetRole,
    message: `成功切换到${getRoleDisplayName(targetRole)}角色`,
  };
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 获取角色显示名称
 *
 * @param role 角色
 * @returns 显示名称
 */
function getRoleDisplayName(role: HomepageRole): string {
  switch (role) {
    case HomepageRole.LAWYER:
      return '律师';
    case HomepageRole.ENTERPRISE:
      return '企业法务';
    case HomepageRole.GENERAL:
      return '普通用户';
    default:
      return '未知';
  }
}

/**
 * 检查律师认证是否有效
 *
 * @param status 认证状态
 * @returns 是否有效
 */
export function isLawyerQualificationValid(
  status: QualificationStatus
): boolean {
  return status === QualificationStatus.APPROVED;
}

/**
 * 检查企业账户是否有效
 *
 * @param status 账户状态
 * @returns 是否有效
 */
export function isEnterpriseAccountValid(status: EnterpriseStatus): boolean {
  return status === EnterpriseStatus.APPROVED;
}
