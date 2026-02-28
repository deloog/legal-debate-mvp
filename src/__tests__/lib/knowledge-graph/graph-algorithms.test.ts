/**
 * 图算法库测试
 */

import { GraphAlgorithms } from '@/lib/knowledge-graph/graph-algorithms';
import { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';

describe('GraphAlgorithms', () => {
  // 测试数据
  const mockNodes: GraphNode[] = [
    {
      id: '1',
      lawName: '民法典',
      articleNumber: '1',
      category: 'CIVIL',
      level: 0,
    },
    {
      id: '2',
      lawName: '刑法',
      articleNumber: '1',
      category: 'CRIMINAL',
      level: 0,
    },
    {
      id: '3',
      lawName: '行政法',
      articleNumber: '1',
      category: 'ADMINISTRATIVE',
      level: 0,
    },
    {
      id: '4',
      lawName: '商法',
      articleNumber: '1',
      category: 'COMMERCIAL',
      level: 0,
    },
    {
      id: '5',
      lawName: '劳动法',
      articleNumber: '1',
      category: 'LABOR',
      level: 0,
    },
  ];

  const mockLinks: GraphLink[] = [
    {
      source: '1',
      target: '2',
      relationType: 'CITES',
      strength: 0.8,
      confidence: 0.9,
    },
    {
      source: '2',
      target: '3',
      relationType: 'CITES',
      strength: 0.7,
      confidence: 0.85,
    },
    {
      source: '1',
      target: '3',
      relationType: 'RELATED',
      strength: 0.5,
      confidence: 0.8,
    },
    {
      source: '4',
      target: '5',
      relationType: 'CITES',
      strength: 0.9,
      confidence: 0.95,
    },
  ];

  describe('最短路径算法', () => {
    it('应该找到最短路径', () => {
      const result = GraphAlgorithms.shortestPath(
        mockNodes,
        mockLinks,
        '1',
        '3'
      );

      expect(result.exists).toBe(true);
      expect(result.path.length).toBeGreaterThan(0);
      expect(result.path).toContain('1');
      expect(result.path).toContain('3');
      expect(result.pathLength).toBe(1); // 1 -> 3 直接相连
      expect(result.relationTypes).toContain('RELATED');
    });

    it('应该处理相同节点', () => {
      const result = GraphAlgorithms.shortestPath(
        mockNodes,
        mockLinks,
        '1',
        '1'
      );

      expect(result.exists).toBe(true);
      expect(result.path).toEqual(['1']);
      expect(result.pathLength).toBe(0);
      expect(result.relationTypes).toEqual([]);
    });

    it('应该返回不存在路径', () => {
      const result = GraphAlgorithms.shortestPath(
        mockNodes,
        mockLinks,
        '1',
        '4'
      );

      expect(result.exists).toBe(false);
      expect(result.path).toEqual([]);
      expect(result.pathLength).toBe(0);
    });

    it('应该处理不存在的节点', () => {
      const result = GraphAlgorithms.shortestPath(
        mockNodes,
        mockLinks,
        '999',
        '1'
      );

      expect(result.exists).toBe(false);
    });

    it('应该处理缺失参数', () => {
      const result1 = GraphAlgorithms.shortestPath(
        mockNodes,
        mockLinks,
        '',
        '1'
      );
      expect(result1.exists).toBe(false);

      const result2 = GraphAlgorithms.shortestPath(
        mockNodes,
        mockLinks,
        '1',
        ''
      );
      expect(result2.exists).toBe(false);
    });
  });

  describe('度中心性分析', () => {
    it('应该计算度中心性', () => {
      const results = GraphAlgorithms.degreeCentrality(mockNodes, mockLinks);

      expect(results.length).toBe(mockNodes.length);

      // 节点1有2条出边（到节点2和3）
      const node1Result = results.find(r => r.nodeId === '1');
      expect(node1Result?.score).toBe(2);

      // 节点4有1条出边（到节点5）
      const node4Result = results.find(r => r.nodeId === '4');
      expect(node4Result?.score).toBe(1);

      // 结果应该按分数降序排列
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }

      // 排名应该从1开始
      results.forEach((r, index) => {
        expect(r.rank).toBe(index + 1);
      });
    });

    it('应该处理空图', () => {
      const results = GraphAlgorithms.degreeCentrality([], []);

      expect(results).toEqual([]);
    });

    it('应该返回正确的节点信息', () => {
      const results = GraphAlgorithms.degreeCentrality(mockNodes, mockLinks);

      const result = results[0];
      expect(result.nodeId).toBeDefined();
      expect(result.lawName).toBeDefined();
      expect(result.articleNumber).toBeDefined();
      expect(result.category).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.rank).toBeGreaterThan(0);
    });
  });

  describe('PageRank中心性分析', () => {
    it('应该计算PageRank', () => {
      const results = GraphAlgorithms.pageRank(mockNodes, mockLinks, 10, 0.85);

      expect(results.length).toBe(mockNodes.length);

      // 结果应该按分数降序排列
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }

      // 所有分数应该为正数
      results.forEach(r => {
        expect(r.score).toBeGreaterThan(0);
      });
    });

    it('应该支持自定义参数', () => {
      const results1 = GraphAlgorithms.pageRank(mockNodes, mockLinks, 5, 0.5);
      const results2 = GraphAlgorithms.pageRank(mockNodes, mockLinks, 20, 0.85);

      expect(results1.length).toBe(mockNodes.length);
      expect(results2.length).toBe(mockNodes.length);
    });

    it('应该处理空图', () => {
      const results = GraphAlgorithms.pageRank([], [], 10, 0.85);

      expect(results).toEqual([]);
    });

    it('应该返回正确的节点信息', () => {
      const results = GraphAlgorithms.pageRank(mockNodes, mockLinks, 10, 0.85);

      results.forEach(r => {
        expect(r.nodeId).toBeDefined();
        expect(r.lawName).toBeDefined();
        expect(r.articleNumber).toBeDefined();
        expect(r.category).toBeDefined();
        expect(r.score).toBeDefined();
        expect(r.rank).toBeGreaterThan(0);
      });
    });
  });

  describe('连通分量分析', () => {
    it('应该找到连通分量', () => {
      const components = GraphAlgorithms.connectedComponents(
        mockNodes,
        mockLinks
      );

      expect(components.length).toBeGreaterThan(0);

      // 应该找到两个连通分量：{1,2,3} 和 {4,5}
      expect(components.length).toBe(2);

      // 每个分量应该有正确的属性
      components.forEach(c => {
        expect(c.id).toBeGreaterThanOrEqual(0);
        expect(c.nodes).toBeDefined();
        expect(c.nodeCount).toBe(c.nodes.length);
        expect(c.edgeCount).toBeGreaterThanOrEqual(0);
      });

      // 结果应该按节点数量降序排列
      for (let i = 1; i < components.length; i++) {
        expect(components[i].nodeCount).toBeLessThanOrEqual(
          components[i - 1].nodeCount
        );
      }
    });

    it('应该处理空图', () => {
      const components = GraphAlgorithms.connectedComponents([], []);

      expect(components).toEqual([]);
    });

    it('应该处理单个节点的图', () => {
      const singleNode: GraphNode[] = [
        {
          id: '1',
          lawName: '民法典',
          articleNumber: '1',
          category: 'CIVIL',
          level: 0,
        },
      ];
      const components = GraphAlgorithms.connectedComponents(singleNode, []);

      expect(components.length).toBe(1);
      expect(components[0].nodeCount).toBe(1);
      expect(components[0].edgeCount).toBe(0);
    });

    it('应该处理完全连通的图', () => {
      const fullyConnectedNodes: GraphNode[] = [
        {
          id: '1',
          lawName: '法1',
          articleNumber: '1',
          category: 'CIVIL',
          level: 0,
        },
        {
          id: '2',
          lawName: '法2',
          articleNumber: '1',
          category: 'CIVIL',
          level: 0,
        },
        {
          id: '3',
          lawName: '法3',
          articleNumber: '1',
          category: 'CIVIL',
          level: 0,
        },
      ];
      const fullyConnectedLinks: GraphLink[] = [
        {
          source: '1',
          target: '2',
          relationType: 'CITES',
          strength: 0.8,
          confidence: 0.9,
        },
        {
          source: '2',
          target: '3',
          relationType: 'CITES',
          strength: 0.8,
          confidence: 0.9,
        },
        {
          source: '3',
          target: '1',
          relationType: 'CITES',
          strength: 0.8,
          confidence: 0.9,
        },
      ];

      const components = GraphAlgorithms.connectedComponents(
        fullyConnectedNodes,
        fullyConnectedLinks
      );

      expect(components.length).toBe(1);
      expect(components[0].nodeCount).toBe(3);
    });
  });
});
