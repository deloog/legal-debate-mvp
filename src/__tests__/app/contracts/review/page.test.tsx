/**
 * 合同审查页面测试
 * 测试覆盖：
 * 1. 页面渲染
 * 2. 文件上传
 * 3. 审查结果显示
 * 4. 风险项展示
 * 5. 建议展示
 * 6. 审查历史
 * 7. 错误处理
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContractReviewPage from '@/app/contracts/review/page';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('合同审查页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('页面渲染', () => {
    it('应该正确渲染页面标题', () => {
      render(<ContractReviewPage />);

      expect(screen.getByText('合同智能审查')).toBeInTheDocument();
      expect(screen.getByText(/AI自动识别合同风险点/)).toBeInTheDocument();
    });

    it('应该显示上传区域', () => {
      render(<ContractReviewPage />);

      expect(screen.getByText(/上传合同文件/)).toBeInTheDocument();
    });
  });

  describe('文件上传', () => {
    it('应该成功上传合同文件', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              contractId: 'contract-1',
              fileName: 'test.pdf',
              fileSize: 1024,
              uploadedAt: new Date(),
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'review-1',
              contractId: 'contract-1',
              fileName: 'test.pdf',
              overallScore: 75,
              riskScore: 70,
              complianceScore: 80,
              totalRisks: 3,
              criticalRisks: 0,
              highRisks: 1,
              mediumRisks: 2,
              lowRisks: 0,
              risks: [],
              suggestions: [],
              reviewTime: 2500,
              status: 'COMPLETED',
            },
          }),
        });

      render(<ContractReviewPage />);

      const file = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      });
      const input = screen.getByLabelText(/上传合同/) as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('应该显示上传进度', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ success: true, data: {} }),
                }),
              1000
            )
          )
      );

      render(<ContractReviewPage />);

      const file = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      });
      const input = screen.getByLabelText(/上传合同/) as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText(/上传中/)).toBeInTheDocument();
    });
  });

  describe('审查结果显示', () => {
    it('应该显示审查评分', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'review-1',
            contractId: 'contract-1',
            fileName: 'test.pdf',
            overallScore: 75,
            riskScore: 70,
            complianceScore: 80,
            totalRisks: 3,
            criticalRisks: 0,
            highRisks: 1,
            mediumRisks: 2,
            lowRisks: 0,
            risks: [],
            suggestions: [],
            reviewTime: 2500,
            status: 'COMPLETED',
          },
        }),
      });

      render(<ContractReviewPage />);

      // 模拟已上传状态
      const reviewButton = screen.getByText(/开始审查/);
      fireEvent.click(reviewButton);

      await waitFor(() => {
        expect(screen.getByText('75')).toBeInTheDocument();
        expect(screen.getByText(/总体评分/)).toBeInTheDocument();
      });
    });

    it('应该显示风险统计', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'review-1',
            contractId: 'contract-1',
            fileName: 'test.pdf',
            overallScore: 75,
            riskScore: 70,
            complianceScore: 80,
            totalRisks: 3,
            criticalRisks: 0,
            highRisks: 1,
            mediumRisks: 2,
            lowRisks: 0,
            risks: [],
            suggestions: [],
            reviewTime: 2500,
            status: 'COMPLETED',
          },
        }),
      });

      render(<ContractReviewPage />);

      const reviewButton = screen.getByText(/开始审查/);
      fireEvent.click(reviewButton);

      await waitFor(() => {
        expect(screen.getByText(/总风险数.*3/)).toBeInTheDocument();
        expect(screen.getByText(/高风险.*1/)).toBeInTheDocument();
        expect(screen.getByText(/中风险.*2/)).toBeInTheDocument();
      });
    });
  });

  describe('风险项展示', () => {
    it('应该显示风险列表', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'review-1',
            contractId: 'contract-1',
            fileName: 'test.pdf',
            overallScore: 75,
            riskScore: 70,
            complianceScore: 80,
            totalRisks: 2,
            criticalRisks: 0,
            highRisks: 1,
            mediumRisks: 1,
            lowRisks: 0,
            risks: [
              {
                id: 'risk-1',
                type: 'DISPUTE_RESOLUTION',
                level: 'HIGH',
                title: '缺少争议解决条款',
                description: '合同中未明确约定争议解决方式',
                location: { page: 1, paragraph: 5 },
                originalText: '...',
                impact: '可能导致纠纷处理困难',
                probability: 0.7,
              },
              {
                id: 'risk-2',
                type: 'CONFIDENTIALITY',
                level: 'MEDIUM',
                title: '保密条款不完整',
                description: '保密范围和期限未明确',
                location: { page: 2, paragraph: 3 },
                originalText: '...',
                impact: '可能导致商业秘密泄露',
                probability: 0.6,
              },
            ],
            suggestions: [],
            reviewTime: 2500,
            status: 'COMPLETED',
          },
        }),
      });

      render(<ContractReviewPage />);

      const reviewButton = screen.getByText(/开始审查/);
      fireEvent.click(reviewButton);

      await waitFor(() => {
        expect(screen.getByText('缺少争议解决条款')).toBeInTheDocument();
        expect(screen.getByText('保密条款不完整')).toBeInTheDocument();
      });
    });

    it('应该按风险等级显示不同颜色', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'review-1',
            contractId: 'contract-1',
            fileName: 'test.pdf',
            overallScore: 60,
            riskScore: 50,
            complianceScore: 70,
            totalRisks: 3,
            criticalRisks: 1,
            highRisks: 1,
            mediumRisks: 1,
            lowRisks: 0,
            risks: [
              {
                id: 'risk-1',
                type: 'LIABILITY',
                level: 'CRITICAL',
                title: '无限责任条款',
                description: '合同约定了无限责任',
                location: { page: 1, paragraph: 1 },
                originalText: '...',
                impact: '可能导致巨额赔偿',
                probability: 0.9,
              },
            ],
            suggestions: [],
            reviewTime: 2500,
            status: 'COMPLETED',
          },
        }),
      });

      const { container } = render(<ContractReviewPage />);

      const reviewButton = screen.getByText(/开始审查/);
      fireEvent.click(reviewButton);

      await waitFor(() => {
        const criticalBadge = container.querySelector('.bg-red-100');
        expect(criticalBadge).toBeInTheDocument();
      });
    });
  });

  describe('建议展示', () => {
    it('应该显示修改建议列表', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'review-1',
            contractId: 'contract-1',
            fileName: 'test.pdf',
            overallScore: 75,
            riskScore: 70,
            complianceScore: 80,
            totalRisks: 1,
            criticalRisks: 0,
            highRisks: 1,
            mediumRisks: 0,
            lowRisks: 0,
            risks: [],
            suggestions: [
              {
                id: 'suggestion-1',
                riskId: 'risk-1',
                type: 'ADD',
                title: '添加争议解决条款',
                description: '建议添加明确的争议解决方式',
                suggestedText: '因本合同引起的争议，双方应协商解决...',
                priority: 'HIGH',
                reason: '避免未来纠纷处理困难',
              },
            ],
            reviewTime: 2500,
            status: 'COMPLETED',
          },
        }),
      });

      render(<ContractReviewPage />);

      const reviewButton = screen.getByText(/开始审查/);
      fireEvent.click(reviewButton);

      await waitFor(() => {
        expect(screen.getByText('添加争议解决条款')).toBeInTheDocument();
        expect(
          screen.getByText(/建议添加明确的争议解决方式/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('审查历史', () => {
    it('应该显示审查历史按钮', () => {
      render(<ContractReviewPage />);

      expect(screen.getByText(/审查历史/)).toBeInTheDocument();
    });

    it('应该加载审查历史列表', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: [
              {
                id: 'review-1',
                contractId: 'contract-1',
                fileName: 'contract1.pdf',
                reviewedAt: new Date('2026-01-30T10:00:00Z'),
                overallScore: 75,
                totalRisks: 3,
                criticalRisks: 0,
                status: 'COMPLETED',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 10,
          },
        }),
      });

      render(<ContractReviewPage />);

      const historyButton = screen.getByText(/审查历史/);
      fireEvent.click(historyButton);

      await waitFor(() => {
        expect(screen.getByText('contract1.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理上传失败', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Upload failed')
      );

      render(<ContractReviewPage />);

      const file = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      });
      const input = screen.getByLabelText(/上传合同/) as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/上传失败/)).toBeInTheDocument();
      });
    });

    it('应该处理审查失败', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: {
            code: 'REVIEW_FAILED',
            message: '审查失败',
          },
        }),
      });

      render(<ContractReviewPage />);

      const reviewButton = screen.getByText(/开始审查/);
      fireEvent.click(reviewButton);

      await waitFor(() => {
        expect(screen.getByText(/审查失败/)).toBeInTheDocument();
      });
    });
  });

  describe('响应式设计', () => {
    it('应该在移动端正确显示', () => {
      global.innerWidth = 375;
      global.innerHeight = 667;

      const { container } = render(<ContractReviewPage />);

      expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
    });
  });
});
