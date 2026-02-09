/**
 * 辩论推荐组件测试
 * 测试 DebateRecommendations 组件
 * 覆盖率目标：90%+
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DebateRecommendations } from '@/components/debate/DebateRecommendations';

// Mock fetch
global.fetch = jest.fn();

describe('DebateRecommendations', () => {
  const mockDebateId = 'debate_123';

  const mockRecommendations = [
    {
      article: {
        id: 'article_1',
        lawName: '劳动合同法',
        articleNumber: '第39条',
        fullText: '劳动者有下列情形之一的，用人单位可以解除劳动合同...',
        category: 'LABOR',
        effectiveDate: new Date('2008-01-01'),
        status: 'EFFECTIVE',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        keywords: ['解除', '劳动合同'],
        tags: ['劳动法'],
      },
      score: 0.95,
      reason: '案件类型匹配，关键词匹配: 劳动合同、解除',
    },
    {
      article: {
        id: 'article_2',
        lawName: '劳动合同法',
        articleNumber: '第46条',
        fullText: '有下列情形之一的，用人单位应当向劳动者支付经济补偿...',
        category: 'LABOR',
        effectiveDate: new Date('2008-01-01'),
        status: 'EFFECTIVE',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        keywords: ['经济补偿', '劳动合同'],
        tags: ['劳动法'],
      },
      score: 0.88,
      reason: '案件类型匹配，关键词匹配: 劳动合同',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('加载状态', () => {
    it('应该显示加载状态', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // 永不resolve，保持加载状态
      );

      render(<DebateRecommendations debateId={mockDebateId} />);

      expect(screen.getByText(/加载中/i)).toBeInTheDocument();
    });
  });

  describe('成功场景', () => {
    it('应该成功显示推荐法条列表', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      render(<DebateRecommendations debateId={mockDebateId} />);

      await waitFor(() => {
        expect(screen.getAllByText('劳动合同法')).toHaveLength(2);
      });

      expect(screen.getByText('第39条')).toBeInTheDocument();
      expect(screen.getByText('第46条')).toBeInTheDocument();
    });

    it('应该显示推荐分数', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      render(<DebateRecommendations debateId={mockDebateId} />);

      await waitFor(() => {
        expect(screen.getByText(/95%/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/88%/i)).toBeInTheDocument();
    });

    it('应该显示推荐原因', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      render(<DebateRecommendations debateId={mockDebateId} />);

      await waitFor(() => {
        expect(
          screen.getByText(/案件类型匹配，关键词匹配: 劳动合同、解除/i)
        ).toBeInTheDocument();
      });
    });

    it('应该支持选择推荐法条', async () => {
      const onSelect = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      render(
        <DebateRecommendations debateId={mockDebateId} onSelect={onSelect} />
      );

      await waitFor(() => {
        expect(screen.getAllByText('劳动合同法')).toHaveLength(2);
      });

      // 点击选择按钮
      const selectButtons = screen.getAllByRole('button', { name: /选择/i });
      fireEvent.click(selectButtons[0]);

      expect(onSelect).toHaveBeenCalledWith(mockRecommendations[0].article);
    });

    it('应该在没有推荐结果时显示空状态', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: [],
        }),
      });

      render(<DebateRecommendations debateId={mockDebateId} />);

      await waitFor(() => {
        expect(screen.getByText(/暂无推荐法条/i)).toBeInTheDocument();
      });
    });
  });

  describe('错误场景', () => {
    it('应该显示错误信息', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: '获取推荐失败',
        }),
      });

      render(<DebateRecommendations debateId={mockDebateId} />);

      await waitFor(() => {
        expect(screen.getByText(/获取推荐失败/i)).toBeInTheDocument();
      });
    });

    it('应该处理网络错误', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<DebateRecommendations debateId={mockDebateId} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('应该支持重新加载', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      render(<DebateRecommendations debateId={mockDebateId} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // 点击重新加载按钮
      const retryButton = screen.getByRole('button', { name: /重新加载/i });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getAllByText('劳动合同法')).toHaveLength(2);
      });
    });
  });

  describe('交互功能', () => {
    it('应该支持展开/收起法条详情', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      render(<DebateRecommendations debateId={mockDebateId} />);

      await waitFor(() => {
        expect(screen.getAllByText('劳动合同法')).toHaveLength(2);
      });

      // 点击展开按钮
      const expandButtons = screen.getAllByLabelText(/展开/i);
      fireEvent.click(expandButtons[0]);

      // 应该显示完整法条内容
      await waitFor(() => {
        expect(
          screen.getByText(/劳动者有下列情形之一的，用人单位可以解除劳动合同/i)
        ).toBeInTheDocument();
      });
    });

    it('应该支持过滤推荐结果', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      render(
        <DebateRecommendations debateId={mockDebateId} showFilter={true} />
      );

      await waitFor(() => {
        expect(screen.getAllByText('劳动合同法')).toHaveLength(2);
      });

      // 输入过滤关键词
      const filterInput = screen.getByPlaceholderText(/搜索法条/i);
      fireEvent.change(filterInput, { target: { value: '第39条' } });

      // 应该只显示匹配的法条
      await waitFor(() => {
        expect(screen.getByText('第39条')).toBeInTheDocument();
        expect(screen.queryByText('第46条')).not.toBeInTheDocument();
      });
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内渲染', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      const startTime = Date.now();
      render(<DebateRecommendations debateId={mockDebateId} />);

      await waitFor(() => {
        expect(screen.getAllByText('劳动合同法')).toHaveLength(2);
      });

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });
  });

  describe('边界条件', () => {
    it('应该处理空debateId', () => {
      render(<DebateRecommendations debateId='' />);

      expect(screen.getByText(/无效的辩论ID/i)).toBeInTheDocument();
    });

    it('应该处理大量推荐结果', async () => {
      const manyRecommendations = Array.from({ length: 50 }, (_, i) => ({
        article: {
          id: `article_${i}`,
          lawName: '劳动合同法',
          articleNumber: `第${i}条`,
          fullText: `法条内容${i}`,
          category: 'LABOR',
          effectiveDate: new Date('2008-01-01'),
          status: 'EFFECTIVE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          keywords: ['劳动合同'],
          tags: ['劳动法'],
        },
        score: 0.9 - i * 0.01,
        reason: '相关法条',
      }));

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: manyRecommendations,
        }),
      });

      render(<DebateRecommendations debateId={mockDebateId} />);

      await waitFor(() => {
        expect(screen.getByText('第0条')).toBeInTheDocument();
      });

      // 应该支持分页或虚拟滚动
      expect(screen.getAllByText(/劳动合同法/i).length).toBeGreaterThan(0);
    });
  });
});
