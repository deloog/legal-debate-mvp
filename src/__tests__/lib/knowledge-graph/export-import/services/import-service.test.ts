/**
 * 导入服务单元测试
 */

import { ImportService } from '@/lib/knowledge-graph/export-import/services/import-service';
import type { ImportOptions } from '@/lib/knowledge-graph/export-import/types';

describe('ImportService', () => {
  let importService: ImportService;
  let mockPrisma: any;

  beforeEach(() => {
    importService = new ImportService();
    const mockFindUniqueArticle = jest.fn();
    const mockFindUniqueRelation = jest.fn();
    const mockCreateArticle = jest.fn();
    const mockUpdateArticle = jest.fn();
    const mockCreateRelation = jest.fn();
    const mockUpdateRelation = jest.fn();
    const mockTransaction = jest.fn();

    mockPrisma = {
      lawArticle: {
        findUnique: mockFindUniqueArticle,
        create: mockCreateArticle,
        update: mockUpdateArticle,
      },
      lawArticleRelation: {
        findUnique: mockFindUniqueRelation,
        create: mockCreateRelation,
        update: mockUpdateRelation,
      },
      $transaction: mockTransaction,
    };
  });

  describe('importData', () => {
    it('应该成功导入知识图谱数据', async () => {
      const graphData = JSON.stringify({
        nodes: [
          {
            id: 'article-1',
            label: '刑法第一条',
            lawName: '刑法',
            articleNumber: '第一条',
            lawType: 'LAW',
            category: 'CRIMINAL',
            tags: ['犯罪'],
            effectiveDate: new Date('2020-01-01'),
            status: 'VALID',
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'article-1',
            target: 'article-2',
            relationType: 'CITES',
            strength: 0.9,
            confidence: 0.85,
            discoveryMethod: 'AI_DETECTED',
            verificationStatus: 'PENDING',
            createdAt: new Date('2024-01-01'),
          },
        ],
      });

      const options: ImportOptions = {
        format: 'json-ld',
        mergeStrategy: 'skip',
        validate: false,
      };

      (mockPrisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue(
        null
      );
      (mockPrisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article-2',
      });

      ((mockPrisma as any).$transaction as jest.Mock).mockImplementation(
        async callback => {
          return callback(mockPrisma);
        }
      );

      const result = await importService.importData(
        mockPrisma,
        graphData,
        options
      );

      expect(result.success).toBe(true);
      expect(result.importedNodes).toBe(1);
      expect(result.importedEdges).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('应该跳过已存在的节点', async () => {
      const graphData = JSON.stringify({
        nodes: [
          {
            id: 'article-1',
            label: '刑法第一条',
            lawName: '刑法',
            articleNumber: '第一条',
          },
        ],
        edges: [],
      });

      const options: ImportOptions = {
        format: 'json-ld',
        mergeStrategy: 'skip',
        validate: false,
      };

      (mockPrisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article-1',
      });

      mockPrisma.$transaction.mockImplementation(async callback => {
        return callback(mockPrisma);
      });

      const result = await importService.importData(
        mockPrisma,
        graphData,
        options
      );

      expect(result.importedNodes).toBe(1); // 仍然计数为导入成功
      expect(result.skippedEdges).toBe(0);
    });

    it('导入失败时应该记录错误', async () => {
      const graphData = JSON.stringify({
        nodes: [
          {
            id: 'article-1',
            label: '刑法第一条',
          },
        ],
        edges: [],
      });

      const options: ImportOptions = {
        format: 'json-ld',
        mergeStrategy: 'skip',
        validate: false,
      };

      mockPrisma.$transaction.mockImplementation(async callback => {
        return callback(mockPrisma);
      });

      (mockPrisma.lawArticle.findUnique as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      const result = await importService.importData(
        mockPrisma,
        graphData,
        options
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('数据库错误');
    });

    it('验证失败时应该抛出错误', async () => {
      const invalidData = JSON.stringify({
        nodes: [{ id: 123 }], // 无效的id类型
        edges: [],
      });

      const options: ImportOptions = {
        format: 'json-ld',
        mergeStrategy: 'skip',
        validate: true,
      };

      await expect(
        importService.importData(mockPrisma, invalidData, options)
      ).rejects.toThrow();
    });
  });

  describe('parseData', () => {
    it('应该解析JSON-LD格式', () => {
      const jsonLdString = JSON.stringify({
        nodes: [],
        edges: [],
      });

      const result = (importService as any).parseData(jsonLdString, 'json-ld');

      expect(result).toBeDefined();
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(Array.isArray(result.edges)).toBe(true);
    });

    it('不支持的格式应该抛出错误', () => {
      expect(() =>
        (importService as any).parseData('', 'invalid-format')
      ).toThrow('不支持的导入格式: invalid-format');
    });
  });

  describe('validateData', () => {
    it('应该验证有效的数据', () => {
      const validData = {
        nodes: [
          {
            id: 'node-1',
            label: '节点1',
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
          },
        ],
      };

      expect(() =>
        (importService as any).validateData(validData)
      ).not.toThrow();
    });

    it('应该拒绝无效的数据格式', () => {
      const invalidData = null;

      expect(() => (importService as any).validateData(invalidData)).toThrow(
        '导入数据格式无效'
      );
    });

    it('应该拒绝缺少nodes的数据', () => {
      const invalidData = {
        edges: [],
      };

      expect(() => (importService as any).validateData(invalidData)).toThrow(
        '导入数据缺少nodes数组'
      );
    });

    it('应该拒绝缺少edges的数据', () => {
      const invalidData = {
        nodes: [],
      };

      expect(() => (importService as any).validateData(invalidData)).toThrow(
        '导入数据缺少edges数组'
      );
    });

    it('应该拒绝缺少id的节点', () => {
      const invalidData = {
        nodes: [{ label: '节点' }],
        edges: [],
      };

      expect(() => (importService as any).validateData(invalidData)).toThrow(
        '第1个节点缺少id'
      );
    });

    it('应该拒绝缺少id的边', () => {
      const invalidData = {
        nodes: [{ id: 'node-1', label: '节点' }],
        edges: [{ source: 'node-1', target: 'node-2' }],
      };

      expect(() => (importService as any).validateData(invalidData)).toThrow(
        '第1条边缺少id'
      );
    });
  });
});
