// ExpertLevel 将在 prisma schema 中定义
// 暂时使用字符串类型，待数据库迁移后使用枚举
export type ExpertLevel = 'JUNIOR' | 'SENIOR' | 'MASTER';

/**
 * 专家专业领域
 */
export type ExpertiseArea =
  | '民事'
  | '刑事'
  | '劳动法'
  | '合同法'
  | '公司法'
  | '知识产权'
  | '行政法'
  | '经济法'
  | '刑法'
  | '商法'
  | '民事诉讼法'
  | '刑事诉讼法'
  | '行政诉讼法'
  | '其他';

/**
 * 专家档案
 */
export interface ExpertProfile {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  expertiseAreas: string[];
  expertLevel: ExpertLevel;
  certifiedBy: string | null;
  certifiedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 专家贡献统计
 */
export interface ExpertContributionStats {
  userId: string;
  totalRelationsAdded: number;
  totalRelationsVerified: number;
  averageQualityScore: number;
  lastUpdated: Date;
}

/**
 * 专家准确率
 */
export interface ExpertAccuracyRate {
  userId: string;
  totalVerified: number;
  correctCount: number;
  accuracyRate: number;
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  lastUpdated: Date;
}

/**
 * 专家列表过滤条件
 */
export interface ExpertListFilters {
  expertLevel?: ExpertLevel;
  expertiseArea?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 专家列表结果
 */
export interface ExpertListResult {
  experts: ExpertProfile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 专家贡献（旧版，保留兼容性）
 */
export interface ExpertContributions {
  /** 添加的关系数量 */
  added: number;

  /** 验证的关系数量 */
  verified: number;

  /** 准确的反馈数量（正面反馈） */
  accurateFeedbacks: number;

  /** 不准确的反馈数量（负面反馈） */
  inaccurateFeedbacks: number;

  /** 总贡献数 */
  total: number;
}

/**
 * 准确率等级（旧版，保留兼容性）
 */
export enum AccuracyLevel {
  EXCELLENT = 'excellent', // ≥ 0.9
  HIGH = 'high', // 0.8 - 0.9
  MEDIUM = 'medium', // 0.6 - 0.8
  LOW = 'low', // < 0.6
}

/**
 * 专家详情（旧版，保留兼容性）
 */
export interface ExpertDetail {
  id: string;
  userId: string;
  username: string;
  email: string;
  expertiseAreas: string[];
  expertLevel: ExpertLevel;

  // 贡献统计
  relationsAdded: number;
  relationsVerified: number;
  accuracyRate: number | null;

  // 认证信息
  certifiedBy: string | null;
  certifiedAt: Date | null;
  notes: string | null;

  // 时间信息
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建专家申请
 */
export interface CreateExpertApplicationInput {
  userId: string;
  expertiseAreas: string[];
  expertLevel?: ExpertLevel;
  notes?: string;
}

/**
 * 更新专家信息
 */
export interface UpdateExpertInput {
  expertiseAreas?: string[];
  expertLevel?: ExpertLevel;
  notes?: string;
}

/**
 * 专家申请状态
 */
export interface ExpertApplicationStatus {
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
}

/**
 * 专家认证请求
 */
export interface CertifyExpertRequest {
  expertId: string;
  adminId: string;
  notes?: string;
}

/**
 * 专家等级升级请求
 */
export interface PromoteExpertRequest {
  expertId: string;
  newLevel: ExpertLevel;
  reason: string;
}

/**
 * 专家查询参数
 */
export interface ExpertQueryParams {
  expertiseArea?: string;
  expertLevel?: ExpertLevel;
  minAccuracyRate?: number;
  sortBy?: 'accuracyRate' | 'contributions' | 'createdAt';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * 专家统计信息
 */
export interface ExpertStats {
  totalExperts: number;
  byLevel: Record<string, number>;
  averageAccuracyRate: number;
  topContributors: ExpertDetail[];
}
