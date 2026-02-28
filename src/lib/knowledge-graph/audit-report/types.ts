/**
 * 知识图谱审计报告类型定义
 */

/**
 * 报告类型枚举
 */
export enum AuditReportType {
  ACCESS_AUDIT = 'access_audit', // 访问审计报告
  CHANGE_AUDIT = 'change_audit', // 变更审计报告
  COMPLIANCE = 'compliance', // 合规报告
}

/**
 * 报告格式枚举
 */
export enum AuditReportFormat {
  JSON = 'json',
  PDF = 'pdf', // 预留，暂未实现
}

/**
 * 报告时间范围
 */
export interface AuditReportPeriod {
  start: Date;
  end: Date;
}

/**
 * 访问审计报告摘要
 */
export interface AccessAuditSummary {
  totalViews: number; // 总访问次数
  totalExports: number; // 总导出次数
  uniqueUsers: number; // 独立用户数
  topViewedRelations: Array<{ id: string; count: number }>; // 热门关系TOP10
  avgViewsPerUser: number; // 人均访问次数
  peakViewTime: Date | null; // 访问高峰时间
}

/**
 * 变更审计报告摘要
 */
export interface ChangeAuditSummary {
  totalRelationsCreated: number; // 创建关系数
  totalRelationsDeleted: number; // 删除关系数
  totalVerified: number; // 已验证数
  totalRejected: number; // 已拒绝数
  verificationRate: number; // 验证率（百分比）
  totalBatchOperations: number; // 批量操作数
  topOperators: Array<{ userId: string; userName: string; count: number }>; // 活跃操作员TOP5
}

/**
 * 合规报告摘要
 */
export interface ComplianceSummary {
  totalDataAccess: number; // 总数据访问次数
  sensitiveDataAccess: number; // 敏感数据访问次数
  dataDeletionRequests: number; // 数据删除请求数
  dataDeletionCompleted: number; // 已完成的删除数
  complianceScore: number; // 合规评分（0-100）
  privacyViolations: number; // 隐私违规数
  unauthorizedAccessAttempts: number; // 未授权访问尝试次数
}

/**
 * 报告摘要（联合类型）
 */
export type AuditReportSummary =
  | AccessAuditSummary
  | ChangeAuditSummary
  | ComplianceSummary;

/**
 * 访问审计详情
 */
export interface AccessAuditDetail {
  timestamp: Date;
  userId: string;
  userName?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 变更审计详情
 */
export interface ChangeAuditDetail {
  timestamp: Date;
  userId: string;
  userName?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * 合规审计详情
 */
export interface ComplianceAuditDetail {
  timestamp: Date;
  userId: string;
  userName?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  isSensitive: boolean; // 是否涉及敏感数据
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 报告详情（联合类型）
 */
export type AuditReportDetail =
  | AccessAuditDetail
  | ChangeAuditDetail
  | ComplianceAuditDetail;

/**
 * 完整审计报告
 */
export interface AuditReport<
  T extends AuditReportSummary = AuditReportSummary,
> {
  reportType: AuditReportType;
  period: {
    start: string; // ISO 8601格式
    end: string; // ISO 8601格式
  };
  summary: T;
  details: AuditReportDetail[];
  generatedAt: string; // ISO 8601格式
  generatedBy: string; // 生成者用户ID
}

/**
 * 报告生成参数
 */
export interface GenerateReportParams {
  startDate: string; // ISO 8601格式
  endDate: string; // ISO 8601格式
  reportType: AuditReportType;
  format?: AuditReportFormat;
  userId?: string; // 请求者用户ID
}

/**
 * 报告生成器接口
 */
export interface ReportGenerator<T extends AuditReportSummary> {
  generate(params: GenerateReportParams): Promise<AuditReport<T>>;
}
