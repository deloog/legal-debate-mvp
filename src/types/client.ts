// 客户类型定义

/**
 * 客户类型枚举
 */
export enum ClientType {
  INDIVIDUAL = 'INDIVIDUAL', // 个人客户
  ENTERPRISE = 'ENTERPRISE', // 企业客户
  POTENTIAL = 'POTENTIAL', // 潜在客户
}

/**
 * 客户来源枚举
 */
export enum ClientSource {
  REFERRAL = 'REFERRAL', // 推荐
  ONLINE = 'ONLINE', // 网络
  EVENT = 'EVENT', // 活动
  ADVERTISING = 'ADVERTISING', // 广告
  OTHER = 'OTHER', // 其他
}

/**
 * 客户状态枚举
 */
export enum ClientStatus {
  ACTIVE = 'ACTIVE', // 活跃
  INACTIVE = 'INACTIVE', // 非活跃
  LOST = 'LOST', // 流失
  BLACKLISTED = 'BLACKLISTED', // 黑名单
}

/**
 * 沟通类型枚举
 */
export enum CommunicationType {
  PHONE = 'PHONE', // 电话
  EMAIL = 'EMAIL', // 邮件
  MEETING = 'MEETING', // 面谈
  WECHAT = 'WECHAT', // 微信
  OTHER = 'OTHER', // 其他
}

/**
 * 创建客户输入接口
 */
export interface CreateClientInput {
  userId: string;
  clientType: ClientType;
  name: string;
  gender?: string;
  age?: number;
  profession?: string;
  phone?: string;
  email?: string;
  address?: string;
  idCardNumber?: string; // 身份证号
  company?: string; // 企业名称
  creditCode?: string; // 统一社会信用代码
  legalRep?: string; // 法人代表
  source?: ClientSource;
  tags?: string[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 更新客户输入接口
 */
export interface UpdateClientInput {
  clientType?: ClientType;
  name?: string;
  gender?: string;
  age?: number;
  profession?: string;
  phone?: string;
  email?: string;
  address?: string;
  idCardNumber?: string;
  company?: string;
  creditCode?: string;
  legalRep?: string;
  source?: ClientSource;
  tags?: string[];
  status?: ClientStatus;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 客户查询参数接口
 */
export interface ClientQueryParams {
  userId?: string;
  clientType?: ClientType;
  status?: ClientStatus;
  source?: ClientSource;
  search?: string; // 搜索关键词（姓名、电话、邮箱等）
  tags?: string[]; // 标签筛选
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 案件历史摘要接口
 */
export interface CaseSummary {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  cause?: string | null;
  amount?: number | null;
  court?: string | null;
  caseNumber?: string | null;
}

/**
 * 客户详情接口
 */
export interface ClientDetail {
  id: string;
  userId: string;
  clientType: ClientType;
  name: string;
  gender?: string | null;
  age?: number | null;
  profession?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  idCardNumber?: string | null;
  company?: string | null;
  creditCode?: string | null;
  legalRep?: string | null;
  source?: ClientSource | null;
  tags: string[];
  status: ClientStatus;
  notes?: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  cases?: number; // 关联案件数
  communications?: number; // 沟通记录数
  caseHistory?: CaseSummary[]; // 案件历史
}

/**
 * 客户列表响应接口
 */
export interface ClientListResponse {
  clients: ClientDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 客户统计信息接口
 */
export interface ClientStatistics {
  totalClients: number;
  activeClients: number;
  inactiveClients: number;
  lostClients: number;
  blacklistedClients: number;
  clientsByType: Record<string, number>;
  clientsBySource: Record<string, number>;
  clientsByTags: Record<string, number>;
  monthlyGrowth: Array<{
    month: string;
    count: number;
  }>;
  recentClients: ClientDetail[];
}

/**
 * 沟通记录输入接口
 */
export interface CreateCommunicationInput {
  clientId: string;
  userId: string;
  type: CommunicationType;
  summary: string;
  content?: string;
  nextFollowUpDate?: Date;
  isImportant?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * 更新沟通记录输入接口
 */
export interface UpdateCommunicationInput {
  type?: CommunicationType;
  summary?: string;
  content?: string;
  nextFollowUpDate?: Date;
  isImportant?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * 沟通记录查询参数接口
 */
export interface CommunicationQueryParams {
  clientId?: string;
  userId?: string;
  type?: CommunicationType;
  startDate?: Date;
  endDate?: Date;
  isImportant?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'nextFollowUpDate';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 客户验证错误接口
 */
export interface ClientValidationError {
  field: string;
  message: string;
}

/**
 * 客户验证结果接口
 */
export interface ClientValidationResult {
  isValid: boolean;
  errors: ClientValidationError[];
}

/**
 * 跟进任务状态枚举
 */
export enum FollowUpTaskStatus {
  PENDING = 'PENDING', // 待跟进
  COMPLETED = 'COMPLETED', // 已完成
  CANCELLED = 'CANCELLED', // 已取消
}

/**
 * 跟进任务优先级枚举
 */
export enum FollowUpTaskPriority {
  HIGH = 'HIGH', // 高
  MEDIUM = 'MEDIUM', // 中
  LOW = 'LOW', // 低
}

/**
 * 跟进任务接口
 */
export interface FollowUpTask {
  id: string;
  clientId: string;
  communicationId: string | null;
  userId: string;
  type: CommunicationType;
  summary: string;
  dueDate: Date;
  priority: FollowUpTaskPriority;
  status: FollowUpTaskStatus;
  completedAt?: Date | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
}

/**
 * 创建跟进任务输入接口
 */
export interface CreateFollowUpTaskInput {
  clientId: string;
  communicationId?: string;
  userId: string;
  type: CommunicationType;
  summary: string;
  dueDate: Date;
  priority?: FollowUpTaskPriority;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 更新跟进任务输入接口
 */
export interface UpdateFollowUpTaskInput {
  type?: CommunicationType;
  summary?: string;
  status?: FollowUpTaskStatus;
  priority?: FollowUpTaskPriority;
  dueDate?: Date;
  notes?: string;
  completedAt?: Date | null;
}

/**
 * 跟进任务查询参数接口
 */
export interface FollowUpTaskQueryParams {
  userId?: string;
  clientId?: string;
  status?: FollowUpTaskStatus;
  priority?: FollowUpTaskPriority;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'dueDate' | 'priority' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 跟进任务列表响应接口
 */
export interface FollowUpTaskListResponse {
  tasks: FollowUpTask[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 标记任务完成输入接口
 */
export interface CompleteFollowUpTaskInput {
  notes?: string;
}

// =============================================================================
// 客户分析相关类型
// =============================================================================

/**
 * 客户价值等级
 */
export enum ClientValueLevel {
  HIGH = 'HIGH', // 高价值
  MEDIUM = 'MEDIUM', // 中价值
  LOW = 'LOW', // 低价值
}

/**
 * 客户转化漏斗数据
 */
export interface ClientConversionFunnel {
  stage: ClientStatus;
  count: number;
  percentage: number;
  conversionRate: number;
}

/**
 * 客户价值分析数据
 */
export interface ClientValueAnalysis {
  totalValue: number;
  valueLevel: ClientValueLevel;
  valueScore: number;
  factors: {
    caseCount: number;
    caseRevenue: number;
    communicationFrequency: number;
    cooperationDuration: number;
    referralCount: number;
  };
  ranking: number;
  percentile: number;
}

/**
 * 客户分析响应数据
 */
export interface ClientAnalyticsResponse {
  conversionFunnel: ClientConversionFunnel[];
  valueAnalysis: {
    highValue: number;
    mediumValue: number;
    lowValue: number;
    totalValue: number;
    averageValueScore: number;
  };
  topClients: Array<{
    clientId: string;
    clientName: string;
    valueLevel: ClientValueLevel;
    valueScore: number;
    caseCount: number;
    totalRevenue: number;
  }>;
  lifecycle: {
    avgDuration: number;
    longestDuration: number;
    shortestDuration: number;
    retentionRate: number;
  };
  satisfaction: {
    avgCommunicationFrequency: number;
    avgResponseTime: number;
    satisfactionScore: number;
  };
  riskAnalysis: {
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    totalRisk: number;
  };
  metadata: {
    generatedAt: string;
    timeRange: string;
    totalClients: number;
  };
}

/**
 * 客户分析查询参数
 */
export interface ClientAnalyticsQueryParams {
  timeRange?: 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'LAST_180_DAYS' | 'ALL';
  topClientsLimit?: number;
  includeLifecycle?: boolean;
  includeSatisfaction?: boolean;
  includeRiskAnalysis?: boolean;
}
