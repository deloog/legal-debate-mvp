/**
 * 合同推荐组件测试
 * 测试 ContractRecommendations 组件的各种场景
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContractRecommendations } from '@/components/contract/ContractRecommendations';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('ContractRecommendations', () => {
  const mockContractId = 'contract-123';
  const mockRecommendations = [
    {
      article: {
        id: 'article-1',
        lawName: '中华人民共和国民法典',
        articleNumber: '第470条',
        fullText:
          '合同的内容由当事人约定，一般包括下列条款：（一）当事人的姓名或者名称和住所...',
        category: 'CIVIL',
        effectiveDate: new Date('2021-01-01'),
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        keywords: ['合同', '当事人'],
        tags: ['民法典', '合同编'],
      },
      score: 0.85,
      reason: '基于合同类型推荐的相关法条',
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
        createdAt: new Date(),
        updatedAt: new Date(),
        keywords: ['违约', '责任'],
        tags: ['民法典', '合同编'],
      },
      score: 0.75,
      reason: '该法条补充完善了此法条',
      relationType: 'COMPLETES',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('加载状态', () => {
    it('应该显示加载状态', () => {
      // Arrange
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // 永不resolve，保持加载状态
      );

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
        />
      );

      // Assert
      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  describe('成功场景', () => {
    it('应该成功显示推荐法条列表', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
        />
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('推荐法条（2条）')).toBeInTheDocument();
      });

      expect(screen.getAllByText('中华人民共和国民法典')).toHaveLength(2);
      expect(screen.getByText('第470条')).toBeInTheDocument();
      expect(
        screen.getByText('基于合同类型推荐的相关法条')
      ).toBeInTheDocument();
      expect(screen.getByText('第577条')).toBeInTheDocument();
      expect(screen.getByText('该法条补充完善了此法条')).toBeInTheDocument();
    });

    it('应该显示推荐分数', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
        />
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('85%')).toBeInTheDocument();
        expect(screen.getByText('75%')).toBeInTheDocument();
      });
    });

    it('应该使用自定义limit参数', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
          limit={5}
        />
      );

      // Assert
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('limit=5')
        );
      });
    });

    it('应该使用自定义minScore参数', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
          minScore={0.5}
        />
      );

      // Assert
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('minScore=0.5')
        );
      });
    });
  });

  describe('空状态', () => {
    it('应该显示空状态当没有推荐时', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: [],
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
        />
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('暂无推荐法条')).toBeInTheDocument();
        expect(
          screen.getByText('系统未找到相关的法条推荐')
        ).toBeInTheDocument();
      });
    });
  });

  describe('错误处理', () => {
    it('应该显示错误信息当API返回错误', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: '合同不存在',
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
        />
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('合同不存在')).toBeInTheDocument();
      });
    });

    it('应该显示错误信息当网络请求失败', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
        />
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('应该显示错误信息当contractId无效', async () => {
      // Act
      render(<ContractRecommendations contractId='' userId='test-user-id' />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('无效的合同ID')).toBeInTheDocument();
      });
    });

    it('应该支持重新加载', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
        />
      );

      // Assert - 首次加载失败
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Arrange - 第二次加载成功
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act - 点击重新加载
      const retryButton = screen.getByText('重新加载');
      fireEvent.click(retryButton);

      // Assert - 加载成功
      await waitFor(() => {
        expect(screen.getByText('推荐法条（2条）')).toBeInTheDocument();
      });
    });
  });

  describe('交互功能', () => {
    it('应该支持展开和收起法条内容', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
        />
      );

      // Assert - 初始状态不显示完整内容
      await waitFor(() => {
        expect(screen.getByText('推荐法条（2条）')).toBeInTheDocument();
      });

      const fullText = mockRecommendations[0].article.fullText;
      expect(screen.queryByText(fullText)).not.toBeInTheDocument();

      // Act - 点击展开按钮
      const expandButtons = screen.getAllByLabelText('展开');
      fireEvent.click(expandButtons[0]);

      // Assert - 显示完整内容
      await waitFor(() => {
        expect(screen.getByText(fullText)).toBeInTheDocument();
      });

      // Act - 点击收起按钮
      const collapseButton = screen.getByLabelText('收起');
      fireEvent.click(collapseButton);

      // Assert - 隐藏完整内容
      await waitFor(() => {
        expect(screen.queryByText(fullText)).not.toBeInTheDocument();
      });
    });

    it('应该支持选择法条', async () => {
      // Arrange
      const mockOnSelect = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-123'
          onSelect={mockOnSelect}
        />
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('推荐法条（2条）')).toBeInTheDocument();
      });

      // Act - 点击选择按钮
      const selectButtons = screen.getAllByText('选择');
      fireEvent.click(selectButtons[0]);

      // Assert - 调用回调函数
      expect(mockOnSelect).toHaveBeenCalledWith(mockRecommendations[0].article);
    });

    it('应该不显示选择按钮当没有onSelect回调', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
        />
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('推荐法条（2条）')).toBeInTheDocument();
      });

      expect(screen.queryByText('选择')).not.toBeInTheDocument();
    });
  });

  describe('过滤功能', () => {
    it('应该显示过滤输入框当showFilter为true', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-123'
          showFilter={true}
        />
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索法条...')).toBeInTheDocument();
      });
    });

    it('应该不显示过滤输入框当showFilter为false', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-123'
          showFilter={false}
        />
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('推荐法条（2条）')).toBeInTheDocument();
      });

      expect(
        screen.queryByPlaceholderText('搜索法条...')
      ).not.toBeInTheDocument();
    });

    it('应该支持按法条名称过滤', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-123'
          showFilter={true}
        />
      );

      // Assert - 初始显示所有推荐
      await waitFor(() => {
        expect(screen.getByText('推荐法条（2条）')).toBeInTheDocument();
      });

      // Act - 输入过滤文本
      const filterInput = screen.getByPlaceholderText('搜索法条...');
      fireEvent.change(filterInput, { target: { value: '第470条' } });

      // Assert - 只显示匹配的推荐
      await waitFor(() => {
        expect(screen.getByText('推荐法条（1条）')).toBeInTheDocument();
      });

      expect(screen.getByText('第470条')).toBeInTheDocument();
      expect(screen.queryByText('第577条')).not.toBeInTheDocument();
    });

    it('应该支持按法条内容过滤', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-123'
          showFilter={true}
        />
      );

      // Assert - 初始显示所有推荐
      await waitFor(() => {
        expect(screen.getByText('推荐法条（2条）')).toBeInTheDocument();
      });

      // Act - 输入过滤文本
      const filterInput = screen.getByPlaceholderText('搜索法条...');
      fireEvent.change(filterInput, { target: { value: '违约' } });

      // Assert - 只显示匹配的推荐
      await waitFor(() => {
        expect(screen.getByText('推荐法条（1条）')).toBeInTheDocument();
      });

      expect(screen.getByText('第577条')).toBeInTheDocument();
      expect(screen.queryByText('第470条')).not.toBeInTheDocument();
    });

    it('应该显示空结果当过滤无匹配', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-123'
          showFilter={true}
        />
      );

      // Assert - 初始显示所有推荐
      await waitFor(() => {
        expect(screen.getByText('推荐法条（2条）')).toBeInTheDocument();
      });

      // Act - 输入不匹配的过滤文本
      const filterInput = screen.getByPlaceholderText('搜索法条...');
      fireEvent.change(filterInput, { target: { value: '不存在的法条' } });

      // Assert - 显示0条结果
      await waitFor(() => {
        expect(screen.getByText('推荐法条（0条）')).toBeInTheDocument();
      });
    });

    it('应该清除过滤时恢复所有推荐', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: mockRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-123'
          showFilter={true}
        />
      );

      // Assert - 初始显示所有推荐
      await waitFor(() => {
        expect(screen.getByText('推荐法条（2条）')).toBeInTheDocument();
      });

      // Act - 输入过滤文本
      const filterInput = screen.getByPlaceholderText('搜索法条...');
      fireEvent.change(filterInput, { target: { value: '第470条' } });

      // Assert - 只显示1条
      await waitFor(() => {
        expect(screen.getByText('推荐法条（1条）')).toBeInTheDocument();
      });

      // Act - 清除过滤
      fireEvent.change(filterInput, { target: { value: '' } });

      // Assert - 恢复显示所有推荐
      await waitFor(() => {
        expect(screen.getByText('推荐法条（2条）')).toBeInTheDocument();
      });
    });
  });

  describe('边界情况', () => {
    it('应该处理推荐分数为0的情况', async () => {
      // Arrange
      const zeroScoreRecommendations = [
        {
          ...mockRecommendations[0],
          score: 0,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: zeroScoreRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
        />
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument();
      });
    });

    it('应该处理推荐分数为1的情况', async () => {
      // Arrange
      const fullScoreRecommendations = [
        {
          ...mockRecommendations[0],
          score: 1,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: fullScoreRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
        />
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });

    it('应该处理法条内容为空的情况', async () => {
      // Arrange
      const emptyContentRecommendations = [
        {
          ...mockRecommendations[0],
          article: {
            ...mockRecommendations[0].article,
            fullText: '',
          },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recommendations: emptyContentRecommendations,
        }),
      });

      // Act
      render(
        <ContractRecommendations
          contractId={mockContractId}
          userId='test-user-id'
        />
      );

      // Assert - 应该正常渲染
      await waitFor(() => {
        expect(screen.getByText('推荐法条（1条）')).toBeInTheDocument();
      });
    });
  });
});
