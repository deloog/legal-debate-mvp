/**
 * 图数据库评估类型定义
 */

/**
 * 候选数据库类型
 */
export enum DatabaseType {
  POSTGRESQL = 'postgresql',
  NEO4J = 'neo4j',
  ARANGODB = 'arangodb',
}

/**
 * 基准测试类型
 */
export enum BenchmarkType {
  // 单跳查询
  SINGLE_HOP_QUERY = 'single_hop_query',
  // 多跳路径查询
  MULTI_HOP_PATH = 'multi_hop_path',
  // 邻居查询
  NEIGHBOR_QUERY = 'neighbor_query',
  // PageRank中心性
  PAGERANK_CENTRALITY = 'pagerank_centrality',
  // 连通分量
  CONNECTED_COMPONENTS = 'connected_components',
  // 批量插入
  BATCH_INSERT = 'batch_insert',
  // 批量更新
  BATCH_UPDATE = 'batch_update',
  // 复杂过滤查询
  COMPLEX_FILTER_QUERY = 'complex_filter_query',
  // 聚合查询
  AGGREGATION_QUERY = 'aggregation_query',
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  // 执行时间（毫秒）
  executionTime: number;
  // 查询返回的记录数
  recordCount: number;
  // 内存使用（MB）
  memoryUsage: number;
  // CPU使用率（百分比）
  cpuUsage: number;
  // 查询计划详情
  queryPlan?: string;
}

/**
 * 基准测试结果
 */
export interface BenchmarkResult {
  // 数据库类型
  databaseType: DatabaseType;
  // 测试类型
  benchmarkType: BenchmarkType;
  // 数据规模
  dataScale: DataScale;
  // 性能指标
  metrics: PerformanceMetrics;
  // 成功/失败
  success: boolean;
  // 错误信息（如果失败）
  error?: string;
  // 测试时间戳
  timestamp: Date;
}

/**
 * 数据规模配置
 */
export interface DataScale {
  // 法条数量
  articleCount: number;
  // 关系数量
  relationCount: number;
  // 平均每个法条的关系数
  avgRelationsPerArticle: number;
  // 图的平均度数
  averageDegree: number;
}

/**
 * 测试法条
 */
export interface TestArticle {
  id: string;
  lawName: string;
  articleNumber: string;
  category: string;
  lawType: string;
  fullText: string;
  effectiveDate: Date;
}

/**
 * 测试关系
 */
export interface TestRelation {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  strength: number;
  confidence: number;
  verificationStatus: string;
}

/**
 * 路径查询参数
 */
export interface PathQueryParams {
  sourceId: string;
  targetId: string;
  maxDepth: number;
  relationTypes?: string[];
}

/**
 * 邻居查询参数
 */
export interface NeighborQueryParams {
  nodeId: string;
  depth: number;
  direction?: 'incoming' | 'outgoing' | 'both';
  relationTypes?: string[];
  minStrength?: number;
}

/**
 * PageRank参数
 */
export interface PageRankParams {
  iterations: number;
  dampingFactor: number;
  tolerance: number;
}

/**
 * 基准测试配置
 */
export interface BenchmarkConfig {
  // 数据库类型
  databaseType: DatabaseType;
  // 数据规模
  dataScale: DataScale;
  // 测试类型列表
  benchmarkTypes: BenchmarkType[];
  // 每个测试重复次数
  iterations: number;
  // 连接配置
  connectionConfig: Record<string, string | number>;
}

/**
 * 评估对比结果
 */
export interface ComparisonResult {
  // 测试类型
  benchmarkType: BenchmarkType;
  // PostgreSQL结果
  postgresql: BenchmarkResult[];
  // Neo4j结果（可选）
  neo4j?: BenchmarkResult[];
  // ArangoDB结果（可选）
  arangodb?: BenchmarkResult[];
  // 性能提升百分比（相对于PostgreSQL）
  performanceGain?: {
    neo4j?: number;
    arangodb?: number;
  };
  // 推荐数据库
  recommendedDatabase: DatabaseType;
  // 推荐理由
  recommendationReason: string;
}

/**
 * 迁移成本估算
 */
export interface MigrationCost {
  // 数据迁移工时
  dataMigrationHours: number;
  // 应用改造工时
  applicationRefactoringHours: number;
  // 测试工时
  testingHours: number;
  // 培训工时
  trainingHours: number;
  // 总工时
  totalHours: number;
  // 许可证成本（年）
  licenseCostPerYear?: number;
  // 硬件成本
  hardwareCost?: number;
  // 总第一年成本
  totalFirstYearCost?: number;
}

/**
 * 数据库特性对比
 */
export interface DatabaseFeatures {
  // 原生图查询
  nativeGraphQuery: boolean;
  // 图算法库
  graphAlgorithms: string[];
  // 查询语言
  queryLanguage: string;
  // ACID支持
  acidSupport: boolean;
  // 水平扩展
  horizontalScaling: boolean;
  // 多模型支持
  multiModel: boolean;
  // 开源
  openSource: boolean;
  // 社区活跃度
  communityActivity: 'high' | 'medium' | 'low';
  // 学习曲线
  learningCurve: 'easy' | 'medium' | 'steep';
  // 部署复杂度
  deploymentComplexity: 'simple' | 'medium' | 'complex';
}

/**
 * 评估报告
 */
export interface EvaluationReport {
  // 报告标题
  title: string;
  // 生成日期
  generatedAt: Date;
  // 当前架构分析
  currentArchitecture: {
    database: DatabaseType;
    dataScale: DataScale;
    performanceIssues: string[];
  };
  // 数据库特性对比
  featuresComparison: Record<DatabaseType, DatabaseFeatures>;
  // 性能基准测试结果
  benchmarkResults: ComparisonResult[];
  // 迁移成本估算
  migrationCost?: Record<DatabaseType, MigrationCost>;
  // 最终建议
  recommendation: {
    recommendedDatabase: DatabaseType;
    reason: string;
    migrationPath: string[];
    risks: string[];
    timeline: string;
  };
  // 附加信息
  additionalNotes: string[];
}
