/**
 * 图数据库评估类型定义
 *
 * 评估目标：
 * 1. 当前PostgreSQL存储的性能评估
 * 2. Neo4j图数据库可行性分析
 * 3. ArangoDB图数据库可行性分析
 * 4. 迁移成本和风险评估
 */

import { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';

/**
 * 评估的图数据库类型
 */
export enum GraphDatabaseType {
  POSTGRESQL = 'postgresql',
  NEO4J = 'neo4j',
  ARANGODB = 'arangodb',
}

/**
 * 性能基准测试结果
 */
export interface BenchmarkResult {
  operation: string;
  databaseType: GraphDatabaseType;
  duration: number; // 毫秒
  dataSize: number; // 数据量
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 图算法性能测试结果
 */
export interface AlgorithmBenchmarkResult {
  algorithm: string;
  dataSize: number;
  inMemoryTime: number; // 内存中执行时间
  estimatedGraphDbTime: number; // 预估图数据库时间
  memoryUsage: number; // 内存使用量（字节）
  notes: string;
}

/**
 * 存储成本评估
 */
export interface StorageCostEstimate {
  databaseType: GraphDatabaseType;
  estimatedStorageGB: number;
  costPerGBMonthly: number; // 美元/月
  estimatedMonthlyCost: number;
  notes: string;
}

/**
 * 运维成本评估
 */
export interface OperationalCostEstimate {
  databaseType: GraphDatabaseType;
  setupComplexity: 'low' | 'medium' | 'high';
  maintenanceEffort: 'low' | 'medium' | 'high';
  monitoringTools: string[];
  backupStrategy: string;
  estimatedMonthlyEffortHours: number;
}

/**
 * 特性支持评估
 */
export interface FeatureSupportAssessment {
  feature: string;
  postgresql: { supported: boolean; notes: string };
  neo4j: { supported: boolean; notes: string };
  arangodb: { supported: boolean; notes: string };
}

/**
 * 迁移复杂度评估
 */
export interface MigrationComplexityAssessment {
  aspect: string;
  complexity: 'low' | 'medium' | 'high';
  effortDays: number;
  risk: 'low' | 'medium' | 'high';
  mitigation: string;
}

/**
 * 综合评估结果
 */
export interface ComprehensiveEvaluationResult {
  id: string;
  evaluatedAt: string;
  currentDataSize: {
    nodes: number;
    edges: number;
  };
  projectedDataSize: {
    nodes1Year: number;
    edges1Year: number;
    nodes3Year: number;
    edges3Year: number;
  };
  benchmarks: {
    algorithm: AlgorithmBenchmarkResult[];
    storage: StorageCostEstimate[];
    operational: OperationalCostEstimate[];
  };
  featureSupport: FeatureSupportAssessment[];
  migrationComplexity: MigrationComplexityAssessment[];
  recommendations: Recommendation[];
  finalVerdict: {
    recommendedDatabase: GraphDatabaseType | 'keep_current';
    confidence: 'low' | 'medium' | 'high';
    reasoning: string;
  };
}

/**
 * 建议项
 */
export interface Recommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  estimatedImpact: string;
  relatedMetrics: string[];
}

/**
 * 评估配置
 */
export interface EvaluationConfig {
  sampleSizes: number[];
  algorithmIterations: number;
  includeProjections: boolean;
  benchmarkOperations: string[];
}

/**
 * 性能测试输入
 */
export interface PerformanceTestInput {
  nodes: GraphNode[];
  links: GraphLink[];
  algorithm:
    | 'shortestPath'
    | 'pageRank'
    | 'connectedComponents'
    | 'degreeCentrality';
  iterations?: number;
}

/**
 * 评估报告格式
 */
export enum ReportFormat {
  JSON = 'json',
  MARKDOWN = 'markdown',
  HTML = 'html',
}

/**
 * 评估请求
 */
export interface EvaluationRequest {
  config?: Partial<EvaluationConfig>;
  includeBenchmarks?: boolean;
  includeProjections?: boolean;
  reportFormat?: ReportFormat;
}

/**
 * 默认评估配置
 */
export const DEFAULT_EVALUATION_CONFIG: EvaluationConfig = {
  sampleSizes: [100, 1000, 10000],
  algorithmIterations: 10,
  includeProjections: true,
  benchmarkOperations: [
    'shortestPath',
    'pageRank',
    'connectedComponents',
    'neighbors',
    'batchQuery',
  ],
};
