/**
 * 法务报表系统类型定义
 * 用于企业法务报表生成和分析功能
 */

// =============================================================================
// 枚举定义
// =============================================================================

/**
 * 报表类型
 */
export enum ReportType {
  CASE_STATISTICS = 'case_statistics', // 案件统计
  COST_ANALYSIS = 'cost_analysis', // 费用分析
  RISK_REPORT = 'risk_report', // 风险报告
  COMPLIANCE_REPORT = 'compliance_report', // 合规报告
}

/**
 * 报表时间范围
 */
export enum ReportPeriod {
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  LAST_90_DAYS = 'last_90_days',
  LAST_YEAR = 'last_year',
  CUSTOM = 'custom',
}

/**
 * 导出格式
 */
export enum ExportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
}

// =============================================================================
// 报表筛选条件
// =============================================================================

/**
 * 报表筛选条件
 */
export interface ReportFilter {
  reportType: ReportType;
  period: ReportPeriod;
  startDate?: Date;
  endDate?: Date;
  caseType?: string;
  department?: string;
  status?: string;
}

// =============================================================================
// 案件统计报表
// =============================================================================

/**
 * 案件统计数据
 */
export interface CaseStatistics {
  totalCases: number;
  activeCases: number;
  closedCases: number;
  wonCases: number;
  lostCases: number;
  pendingCases: number;
  byCaseType: Array<{
    caseType: string;
    count: number;
    percentage: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  byMonth: Array<{
    month: string;
    newCases: number;
    closedCases: number;
  }>;
  averageDuration: number; // 平均案件时长（天）
  successRate: number; // 胜诉率
}

// =============================================================================
// 费用分析报表
// =============================================================================

/**
 * 费用分析数据
 */
export interface CostAnalysis {
  totalCost: number;
  averageCostPerCase: number;
  costByCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  costByCaseType: Array<{
    caseType: string;
    amount: number;
    percentage: number;
  }>;
  costByMonth: Array<{
    month: string;
    amount: number;
  }>;
  topExpensiveCases: Array<{
    caseId: string;
    caseTitle: string;
    cost: number;
  }>;
  budgetUtilization: number; // 预算使用率
}

// =============================================================================
// 风险报告
// =============================================================================

/**
 * 风险报告数据
 */
export interface RiskReportData {
  totalRisks: number;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
  risksByCategory: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  risksByCaseType: Array<{
    caseType: string;
    count: number;
    averageRiskScore: number;
  }>;
  riskTrend: Array<{
    month: string;
    criticalRisks: number;
    highRisks: number;
    mediumRisks: number;
    lowRisks: number;
  }>;
  topRiskyCases: Array<{
    caseId: string;
    caseTitle: string;
    riskScore: number;
    riskLevel: string;
  }>;
  mitigationRate: number; // 风险缓解率
}

// =============================================================================
// 合规报告
// =============================================================================

/**
 * 合规报告数据
 */
export interface ComplianceReportData {
  overallScore: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  complianceByCategory: Array<{
    category: string;
    score: number;
    passed: number;
    failed: number;
  }>;
  complianceTrend: Array<{
    month: string;
    score: number;
  }>;
  topIssues: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
  }>;
  improvementRate: number; // 改进率
}

// =============================================================================
// 报表数据
// =============================================================================

/**
 * 报表数据
 */
export interface ReportData {
  id: string;
  reportType: ReportType;
  title: string;
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  filter: ReportFilter;
  data: CaseStatistics | CostAnalysis | RiskReportData | ComplianceReportData;
  summary: string;
  recommendations: string[];
}

// =============================================================================
// API 请求和响应类型
// =============================================================================

/**
 * 生成报表请求
 */
export interface GenerateReportRequest {
  filter: ReportFilter;
}

/**
 * 生成报表响应
 */
export interface GenerateReportResponse {
  success: boolean;
  data?: ReportData;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 导出报表请求
 */
export interface ExportReportRequest {
  reportId: string;
  format: ExportFormat;
}

/**
 * 导出报表响应
 */
export interface ExportReportResponse {
  success: boolean;
  data?: {
    downloadUrl: string;
    fileName: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 报表历史项
 */
export interface ReportHistoryItem {
  id: string;
  reportType: ReportType;
  title: string;
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

/**
 * 报表历史响应
 */
export interface ReportHistoryResponse {
  success: boolean;
  data?: {
    items: ReportHistoryItem[];
    total: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// =============================================================================
// 类型守卫函数
// =============================================================================

/**
 * 验证报表类型
 */
export function isValidReportType(value: unknown): value is ReportType {
  return (
    typeof value === 'string' &&
    Object.values(ReportType).includes(value as ReportType)
  );
}

/**
 * 验证报表时间范围
 */
export function isValidReportPeriod(value: unknown): value is ReportPeriod {
  return (
    typeof value === 'string' &&
    Object.values(ReportPeriod).includes(value as ReportPeriod)
  );
}

/**
 * 验证导出格式
 */
export function isValidExportFormat(value: unknown): value is ExportFormat {
  return (
    typeof value === 'string' &&
    Object.values(ExportFormat).includes(value as ExportFormat)
  );
}

/**
 * 验证报表筛选条件
 */
export function isValidReportFilter(data: unknown): data is ReportFilter {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const filter = data as Record<string, unknown>;

  // 验证必填字段
  if (!isValidReportType(filter.reportType)) {
    return false;
  }

  if (!isValidReportPeriod(filter.period)) {
    return false;
  }

  // 验证自定义时间范围
  if (filter.period === ReportPeriod.CUSTOM) {
    if (!filter.startDate || !filter.endDate) {
      return false;
    }
    // 检查是否为Date对象或可以转换为Date的字符串
    const startDate =
      filter.startDate instanceof Date
        ? filter.startDate
        : new Date(filter.startDate as string);
    const endDate =
      filter.endDate instanceof Date
        ? filter.endDate
        : new Date(filter.endDate as string);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return false;
    }
  }

  return true;
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 获取报表类型标签
 */
export function getReportTypeLabel(reportType: ReportType): string {
  const labels: Record<ReportType, string> = {
    [ReportType.CASE_STATISTICS]: '案件统计',
    [ReportType.COST_ANALYSIS]: '费用分析',
    [ReportType.RISK_REPORT]: '风险报告',
    [ReportType.COMPLIANCE_REPORT]: '合规报告',
  };
  return labels[reportType] || '未知';
}

/**
 * 获取报表时间范围标签
 */
export function getReportPeriodLabel(period: ReportPeriod): string {
  const labels: Record<ReportPeriod, string> = {
    [ReportPeriod.LAST_7_DAYS]: '最近7天',
    [ReportPeriod.LAST_30_DAYS]: '最近30天',
    [ReportPeriod.LAST_90_DAYS]: '最近90天',
    [ReportPeriod.LAST_YEAR]: '最近一年',
    [ReportPeriod.CUSTOM]: '自定义',
  };
  return labels[period] || '未知';
}

/**
 * 获取导出格式标签
 */
export function getExportFormatLabel(format: ExportFormat): string {
  const labels: Record<ExportFormat, string> = {
    [ExportFormat.PDF]: 'PDF',
    [ExportFormat.EXCEL]: 'Excel',
    [ExportFormat.CSV]: 'CSV',
  };
  return labels[format] || '未知';
}
