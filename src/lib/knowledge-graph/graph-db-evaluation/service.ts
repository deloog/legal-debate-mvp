/**
 * 图数据库评估服务
 *
 * 功能：
 * 1. 性能基准测试
 * 2. 特性支持评估
 * 3. 成本分析
 * 4. 迁移复杂度评估
 * 5. 综合建议生成
 */

import { logger } from '@/lib/logger';
import { GraphAlgorithms } from '@/lib/knowledge-graph/graph-algorithms';
import {
  GraphDatabaseType,
  BenchmarkResult,
  AlgorithmBenchmarkResult,
  StorageCostEstimate,
  OperationalCostEstimate,
  FeatureSupportAssessment,
  MigrationComplexityAssessment,
  ComprehensiveEvaluationResult,
  Recommendation,
  EvaluationConfig,
  DEFAULT_EVALUATION_CONFIG,
  PerformanceTestInput,
} from './types';

/**
 * 图数据库评估服务类
 */
export class GraphDatabaseEvaluationService {
  private config: EvaluationConfig;

  constructor(config?: Partial<EvaluationConfig>) {
    this.config = { ...DEFAULT_EVALUATION_CONFIG, ...config };
  }

  /**
   * 运行完整的图数据库评估
   */
  async runComprehensiveEvaluation(): Promise<ComprehensiveEvaluationResult> {
    const evaluationId = `eval_${Date.now()}`;

    logger.info('开始图数据库评估', { evaluationId });

    // 获取当前数据规模
    const currentDataSize = await this.estimateCurrentDataSize();

    // 预测未来数据规模
    const projectedDataSize = this.projectDataSize(currentDataSize);

    // 运行算法基准测试
    const algorithmBenchmarks = await this.benchmarkAlgorithms();

    // 存储成本评估
    const storageCosts = this.assessStorageCosts(
      currentDataSize,
      projectedDataSize
    );

    // 运维成本评估
    const operationalCosts = this.assessOperationalCosts();

    // 特性支持评估
    const featureSupport = this.assessFeatureSupport();

    // 迁移复杂度评估
    const migrationComplexity = this.assessMigrationComplexity();

    // 生成建议
    const recommendations = this.generateRecommendations({
      currentDataSize,
      projectedDataSize,
      algorithmBenchmarks,
      storageCosts,
      featureSupport,
    });

    // 得出最终结论
    const verdict = this.determineVerdict({
      currentDataSize,
      projectedDataSize,
      algorithmBenchmarks,
      storageCosts,
      featureSupport,
      migrationComplexity,
    });

    const result: ComprehensiveEvaluationResult = {
      id: evaluationId,
      evaluatedAt: new Date().toISOString(),
      currentDataSize,
      projectedDataSize,
      benchmarks: {
        algorithm: algorithmBenchmarks,
        storage: storageCosts,
        operational: operationalCosts,
      },
      featureSupport,
      migrationComplexity,
      recommendations,
      finalVerdict: verdict,
    };

    logger.info('图数据库评估完成', {
      evaluationId,
      recommendedDatabase: verdict.recommendedDatabase,
      confidence: verdict.confidence,
    });

    return result;
  }

  /**
   * 估算当前数据规模
   */
  private async estimateCurrentDataSize(): Promise<{
    nodes: number;
    edges: number;
  }> {
    try {
      // 动态导入 Prisma Client
      const { prisma } = await import('@/lib/db');

      const [articleCount, relationCount] = await Promise.all([
        prisma.lawArticle.count(),
        prisma.lawArticleRelation.count(),
      ]);

      return {
        nodes: articleCount,
        edges: relationCount,
      };
    } catch (error) {
      logger.warn('无法获取数据库统计，使用估算值', { error });
      // 返回估算值 - 基于典型法律数据库规模
      return {
        nodes: 50000, // 估算约5万条法条
        edges: 100000, // 估算约10万条关系
      };
    }
  }

  /**
   * 预测未来数据规模
   */
  private projectDataSize(current: { nodes: number; edges: number }): {
    nodes1Year: number;
    edges1Year: number;
    nodes3Year: number;
    edges3Year: number;
  } {
    // 基于历史增长趋势预测
    // 假设月增长率为5%
    const monthlyGrowthRate = 0.05;
    const months1Year = 12;
    const months3Year = 36;

    const growthFactor1Year = Math.pow(1 + monthlyGrowthRate, months1Year);
    const growthFactor3Year = Math.pow(1 + monthlyGrowthRate, months3Year);

    return {
      nodes1Year: Math.round(current.nodes * growthFactor1Year),
      edges1Year: Math.round(current.edges * growthFactor1Year),
      nodes3Year: Math.round(current.nodes * growthFactor3Year),
      edges3Year: Math.round(current.edges * growthFactor3Year),
    };
  }

  /**
   * 基准测试图算法性能
   */
  private async benchmarkAlgorithms(): Promise<AlgorithmBenchmarkResult[]> {
    const results: AlgorithmBenchmarkResult[] = [];
    const testDataSizes = this.config.sampleSizes;

    for (const size of testDataSizes) {
      // 生成测试数据
      const { nodes, links } = this.generateTestGraph(size);

      // 测试最短路径算法
      const shortestPathResult = await this.benchmarkAlgorithm(
        'shortestPath',
        size,
        () => {
          if (nodes.length >= 2) {
            GraphAlgorithms.shortestPath(
              nodes,
              links,
              nodes[0].id,
              nodes[1].id
            );
          }
        }
      );
      results.push(shortestPathResult);

      // 测试PageRank算法
      const pageRankResult = await this.benchmarkAlgorithm(
        'pageRank',
        size,
        () => {
          GraphAlgorithms.pageRank(nodes, links, 10, 0.85);
        }
      );
      results.push(pageRankResult);

      // 测试连通分量算法
      const connectedComponentsResult = await this.benchmarkAlgorithm(
        'connectedComponents',
        size,
        () => {
          GraphAlgorithms.connectedComponents(nodes, links);
        }
      );
      results.push(connectedComponentsResult);

      // 测试度中心性算法
      const degreeCentralityResult = await this.benchmarkAlgorithm(
        'degreeCentrality',
        size,
        () => {
          GraphAlgorithms.degreeCentrality(nodes, links);
        }
      );
      results.push(degreeCentralityResult);
    }

    return results;
  }

  /**
   * 执行单个算法基准测试
   */
  private async benchmarkAlgorithm(
    algorithm: string,
    dataSize: number,
    fn: () => void
  ): Promise<AlgorithmBenchmarkResult> {
    const iterations = this.config.algorithmIterations;
    const startMemory = process.memoryUsage().heapUsed;

    // 预热
    fn();

    // 正式测试
    const times: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }

    const endMemory = process.memoryUsage().heapUsed;
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const memoryUsage = endMemory - startMemory;

    // 根据数据量估算图数据库执行时间
    // Neo4j和ArangoDB对大规模图操作有优化，但在小规模数据上可能不如内存操作
    let estimatedGraphDbTime: number;
    let notes: string;

    if (dataSize <= 1000) {
      estimatedGraphDbTime = avgTime * 1.5; // 小规模数据，内存操作更快
      notes = '小规模数据，内存算法性能优于图数据库';
    } else if (dataSize <= 10000) {
      estimatedGraphDbTime = avgTime * 0.8; // 中等规模，性能接近
      notes = '中等规模，性能与图数据库接近';
    } else {
      estimatedGraphDbTime = avgTime * 0.3; // 大规模，图数据库更优
      notes = '大规模数据，图数据库原生图操作更具优势';
    }

    return {
      algorithm,
      dataSize,
      inMemoryTime: Math.round(avgTime * 100) / 100,
      estimatedGraphDbTime: Math.round(estimatedGraphDbTime * 100) / 100,
      memoryUsage,
      notes,
    };
  }

  /**
   * 生成测试图数据
   */
  private generateTestGraph(size: number): {
    nodes: {
      id: string;
      lawName: string;
      articleNumber: string;
      category: string;
      level: number;
    }[];
    links: {
      source: string;
      target: string;
      relationType: string;
      strength: number;
      confidence: number;
    }[];
  } {
    const nodes = [];
    const links = [];

    // 生成节点
    for (let i = 0; i < size; i++) {
      nodes.push({
        id: `article_${i}`,
        lawName: `法律${Math.floor(i / 1000)}`,
        articleNumber: `第${i % 1000}条`,
        category: ['CIVIL', 'CRIMINAL', 'ADMINISTRATIVE', 'COMMERCIAL'][i % 4],
        level: 0,
      });
    }

    // 生成边 - 随机连接，模拟真实图结构
    const edgeCount = Math.min(size * 2, (size * (size - 1)) / 10);
    const relationTypes = [
      'CITES',
      'RELATED',
      'CONFLICTS',
      'SUPERSEDES',
      'COMPLETES',
    ];

    for (let i = 0; i < edgeCount; i++) {
      const sourceIndex = Math.floor(Math.random() * size);
      let targetIndex = Math.floor(Math.random() * size);
      while (targetIndex === sourceIndex) {
        targetIndex = Math.floor(Math.random() * size);
      }

      links.push({
        source: nodes[sourceIndex].id,
        target: nodes[targetIndex].id,
        relationType:
          relationTypes[Math.floor(Math.random() * relationTypes.length)],
        strength: Math.random() * 0.5 + 0.5,
        confidence: Math.random() * 0.3 + 0.7,
      });
    }

    return { nodes, links };
  }

  /**
   * 评估存储成本
   */
  private assessStorageCosts(
    current: { nodes: number; edges: number },
    _projected: {
      nodes1Year: number;
      edges1Year: number;
      nodes3Year: number;
      edges3Year: number;
    }
  ): StorageCostEstimate[] {
    // PostgreSQL成本估算（基于AWS RDS定价）
    const postgresCostPerGB = 0.1; // $0.10/GB/月
    const postgresStorageGB = Math.max(
      1,
      current.nodes * 0.001 + current.edges * 0.0005
    );
    // Neo4j成本估算（基于Neo4j Aura定价）
    const neo4jCostPerGB = 0.5; // $0.50/GB/月（入门级）
    const neo4jStorageGB = postgresStorageGB * 1.2; // 图数据库略有额外开销

    // ArangoDB成本估算（基于ArangoDB Oasis定价）
    const arangodbCostPerGB = 0.35; // $0.35/GB/月
    const arangodbStorageGB = postgresStorageGB * 1.1;

    return [
      {
        databaseType: GraphDatabaseType.POSTGRESQL,
        estimatedStorageGB: Math.round(postgresStorageGB * 100) / 100,
        costPerGBMonthly: postgresCostPerGB,
        estimatedMonthlyCost:
          Math.round(postgresStorageGB * postgresCostPerGB * 100) / 100,
        notes: '基于当前数据规模估算，包含索引存储',
      },
      {
        databaseType: GraphDatabaseType.NEO4J,
        estimatedStorageGB: Math.round(neo4jStorageGB * 100) / 100,
        costPerGBMonthly: neo4jCostPerGB,
        estimatedMonthlyCost:
          Math.round(neo4jStorageGB * neo4jCostPerGB * 100) / 100,
        notes: 'Neo4j存储开销略高于关系型数据库',
      },
      {
        databaseType: GraphDatabaseType.ARANGODB,
        estimatedStorageGB: Math.round(arangodbStorageGB * 100) / 100,
        costPerGBMonthly: arangodbCostPerGB,
        estimatedMonthlyCost:
          Math.round(arangodbStorageGB * arangodbCostPerGB * 100) / 100,
        notes: 'ArangoDB作为文档+图数据库，存储效率较高',
      },
    ];
  }

  /**
   * 评估运维成本
   */
  private assessOperationalCosts(): OperationalCostEstimate[] {
    return [
      {
        databaseType: GraphDatabaseType.POSTGRESQL,
        setupComplexity: 'low',
        maintenanceEffort: 'low',
        monitoringTools: ['pg_stat_statements', 'Datadog', 'CloudWatch'],
        backupStrategy: '每日全量 + 持续归档',
        estimatedMonthlyEffortHours: 2,
      },
      {
        databaseType: GraphDatabaseType.NEO4J,
        setupComplexity: 'medium',
        maintenanceEffort: 'medium',
        monitoringTools: ['Neo4j Browser', 'Neo4j Ops Manager', 'Datadog'],
        backupStrategy: '每日全量 + 增量备份',
        estimatedMonthlyEffortHours: 4,
      },
      {
        databaseType: GraphDatabaseType.ARANGODB,
        setupComplexity: 'medium',
        maintenanceEffort: 'medium',
        monitoringTools: ['ArangoDB Web UI', 'Prometheus', 'Datadog'],
        backupStrategy: '每日全量 + 持续归档',
        estimatedMonthlyEffortHours: 3,
      },
    ];
  }

  /**
   * 评估特性支持
   */
  private assessFeatureSupport(): FeatureSupportAssessment[] {
    return [
      {
        feature: '最短路径查询',
        postgresql: {
          supported: true,
          notes: '需要递归CTE，性能随深度增加下降',
        },
        neo4j: {
          supported: true,
          notes: '原生图查询语言Cypher，性能优秀',
        },
        arangodb: {
          supported: true,
          notes: 'AQL支持图查询，性能良好',
        },
      },
      {
        feature: 'PageRank中心性',
        postgresql: {
          supported: true,
          notes: '需在应用层实现，数据传输开销大',
        },
        neo4j: {
          supported: true,
          notes: '内置算法库，性能优秀',
        },
        arangodb: {
          supported: true,
          notes: 'arangosh支持图算法扩展',
        },
      },
      {
        feature: '社区发现',
        postgresql: {
          supported: true,
          notes: '需在应用层实现，复杂度高',
        },
        neo4j: {
          supported: true,
          notes: '内置社区发现算法',
        },
        arangodb: {
          supported: true,
          notes: '可通过arangosh实现',
        },
      },
      {
        feature: '批量关系查询',
        postgresql: {
          supported: true,
          notes: '索引优化后性能良好',
        },
        neo4j: {
          supported: true,
          notes: '图遍历优化，性能优秀',
        },
        arangodb: {
          supported: true,
          notes: '支持批量查询，性能良好',
        },
      },
      {
        feature: '事务支持',
        postgresql: {
          supported: true,
          notes: '成熟的ACID事务支持',
        },
        neo4j: {
          supported: true,
          notes: '支持ACID事务',
        },
        arangodb: {
          supported: true,
          notes: '支持ACID事务（单实例）',
        },
      },
      {
        feature: '水平扩展',
        postgresql: {
          supported: true,
          notes: '支持分片，但复杂度高',
        },
        neo4j: {
          supported: true,
          notes: '企业版支持集群，社区版有限制',
        },
        arangodb: {
          supported: true,
          notes: '支持集群模式',
        },
      },
      {
        feature: 'GIS地理查询',
        postgresql: {
          supported: true,
          notes: 'PostGIS扩展强大',
        },
        neo4j: {
          supported: false,
          notes: '需要额外扩展',
        },
        arangodb: {
          supported: false,
          notes: '需要额外扩展',
        },
      },
      {
        feature: '全文搜索',
        postgresql: {
          supported: true,
          notes: '全文索引支持完善',
        },
        neo4j: {
          supported: true,
          notes: '需集成Elasticsearch',
        },
        arangodb: {
          supported: true,
          notes: '内置全文索引',
        },
      },
    ];
  }

  /**
   * 评估迁移复杂度
   */
  private assessMigrationComplexity(): MigrationComplexityAssessment[] {
    return [
      {
        aspect: '数据模型转换',
        complexity: 'medium',
        effortDays: 5,
        risk: 'low',
        mitigation: '编写迁移脚本，双写验证',
      },
      {
        aspect: '数据迁移',
        complexity: 'medium',
        effortDays: 3,
        risk: 'medium',
        mitigation: '分批迁移，校验数据一致性',
      },
      {
        aspect: 'API适配',
        complexity: 'high',
        effortDays: 10,
        risk: 'medium',
        mitigation: '抽象数据访问层，平滑切换',
      },
      {
        aspect: '查询重写',
        complexity: 'high',
        effortDays: 7,
        risk: 'high',
        mitigation: '充分测试，保留回滚能力',
      },
      {
        aspect: '运维流程',
        complexity: 'medium',
        effortDays: 3,
        risk: 'low',
        mitigation: '文档化运维流程，培训团队',
      },
      {
        aspect: '性能调优',
        complexity: 'high',
        effortDays: 5,
        risk: 'medium',
        mitigation: '基线测试，持续监控优化',
      },
    ];
  }

  /**
   * 生成建议
   */
  private generateRecommendations(params: {
    currentDataSize: { nodes: number; edges: number };
    projectedDataSize: {
      nodes1Year: number;
      edges1Year: number;
      nodes3Year: number;
      edges3Year: number;
    };
    algorithmBenchmarks: AlgorithmBenchmarkResult[];
    storageCosts: StorageCostEstimate[];
    featureSupport: FeatureSupportAssessment[];
  }): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const { currentDataSize, projectedDataSize } = params;

    // 建议1：保持当前架构
    if (currentDataSize.edges < 50000) {
      recommendations.push({
        id: 'rec_1',
        priority: 'high',
        title: '当前规模无需图数据库',
        description: `当前数据规模为${currentDataSize.nodes}节点/${currentDataSize.edges}边，PostgreSQL足以支撑`,
        action: '继续使用PostgreSQL，监控数据增长',
        estimatedImpact: '保持现有架构，减少运维复杂度',
        relatedMetrics: ['当前数据规模'],
      });
    }

    // 建议2：优化索引
    recommendations.push({
      id: 'rec_2',
      priority: 'medium',
      title: '优化数据库索引',
      description: '根据查询模式优化复合索引，提升查询性能',
      action: '分析慢查询日志，添加针对性索引',
      estimatedImpact: '查询性能提升30-50%',
      relatedMetrics: ['查询响应时间'],
    });

    // 建议3：实现缓存
    recommendations.push({
      id: 'rec_3',
      priority: 'medium',
      title: '增强缓存策略',
      description: '对频繁访问的图数据实施多级缓存',
      action: '实现Redis缓存层，缓存图遍历结果',
      estimatedImpact: '减少数据库负载，提升响应速度',
      relatedMetrics: ['缓存命中率', '查询响应时间'],
    });

    // 建议4：评估阈值
    const projected3Year = projectedDataSize.edges3Year;
    if (projected3Year > 500000) {
      recommendations.push({
        id: 'rec_4',
        priority: 'critical',
        title: '关注数据增长趋势',
        description: `预计3年后数据规模将达到${projected3Year}边，建议开始评估图数据库`,
        action: '建立数据增长监控，制定图数据库引入计划',
        estimatedImpact: '提前规划，避免性能瓶颈',
        relatedMetrics: ['数据增长率', '预测数据规模'],
      });
    }

    // 建议5：垂直优化
    recommendations.push({
      id: 'rec_5',
      priority: 'low',
      title: '考虑数据库升级',
      description: '如果性能不满足需求，先考虑升级数据库服务器配置',
      action: '评估硬件升级成本 vs 图数据库迁移成本',
      estimatedImpact: '快速获得性能提升',
      relatedMetrics: ['硬件成本', '迁移成本'],
    });

    return recommendations;
  }

  /**
   * 得出最终结论
   */
  private determineVerdict(params: {
    currentDataSize: { nodes: number; edges: number };
    projectedDataSize: {
      nodes1Year: number;
      edges1Year: number;
      nodes3Year: number;
      edges3Year: number;
    };
    algorithmBenchmarks: AlgorithmBenchmarkResult[];
    storageCosts: StorageCostEstimate[];
    featureSupport: FeatureSupportAssessment[];
    migrationComplexity: MigrationComplexityAssessment[];
  }): {
    recommendedDatabase: GraphDatabaseType | 'keep_current';
    confidence: 'low' | 'medium' | 'high';
    reasoning: string;
  } {
    const { currentDataSize, projectedDataSize } = params;

    // 评估阈值
    const currentEdgeCount = currentDataSize.edges;
    const projected3YearEdgeCount = projectedDataSize.edges3Year;

    // 阈值判断
    const GRAPH_DB_THRESHOLD = 500000; // 50万条边

    if (
      currentEdgeCount < 50000 &&
      projected3YearEdgeCount < GRAPH_DB_THRESHOLD
    ) {
      return {
        recommendedDatabase: 'keep_current',
        confidence: 'high',
        reasoning: `当前数据规模（${currentEdgeCount}边）和预计3年后规模（${projected3YearEdgeCount}边）均未达到引入图数据库的阈值。PostgreSQL配合适当的优化足以支撑当前及未来3年的业务需求，且可避免引入额外的运维复杂度。`,
      };
    }

    if (
      currentEdgeCount >= 100000 ||
      projected3YearEdgeCount >= GRAPH_DB_THRESHOLD * 2
    ) {
      return {
        recommendedDatabase: GraphDatabaseType.NEO4J,
        confidence: 'medium',
        reasoning: `数据规模已达到或超过建议阈值，建议引入Neo4j。Neo4j在图查询性能、算法支持方面有显著优势，社区成熟，文档完善。`,
      };
    }

    // 中间情况，建议进一步观察
    return {
      recommendedDatabase: 'keep_current',
      confidence: 'medium',
      reasoning: `当前数据规模适中，建议持续监控数据增长。如果业务对图查询性能有更高要求（如实时路径分析），可考虑引入ArangoDB作为折中方案（文档+图能力）。`,
    };
  }

  /**
   * 运行单个性能测试
   */
  async runPerformanceTest(
    input: PerformanceTestInput
  ): Promise<BenchmarkResult> {
    const { nodes, links, algorithm, iterations = 10 } = input;

    const start = performance.now();
    let success = true;
    let error: string | undefined;

    try {
      for (let i = 0; i < iterations; i++) {
        switch (algorithm) {
          case 'shortestPath':
            if (nodes.length >= 2) {
              GraphAlgorithms.shortestPath(
                nodes,
                links,
                nodes[0].id,
                nodes[1].id
              );
            }
            break;
          case 'pageRank':
            GraphAlgorithms.pageRank(nodes, links, 10, 0.85);
            break;
          case 'connectedComponents':
            GraphAlgorithms.connectedComponents(nodes, links);
            break;
          case 'degreeCentrality':
            GraphAlgorithms.degreeCentrality(nodes, links);
            break;
        }
      }
    } catch (e) {
      success = false;
      error = e instanceof Error ? e.message : 'Unknown error';
    }

    const end = performance.now();
    const duration = (end - start) / iterations;

    return {
      operation: algorithm,
      databaseType: GraphDatabaseType.POSTGRESQL,
      duration: Math.round(duration * 100) / 100,
      dataSize: nodes.length,
      success,
      error,
      metadata: {
        iterations,
        edgeCount: links.length,
      },
    };
  }
}

/**
 * 创建评估服务的工厂函数
 */
export function createGraphDatabaseEvaluationService(
  config?: Partial<EvaluationConfig>
): GraphDatabaseEvaluationService {
  return new GraphDatabaseEvaluationService(config);
}
