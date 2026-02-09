/**
 * 推荐列表组件测试
 * 测试覆盖率目标：90%+
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecommendationList } from '@/components/recommendation/RecommendationList';
import type { Recommendation } from '@/types/recommendation';

describe('RecommendationList', () => {
  // 测试数据
  const mockRecommendations: Recommendation[] = [
    {
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
        keywords: ['违约责任', '合同义务'],
        tags: ['合同法'],
      },
      score: 0.85,
      reason: '该法条与案件类型匹配',
      relationType: 'RELATED',
    },
    {
      article: {
        id: 'article-2',
        lawName: '中华人民共和国民法典',
        articleNumber: '第577条',
        fullText:
          '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
        category: 'CIVIL',
        effectiveDate: new Date('2021-01-01'),
        status: 'ACTIVE',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        keywords: ['违约责任'],
        tags: ['民法典'],
      },
      score: 0.75,
      reason: '关键词匹配',
      relationType: 'CITES',
    },
    {
      article: {
        id: 'article-3',
        lawName: '中华人民共和国合同法',
        articleNumber: '第113条',
        fullText:
          '当事人一方不履行合同义务或者履行合同义务不符合约定，给对方造成损失的，损失赔偿额应当相当于因违约所造成的损失。',
        category: 'CIVIL',
        effectiveDate: new Date('1999-10-01'),
        status: 'ACTIVE',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        keywords: ['损失赔偿'],
        tags: ['合同法'],
      },
      score: 0.65,
      reason: '相似度匹配',
      relationType: 'COMPLETES',
    },
  ];

  const mockCallbacks = {
    onSelect: jest.fn(),
    onView: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本渲染', () => {
    it('应该正确渲染推荐列表', () => {
      render(<RecommendationList recommendations={mockRecommendations} />);

      expect(screen.getAllByText('中华人民共和国合同法')).toHaveLength(2);
      expect(screen.getByText('中华人民共和国民法典')).toBeInTheDocument();
    });

    it('应该渲染正确数量的推荐卡片', () => {
      const { container } = render(
        <RecommendationList recommendations={mockRecommendations} />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards).toHaveLength(3);
    });

    it('应该显示列表标题', () => {
      render(
        <RecommendationList
          recommendations={mockRecommendations}
          title='推荐法条'
        />
      );

      expect(screen.getByText('推荐法条')).toBeInTheDocument();
    });

    it('应该显示推荐数量', () => {
      render(
        <RecommendationList
          recommendations={mockRecommendations}
          showCount={true}
        />
      );

      expect(screen.getByText(/共 3 条推荐/)).toBeInTheDocument();
    });
  });

  describe('空状态', () => {
    it('应该显示空状态消息', () => {
      render(<RecommendationList recommendations={[]} />);

      expect(screen.getByText(/暂无推荐|没有推荐/i)).toBeInTheDocument();
    });

    it('应该显示自定义空状态消息', () => {
      render(
        <RecommendationList
          recommendations={[]}
          emptyMessage='没有找到相关法条'
        />
      );

      expect(screen.getByText('没有找到相关法条')).toBeInTheDocument();
    });
  });

  describe('加载状态', () => {
    it('应该显示加载指示器', () => {
      render(
        <RecommendationList
          recommendations={mockRecommendations}
          loading={true}
        />
      );

      expect(screen.getByText(/加载中/i)).toBeInTheDocument();
    });
  });

  describe('过滤功能', () => {
    it('应该根据最小分数过滤推荐', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          minScore={0.8}
        />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards).toHaveLength(1); // 只有 article-1 的分数 >= 0.8
    });

    it('应该根据最大分数过滤推荐', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          maxScore={0.7}
        />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards).toHaveLength(1); // 只有 article-3 的分数 <= 0.7
    });

    it('应该根据分类过滤推荐', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          categories={['CIVIL']}
        />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards).toHaveLength(3); // 所有都是 CIVIL 分类
    });

    it('应该根据关系类型过滤推荐', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          relationTypes={['RELATED']}
        />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards).toHaveLength(1); // 只有 article-1 是 RELATED
    });

    it('应该根据关键词过滤推荐', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          keywords={['违约责任']}
        />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards).toHaveLength(2); // article-1 和 article-2 包含"违约责任"
    });

    it('应该根据搜索文本过滤推荐', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          searchText='民法典'
        />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards).toHaveLength(1); // 只有 article-2 包含"民法典"
    });
  });

  describe('排序功能', () => {
    it('应该按分数降序排序', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          sortBy='score'
          sortOrder='desc'
        />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      const firstCard = cards[0];
      expect(firstCard).toHaveTextContent('第107条'); // article-1, score 0.85
    });

    it('应该按分数升序排序', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          sortBy='score'
          sortOrder='asc'
        />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      const firstCard = cards[0];
      expect(firstCard).toHaveTextContent('第113条'); // article-3, score 0.65
    });

    it('应该按日期排序', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          sortBy='date'
          sortOrder='desc'
        />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards.length).toBeGreaterThan(0);
    });

    it('应该按相关性排序', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          sortBy='relevance'
          sortOrder='desc'
        />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards.length).toBeGreaterThan(0);
    });

    it('应该按名称排序', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          sortBy='name'
          sortOrder='asc'
        />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  describe('分页功能', () => {
    it('应该限制显示的推荐数量', () => {
      const { container } = render(
        <RecommendationList recommendations={mockRecommendations} limit={2} />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards).toHaveLength(2);
    });

    it('应该显示"加载更多"按钮', () => {
      render(
        <RecommendationList
          recommendations={mockRecommendations}
          limit={2}
          showLoadMore={true}
        />
      );

      expect(screen.getByText(/加载更多|查看更多/i)).toBeInTheDocument();
    });

    it('点击"加载更多"应该显示更多推荐', async () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          limit={2}
          showLoadMore={true}
        />
      );

      let cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards).toHaveLength(2);

      const loadMoreButton = screen.getByText(/加载更多|查看更多/i);
      fireEvent.click(loadMoreButton);

      await waitFor(() => {
        cards = container.querySelectorAll(
          '[data-testid="recommendation-card"]'
        );
        expect(cards).toHaveLength(3);
      });
    });
  });

  describe('交互操作', () => {
    it('点击推荐卡片的选择按钮应该调用onSelect回调', () => {
      render(
        <RecommendationList
          recommendations={mockRecommendations}
          onSelect={mockCallbacks.onSelect}
          showActions={true}
        />
      );

      const selectButtons = screen.getAllByRole('button', { name: /选择/i });
      fireEvent.click(selectButtons[0]);

      expect(mockCallbacks.onSelect).toHaveBeenCalledWith(
        mockRecommendations[0].article
      );
    });

    it('点击推荐卡片的查看按钮应该调用onView回调', () => {
      render(
        <RecommendationList
          recommendations={mockRecommendations}
          onView={mockCallbacks.onView}
          showActions={true}
        />
      );

      const viewButtons = screen.getAllByRole('button', { name: /查看详情/i });
      fireEvent.click(viewButtons[0]);

      expect(mockCallbacks.onView).toHaveBeenCalledWith(
        mockRecommendations[0].article
      );
    });
  });

  describe('显示选项', () => {
    it('应该传递显示选项到推荐卡片', () => {
      render(
        <RecommendationList
          recommendations={mockRecommendations}
          showScore={false}
          showReason={false}
          showRelationType={false}
        />
      );

      expect(screen.queryByText(/85%/)).not.toBeInTheDocument();
      expect(
        screen.queryByText('该法条与案件类型匹配')
      ).not.toBeInTheDocument();
    });

    it('紧凑模式应该应用到所有推荐卡片', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          compact={true}
        />
      );

      const cards = container.querySelectorAll('.recommendation-card.compact');
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理空推荐数组', () => {
      render(<RecommendationList recommendations={[]} />);

      expect(screen.getByText(/暂无推荐|没有推荐/i)).toBeInTheDocument();
    });

    it('应该处理单个推荐', () => {
      const { container } = render(
        <RecommendationList recommendations={[mockRecommendations[0]]} />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards).toHaveLength(1);
    });

    it('应该处理缺少标题的情况', () => {
      const { container } = render(
        <RecommendationList recommendations={mockRecommendations} />
      );

      const listTitle = container.querySelector('.list-title');
      expect(listTitle).not.toBeInTheDocument();
    });

    it('应该处理limit为0的情况', () => {
      const { container } = render(
        <RecommendationList recommendations={mockRecommendations} limit={0} />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards).toHaveLength(0);
    });

    it('应该处理limit大于推荐数量的情况', () => {
      const { container } = render(
        <RecommendationList recommendations={mockRecommendations} limit={10} />
      );

      const cards = container.querySelectorAll(
        '[data-testid="recommendation-card"]'
      );
      expect(cards).toHaveLength(3);
    });
  });

  describe('样式和布局', () => {
    it('应该应用自定义类名', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          className='custom-list'
        />
      );

      const list = container.querySelector('.custom-list');
      expect(list).toBeInTheDocument();
    });

    it('应该应用网格布局', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          layout='grid'
        />
      );

      const list = container.querySelector('.grid-layout');
      expect(list).toBeInTheDocument();
    });

    it('应该应用列表布局', () => {
      const { container } = render(
        <RecommendationList
          recommendations={mockRecommendations}
          layout='list'
        />
      );

      const list = container.querySelector('.list-layout');
      expect(list).toBeInTheDocument();
    });
  });
});
