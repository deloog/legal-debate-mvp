/**
 * 企业认证类型定义
 */

// =============================================================================
// 企业状态枚举（与 Prisma 对应）
// =============================================================================

/**
 * 企业状态枚举
 */
export enum EnterpriseStatus {
  PENDING = "PENDING", // 待审核
  UNDER_REVIEW = "UNDER_REVIEW", // 审核中
  APPROVED = "APPROVED", // 已通过
  REJECTED = "REJECTED", // 已拒绝
  EXPIRED = "EXPIRED", // 已过期
  SUSPENDED = "SUSPENDED", // 已暂停
}

/**
 * 企业审核操作枚举
 */
export enum EnterpriseReviewAction {
  APPROVE = "APPROVE", // 通过
  REJECT = "REJECT", // 拒绝
  SUSPEND = "SUSPEND", // 暂停
  REACTIVATE = "REACTIVATE", // 重新激活
}

// =============================================================================
// 企业账号相关类型
// =============================================================================

/**
 * 企业账号信息
 */
export interface EnterpriseAccount {
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
}

/**
 * 企业账号基本信息（不含敏感数据）
 */
export interface EnterpriseAccountPublic {
  id: string;
  userId: string;
  enterpriseName: string;
  creditCode: string;
  legalPerson: string;
  industryType: string;
  status: EnterpriseStatus;
  submittedAt: Date;
  expiresAt: Date | null;
}

/**
 * 企业注册请求
 */
export interface EnterpriseRegisterRequest {
  enterpriseName: string;
  creditCode: string;
  legalPerson: string;
  industryType: string;
  businessLicense?: string; // Base64编码的营业执照图片
}

/**
 * 企业资质上传请求
 */
export interface EnterpriseQualificationUploadRequest {
  businessLicense: string; // Base64编码的营业执照图片
}

// =============================================================================
// 企业审核相关类型
// =============================================================================

/**
 * 企业审核信息
 */
export interface EnterpriseReview {
  id: string;
  enterpriseId: string;
  reviewerId: string;
  reviewAction: EnterpriseReviewAction;
  reviewNotes: string | null;
  reviewData: unknown | null;
  createdAt: Date;
}

/**
 * 企业审核请求
 */
export interface EnterpriseReviewRequest {
  reviewAction: EnterpriseReviewAction;
  reviewNotes?: string;
}

// =============================================================================
// 企业认证响应类型
// =============================================================================

/**
 * 企业注册响应
 */
export interface EnterpriseRegisterResponse {
  success: boolean;
  message: string;
  data?: EnterpriseAccountPublic;
  error?: string;
}

/**
 * 企业审核响应
 */
export interface EnterpriseReviewResponse {
  success: boolean;
  message: string;
  data?: EnterpriseAccountPublic;
  error?: string;
}

/**
 * 获取企业信息响应
 */
export interface EnterpriseInfoResponse {
  success: boolean;
  message: string;
  data?: EnterpriseAccountPublic;
  error?: string;
}

// =============================================================================
// 验证错误类型
// =============================================================================

/**
 * 企业名称验证错误
 */
export interface EnterpriseNameValidationError {
  valid: boolean;
  errors: string[];
}

/**
 * 统一社会信用代码验证错误
 */
export interface CreditCodeValidationError {
  valid: boolean;
  errors: string[];
}

/**
 * 法人代表验证错误
 */
export interface LegalPersonValidationError {
  valid: boolean;
  errors: string[];
}

// =============================================================================
// OCR识别相关类型
// =============================================================================

/**
 * 营业执照OCR识别结果
 */
export interface BusinessLicenseOcrResult {
  success: boolean;
  data?: {
    enterpriseName: string;
    creditCode: string;
    legalPerson: string;
    address?: string;
    issueDate?: string;
    businessScope?: string;
  };
  error?: string;
}

/**
 * OCR识别请求
 */
export interface OcrRecognizeRequest {
  imageBase64: string;
}

/**
 * OCR识别响应
 */
export interface OcrRecognizeResponse {
  success: boolean;
  data?: BusinessLicenseOcrResult["data"];
  error?: string;
}

// =============================================================================
// 企业权限相关类型
// =============================================================================

/**
 * 企业用户权限定义
 */
export interface EnterprisePermissions {
  // 基础权限（与律师相同）
  canCreateCase: boolean;
  canCreateDebate: boolean;
  canUploadDocument: boolean;
  canSearchLawArticles: boolean;

  // 企业特有权限
  canManageEnterpriseCases: boolean;
  canViewEnterpriseStatistics: boolean;
  canAssignTeamMembers: boolean;
}

/**
 * 企业角色权限配置
 */
export const ENTERPRISE_ROLE_PERMISSIONS: EnterprisePermissions = {
  canCreateCase: true,
  canCreateDebate: true,
  canUploadDocument: true,
  canSearchLawArticles: true,
  canManageEnterpriseCases: true,
  canViewEnterpriseStatistics: true,
  canAssignTeamMembers: true,
};
