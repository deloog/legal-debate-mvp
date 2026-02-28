/**
 * 法条关系图谱可视化组件测试
 *
 * 测试覆盖：
 * 1. 组件渲染
 * 2. 数据加载
 * 3. 图谱渲染
 * 4. 交互功能
 * 5. 错误处理
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LawArticleGraphVisualization } from '@/components/law-article/LawArticleGraphVisualization';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Create chainable mock helper
function createChainableMock(): Record<string, jest.Mock> {
  const mock: Record<string, jest.Mock> = {
    select: jest.fn(),
    selectAll: jest.fn(),
    data: jest.fn(),
    enter: jest.fn(),
    append: jest.fn(),
    attr: jest.fn(),
    style: jest.fn(),
    text: jest.fn(),
    call: jest.fn(),
    on: jest.fn(),
    remove: jest.fn(),
  };

  // Make all methods return the mock itself for chaining
  Object.keys(mock).forEach(key => {
    mock[key].mockReturnValue(mock);
  });

  return mock;
}

// Mock D3.js with complete chain support
jest.mock('d3', () => {
  const chainableMock = createChainableMock();
  return {
    select: jest.fn(() => chainableMock),
    forceSimulation: jest.fn(() => ({
      force: jest.fn(function (this: unknown) {
        return this;
      }),
      on: jest.fn(),
      stop: jest.fn(),
      alphaTarget: jest.fn(function (this: unknown) {
        return this;
      }),
      restart: jest.fn(),
    })),
    forceLink: jest.fn(() => ({
      id: jest.fn(function (this: unknown) {
        return this;
      }),
      distance: jest.fn(function (this: unknown) {
        return this;
      }),
    })),
    forceManyBody: jest.fn(() => ({
      strength: jest.fn(function (this: unknown) {
        return this;
      }),
    })),
    forceCenter: jest.fn(),
    forceCollide: jest.fn(() => ({
      radius: jest.fn(function (this: unknown) {
        return this;
      }),
    })),
    drag: jest.fn(() => ({
      on: jest.fn(function (this: unknown) {
        return this;
      }),
    })),
  };
});

describe('LawArticleGraphVisualization', () => {
  const mockGraphData = {
    nodes: [
      {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
        level: 0,
      },
      {
        id: 'article-2',
        lawName: '民法典',
        articleNumber: '2',
        category: 'CIVIL',
        level: 1,
      },
    ],
    links: [
      {
        source: 'article-1',
        target: 'article-2',
        relationType: 'CITES',
        strength: 0.9,
        confidence: 0.95,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('graphData prop（优化功能）', () => {
    it('应该直接使用传入的graphData而不调用API', async () => {
      // 渲染组件（传入graphData）
      const { container } = render(
        <LawArticleGraphVisualization graphData={mockGraphData} />
      );

      // 等待渲染完成
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证没有调用fetch（直接使用传入的graphData）
      expect(global.fetch).not.toHaveBeenCalled();

      // 验证SVG元素存在
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('应该正确显示传入的graphData中的节点', async () => {
      // 渲染组件（传入graphData）
      const { container } = render(
        <LawArticleGraphVisualization graphData={mockGraphData} />
      );

      // 等待渲染完成
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证SVG元素存在
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('应该正确处理空的graphData', async () => {
      // 渲染组件（传入空graphData）
      const { container } = render(
        <LawArticleGraphVisualization graphData={{ nodes: [], links: [] }} />
      );

      // 等待渲染完成
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证显示"暂无图谱数据"
      expect(screen.getByText('暂无图谱数据')).toBeInTheDocument();
    });

    it('当graphData和centerArticleId都传入时，优先使用graphData', async () => {
      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          nodes: [
            {
              id: 'article-3',
              lawName: '测试法',
              articleNumber: '3',
              category: 'CRIMINAL',
              level: 0,
            },
          ],
          links: [],
        }),
      });

      // 渲染组件（两者都传入）
      render(
        <LawArticleGraphVisualization
          graphData={mockGraphData}
          centerArticleId='article-3'
        />
      );

      // 等待渲染完成
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证没有调用fetch（优先使用graphData）
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('应该处理graphData为undefined的情况（回退到API调用）', async () => {
      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          nodes: [
            {
              id: 'article-1',
              lawName: '民法典',
              articleNumber: '1',
              category: 'CIVIL',
              level: 0,
            },
          ],
          links: [],
        }),
      });

      // 渲染组件（graphData为undefined）
      render(
        <LawArticleGraphVisualization
          graphData={undefined}
          centerArticleId='article-1'
        />
      );

      // 等待渲染完成
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证调用了API
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/law-articles/article-1/graph?depth=2'
      );
    });
  });

  describe('组件渲染', () => {
    it('应该显示加载状态', () => {
      // Mock fetch - 延迟响应
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ nodes: [], links: [] }),
                }),
              1000
            )
          )
      );

      // 渲染组件
      render(<LawArticleGraphVisualization centerArticleId='article-1' />);

      // 验证加载状态
      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('应该渲染SVG元素', async () => {
      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          nodes: [
            {
              id: 'article-1',
              lawName: '民法典',
              articleNumber: '1',
              category: 'CIVIL',
              level: 0,
            },
          ],
          links: [],
        }),
      });

      // 渲染组件
      const { container } = render(
        <LawArticleGraphVisualization centerArticleId='article-1' />
      );

      // 等待数据加载
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证SVG元素存在
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('应该显示图例', async () => {
      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          nodes: [
            {
              id: 'article-1',
              lawName: '民法典',
              articleNumber: '1',
              category: 'CIVIL',
              level: 0,
            },
          ],
          links: [],
        }),
      });

      // 渲染组件
      render(<LawArticleGraphVisualization centerArticleId='article-1' />);

      // 等待数据加载
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证图例存在
      expect(screen.getByText('关系类型')).toBeInTheDocument();
      expect(screen.getByText('引用')).toBeInTheDocument();
      expect(screen.getByText('冲突')).toBeInTheDocument();
      expect(screen.getByText('补全')).toBeInTheDocument();
      expect(screen.getByText('替代')).toBeInTheDocument();
      expect(screen.getByText('实施')).toBeInTheDocument();
    });
  });

  describe('数据加载', () => {
    it('应该使用正确的API端点', async () => {
      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ nodes: [], links: [] }),
      });

      // 渲染组件
      render(<LawArticleGraphVisualization centerArticleId='article-1' />);

      // 等待数据加载
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/law-articles/article-1/graph?depth=2'
        );
      });
    });

    it('应该支持自定义深度参数', async () => {
      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ nodes: [], links: [] }),
      });

      // 渲染组件（depth=3）
      render(
        <LawArticleGraphVisualization centerArticleId='article-1' depth={3} />
      );

      // 等待数据加载
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/law-articles/article-1/graph?depth=3'
        );
      });
    });

    it('应该在centerArticleId变化时重新加载', async () => {
      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ nodes: [], links: [] }),
      });

      // 渲染组件
      const { rerender } = render(
        <LawArticleGraphVisualization centerArticleId='article-1' />
      );

      // 等待第一次加载
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // 清除mock
      jest.clearAllMocks();

      // 重新渲染（不同的centerArticleId）
      rerender(<LawArticleGraphVisualization centerArticleId='article-2' />);

      // 验证重新加载
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/law-articles/article-2/graph?depth=2'
        );
      });
    });

    it('应该在depth变化时重新加载', async () => {
      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ nodes: [], links: [] }),
      });

      // 渲染组件
      const { rerender } = render(
        <LawArticleGraphVisualization centerArticleId='article-1' depth={2} />
      );

      // 等待第一次加载
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // 清除mock
      jest.clearAllMocks();

      // 重新渲染（不同的depth）
      rerender(
        <LawArticleGraphVisualization centerArticleId='article-1' depth={3} />
      );

      // 验证重新加载
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/law-articles/article-1/graph?depth=3'
        );
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理网络错误', async () => {
      // Mock fetch - 网络错误
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // 渲染组件
      const { container } = render(
        <LawArticleGraphVisualization centerArticleId='article-1' />
      );

      // 等待错误处理完成（组件会显示空状态）
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证显示空状态而非错误
      expect(screen.getByText('暂无图谱数据')).toBeInTheDocument();
      // SVG应该被隐藏
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('hidden');
    });

    it('应该处理API错误响应', async () => {
      // Mock fetch - API错误
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: '法条不存在' }),
      });

      // 渲染组件
      const { container } = render(
        <LawArticleGraphVisualization centerArticleId='non-existent' />
      );

      // 等待错误处理完成（组件会显示空状态）
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证显示空状态而非错误
      expect(screen.getByText('暂无图谱数据')).toBeInTheDocument();
      // SVG应该被隐藏
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('hidden');
    });

    it('应该处理空数据', async () => {
      // Mock fetch - 空数据
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ nodes: [], links: [] }),
      });

      // 渲染组件
      const { container } = render(
        <LawArticleGraphVisualization centerArticleId='article-1' />
      );

      // 等待数据加载
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证SVG仍然渲染
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('图谱数据', () => {
    it('应该正确处理节点数据', async () => {
      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          nodes: [
            {
              id: 'article-1',
              lawName: '民法典',
              articleNumber: '1',
              category: 'CIVIL',
              level: 0,
            },
            {
              id: 'article-2',
              lawName: '民法典',
              articleNumber: '2',
              category: 'CIVIL',
              level: 1,
            },
          ],
          links: [
            {
              source: 'article-1',
              target: 'article-2',
              relationType: 'CITES',
              strength: 0.9,
              confidence: 0.95,
            },
          ],
        }),
      });

      // 渲染组件
      render(<LawArticleGraphVisualization centerArticleId='article-1' />);

      // 等待数据加载
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证数据已加载（通过检查SVG是否存在）
      await waitFor(() => {
        expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
      });
    });

    it('应该正确处理关系数据', async () => {
      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          nodes: [
            {
              id: 'article-1',
              lawName: '民法典',
              articleNumber: '1',
              category: 'CIVIL',
              level: 0,
            },
            {
              id: 'article-2',
              lawName: '民法典',
              articleNumber: '2',
              category: 'CIVIL',
              level: 1,
            },
          ],
          links: [
            {
              source: 'article-1',
              target: 'article-2',
              relationType: 'CITES',
              strength: 0.9,
              confidence: 0.95,
            },
            {
              source: 'article-1',
              target: 'article-2',
              relationType: 'COMPLETES',
              strength: 0.8,
              confidence: 0.85,
            },
          ],
        }),
      });

      // 渲染组件
      render(<LawArticleGraphVisualization centerArticleId='article-1' />);

      // 等待数据加载
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证数据已加载
      await waitFor(() => {
        expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
      });
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内渲染大量节点', async () => {
      // Mock fetch - 100个节点
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          nodes: Array.from({ length: 100 }, (_, i) => ({
            id: `article-${i}`,
            lawName: '民法典',
            articleNumber: `${i}`,
            category: 'CIVIL',
            level: i % 3,
          })),
          links: Array.from({ length: 200 }, (_, i) => ({
            source: `article-${i % 100}`,
            target: `article-${(i + 1) % 100}`,
            relationType: 'CITES',
            strength: 0.9,
            confidence: 0.95,
          })),
        }),
      });

      // 渲染组件
      const startTime = Date.now();
      render(<LawArticleGraphVisualization centerArticleId='article-1' />);

      // 等待数据加载
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      const duration = Date.now() - startTime;

      // 验证性能 - 应该在2秒内完成
      expect(duration).toBeLessThan(2000);
    });
  });
});
