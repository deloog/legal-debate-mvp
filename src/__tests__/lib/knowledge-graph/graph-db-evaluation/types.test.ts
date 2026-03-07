/**
 * 图数据库评估类型测试
 */

import {
  GraphDatabaseType,
  DEFAULT_EVALUATION_CONFIG,
  ReportFormat,
} from '@/lib/knowledge-graph/graph-db-evaluation/types';

describe('GraphDatabaseEvaluation Types', () => {
  describe('GraphDatabaseType', () => {
    it('应该包含所有数据库类型', () => {
      expect(GraphDatabaseType.POSTGRESQL).toBe('postgresql');
      expect(GraphDatabaseType.NEO4J).toBe('neo4j');
      expect(GraphDatabaseType.ARANGODB).toBe('arangodb');
    });

    it('应该包含3种数据库类型', () => {
      const types = Object.values(GraphDatabaseType);
      expect(types.length).toBe(3);
    });
  });

  describe('DEFAULT_EVALUATION_CONFIG', () => {
    it('应该包含默认样本大小', () => {
      expect(DEFAULT_EVALUATION_CONFIG.sampleSizes).toEqual([100, 1000, 10000]);
    });

    it('应该包含默认算法迭代次数', () => {
      expect(DEFAULT_EVALUATION_CONFIG.algorithmIterations).toBe(10);
    });

    it('应该默认启用预测', () => {
      expect(DEFAULT_EVALUATION_CONFIG.includeProjections).toBe(true);
    });

    it('应该包含基准测试操作列表', () => {
      expect(DEFAULT_EVALUATION_CONFIG.benchmarkOperations).toContain(
        'shortestPath'
      );
      expect(DEFAULT_EVALUATION_CONFIG.benchmarkOperations).toContain(
        'pageRank'
      );
      expect(DEFAULT_EVALUATION_CONFIG.benchmarkOperations).toContain(
        'connectedComponents'
      );
      expect(DEFAULT_EVALUATION_CONFIG.benchmarkOperations).toContain(
        'neighbors'
      );
      expect(DEFAULT_EVALUATION_CONFIG.benchmarkOperations).toContain(
        'batchQuery'
      );
    });
  });

  describe('ReportFormat', () => {
    it('应该包含所有报告格式', () => {
      expect(ReportFormat.JSON).toBe('json');
      expect(ReportFormat.MARKDOWN).toBe('markdown');
      expect(ReportFormat.HTML).toBe('html');
    });

    it('应该包含3种报告格式', () => {
      const formats = Object.values(ReportFormat);
      expect(formats.length).toBe(3);
    });
  });
});

describe('类型定义完整性验证', () => {
  it('应该能创建BenchmarkResult对象', () => {
    const result = {
      operation: 'shortestPath',
      databaseType: GraphDatabaseType.POSTGRESQL,
      duration: 100,
      dataSize: 1000,
      success: true,
    };
    expect(result.operation).toBe('shortestPath');
    expect(result.duration).toBe(100);
  });

  it('应该能创建AlgorithmBenchmarkResult对象', () => {
    const result = {
      algorithm: 'pageRank',
      dataSize: 1000,
      inMemoryTime: 50,
      estimatedGraphDbTime: 40,
      memoryUsage: 1024 * 1024,
      notes: '测试备注',
    };
    expect(result.algorithm).toBe('pageRank');
    expect(result.inMemoryTime).toBe(50);
  });

  it('应该能创建StorageCostEstimate对象', () => {
    const estimate = {
      databaseType: GraphDatabaseType.NEO4J,
      estimatedStorageGB: 10,
      costPerGBMonthly: 0.5,
      estimatedMonthlyCost: 5,
      notes: '存储成本估算',
    };
    expect(estimate.databaseType).toBe(GraphDatabaseType.NEO4J);
    expect(estimate.estimatedStorageGB).toBe(10);
  });

  it('应该能创建FeatureSupportAssessment对象', () => {
    const assessment = {
      feature: '最短路径查询',
      postgresql: { supported: true, notes: '需要递归CTE' },
      neo4j: { supported: true, notes: '原生Cypher支持' },
      arangodb: { supported: true, notes: 'AQL支持' },
    };
    expect(assessment.feature).toBe('最短路径查询');
    expect(assessment.postgresql.supported).toBe(true);
  });

  it('应该能创建MigrationComplexityAssessment对象', () => {
    const assessment = {
      aspect: '数据迁移',
      complexity: 'medium',
      effortDays: 3,
      risk: 'medium',
      mitigation: '分批迁移',
    };
    expect(assessment.complexity).toBe('medium');
    expect(assessment.effortDays).toBe(3);
  });

  it('应该能创建Recommendation对象', () => {
    const recommendation = {
      id: 'rec_1',
      priority: 'high',
      title: '测试建议',
      description: '测试描述',
      action: '测试操作',
      estimatedImpact: '测试影响',
      relatedMetrics: ['metric1'],
    };
    expect(recommendation.priority).toBe('high');
    expect(recommendation.relatedMetrics).toContain('metric1');
  });
});
