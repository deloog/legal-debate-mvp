/**
 * SimilarCasesPanel 单元测试
 *
 * TDD 红阶段：先编写测试，后实现组件
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SimilarCasesPanel } from '../../../components/cases/SimilarCasesPanel';
import type {
  SimilaritySearchResult,
  SimilarCaseMatch,
} from '../../../types/case-example';
import { CaseResult, CaseType } from '@prisma/client';

// Mock fetch
global.fetch = jest.fn();

describe('SimilarCasesPanel', () => {
  const mockCaseId = 'case-123';

  const mockMatches: SimilarCaseMatch[] = [
    {
      caseExample: {
        id: 'example-1',
        title: '合同纠纷案例一',
        caseNumber: '(2024)京01民初123号',
        court: '北京市第一中级人民法院',
        type: CaseType.CIVIL,
        cause: '合同纠纷',
        facts: '原告与被告签订买卖合同...',
        judgment: '判决被告支付货款...',
        result: CaseResult.WIN,
        judgmentDate: new Date('2024-01-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: null,
      },
      similarity: 0.92,
      matchingFactors: ['案由相同', '争议金额相近', '地区相同'],
    },
    {
      caseExample: {
        id: 'example-2',
        title: '合同纠纷案例二',
        caseNumber: '(2024)沪02民初456号',
        court: '上海市第二中级人民法院',
        type: CaseType.CIVIL,
        cause: '合同纠纷',
        facts: '双方签订服务合同...',
        judgment: '判决解除合同...',
        result: CaseResult.PARTIAL,
        judgmentDate: new Date('2024-02-20'),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: null,
      },
      similarity: 0.85,
      matchingFactors: ['案由相同', '法律适用相似'],
    },
  ];

  const mockSearchResult: SimilaritySearchResult = {
    caseId: mockCaseId,
    matches: mockMatches,
    totalMatches: 2,
    searchTime: 1250,
    metadata: {
      algorithm: 'cosine',
      vectorDimension: 1536,
      casesSearched: 1000,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('render', () => {
    it('should render loading state initially', () => {
      (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

      render(<SimilarCasesPanel caseId={mockCaseId} />);

      expect(screen.getByText('正在检索相似案例...')).toBeInTheDocument();
    });

    it('should render panel title', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSearchResult }),
      });

      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('相似案例推荐')).toBeInTheDocument();
      });
    });

    it('should display search statistics', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSearchResult }),
      });

      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('找到 2 个相似案例')).toBeInTheDocument();
        expect(screen.getByText('耗时 1.3s')).toBeInTheDocument();
      });
    });
  });

  describe('similar case cards', () => {
    beforeEach(() => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSearchResult }),
      });
    });

    it('should render case cards with basic info', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('合同纠纷案例一')).toBeInTheDocument();
        expect(screen.getByText('合同纠纷案例二')).toBeInTheDocument();
      });
    });

    it('should display similarity score', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('92%')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
      });
    });

    it('should display case number and court', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('(2024)京01民初123号')).toBeInTheDocument();
        expect(screen.getByText('北京市第一中级人民法院')).toBeInTheDocument();
      });
    });

    it('should display case result badge', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('胜诉')).toBeInTheDocument();
        expect(screen.getByText('部分胜诉')).toBeInTheDocument();
      });
    });

    it('should display matching factors', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        // 使用 getAllByText 因为多个案例可能有相同的匹配因素
        expect(screen.getAllByText('案由相同').length).toBeGreaterThanOrEqual(
          1
        );
        expect(screen.getByText('争议金额相近')).toBeInTheDocument();
        expect(screen.getByText('地区相同')).toBeInTheDocument();
      });
    });
  });

  describe('interactions', () => {
    beforeEach(() => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSearchResult }),
      });
    });

    it('should call onCaseSelect when card is clicked', async () => {
      const mockOnSelect = jest.fn();
      render(
        <SimilarCasesPanel caseId={mockCaseId} onCaseSelect={mockOnSelect} />
      );

      await waitFor(() => {
        const firstCard = screen
          .getByText('合同纠纷案例一')
          .closest('.case-card');
        if (firstCard) {
          fireEvent.click(firstCard);
          expect(mockOnSelect).toHaveBeenCalledWith(mockMatches[0]);
        }
      });
    });

    it('should expand case details when expand button is clicked', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        const expandButton = screen.getAllByLabelText('展开详情')[0];
        fireEvent.click(expandButton);
        expect(screen.getByText('案情摘要')).toBeInTheDocument();
        expect(screen.getByText('判决结果')).toBeInTheDocument();
      });
    });

    it('should refresh results when refresh button is clicked', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSearchResult }),
      });

      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        const refreshButton = screen.getByLabelText('重新检索');
        fireEvent.click(refreshButton);
        expect(fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('filters', () => {
    beforeEach(() => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockSearchResult }),
      });
    });

    it('should apply threshold filter', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} defaultThreshold={0.8} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('threshold=0.8'),
          expect.any(Object)
        );
      });
    });

    it('should apply topK filter', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} defaultTopK={5} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('topK=5'),
          expect.any(Object)
        );
      });
    });

    it('should update filters when user changes selection', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        const thresholdSelect = screen.getByLabelText('相似度阈值');
        fireEvent.change(thresholdSelect, { target: { value: '0.9' } });
        expect(fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('error handling', () => {
    it('should display error message when API fails', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        // 组件会显示实际的错误消息
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should display empty state when no matches found', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { ...mockSearchResult, matches: [], totalMatches: 0 },
        }),
      });

      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('未找到相似案例')).toBeInTheDocument();
        expect(
          screen.getByText('尝试调整相似度阈值或添加更多案情描述')
        ).toBeInTheDocument();
      });
    });

    it('should retry on error when retry button is clicked', async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockSearchResult }),
        });

      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        const retryButton = screen.getByText('重新加载');
        fireEvent.click(retryButton);
        expect(fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('pagination', () => {
    // 生成12个相似案例数据用于分页测试
    const generateManyMatches = (count: number): SimilarCaseMatch[] => {
      return Array.from({ length: count }, (_, i) => ({
        caseExample: {
          id: `example-${i + 1}`,
          title: `合同纠纷案例 ${i + 1}`,
          caseNumber: `(2024)京${String(i + 1).padStart(2, '0')}民初${String(i + 1).padStart(3, '0')}号`,
          court: '北京市第一中级人民法院',
          type: CaseType.CIVIL,
          cause: '合同纠纷',
          facts: `案例 ${i + 1} 的案情事实...`,
          judgment: '判决结果...',
          result: i % 2 === 0 ? CaseResult.WIN : CaseResult.PARTIAL,
          judgmentDate: new Date('2024-01-15'),
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: null,
        },
        similarity: 0.9 - i * 0.02,
        matchingFactors: ['案由相同', '争议金额相近'],
      }));
    };

    const mockPaginationResult: SimilaritySearchResult = {
      caseId: mockCaseId,
      matches: generateManyMatches(12),
      totalMatches: 12,
      searchTime: 1000,
    };

    beforeEach(() => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockPaginationResult }),
      });
    });

    it('should display pagination when results exceed page size', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        // 验证分页信息
        expect(screen.getByText(/第 1 \/ 3 页/)).toBeInTheDocument();
        expect(screen.getByText(/共 12 条/)).toBeInTheDocument();
      });

      // 验证只显示5条数据（每页大小）
      const caseCards = document.querySelectorAll('.case-card');
      expect(caseCards.length).toBe(5);
    });

    it('should navigate to next page when next button clicked', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText(/第 1 \/ 3 页/)).toBeInTheDocument();
      });

      // 点击下一页
      const nextButton = screen.getByRole('button', { name: /下一页/ });
      fireEvent.click(nextButton);

      // 验证页码更新
      await waitFor(() => {
        expect(screen.getByText(/第 2 \/ 3 页/)).toBeInTheDocument();
      });

      // 验证显示的是第6-10条数据
      expect(screen.getByText('合同纠纷案例 6')).toBeInTheDocument();
    });

    it('should navigate to previous page when previous button clicked', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText(/第 1 \/ 3 页/)).toBeInTheDocument();
      });

      // 先点击下一页
      fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
      await waitFor(() => {
        expect(screen.getByText(/第 2 \/ 3 页/)).toBeInTheDocument();
      });

      // 再点击上一页
      fireEvent.click(screen.getByRole('button', { name: /上一页/ }));
      await waitFor(() => {
        expect(screen.getByText(/第 1 \/ 3 页/)).toBeInTheDocument();
      });

      // 验证回到第一页数据
      expect(screen.getByText('合同纠纷案例 1')).toBeInTheDocument();
    });

    it('should disable previous button on first page', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        const prevButton = screen.getByRole('button', { name: /上一页/ });
        expect(prevButton).toBeDisabled();
      });
    });

    it('should disable next button on last page', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText(/第 1 \/ 3 页/)).toBeInTheDocument();
      });

      // 点击到最后一页
      fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
      await waitFor(() => {
        expect(screen.getByText(/第 2 \/ 3 页/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
      await waitFor(() => {
        expect(screen.getByText(/第 3 \/ 3 页/)).toBeInTheDocument();
      });

      // 验证下一页按钮禁用
      const nextButton = screen.getByRole('button', { name: /下一页/ });
      expect(nextButton).toBeDisabled();
    });

    it('should reset to first page when filter changes', async () => {
      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText(/第 1 \/ 3 页/)).toBeInTheDocument();
      });

      // 点击到第二页
      fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
      await waitFor(() => {
        expect(screen.getByText(/第 2 \/ 3 页/)).toBeInTheDocument();
      });

      // 修改筛选条件
      const thresholdSelect = screen.getByLabelText('相似度阈值');
      fireEvent.change(thresholdSelect, { target: { value: '0.8' } });

      // 验证重置到第一页
      await waitFor(() => {
        expect(screen.getByText(/第 1 \/ 3 页/)).toBeInTheDocument();
      });
    });

    it('should not display pagination when results fit in one page', async () => {
      const singlePageResult: SimilaritySearchResult = {
        ...mockSearchResult,
        matches: generateManyMatches(3),
        totalMatches: 3,
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: singlePageResult }),
      });

      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('找到 3 个相似案例')).toBeInTheDocument();
      });

      // 验证不显示分页
      expect(screen.queryByText(/第 1/)).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle very long case titles', async () => {
      const longTitleResult: SimilaritySearchResult = {
        ...mockSearchResult,
        matches: [
          {
            ...mockMatches[0],
            caseExample: {
              ...mockMatches[0].caseExample,
              title:
                '这是一个非常长的案例标题，可能会超出显示范围，需要被截断处理以确保界面美观和可读性',
            },
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: longTitleResult }),
      });

      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        const title = screen.getByText(/这是一个非常长的案例标题/);
        expect(title).toBeInTheDocument();
      });
    });

    it('should handle zero similarity gracefully', async () => {
      const zeroSimilarityResult: SimilaritySearchResult = {
        ...mockSearchResult,
        matches: [
          {
            ...mockMatches[0],
            similarity: 0,
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: zeroSimilarityResult }),
      });

      render(<SimilarCasesPanel caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument();
      });
    });

    it('should render skeleton loading state', async () => {
      (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

      render(<SimilarCasesPanel caseId={mockCaseId} />);

      expect(document.querySelector('.skeleton')).toBeInTheDocument();
    });
  });
});
