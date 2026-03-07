/**
 * @jest-environment jsdom
 */

/**
 * 屏幕阅读器工具测试
 */

import {
  generateNodeAriaLabel,
  generateLinkAriaLabel,
  generateGraphAriaDescription,
  announceNodeSelection,
  announceGraphUpdate,
} from '@/lib/knowledge-graph/accessibility/screen-reader-utils';
import { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';

describe('屏幕阅读器工具', () => {
  describe('generateNodeAriaLabel', () => {
    const mockNode: GraphNode = {
      id: 'article-1',
      lawName: '民法典',
      articleNumber: '123',
      category: 'CIVIL',
      level: 0,
    };

    it('应该生成完整的节点ARIA标签', () => {
      const label = generateNodeAriaLabel(mockNode);
      expect(label).toContain('民法典');
      expect(label).toContain('第123条');
      expect(label).toContain('民事');
    });

    it('应该包含所有节点信息', () => {
      const label = generateNodeAriaLabel(mockNode);
      expect(label).toBe('民法典第123条，分类：民事');
    });

    it('应该处理缺失的分类', () => {
      const nodeWithoutCategory: GraphNode = {
        ...mockNode,
        category: '',
        level: 0,
      };
      const label = generateNodeAriaLabel(nodeWithoutCategory);
      expect(label).toContain('未知分类');
    });
  });

  describe('generateLinkAriaLabel', () => {
    const mockSource: GraphNode = {
      id: 'article-1',
      lawName: '民法典',
      articleNumber: '123',
      category: 'CIVIL',
      level: 0,
    };

    const mockTarget: GraphNode = {
      id: 'article-2',
      lawName: '刑法',
      articleNumber: '456',
      category: 'CRIMINAL',
      level: 1,
    };

    const mockLink: GraphLink = {
      source: 'article-1',
      target: 'article-2',
      relationType: 'CITES',
      strength: 0.8,
      confidence: 0.9,
    };

    it('应该生成完整的连线ARIA标签', () => {
      const label = generateLinkAriaLabel(mockLink, mockSource, mockTarget);
      expect(label).toContain('民法典');
      expect(label).toContain('刑法');
      expect(label).toContain('引用');
      expect(label).toContain('0.8');
    });

    it('应该包含关系类型', () => {
      const label = generateLinkAriaLabel(mockLink, mockSource, mockTarget);
      expect(label).toContain('引用');
    });

    it('应该包含强度', () => {
      const label = generateLinkAriaLabel(mockLink, mockSource, mockTarget);
      expect(label).toContain('强度：0.8');
    });

    it('应该处理不同关系类型', () => {
      const conflictLink: GraphLink = {
        ...mockLink,
        relationType: 'CONFLICTS',
      };
      const label = generateLinkAriaLabel(conflictLink, mockSource, mockTarget);
      expect(label).toContain('冲突');
    });
  });

  describe('generateGraphAriaDescription', () => {
    const mockNodes: GraphNode[] = [
      {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '123',
        category: 'CIVIL',
        level: 0,
      },
      {
        id: 'article-2',
        lawName: '刑法',
        articleNumber: '456',
        category: 'CRIMINAL',
        level: 1,
      },
    ];

    const mockLinks: GraphLink[] = [
      {
        source: 'article-1',
        target: 'article-2',
        relationType: 'CITES',
        strength: 0.8,
        confidence: 0.9,
      },
    ];

    it('应该生成图谱描述', () => {
      const description = generateGraphAriaDescription(mockNodes, mockLinks);
      expect(description).toContain('2个法条');
      expect(description).toContain('1条关系');
      expect(description).toContain('引用');
    });

    it('应该统计节点数量', () => {
      const description = generateGraphAriaDescription(mockNodes, mockLinks);
      expect(description).toContain('2个法条');
    });

    it('应该统计关系数量', () => {
      const description = generateGraphAriaDescription(mockNodes, mockLinks);
      expect(description).toContain('1条关系');
    });

    it('应该列出主要关系类型', () => {
      const description = generateGraphAriaDescription(mockNodes, mockLinks);
      expect(description).toContain('引用');
    });

    it('应该处理空图谱', () => {
      const description = generateGraphAriaDescription([], []);
      expect(description).toContain('0个法条');
      expect(description).toContain('0条关系');
    });
  });

  describe('announceNodeSelection', () => {
    it('应该能够调用announceNodeSelection', () => {
      // 测试函数存在且可以被调用
      expect(() => {
        announceNodeSelection({
          lawName: '民法典',
          articleNumber: '123',
        } as GraphNode);
      }).not.toThrow();
    });
  });

  describe('announceGraphUpdate', () => {
    it('应该能够调用announceGraphUpdate', () => {
      expect(() => {
        announceGraphUpdate(5, 3);
      }).not.toThrow();
    });

    it('应该处理空图谱更新', () => {
      expect(() => {
        announceGraphUpdate(0, 0);
      }).not.toThrow();
    });
  });
});
