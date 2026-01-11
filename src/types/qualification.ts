/**
 * 律师资格验证类型定义
 */

// =============================================================================
// 资格状态枚举（与 Prisma 对应）
// =============================================================================

export enum QualificationStatus {
  PENDING = "PENDING", // 待审核
  UNDER_REVIEW = "UNDER_REVIEW", // 审核中
  APPROVED = "APPROVED", // 已通过
  REJECTED = "REJECTED", // 已拒绝
  EXPIRED = "EXPIRED", // 已过期
}

// =============================================================================
// 律师资格信息
// =============================================================================

/**
 * 律师资格提交信息
 */
export interface QualificationSubmitData {
  licenseNumber: string; // 17位执业证号
  fullName: string; // 律师姓名
  idCardNumber: string; // 身份证号
  lawFirm: string; // 执业律所
  licensePhoto?: string; // 执业证照片路径
}

/**
 * 律师资格信息（完整）
 */
export interface LawyerQualification {
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
}

/**
 * 律师资格信息（响应）
 */
export interface QualificationResponse {
  id: string;
  licenseNumber: string;
  fullName: string;
  lawFirm: string;
  licensePhoto: string | null;
  status: QualificationStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewNotes: string | null;
}

// =============================================================================
// 验证结果
// =============================================================================

/**
 * 执业证号验证结果
 */
export interface LicenseNumberValidation {
  valid: boolean;
  errors: string[];
  formatted?: string;
}

/**
 * 基础信息验证结果
 */
export interface BasicInfoValidation {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * 第三方核验结果
 */
export interface ThirdPartyVerificationResult {
  success: boolean;
  verified: boolean;
  data?: {
    status: string; // 执业状态
    lawFirm: string; // 执业律所
    issueDate: string; // 首次执业日期
    verifiedAt: string; // 核验时间
  };
  error?: string;
}

// =============================================================================
// 审核相关类型
// =============================================================================

/**
 * 审核请求
 */
export interface ReviewRequest {
  approved: boolean;
  reviewNotes: string;
}

/**
 * 审核结果
 */
export interface ReviewResult {
  success: boolean;
  message: string;
  qualification?: QualificationResponse;
}

// =============================================================================
// 请求/响应类型
// =============================================================================

/**
 * 律师资格上传请求
 */
export interface QualificationUploadRequest {
  licenseNumber: string;
  fullName: string;
  idCardNumber: string;
  lawFirm: string;
}

/**
 * 律师资格上传响应
 */
export interface QualificationUploadResponse {
  success: boolean;
  message: string;
  data?: {
    qualification: QualificationResponse;
  };
  error?: string;
}

/**
 * 获取当前用户资格状态响应
 */
export interface MyQualificationResponse {
  success: boolean;
  data?: {
    qualification: QualificationResponse | null;
  };
}

/**
 * 管理员获取资格列表请求参数
 */
export interface AdminQualificationsQuery {
  status?: QualificationStatus;
  page?: number;
  limit?: number;
}

/**
 * 管理员获取资格列表响应
 */
export interface AdminQualificationsResponse {
  success: boolean;
  data?: {
    qualifications: QualificationResponse[];
    total: number;
    page: number;
    limit: number;
  };
}

// =============================================================================
// 错误类型
// =============================================================================

/**
 * 资格验证错误代码
 */
export enum QualificationErrorCode {
  INVALID_LICENSE_NUMBER = "INVALID_LICENSE_NUMBER",
  INVALID_ID_CARD = "INVALID_ID_CARD",
  QUALIFICATION_EXISTS = "QUALIFICATION_EXISTS",
  QUALIFICATION_NOT_FOUND = "QUALIFICATION_NOT_FOUND",
  INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION",
  VERIFICATION_FAILED = "VERIFICATION_FAILED",
  FILE_UPLOAD_ERROR = "FILE_UPLOAD_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
}

/**
 * 资格验证错误
 */
export interface QualificationError {
  code: QualificationErrorCode;
  message: string;
  details?: unknown;
}
