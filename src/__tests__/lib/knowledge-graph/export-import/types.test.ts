import type {
  ExportFormat,
  MergeStrategy,
  ExportFilterOptions,
  GraphNode,
  GraphEdge,
  GraphData,
  ImportError,
  ImportResult,
  ExportTaskStatus,
  ExportOptions,
  ImportOptions,
  GraphMLNodeAttributes,
  GraphMLEdgeAttributes,
  GMLNode,
  GMLEdge,
  JsonLdGraph,
} from '@/lib/knowledge-graph/export-import/types';

describe('Export-Import Types', () => {
  describe('ExportFormat', () => {
    it('应该包含所有支持的导出格式', () => {
      const formats: ExportFormat[] = ['graphml', 'gml', 'json-ld'];
      expect(formats).toBeDefined();
      expect(formats.length).toBe(3);
    });
  });

  describe('MergeStrategy', () => {
    it('应该包含所有合并策略', () => {
      const strategies: MergeStrategy[] = ['skip', 'update', 'replace'];
      expect(strategies).toBeDefined();
      expect(strategies.length).toBe(3);
    });
  });

  describe('ExportFilterOptions', () => {
    it('应该正确构建导出过滤参数', () => {
      const filter: ExportFilterOptions = {
        format: 'graphml',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        relationTypes: ['CITES', 'CONFLICTS'],
        minStrength: 0.5,
        maxStrength: 1.0,
        verificationStatus: ['VERIFIED'],
        discoveryMethod: ['AI_DETECTED'],
      };

      expect(filter.format).toBe('graphml');
      expect(filter.relationTypes).toEqual(['CITES', 'CONFLICTS']);
      expect(filter.minStrength).toBe(0.5);
    });

    it('应该允许所有过滤参数为可选', () => {
      const filter: ExportFilterOptions = {
        format: 'json-ld',
      };

      expect(filter.format).toBe('json-ld');
      expect(filter.relationTypes).toBeUndefined();
      expect(filter.startDate).toBeUndefined();
    });
  });

  describe('GraphNode', () => {
    it('应该正确构建图节点', () => {
      const node: GraphNode = {
        id: 'node-1',
        label: '《民法典》第123条',
        lawName: '《民法典》',
        articleNumber: '第123条',
        lawType: 'LAW',
        category: 'CIVIL',
        tags: ['民事', '合同'],
        fullText: '完整文本',
        effectiveDate: new Date('2020-01-01'),
        status: 'VALID',
      };

      expect(node.id).toBe('node-1');
      expect(node.label).toBe('《民法典》第123条');
      expect(node.tags).toContain('民事');
    });

    it('应该允许fullText为可选', () => {
      const node: GraphNode = {
        id: 'node-2',
        label: '《合同法》第45条',
        lawName: '《合同法》',
        articleNumber: '第45条',
        lawType: 'LAW',
        category: 'COMMERCIAL',
        tags: ['合同'],
        effectiveDate: new Date('2010-01-01'),
        status: 'VALID',
      };

      expect(node.fullText).toBeUndefined();
    });
  });

  describe('GraphEdge', () => {
    it('应该正确构建图边', () => {
      const edge: GraphEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        relationType: 'CITES',
        strength: 0.8,
        confidence: 0.9,
        description: '引用关系',
        discoveryMethod: 'AI_DETECTED',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'user-123',
        verifiedAt: new Date('2026-01-01'),
        aiProvider: 'deepseek',
        aiModel: 'deepseek-chat',
        aiConfidence: 0.85,
        createdAt: new Date('2026-01-01'),
      };

      expect(edge.id).toBe('edge-1');
      expect(edge.relationType).toBe('CITES');
      expect(edge.aiConfidence).toBe(0.85);
    });

    it('应该允许AI相关字段为可选', () => {
      const edge: GraphEdge = {
        id: 'edge-2',
        source: 'node-1',
        target: 'node-2',
        relationType: 'MANUAL',
        strength: 1.0,
        confidence: 1.0,
        discoveryMethod: 'MANUAL',
        verificationStatus: 'PENDING',
        createdAt: new Date('2026-01-01'),
      };

      expect(edge.aiProvider).toBeUndefined();
      expect(edge.verifiedBy).toBeUndefined();
    });
  });

  describe('GraphData', () => {
    it('应该正确构建图数据', () => {
      const data: GraphData = {
        nodes: [],
        edges: [],
        exportedAt: new Date('2026-01-01'),
        totalCount: 0,
      };

      expect(data.exportedAt).toBeDefined();
      expect(data.totalCount).toBe(0);
    });

    it('应该支持节点和边数据', () => {
      const node: GraphNode = {
        id: 'node-1',
        label: '节点1',
        lawName: '法条',
        articleNumber: '第1条',
        lawType: 'LAW',
        category: 'CIVIL',
        tags: [],
        effectiveDate: new Date(),
        status: 'VALID',
      };

      const edge: GraphEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        relationType: 'CITES',
        strength: 0.8,
        confidence: 0.9,
        discoveryMethod: 'AI_DETECTED',
        verificationStatus: 'VERIFIED',
        createdAt: new Date(),
      };

      const data: GraphData = {
        nodes: [node],
        edges: [edge],
        exportedAt: new Date(),
        totalCount: 1,
      };

      expect(data.nodes.length).toBe(1);
      expect(data.edges.length).toBe(1);
    });
  });

  describe('ImportError', () => {
    it('应该正确构建导入错误', () => {
      const error: ImportError = {
        type: 'NODE_NOT_FOUND',
        entity: 'edge',
        entityId: 'edge-1',
        field: 'source',
        message: '源节点不存在',
        severity: 'error',
      };

      expect(error.type).toBe('NODE_NOT_FOUND');
      expect(error.severity).toBe('error');
      expect(error.field).toBe('source');
    });

    it('应该支持所有错误类型', () => {
      const errorTypes: ImportError['type'][] = [
        'NODE_NOT_FOUND',
        'INVALID_RELATION_TYPE',
        'MISSING_FIELD',
        'INVALID_DATA',
      ];

      expect(errorTypes).toHaveLength(4);
    });

    it('应该支持warning级别的错误', () => {
      const warning: ImportError = {
        type: 'INVALID_DATA',
        entity: 'node',
        message: '数据格式警告',
        severity: 'warning',
      };

      expect(warning.severity).toBe('warning');
    });
  });

  describe('ImportResult', () => {
    it('应该正确构建导入结果', () => {
      const result: ImportResult = {
        success: true,
        importedNodes: 10,
        importedEdges: 20,
        skippedEdges: 5,
        updatedEdges: 3,
        errors: [],
        warnings: [],
        processingTime: 1000,
      };

      expect(result.success).toBe(true);
      expect(result.importedNodes).toBe(10);
      expect(result.processingTime).toBe(1000);
    });

    it('应该包含错误和警告信息', () => {
      const errors: ImportError[] = [
        {
          type: 'NODE_NOT_FOUND',
          entity: 'edge',
          message: '节点不存在',
          severity: 'error',
        },
      ];

      const result: ImportResult = {
        success: false,
        importedNodes: 0,
        importedEdges: 0,
        skippedEdges: 0,
        updatedEdges: 0,
        errors,
        warnings: [],
        processingTime: 500,
      };

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('ExportTaskStatus', () => {
    it('应该正确构建导出任务状态', () => {
      const status: ExportTaskStatus = {
        taskId: 'task-1',
        status: 'PROCESSING',
        progress: 50,
        format: 'graphml',
        filePath: '/exports/task-1.graphml',
        fileSize: 1024,
        createdAt: new Date(),
      };

      expect(status.taskId).toBe('task-1');
      expect(status.progress).toBe(50);
      expect(status.fileSize).toBe(1024);
    });

    it('应该支持所有任务状态', () => {
      const statuses: ExportTaskStatus['status'][] = [
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED',
      ];

      expect(statuses).toHaveLength(4);
    });

    it('应该支持失败状态', () => {
      const status: ExportTaskStatus = {
        taskId: 'task-2',
        status: 'FAILED',
        progress: 0,
        format: 'json-ld',
        error: '导出失败：数据库错误',
        createdAt: new Date(),
      };

      expect(status.status).toBe('FAILED');
      expect(status.error).toBeDefined();
    });
  });

  describe('ExportOptions', () => {
    it('应该正确构建导出选项', () => {
      const options: ExportOptions = {
        format: 'graphml',
        filter: {
          format: 'graphml',
          relationTypes: ['CITES'],
        },
        compress: true,
        async: false,
      };

      expect(options.format).toBe('graphml');
      expect(options.compress).toBe(true);
      expect(options.async).toBe(false);
    });

    it('应该允许compress和async为可选', () => {
      const options: ExportOptions = {
        format: 'gml',
      };

      expect(options.compress).toBeUndefined();
      expect(options.async).toBeUndefined();
    });
  });

  describe('ImportOptions', () => {
    it('应该正确构建导入选项', () => {
      const options: ImportOptions = {
        format: 'graphml',
        mergeStrategy: 'update',
        validate: true,
        dryRun: false,
      };

      expect(options.format).toBe('graphml');
      expect(options.mergeStrategy).toBe('update');
      expect(options.validate).toBe(true);
    });

    it('应该允许dryRun为可选', () => {
      const options: ImportOptions = {
        format: 'json-ld',
        mergeStrategy: 'skip',
        validate: true,
      };

      expect(options.dryRun).toBeUndefined();
    });
  });

  describe('GraphMLNodeAttributes', () => {
    it('应该正确构建GraphML节点属性', () => {
      const attrs: GraphMLNodeAttributes = {
        id: 'node-1',
        label: '节点1',
        lawName: '法条',
        articleNumber: '第1条',
        lawType: 'LAW',
        category: 'CIVIL',
        tags: '民事,合同',
        fullText: '完整文本',
        effectiveDate: '2020-01-01T00:00:00.000Z',
        status: 'VALID',
      };

      expect(attrs.id).toBe('node-1');
      expect(attrs.tags).toBe('民事,合同');
      expect(attrs.fullText).toBeDefined();
    });
  });

  describe('GraphMLEdgeAttributes', () => {
    it('应该正确构建GraphML边属性', () => {
      const attrs: GraphMLEdgeAttributes = {
        id: 'edge-1',
        relationType: 'CITES',
        strength: 0.8,
        confidence: 0.9,
        description: '引用关系',
        discoveryMethod: 'AI_DETECTED',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'user-123',
        verifiedAt: '2026-01-01T00:00:00.000Z',
        aiProvider: 'deepseek',
        aiModel: 'deepseek-chat',
        aiConfidence: 0.85,
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      expect(attrs.id).toBe('edge-1');
      expect(attrs.aiConfidence).toBe(0.85);
      expect(attrs.verifiedBy).toBe('user-123');
    });
  });

  describe('GMLNode', () => {
    it('应该正确构建GML节点', () => {
      const node: GMLNode = {
        id: 'node-1',
        label: '节点1',
        lawName: '法条',
        articleNumber: '第1条',
        lawType: 'LAW',
        category: 'CIVIL',
        tags: ['民事', '合同'],
        effectiveDate: '2020-01-01T00:00:00.000Z',
        status: 'VALID',
      };

      expect(node.id).toBe('node-1');
      expect(node.tags).toEqual(['民事', '合同']);
    });
  });

  describe('GMLEdge', () => {
    it('应该正确构建GML边', () => {
      const edge: GMLEdge = {
        source: 'node-1',
        target: 'node-2',
        id: 'edge-1',
        relationType: 'CITES',
        strength: 0.8,
        confidence: 0.9,
        discoveryMethod: 'AI_DETECTED',
        verificationStatus: 'VERIFIED',
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      expect(edge.source).toBe('node-1');
      expect(edge.target).toBe('node-2');
      expect(edge.relationType).toBe('CITES');
    });
  });

  describe('JsonLdGraph', () => {
    it('应该正确构建JSON-LD图数据', () => {
      const graph: JsonLdGraph = {
        '@context': {
          node: 'http://example.org/ns#node',
          edge: 'http://example.org/ns#edge',
          source: 'http://example.org/ns#source',
          target: 'http://example.org/ns#target',
          label: 'http://www.w3.org/2000/01/rdf-schema#label',
          relationType: 'http://example.org/ns#relationType',
          strength: 'http://example.org/ns#strength',
          confidence: 'http://example.org/ns#confidence',
          discoveryMethod: 'http://example.org/ns#discoveryMethod',
          verificationStatus: 'http://example.org/ns#verificationStatus',
          createdAt: 'http://example.org/ns#createdAt',
          xsd: 'http://www.w3.org/2001/XMLSchema#',
        },
        '@graph': [
          {
            '@type': 'node',
            '@id': 'node-1',
            label: '节点1',
            lawName: '法条',
            articleNumber: '第1条',
            lawType: 'LAW',
            category: 'CIVIL',
            tags: ['民事'],
            effectiveDate: '2020-01-01T00:00:00.000Z',
            status: 'VALID',
          },
        ],
        exportedAt: '2026-01-01T00:00:00.000Z',
      };

      expect(graph['@context']).toBeDefined();
      expect(graph['@graph']).toHaveLength(1);
      expect(graph.exportedAt).toBeDefined();
    });
  });
});
