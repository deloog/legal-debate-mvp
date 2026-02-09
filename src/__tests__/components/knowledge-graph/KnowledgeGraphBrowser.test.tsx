/**
 * 知识图谱浏览器组件测试
 *
 * 测试覆盖：
 * 1. 组件渲染
 * 2. 搜索功能
 * 3. 过滤功能
 * 4. 分页功能
 * 5. 导出功能
 * 6. 加载状态
 * 7. 错误处理
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KnowledgeGraphBrowser } from '@/components/knowledge-graph/KnowledgeGraphBrowser';

// Mock fetch
global.fetch = jest.fn();

// Mock LawArticleGraphVisualization 组件
jest.mock('@/components/law-article/LawArticleGraphVisualization', () => ({
  LawArticleGraphVisualization: ({
    centerArticleId,
  }: {
    centerArticleId: string;
  }) => (
    <div data-testid='graph-visualization'>Graph for {centerArticleId}</div>
  ),
}));

describe('KnowledgeGraphBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该渲染组件的主要元素', async () => {
      const mockData = {
        nodes: [
          {
            id: 'article1',
            lawName: '民法典',
            articleNumber: '第1条',
            category: 'CIVIL',
          },
        ],
        links: [],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 1,
          totalPages: 1,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      render(<KnowledgeGraphBrowser />);

      // 等待数据加载
      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证主要元素存在
      expect(
        screen.getByPlaceholderText('搜索法条名称或条文号')
      ).toBeInTheDocument();
      expect(screen.getByText('分类')).toBeInTheDocument();
      expect(screen.getByText('关系类型')).toBeInTheDocument();
      expect(screen.getByText('导出')).toBeInTheDocument();
    });

    it('应该显示加载状态', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // 永不resolve
      );

      render(<KnowledgeGraphBrowser />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('应该显示图谱数据', async () => {
      const mockData = {
        nodes: [
          {
            id: 'article1',
            lawName: '民法典',
            articleNumber: '第1条',
            category: 'CIVIL',
          },
          {
            id: 'article2',
            lawName: '民法典',
            articleNumber: '第2条',
            category: 'CIVIL',
          },
        ],
        links: [
          {
            source: 'article1',
            target: 'article2',
            relationType: 'CITES',
            strength: 0.8,
            confidence: 0.9,
          },
        ],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 2,
          totalPages: 1,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      render(<KnowledgeGraphBrowser />);

      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证显示统计信息
      const statsText = screen.getByText(/个法条/);
      expect(statsText).toBeInTheDocument();
      const relationText = screen.getByText(/个关系/);
      expect(relationText).toBeInTheDocument();
    });
  });

  describe('搜索功能', () => {
    it('应该支持搜索法条', async () => {
      const mockData = {
        nodes: [
          {
            id: 'article1',
            lawName: '民法典',
            articleNumber: '第1条',
            category: 'CIVIL',
          },
        ],
        links: [],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 1,
          totalPages: 1,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      render(<KnowledgeGraphBrowser />);

      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证搜索输入框存在
      const searchInput = screen.getByPlaceholderText('搜索法条名称或条文号');
      expect(searchInput).toBeInTheDocument();

      // 输入搜索关键词
      fireEvent.change(searchInput, { target: { value: '民法典' } });
      expect(searchInput).toHaveValue('民法典');
    });

    it('应该支持清空搜索', async () => {
      const mockData = {
        nodes: [],
        links: [],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 0,
          totalPages: 0,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      render(<KnowledgeGraphBrowser />);

      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证搜索输入框存在
      const searchInput = screen.getByPlaceholderText('搜索法条名称或条文号');

      // 输入搜索关键词
      fireEvent.change(searchInput, { target: { value: '民法典' } });
      expect(searchInput).toHaveValue('民法典');

      // 清空搜索
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(searchInput).toHaveValue('');
    });
  });

  describe('过滤功能', () => {
    it('应该支持按分类过滤', async () => {
      const mockData = {
        nodes: [],
        links: [],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 0,
          totalPages: 0,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      render(<KnowledgeGraphBrowser />);

      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 选择分类
      const categorySelect = screen.getByLabelText('分类');
      fireEvent.change(categorySelect, { target: { value: 'CIVIL' } });

      // 验证发起了带分类参数的请求
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('category=CIVIL')
        );
      });
    });

    it('应该支持按关系类型过滤', async () => {
      const mockData = {
        nodes: [],
        links: [],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 0,
          totalPages: 0,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      render(<KnowledgeGraphBrowser />);

      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 选择关系类型
      const relationTypeSelect = screen.getByLabelText('关系类型');
      fireEvent.change(relationTypeSelect, { target: { value: 'CITES' } });

      // 验证发起了带关系类型参数的请求
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('relationType=CITES')
        );
      });
    });

    it('应该支持组合过滤', async () => {
      const mockData = {
        nodes: [],
        links: [],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 0,
          totalPages: 0,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      render(<KnowledgeGraphBrowser />);

      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 选择分类和关系类型
      const categorySelect = screen.getByLabelText('分类');
      fireEvent.change(categorySelect, { target: { value: 'CIVIL' } });

      await waitFor(() => {
        const relationTypeSelect = screen.getByLabelText('关系类型');
        fireEvent.change(relationTypeSelect, { target: { value: 'CITES' } });
      });

      // 验证发起了带两个参数的请求
      await waitFor(() => {
        const lastCall = (global.fetch as jest.Mock).mock.calls[
          (global.fetch as jest.Mock).mock.calls.length - 1
        ][0];
        expect(lastCall).toContain('category=CIVIL');
        expect(lastCall).toContain('relationType=CITES');
      });
    });
  });

  describe('分页功能', () => {
    it('应该显示分页信息', async () => {
      const mockData = {
        nodes: Array.from({ length: 10 }, (_, i) => ({
          id: `article${i + 1}`,
          lawName: '民法典',
          articleNumber: `第${i + 1}条`,
          category: 'CIVIL',
        })),
        links: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 100,
          totalPages: 10,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      render(<KnowledgeGraphBrowser />);

      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 验证显示分页信息
      expect(screen.getByText(/第 1 页/)).toBeInTheDocument();
      expect(screen.getByText(/共 10 页/)).toBeInTheDocument();
    });

    it('应该支持翻页', async () => {
      const mockData = {
        nodes: [],
        links: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 100,
          totalPages: 10,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      render(<KnowledgeGraphBrowser />);

      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 点击下一页
      const nextButton = screen.getByText('下一页');
      fireEvent.click(nextButton);

      // 验证发起了第2页的请求
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('page=2')
        );
      });
    });
  });

  describe('导出功能', () => {
    it('应该支持导出JSON', async () => {
      const mockData = {
        nodes: [
          {
            id: 'article1',
            lawName: '民法典',
            articleNumber: '第1条',
            category: 'CIVIL',
          },
        ],
        links: [],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 1,
          totalPages: 1,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      // Mock URL.createObjectURL and revokeObjectURL
      const mockCreateObjectURL = jest.fn(() => 'blob:mock-url');
      const mockRevokeObjectURL = jest.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock document.createElement
      const mockLink = {
        click: jest.fn(),
        href: '',
        download: '',
        style: {},
      } as unknown as HTMLAnchorElement;

      const originalCreateElement = document.createElement.bind(document);
      jest
        .spyOn(document, 'createElement')
        .mockImplementation((tagName: string) => {
          if (tagName === 'a') {
            return mockLink;
          }
          return originalCreateElement(tagName);
        });

      render(<KnowledgeGraphBrowser />);

      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });

      // 点击导出按钮
      const exportButton = screen.getByText('导出');
      fireEvent.click(exportButton);

      // 验证触发了下载
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toContain('.json');
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    it('应该显示错误信息', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('网络错误'));

      render(<KnowledgeGraphBrowser />);

      await waitFor(
        () => {
          expect(screen.getByText(/加载失败/)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('应该支持重试', async () => {
      // 第一次调用失败
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('网络错误'));

      render(<KnowledgeGraphBrowser />);

      // 等待错误显示
      await waitFor(
        () => {
          expect(screen.getByText(/加载失败/)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // 准备第二次调用成功
      const mockData = {
        nodes: [],
        links: [],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 0,
          totalPages: 0,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      // 点击重试按钮
      const retryButton = screen.getByText('重试');
      fireEvent.click(retryButton);

      // 验证重新加载
      await waitFor(
        () => {
          expect(screen.queryByText(/加载失败/)).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });
});
