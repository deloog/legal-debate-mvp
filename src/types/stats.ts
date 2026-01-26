/**
 * 统计系统类型定义
 */

// =============================================================================
// 时间范围相关类型
// =============================================================================

/**
 * 时间范围类型
 */
export enum TimeRange {
  TODAY = 'TODAY',
  YESTERDAY = 'YESTERDAY',
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_90_DAYS = 'LAST_90_DAYS',
  THIS_WEEK = 'THIS_WEEK',
  LAST_WEEK = 'LAST_WEEK',
  THIS_MONTH = 'THIS_MONTH',
  LAST_MONTH = 'LAST_MONTH',
  THIS_YEAR = 'THIS_YEAR',
  CUSTOM = 'CUSTOM',
}

/**
 * 时间段类型
 */
export enum DateGranularity {
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
}

/**
 * 自定义时间范围
 */
export interface CustomDateRange {
  startDate: string; // ISO 8601格式
  endDate: string; // ISO 8601格式
}

// =============================================================================
// 用户统计相关类型
// =============================================================================

/**
 * 用户注册趋势查询参数
 */
export interface RegistrationTrendQueryParams {
  timeRange?: TimeRange;
  granularity?: DateGranularity;
  customRange?: CustomDateRange;
  role?: string;
  status?: string;
}

/**
 * 注册趋势数据点
 */
export interface RegistrationTrendPoint {
  date: string; // 日期标签（如 "2024-01-15"）
  count: number; // 注册用户数
  cumulative?: number; // 累计用户数（可选）
}

/**
 * 注册趋势响应数据
 */
export interface RegistrationTrendData {
  trend: RegistrationTrendPoint[];
  summary: {
    totalUsers: number; // 总用户数
    newUsers: number; // 新增用户数
    growthRate: number; // 增长率（百分比）
    averageDaily: number; // 日均新增用户
  };
  metadata: {
    timeRange: TimeRange;
    granularity: DateGranularity;
    startDate: string;
    endDate: string;
  };
}

// =============================================================================
// 用户活跃度相关类型
// =============================================================================

/**
 * 用户活跃度查询参数
 */
export interface ActivityQueryParams {
  timeRange?: TimeRange;
  customRange?: CustomDateRange;
  role?: string;
  status?: string;
}

/**
 * 活跃度分类
 */
export interface ActivityDistribution {
  veryActive: number; // 非常活跃（日活跃）
  active: number; // 活跃（周活跃）
  inactive: number; // 不活跃（月未登录）
  dormant: number; // 沉默（3个月未登录）
}

/**
 * 活跃度趋势数据点
 */
export interface ActivityTrendPoint {
  date: string;
  activeUsers: number;
  newUsers: number;
  churnedUsers?: number; // 流失用户数
}

/**
 * 活跃度响应数据
 */
export interface ActivityData {
  distribution: ActivityDistribution;
  trend: ActivityTrendPoint[];
  summary: {
    totalUsers: number;
    activeUsers: number;
    activeRate: number; // 活跃率（百分比）
    avgLoginFrequency: number; // 平均登录频率（次/周）
  };
  metadata: {
    timeRange: TimeRange;
    startDate: string;
    endDate: string;
  };
}

// =============================================================================
// 案件统计相关类型
// =============================================================================

/**
 * 案件类型分布查询参数
 */
export interface CaseTypeDistributionQueryParams {
  timeRange?: TimeRange;
  customRange?: CustomDateRange;
  status?: string;
}

/**
 * 案件类型分布数据点
 */
export interface CaseTypeDistributionPoint {
  type: string; // 案件类型
  count: number; // 数量
  percentage: number; // 占比
}

/**
 * 案件类型分布响应数据
 */
export interface CaseTypeDistributionData {
  distribution: CaseTypeDistributionPoint[];
  summary: {
    totalCases: number; // 总案件数
    completedCases: number; // 已完成案件数
    activeCases: number; // 活跃案件数
  };
  metadata: {
    timeRange: TimeRange;
    startDate: string;
    endDate: string;
  };
}

/**
 * 案件效率查询参数
 */
export interface CaseEfficiencyQueryParams {
  timeRange?: TimeRange;
  customRange?: CustomDateRange;
  caseType?: string;
}

/**
 * 案件效率数据点
 */
export interface CaseEfficiencyPoint {
  date: string; // 日期
  completedCases: number; // 完成案件数
  averageCompletionTime: number; // 平均完成时间（小时）
  medianCompletionTime: number; // 中位数完成时间（小时）
}

/**
 * 案件效率统计响应数据
 */
export interface CaseEfficiencyData {
  trend: CaseEfficiencyPoint[];
  summary: {
    totalCompletedCases: number; // 总完成案件数
    averageCompletionTime: number; // 平均完成时间（小时）
    medianCompletionTime: number; // 中位数完成时间（小时）
    fastestCompletionTime: number; // 最快完成时间（小时）
    slowestCompletionTime: number; // 最慢完成时间（小时）
  };
  metadata: {
    timeRange: TimeRange;
    startDate: string;
    endDate: string;
  };
}

// =============================================================================
// 辩论统计相关类型
// =============================================================================

/**
 * 辩论生成次数查询参数
 */
export interface DebateGenerationCountQueryParams {
  timeRange?: TimeRange;
  granularity?: DateGranularity;
  customRange?: CustomDateRange;
  status?: string;
}

/**
 * 辩论生成次数数据点
 */
export interface DebateGenerationCountPoint {
  date: string; // 日期标签
  debatesCreated: number; // 创建的辩论数量
  argumentsGenerated: number; // 生成的论点数量
  averageArgumentsPerDebate: number; // 平均每个辩论的论点数
}

/**
 * 辩论生成次数响应数据
 */
export interface DebateGenerationCountData {
  trend: DebateGenerationCountPoint[];
  summary: {
    totalDebates: number; // 总辩论数
    totalArguments: number; // 总论点数
    averageArgumentsPerDebate: number; // 平均论点数
    growthRate: number; // 增长率（百分比）
  };
  metadata: {
    timeRange: TimeRange;
    granularity: DateGranularity;
    startDate: string;
    endDate: string;
  };
}

/**
 * 辩论质量评分查询参数
 */
export interface DebateQualityScoreQueryParams {
  timeRange?: TimeRange;
  customRange?: CustomDateRange;
  debateStatus?: string;
  minConfidence?: number; // 最小置信度
  maxConfidence?: number; // 最大置信度
}

/**
 * 辩论质量评分数据点
 */
export interface DebateQualityScorePoint {
  date: string; // 日期
  averageScore: number; // 平均质量评分（0-1）
  minScore: number; // 最低质量评分
  maxScore: number; // 最高质量评分
  medianScore: number; // 中位数质量评分
  argumentsCount: number; // 论点数量
}

/**
 * 辩论质量评分分布
 */
export interface DebateQualityDistribution {
  excellent: number; // 优秀（>=0.9）
  good: number; // 良好（0.7-0.9）
  average: number; // 一般（0.5-0.7）
  poor: number; // 较差（<0.5）
  totalCount: number; // 总数
}

/**
 * 辩论质量评分响应数据
 */
export interface DebateQualityScoreData {
  trend: DebateQualityScorePoint[];
  distribution: DebateQualityDistribution;
  summary: {
    averageScore: number; // 平均质量评分
    medianScore: number; // 中位数质量评分
    minScore: number; // 最低质量评分
    maxScore: number; // 最高质量评分
    scoreAboveThreshold: number; // 超过阈值的论点数量（>0.8）
    threshold: number; // 阈值（默认0.8）
  };
  metadata: {
    timeRange: TimeRange;
    startDate: string;
    endDate: string;
  };
}

// =============================================================================
// 通用统计类型
// =============================================================================

/**
 * 统计图表配置
 */
export interface ChartConfig {
  title: string;
  type: 'line' | 'bar' | 'area' | 'pie' | 'donut';
  showLegend: boolean;
  showTooltip: boolean;
  showGrid: boolean;
}

/**
 * 统计数据导出格式
 */
export enum ExportFormat {
  CSV = 'CSV',
  EXCEL = 'EXCEL',
  JSON = 'JSON',
  PDF = 'PDF',
}

/**
 * 数据导出查询参数
 */
export interface ExportQueryParams {
  format: ExportFormat;
  timeRange?: TimeRange;
  customRange?: CustomDateRange;
}

// =============================================================================
// 系统性能统计相关类型
// =============================================================================

/**
 * 系统性能统计查询参数
 */
export interface PerformanceQueryParams {
  timeRange?: TimeRange;
  granularity?: DateGranularity;
  customRange?: CustomDateRange;
  provider?: string; // AI服务商（如 deepseek, zhipu）
  model?: string; // AI模型名称
}

/**
 * 响应时间查询参数
 */
export type PerformanceResponseTimeQueryParams = PerformanceQueryParams;

/**
 * 性能指标数据点
 */
export interface PerformanceMetricPoint {
  date: string; // 日期标签
  count: number; // 请求次数
  averageResponseTime: number; // 平均响应时间（毫秒）
  p50ResponseTime: number; // P50响应时间（毫秒）
  p95ResponseTime: number; // P95响应时间（毫秒）
  p99ResponseTime: number; // P99响应时间（毫秒）
  minResponseTime: number; // 最快响应时间（毫秒）
  maxResponseTime: number; // 最慢响应时间（毫秒）
}

/**
 * 响应时间统计响应数据
 */
export interface PerformanceResponseTimeData {
  trend: PerformanceMetricPoint[];
  summary: {
    totalRequests: number; // 总请求数
    averageResponseTime: number; // 平均响应时间（毫秒）
    p95ResponseTime: number; // P95响应时间（毫秒）
    p99ResponseTime: number; // P99响应时间（毫秒）
    minResponseTime: number; // 最快响应时间（毫秒）
    maxResponseTime: number; // 最慢响应时间（毫秒）
  };
  byProvider: Array<{
    provider: string; // 服务商
    averageResponseTime: number; // 平均响应时间
    totalRequests: number; // 请求数
  }>;
  byModel: Array<{
    model: string; // 模型名称
    averageResponseTime: number; // 平均响应时间
    totalRequests: number; // 请求数
  }>;
  metadata: {
    timeRange: TimeRange;
    granularity: DateGranularity;
    startDate: string;
    endDate: string;
  };
}

/**
 * 错误率查询参数
 */
export interface PerformanceErrorRateQueryParams extends PerformanceQueryParams {
  errorType?: string; // 错误类型
  minSeverity?: string; // 最小严重程度
  includeRecovered?: boolean; // 是否包含已恢复的错误
}

/**
 * 错误率数据点
 */
export interface ErrorRatePoint {
  date: string; // 日期标签
  totalRequests: number; // 总请求数
  successCount: number; // 成功请求数
  errorCount: number; // 错误请求数
  errorRate: number; // 错误率（百分比）
  recoveredCount: number; // 恢复的错误数
  recoveryRate: number; // 恢复率（百分比）
}

/**
 * 律师绩效分析相关类型
 */

/**
 * 律师绩效分析查询参数
 */
export interface LawyerPerformanceQueryParams {
  timeRange?: TimeRange;
  granularity?: DateGranularity;
  customRange?: CustomDateRange;
  teamId?: string; // 团队ID筛选
  role?: string; // 角色筛选（LAWYER、PARALEGAL等）
  sortBy?: 'caseVolume' | 'successRate' | 'revenue' | 'efficiency';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * 律师案件量统计
 */
export interface LawyerCaseVolumeData {
  lawyerId: string;
  lawyerName: string;
  lawyerRole: string;
  totalCases: number; // 总案件数
  activeCases: number; // 活跃案件数
  completedCases: number; // 已完成案件数
  archivedCases: number; // 已归档案件数
}

/**
 * 律师胜诉率统计
 */
export interface LawyerSuccessRateData {
  lawyerId: string;
  lawyerName: string;
  lawyerRole: string;
  totalCases: number;
  successfulCases: number;
  successRate: number; // 胜诉率（百分比）
  byType: Array<{
    type: string;
    totalCases: number;
    successfulCases: number;
    successRate: number;
  }>;
}

/**
 * 律师创收统计
 */
export interface LawyerRevenueData {
  lawyerId: string;
  lawyerName: string;
  lawyerRole: string;
  totalRevenue: number; // 总创收
  averageRevenue: number; // 平均案件金额
  maxRevenue: number; // 最高案件金额
  minRevenue: number; // 最低案件金额
  revenueByType: Array<{
    type: string;
    totalRevenue: number;
    caseCount: number;
    percentage: number;
  }>;
}

/**
 * 律师效率统计
 */
export interface LawyerEfficiencyData {
  lawyerId: string;
  lawyerName: string;
  lawyerRole: string;
  completedCases: number; // 已完成案件数
  averageCompletionTime: number; // 平均完成时间（天）
  medianCompletionTime: number; // 中位数完成时间（天）
  fastestCompletionTime: number; // 最快完成时间（天）
  slowestCompletionTime: number; // 最慢完成时间（天）
  efficiencyRating: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR'; // 效率评级
}

/**
 * 律师工作时长统计
 */
export interface LawyerWorkHoursData {
  lawyerId: string;
  lawyerName: string;
  lawyerRole: string;
  totalHours: number; // 总工作时长（小时）
  averageHoursPerCase: number; // 平均每案件工作时长
  averageHoursPerDay: number; // 平均每日工作时长
  workDays: number; // 工作天数
}

/**
 * 律师绩效综合数据
 */
export interface LawyerPerformanceData {
  caseVolume: LawyerCaseVolumeData[];
  successRate: LawyerSuccessRateData[];
  revenue: LawyerRevenueData[];
  efficiency: LawyerEfficiencyData[];
  workHours: LawyerWorkHoursData[];
  summary: {
    totalLawyers: number;
    averageCasesPerLawyer: number;
    averageSuccessRate: number;
    totalRevenue: number;
    averageEfficiency: number;
  };
  metadata: {
    timeRange: TimeRange;
    granularity: DateGranularity;
    startDate: string;
    endDate: string;
    generatedAt: string;
    dataPoints: number;
  };
}

/**
 * 案件统计相关类型
 */

/**
 * 案件分析综合数据
 */
export interface CaseAnalyticsData {
  typeDistribution: CaseTypeDistributionData;
  efficiency: CaseEfficiencyData;
  successRate: CaseSuccessRateData;
  revenueAnalysis: CaseRevenueAnalysisData;
  activeCasesOverview: ActiveCasesOverview;
  metadata: CaseAnalyticsMetadata;
}

/**
 * 活跃案件概览
 */
export interface ActiveCasesOverview {
  totalActiveCases: number;
  averageDuration: number; // 平均审理周期（天）
  expiringSoon: number; // 即将到期案件数（30天内）
  newThisMonth: number; // 本月新增案件数
}

/**
 * 案件成功率数据
 */
export interface CaseSuccessRateData {
  totalCases: number;
  successfulCases: number;
  successRate: number; // 百分比
  byType: Array<{
    type: string;
    totalCases: number;
    successfulCases: number;
    successRate: number;
  }>;
  byCause: Array<{
    cause: string;
    totalCases: number;
    successfulCases: number;
    successRate: number;
  }>;
  trend: Array<{
    date: string;
    totalCases: number;
    successfulCases: number;
    successRate: number;
  }>;
}

/**
 * 案件收益分析数据
 */
export interface CaseRevenueAnalysisData {
  totalRevenue: number;
  averageRevenue: number;
  maxRevenue: number;
  minRevenue: number;
  byType: Array<{
    type: string;
    totalRevenue: number;
    averageRevenue: number;
    caseCount: number;
    percentage: number;
  }>;
  trend: Array<{
    date: string;
    revenue: number;
    caseCount: number;
    averageRevenue: number;
  }>;
}

/**
 * 案件分析元数据
 */
export interface CaseAnalyticsMetadata {
  timeRange: TimeRange;
  startDate: string;
  endDate: string;
  generatedAt: string;
  dataPoints: number;
}

/**
 * 案件分析查询参数
 */
export interface CaseAnalyticsQueryParams {
  timeRange?: TimeRange;
  granularity?: DateGranularity;
  customRange?: CustomDateRange;
  caseType?: string;
  status?: string;
}

/**
 * 案件类型分布查询参数
 */
export interface CaseTypeDistributionQueryParams {
  timeRange?: TimeRange;
  customRange?: CustomDateRange;
  status?: string;
}

/**
 * 错误类型分布
 */
export interface ErrorTypeDistribution {
  errorType: string; // 错误类型
  count: number; // 数量
  percentage: number; // 占比
  recovered: number; // 已恢复数量
  recoveryRate: number; // 恢复率（百分比）
}

/**
 * 严重程度分布
 */
export interface SeverityDistribution {
  severity: string; // 严重程度
  count: number; // 数量
  percentage: number; // 占比
}

/**
 * 错误率统计响应数据
 */
export interface PerformanceErrorRateData {
  trend: ErrorRatePoint[];
  summary: {
    totalRequests: number; // 总请求数
    successCount: number; // 成功请求数
    errorCount: number; // 错误请求数
    errorRate: number; // 总体错误率（百分比）
    recoveredCount: number; // 恢复的错误数
    recoveryRate: number; // 总体恢复率（百分比）
  };
  byErrorType: ErrorTypeDistribution[]; // 按错误类型分布
  bySeverity: SeverityDistribution[]; // 按严重程度分布
  byProvider: Array<{
    provider: string; // 服务商
    totalRequests: number; // 请求数
    errorCount: number; // 错误数
    errorRate: number; // 错误率
  }>;
  metadata: {
    timeRange: TimeRange;
    startDate: string;
    endDate: string;
  };
}

// =============================================================================
// 统计响应类型
// =============================================================================

/**
 * 统计API成功响应
 */
export interface StatsSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
}

/**
 * 统计API错误响应
 */
export interface StatsErrorResponse {
  success: false;
  message: string;
  error?: string;
}

/**
 * 统计API响应
 */
export type StatsApiResponse<T = unknown> =
  | StatsSuccessResponse<T>
  | StatsErrorResponse;

// =============================================================================
// 数据导出相关类型
// =============================================================================

/**
 * 案件导出查询参数
 */
export interface CaseExportQueryParams {
  format: ExportFormat;
  timeRange?: TimeRange;
  customRange?: CustomDateRange;
  caseType?: string;
  status?: string;
}

/**
 * 案件导出数据行
 */
export interface CaseExportRow {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  amount: string;
  caseNumber: string;
  cause: string;
  court: string;
  plaintiffName: string;
  defendantName: string;
  createdAt: string;
  updatedAt: string;
  debateCount: number;
  documentCount: number;
}

/**
 * 案件导出响应
 */
export interface CaseExportResponse {
  data: CaseExportRow[];
  totalCount: number;
  filename: string;
  exportedAt: string;
  timeRange: TimeRange;
  filters: {
    caseType?: string;
    status?: string;
  };
}

/**
 * 统计导出查询参数
 */
export interface StatsExportQueryParams {
  format: ExportFormat;
  exportType: StatsExportType;
  timeRange?: TimeRange;
  customRange?: CustomDateRange;
}

/**
 * 统计导出类型
 */
export enum StatsExportType {
  USER_REGISTRATION = 'USER_REGISTRATION',
  USER_ACTIVITY = 'USER_ACTIVITY',
  CASE_TYPE_DISTRIBUTION = 'CASE_TYPE_DISTRIBUTION',
  CASE_EFFICIENCY = 'CASE_EFFICIENCY',
  DEBATE_GENERATION = 'DEBATE_GENERATION',
  DEBATE_QUALITY = 'DEBATE_QUALITY',
  PERFORMANCE_RESPONSE_TIME = 'PERFORMANCE_RESPONSE_TIME',
  PERFORMANCE_ERROR_RATE = 'PERFORMANCE_ERROR_RATE',
}

/**
 * 统计导出响应
 */
export interface StatsExportResponse {
  exportType: StatsExportType;
  filename: string;
  exportedAt: string;
  data: Record<string, unknown>;
}

/**
 * 导出任务状态
 */
export enum ExportTaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * 导出任务信息
 */
export interface ExportTask {
  id: string;
  userId: string;
  exportType: string;
  format: ExportFormat;
  status: ExportTaskStatus;
  filename: string;
  filePath: string;
  progress: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// =============================================================================
// 报告系统相关类型
// =============================================================================

/**
 * 报告类型
 */
export enum ReportType {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM = 'CUSTOM',
}

/**
 * 报告状态
 */
export enum ReportStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * 报告生成配置
 */
export interface ReportGenerationConfig {
  type: ReportType;
  periodStart: string;
  periodEnd: string;
  format: ReportFormat;
  includeSections?: ReportSection[];
}

/**
 * 报告格式
 */
export enum ReportFormat {
  HTML = 'HTML',
  PDF = 'PDF',
  JSON = 'JSON',
}

/**
 * 报告部分
 */
export enum ReportSection {
  USER_STATS = 'USER_STATS',
  CASE_STATS = 'CASE_STATS',
  DEBATE_STATS = 'DEBATE_STATS',
  PERFORMANCE_STATS = 'PERFORMANCE_STATS',
  SUMMARY = 'SUMMARY',
}

/**
 * 用户统计报告部分
 */
export interface UserStatsReportSection {
  summary: {
    totalUsers: number;
    newUsers: number;
    activeUsers: number;
    growthRate: number;
  };
  trends: {
    registrationTrend: RegistrationTrendPoint[];
    activityTrend: ActivityTrendPoint[];
  };
  distribution: ActivityDistribution;
}

/**
 * 案件统计报告部分
 */
export interface CaseStatsReportSection {
  summary: {
    totalCases: number;
    completedCases: number;
    activeCases: number;
    averageCompletionTime: number;
  };
  distribution: CaseTypeDistributionPoint[];
  trends: CaseEfficiencyPoint[];
}

/**
 * 辩论统计报告部分
 */
export interface DebateStatsReportSection {
  summary: {
    totalDebates: number;
    totalArguments: number;
    averageArgumentsPerDebate: number;
    averageQualityScore: number;
  };
  trends: {
    generationCount: DebateGenerationCountPoint[];
    qualityScore: DebateQualityScorePoint[];
  };
  distribution: DebateQualityDistribution;
}

/**
 * 性能统计报告部分
 */
export interface PerformanceStatsReportSection {
  summary: {
    totalRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
  };
  trends: {
    responseTime: PerformanceMetricPoint[];
    errorRate: ErrorRatePoint[];
  };
}

/**
 * 报告摘要
 */
export interface ReportSummary {
  keyMetrics: Array<{
    label: string;
    value: number;
    change: number;
    unit: string;
  }>;
  highlights: string[];
  issues: string[];
  recommendations: string[];
}

/**
 * 完整报告内容
 */
export interface ReportContent {
  userStats?: UserStatsReportSection;
  caseStats?: CaseStatsReportSection;
  debateStats?: DebateStatsReportSection;
  performanceStats?: PerformanceStatsReportSection;
  summary: ReportSummary;
}

/**
 * 报告元数据
 */
export interface ReportMetadata {
  generatedAt: string;
  generatedBy: string; // 系统生成或用户ID
  generationTime: number; // 毫秒
  dataPoints: number;
  periodStart: string;
  periodEnd: string;
}

/**
 * 报告查询参数
 */
export interface ReportQueryParams {
  type?: ReportType;
  status?: ReportStatus;
  periodStart?: string;
  periodEnd?: string;
  page?: number;
  limit?: number;
}

/**
 * 报告列表响应
 */
export interface ReportListResponse {
  reports: Array<{
    id: string;
    type: ReportType;
    status: ReportStatus;
    periodStart: string;
    periodEnd: string;
    fileName: string;
    fileSize: number;
    generatedAt?: string;
    createdAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
}

/**
 * 报告详情响应
 */
export interface ReportDetailResponse {
  id: string;
  type: ReportType;
  status: ReportStatus;
  periodStart: string;
  periodEnd: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  format: ReportFormat;
  generatedBy?: string;
  generatedAt?: string;
  downloadCount: number;
  metadata: ReportMetadata;
  content?: ReportContent;
  createdAt: string;
  updatedAt: string;
}
