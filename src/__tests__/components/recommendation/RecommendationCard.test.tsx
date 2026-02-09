/**
 * 推荐卡片组件测试
 * 测试覆盖率目标：90%+
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecommendationCard } from '@/components/recommendation/RecommendationCard';
import type { Recommendation } from '@/types/recommendation';

describe('RecommendationCard', () => {
  // 测试数据
  const mockRecommendation: Recommendation = {
    article: {
      id: 'article-1',
      lawName: '中华人民共和国合同法',
      articleNumber: '第107条',
      fullText:
        '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
      category: 'CIVIL',
      effectiveDate: new Date('1999-10-01'),
      status: 'ACTIVE',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      keywords: ['违约责任', '合同义务', '赔偿损失'],
      tags: ['合同法', '违约'],
    },
    score: 0.85,
    reason: '该法条与案件类型匹配，关键词相关',
    relationType: 'RELATED',
  };

  const mockCallbacks = {
    onSelect: jest.fn(),
    onView: jest.fn(),
    onExpand: jest.fn(),
    onCollapse: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本渲染', () => {
    it('应该正确渲染推荐卡片的基本信息', () => {
      render(<RecommendationCard recommendation={mockRecommendation} />);

      expect(screen.getByText('中华人民共和国合同法')).toBeInTheDocument();
      expect(screen.getByText('第107条')).toBeInTheDocument();
    });

    it('应该显示推荐分数', () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          showScore={true}
        />
      );

      expect(screen.getByText(/85%|0\.85/)).toBeInTheDocument();
    });

    it('应该显示推荐原因', () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          showReason={true}
        />
      );

      expect(
        screen.getByText('该法条与案件类型匹配，关键词相关')
      ).toBeInTheDocument();
    });

    it('应该显示关系类型', () => {
      const { container } = render(
        <RecommendationCard
          recommendation={mockRecommendation}
          showRelationType={true}
        />
      );

      const relationElement = container.querySelector('[data-relation-type]');
      expect(relationElement).toBeInTheDocument();
      expect(relationElement).toHaveTextContent('相关');
    });

    it('应该显示关键词', () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          showKeywords={true}
        />
      );

      expect(screen.getByText('违约责任')).toBeInTheDocument();
      expect(screen.getByText('合同义务')).toBeInTheDocument();
      expect(screen.getByText('赔偿损失')).toBeInTheDocument();
    });

    it('应该显示标签', () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          showTags={true}
        />
      );

      expect(screen.getByText('合同法')).toBeInTheDocument();
      expect(screen.getByText('违约')).toBeInTheDocument();
    });
  });

  describe('显示选项控制', () => {
    it('当showScore为false时不应该显示分数', () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          showScore={false}
        />
      );

      expect(screen.queryByText(/85%|0\.85/)).not.toBeInTheDocument();
    });

    it('当showReason为false时不应该显示原因', () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          showReason={false}
        />
      );

      expect(
        screen.queryByText('该法条与案件类型匹配，关键词相关')
      ).not.toBeInTheDocument();
    });

    it('当showRelationType为false时不应该显示关系类型', () => {
      const { container } = render(
        <RecommendationCard
          recommendation={mockRecommendation}
          showRelationType={false}
        />
      );

      const relationElement = container.querySelector('[data-relation-type]');
      expect(relationElement).not.toBeInTheDocument();
    });

    it('当showKeywords为false时不应该显示关键词', () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          showKeywords={false}
        />
      );

      expect(screen.queryByText('违约责任')).not.toBeInTheDocument();
    });

    it('当showTags为false时不应该显示标签', () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          showTags={false}
        />
      );

      expect(screen.queryByText('合同法')).not.toBeInTheDocument();
    });

    it('当showActions为false时不应该显示操作按钮', () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          showActions={false}
        />
      );

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('紧凑模式应该应用正确的样式', () => {
      const { container } = render(
        <RecommendationCard
          recommendation={mockRecommendation}
          compact={true}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('compact');
    });
  });

  describe('交互操作', () => {
    it('点击展开按钮应该显示全文', async () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          showFullText={true}
        />
      );

      const expandButton = screen.getByRole('button', {
        name: /展开|查看全文/i,
      });
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(
          screen.getByText(/当事人一方不履行合同义务/)
        ).toBeInTheDocument();
      });
    });

    it('点击收起按钮应该隐藏全文', async () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          showFullText={true}
        />
      );

      // 先展开
      const expandButton = screen.getByRole('button', {
        name: /展开|查看全文/i,
      });
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(
          screen.getByText(/当事人一方不履行合同义务/)
        ).toBeInTheDocument();
      });

      // 再收起
      const collapseButton = screen.getByRole('button', { name: /收起/i });
      fireEvent.click(collapseButton);

      await waitFor(() => {
        expect(
          screen.queryByText(/当事人一方不履行合同义务/)
        ).not.toBeInTheDocument();
      });
    });

    it('点击选择按钮应该调用onSelect回调', () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          onSelect={mockCallbacks.onSelect}
          showActions={true}
        />
      );

      const selectButton = screen.getByRole('button', { name: /选择|添加/i });
      fireEvent.click(selectButton);

      expect(mockCallbacks.onSelect).toHaveBeenCalledWith(
        mockRecommendation.article
      );
      expect(mockCallbacks.onSelect).toHaveBeenCalledTimes(1);
    });

    it('点击查看详情按钮应该调用onView回调', () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          onView={mockCallbacks.onView}
          showActions={true}
        />
      );

      const viewButton = screen.getByRole('button', { name: /查看详情/i });
      fireEvent.click(viewButton);

      expect(mockCallbacks.onView).toHaveBeenCalledWith(
        mockRecommendation.article
      );
      expect(mockCallbacks.onView).toHaveBeenCalledTimes(1);
    });

    it('展开时应该调用onExpand回调', async () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          onExpand={mockCallbacks.onExpand}
          showFullText={true}
        />
      );

      const expandButton = screen.getByRole('button', {
        name: /展开|查看全文/i,
      });
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(mockCallbacks.onExpand).toHaveBeenCalledWith('article-1');
        expect(mockCallbacks.onExpand).toHaveBeenCalledTimes(1);
      });
    });

    it('收起时应该调用onCollapse回调', async () => {
      render(
        <RecommendationCard
          recommendation={mockRecommendation}
          onCollapse={mockCallbacks.onCollapse}
          showFullText={true}
        />
      );

      // 先展开
      const expandButton = screen.getByRole('button', {
        name: /展开|查看全文/i,
      });
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /收起/i })
        ).toBeInTheDocument();
      });

      // 再收起
      const collapseButton = screen.getByRole('button', { name: /收起/i });
      fireEvent.click(collapseButton);

      await waitFor(() => {
        expect(mockCallbacks.onCollapse).toHaveBeenCalledWith('article-1');
        expect(mockCallbacks.onCollapse).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('边界情况', () => {
    it('应该处理缺少关键词的情况', () => {
      const recommendationWithoutKeywords: Recommendation = {
        ...mockRecommendation,
        article: {
          ...mockRecommendation.article,
          keywords: undefined,
        },
      };

      render(
        <RecommendationCard
          recommendation={recommendationWithoutKeywords}
          showKeywords={true}
        />
      );

      expect(screen.queryByText('违约责任')).not.toBeInTheDocument();
    });

    it('应该处理缺少标签的情况', () => {
      const recommendationWithoutTags: Recommendation = {
        ...mockRecommendation,
        article: {
          ...mockRecommendation.article,
          tags: undefined,
        },
      };

      render(
        <RecommendationCard
          recommendation={recommendationWithoutTags}
          showTags={true}
        />
      );

      expect(screen.queryByText('合同法')).not.toBeInTheDocument();
    });

    it('应该处理缺少关系类型的情况', () => {
      const recommendationWithoutRelationType: Recommendation = {
        ...mockRecommendation,
        relationType: undefined,
      };

      const { container } = render(
        <RecommendationCard
          recommendation={recommendationWithoutRelationType}
          showRelationType={true}
        />
      );

      const relationElement = container.querySelector('[data-relation-type]');
      expect(relationElement).not.toBeInTheDocument();
    });

    it('应该处理空关键词数组', () => {
      const recommendationWithEmptyKeywords: Recommendation = {
        ...mockRecommendation,
        article: {
          ...mockRecommendation.article,
          keywords: [],
        },
      };

      render(
        <RecommendationCard
          recommendation={recommendationWithEmptyKeywords}
          showKeywords={true}
        />
      );

      expect(screen.queryByText('违约责任')).not.toBeInTheDocument();
    });

    it('应该处理空标签数组', () => {
      const recommendationWithEmptyTags: Recommendation = {
        ...mockRecommendation,
        article: {
          ...mockRecommendation.article,
          tags: [],
        },
      };

      render(
        <RecommendationCard
          recommendation={recommendationWithEmptyTags}
          showTags={true}
        />
      );

      expect(screen.queryByText('合同法')).not.toBeInTheDocument();
    });

    it('应该处理分数为0的情况', () => {
      const recommendationWithZeroScore: Recommendation = {
        ...mockRecommendation,
        score: 0,
      };

      render(
        <RecommendationCard
          recommendation={recommendationWithZeroScore}
          showScore={true}
        />
      );

      expect(screen.getByText(/0%|0\.0/)).toBeInTheDocument();
    });

    it('应该处理分数为1的情况', () => {
      const recommendationWithMaxScore: Recommendation = {
        ...mockRecommendation,
        score: 1,
      };

      render(
        <RecommendationCard
          recommendation={recommendationWithMaxScore}
          showScore={true}
        />
      );

      expect(screen.getByText(/100%|1\.0/)).toBeInTheDocument();
    });
  });

  describe('样式和布局', () => {
    it('应该根据分数应用不同的样式', () => {
      const { container: highScoreContainer } = render(
        <RecommendationCard
          recommendation={{ ...mockRecommendation, score: 0.9 }}
          showScore={true}
        />
      );

      const { container: lowScoreContainer } = render(
        <RecommendationCard
          recommendation={{ ...mockRecommendation, score: 0.3 }}
          showScore={true}
        />
      );

      const highScoreElement = highScoreContainer.querySelector('[data-score]');
      const lowScoreElement = lowScoreContainer.querySelector('[data-score]');

      expect(highScoreElement).toHaveClass('high-score');
      expect(lowScoreElement).toHaveClass('low-score');
    });

    it('应该为不同的关系类型应用不同的样式', () => {
      const { container } = render(
        <RecommendationCard
          recommendation={{ ...mockRecommendation, relationType: 'CITES' }}
          showRelationType={true}
        />
      );

      const relationElement = container.querySelector('[data-relation-type]');
      expect(relationElement).toHaveAttribute('data-relation-type', 'CITES');
    });
  });
});
