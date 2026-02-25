/**
 * 导出服务单元测试
 */

import { ExportService } from '@/lib/knowledge-graph/export-import/services/export-service';
import type { GraphNode, GraphEdge } from '@/lib/knowledge-graph/export-import/types';

describe('ExportService', () => {
  let exportService: ExportService;
  let mockPrisma: any;

  beforeEach(() => {
    exportService = new ExportService();
    const mockFindManyArticle = jest.fn();
    const mockFindManyRelation = jest.fn();

    mockPrisma = {
      lawArticle: {
        findMany: mockFindManyArticle,
      },
      lawArticleRelation: {
        findMany: mockFindManyRelation,
      },
      $transaction: jest.fn(),
    };
  });

  describe('exportData', () => {
    it('应该成功导出知识图谱数据', async () => {
      // 模拟节点数据
      const mockArticles = [
        {
          id: 'article-1',
          lawName: '刑法',
          articleNumber: '第一条',
          fullText: '为了惩罚犯罪...',
          lawType: 'LAW',
          category: 'CRIMINAL',
          tags: ['犯罪', '惩罚'],
          effectiveDate: new Date('2020-01-01'),
          status: 'VALID',
        },
      ];

      // 模拟边数据
      const mockRelations = [
        {
          id: 'relation-1',
          sourceId: 'article-1',
          targetId: 'article-2',
          relationType: 'CITES',
          strength: 0.9,
          confidence: 0.85,
          description: '引用关系',
          discoveryMethod: 'AI_DETECTED',
          verificationStatus: 'PENDING',
          verifiedBy: null,
          verifiedAt: null,
          aiProvider: 'deepseek',
          aiModel: 'deepseek-chat',
          aiConfidence: 0.85,
          createdAt: new Date('2024-01-01'),
        },
      ];

      (mockPrisma.lawArticle.findMany as jest.Mock).mockResolvedValue(mockArticles);
      (mockPrisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue(mockRelations);

      const result = await exportService.exportData(mockPrisma, {
        format: 'json-ld',
      });

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(1);
      expect(result.nodes[0].id).toBe('article-1');
      expect(result.edges[0].id).toBe('relation-1');
      expect(result.exportedAt).toBeInstanceOf(Date);
    });

    it('应该根据过滤条件导出数据', async () => {
      const mockArticles: unknown[] = [];
      const mockRelations: unknown[] = [];

      (mockPrisma.lawArticle.findMany as jest.Mock).mockResolvedValue(mockArticles);
      (mockPrisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue(mockRelations);

      const filter = {
        format: 'json-ld' as const,
        relationTypes: ['CITES', 'CITED_BY'],
        minStrength: 0.7,
        maxStrength: 1.0,
        verificationStatus: ['VERIFIED'],
        discoveryMethod: ['AI_DETECTED'],
      };

      await exportService.exportData(mockPrisma, {
        format: 'json-ld',
        filter,
      });

      expect(mockPrisma.lawArticleRelation.findMany).toHaveBeenCalledWith({
        select: expect.any(Object),
        where: expect.objectContaining({
          relationType: expect.any(Object),
          strength: expect.any(Object),
          verificationStatus: expect.any(Object),
          discoveryMethod: expect.any(Object),
        }),
      });
    });

    it('应该根据日期范围过滤数据', async () => {
      const mockArticles: unknown[] = [];
      const mockRelations: unknown[] = [];

      (mockPrisma.lawArticle.findMany as jest.Mock).mockResolvedValue(mockArticles);
      (mockPrisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue(mockRelations);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await exportService.exportData(mockPrisma, {
        format: 'json-ld',
        filter: {
          format: 'json-ld' as const,
          startDate,
          endDate,
        },
      });

      expect(mockPrisma.lawArticleRelation.findMany).toHaveBeenCalledWith({
        select: expect.any(Object),
        where: expect.objectContaining({
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
      });
    });

    it('导出失败时应该抛出错误', async () => {
      (mockPrisma.lawArticle.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      await expect(
        exportService.exportData(mockPrisma, {
          format: 'json-ld',
        })
      ).rejects.toThrow('数据库连接失败');
    });
  });

  describe('formatExportData', () => {
    it('应该格式化JSON-LD格式', () => {
      const graphData = {
        nodes: [
          {
            id: 'node-1',
            label: '刑法第一条',
            lawName: '刑法',
            articleNumber: '第一条',
            lawType: 'LAW',
            category: 'CRIMINAL',
            tags: ['犯罪'],
            effectiveDate: new Date('2020-01-01'),
            status: 'VALID',
          },
        ] as GraphNode[],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
            relationType: 'CITES',
            strength: 0.9,
            confidence: 0.85,
            discoveryMethod: 'AI_DETECTED',
            verificationStatus: 'PENDING',
            createdAt: new Date('2024-01-01'),
          },
        ] as GraphEdge[],
        exportedAt: new Date(),
        totalCount: 1,
      };

      const result = exportService.formatExportData(graphData, 'json-ld');

      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed['@context']).toBeDefined();
      expect(parsed['@graph']).toBeDefined();
      expect(parsed.exportedAt).toBeDefined();
    });

    it('应该格式化GraphML格式', () => {
      const graphData = {
        nodes: [] as GraphNode[],
        edges: [] as GraphEdge[],
        exportedAt: new Date(),
        totalCount: 0,
      };

      const result = exportService.formatExportData(graphData, 'graphml');

      expect(typeof result).toBe('string');
      expect(result).toContain('<?xml');
      expect(result).toContain('<graphml');
    });

    it('应该格式化GML格式', () => {
      const graphData = {
        nodes: [] as GraphNode[],
        edges: [] as GraphEdge[],
        exportedAt: new Date(),
        totalCount: 0,
      };

      const result = exportService.formatExportData(graphData, 'gml');

      expect(typeof result).toBe('string');
      expect(result).toContain('graph');
    });

    it('不支持的格式应该抛出错误', () => {
      const graphData = {
        nodes: [] as GraphNode[],
        edges: [] as GraphEdge[],
        exportedAt: new Date(),
        totalCount: 0,
      };

      expect(() =>
        exportService.formatExportData(graphData, 'invalid' as never)
      ).toThrow('不支持的导出格式: invalid');
    });
  });

  describe('generateFilename', () => {
    it('应该生成GraphML文件名', () => {
      const filename = exportService.generateFilename('graphml');
      expect(filename).toMatch(/knowledge-graph-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.graphml$/);
    });

    it('应该生成GML文件名', () => {
      const filename = exportService.generateFilename('gml');
      expect(filename).toMatch(/knowledge-graph-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.gml$/);
    });

    it('应该生成JSON-LD文件名', () => {
      const filename = exportService.generateFilename('json-ld');
      expect(filename).toMatch(/knowledge-graph-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.jsonld$/);
    });

    it('不支持的格式应该抛出错误', () => {
      expect(() =>
        exportService.generateFilename('invalid' as never)
      ).toThrow('不支持的导出格式: invalid');
    });
  });
});
