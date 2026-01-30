/**
 * 质证预判卡片组件测试
 *
 * 测试覆盖：
 * - 组件渲染
 * - 风险等级显示
 * - 质证意见展示
 * - 应对建议展示
 * - 展开/收起功能
 * - 刷新功能
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CrossExaminationCard } from '@/components/evidence/CrossExaminationCard';
import type { CrossExaminationResult } from '@/lib/evidence/cross-examination-service';

describe('CrossExaminationCard', () => {
  const mockResult: CrossExaminationResult = {
    possibleChallenges: [
      {
        type: 'authenticity',
        content: '复印件无法核实原件真实性',
        likelihood: 70,
      },
      {
        type: 'relevance',
        content: '合同签订时间与争议事项无关联',
        likelihood: 30,
      },
    ],
    responses: [
      {
        challenge: '复印件无法核实原件真实性',
        response: '提供原件或申请法院调取人社局备案合同',
        supportingEvidence: '人社局备案合同',
      },
    ],
    overallRisk: 'medium',
    riskNote: '存在真实性质疑风险，建议补充原件',
  };

  describe('基本渲染', () => {
    it('应该正确渲染组件', () => {
      render(
        <CrossExaminationCard
          evidenceName='劳动合同复印件'
          result={mockResult}
        />
      );

      expect(screen.getByText(/劳动合同复印件/)).toBeInTheDocument();
    });

    it('应该显示风险等级', () => {
      render(
        <CrossExaminationCard evidenceName='劳动合同' result={mockResult} />
      );

      expect(screen.getByText(/中等风险/)).toBeInTheDocument();
    });

    it('应该显示质证意见', () => {
      render(
        <CrossExaminationCard evidenceName='劳动合同' result={mockResult} />
      );

      expect(screen.getByText(/复印件无法核实原件真实性/)).toBeInTheDocument();
    });

    it('应该显示可能性百分比', () => {
      render(
        <CrossExaminationCard evidenceName='劳动合同' result={mockResult} />
      );

      expect(screen.getByText(/70%/)).toBeInTheDocument();
    });
  });

  describe('风险等级显示', () => {
    it('应该正确显示低风险', () => {
      const lowRiskResult: CrossExaminationResult = {
        ...mockResult,
        overallRisk: 'low',
      };

      render(
        <CrossExaminationCard evidenceName='劳动合同' result={lowRiskResult} />
      );

      expect(screen.getByText(/低风险/)).toBeInTheDocument();
    });

    it('应该正确显示中等风险', () => {
      render(
        <CrossExaminationCard evidenceName='劳动合同' result={mockResult} />
      );

      expect(screen.getByText(/中等风险/)).toBeInTheDocument();
    });

    it('应该正确显示高风险', () => {
      const highRiskResult: CrossExaminationResult = {
        ...mockResult,
        overallRisk: 'high',
      };

      render(
        <CrossExaminationCard evidenceName='劳动合同' result={highRiskResult} />
      );

      expect(screen.getByText(/高风险/)).toBeInTheDocument();
    });
  });

  describe('展开/收起功能', () => {
    it('应该支持展开详细信息', () => {
      render(
        <CrossExaminationCard evidenceName='劳动合同' result={mockResult} />
      );

      const expandButton = screen.getByRole('button', { name: /展开|详情/ });
      fireEvent.click(expandButton);

      expect(screen.getAllByText(/应对建议/)[0]).toBeInTheDocument();
    });

    it('应该支持收起详细信息', () => {
      render(
        <CrossExaminationCard evidenceName='劳动合同' result={mockResult} />
      );

      const expandButton = screen.getByRole('button', { name: /展开|详情/ });

      // 展开
      fireEvent.click(expandButton);
      expect(screen.getAllByText(/应对建议/)[0]).toBeInTheDocument();

      // 收起
      const collapseButton = screen.getByRole('button', { name: /收起/ });
      fireEvent.click(collapseButton);
    });
  });

  describe('刷新功能', () => {
    it('应该支持刷新预判', async () => {
      const onRefresh = jest.fn();

      render(
        <CrossExaminationCard
          evidenceName='劳动合同'
          result={mockResult}
          onRefresh={onRefresh}
        />
      );

      const refreshButton = screen.getByRole('button', {
        name: /刷新|重新预判/,
      });
      fireEvent.click(refreshButton);

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('刷新时应该显示加载状态', async () => {
      const onRefresh = jest
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 100))
        );

      render(
        <CrossExaminationCard
          evidenceName='劳动合同'
          result={mockResult}
          onRefresh={onRefresh}
        />
      );

      const refreshButton = screen.getByRole('button', {
        name: /刷新|重新预判/,
      });
      fireEvent.click(refreshButton);

      expect(screen.getAllByText(/加载中|分析中/)[0]).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryAllByText(/加载中|分析中/).length).toBe(0);
      });
    });
  });

  describe('应对建议显示', () => {
    it('应该显示应对建议', () => {
      render(
        <CrossExaminationCard evidenceName='劳动合同' result={mockResult} />
      );

      const expandButton = screen.getByRole('button', { name: /展开|详情/ });
      fireEvent.click(expandButton);

      expect(
        screen.getByText(/提供原件或申请法院调取人社局备案合同/)
      ).toBeInTheDocument();
    });

    it('应该显示补充证据建议', () => {
      render(
        <CrossExaminationCard evidenceName='劳动合同' result={mockResult} />
      );

      const expandButton = screen.getByRole('button', { name: /展开|详情/ });
      fireEvent.click(expandButton);

      expect(screen.getAllByText(/人社局备案合同/)[0]).toBeInTheDocument();
    });
  });

  describe('边界情况', () => {
    it('应该处理空的质证意见', () => {
      const emptyResult: CrossExaminationResult = {
        possibleChallenges: [],
        responses: [],
        overallRisk: 'low',
        riskNote: '暂无风险',
      };

      render(
        <CrossExaminationCard evidenceName='劳动合同' result={emptyResult} />
      );

      expect(screen.getByText(/暂无质证意见/)).toBeInTheDocument();
    });

    it('应该处理长文本', () => {
      const longTextResult: CrossExaminationResult = {
        possibleChallenges: [
          {
            type: 'authenticity',
            content: '这是一段很长的质证意见内容'.repeat(10),
            likelihood: 70,
          },
        ],
        responses: [],
        overallRisk: 'medium',
        riskNote: '风险说明',
      };

      render(
        <CrossExaminationCard evidenceName='劳动合同' result={longTextResult} />
      );

      expect(screen.getByText(/劳动合同/)).toBeInTheDocument();
    });
  });

  describe('无障碍性', () => {
    it('应该有正确的ARIA标签', () => {
      const { container } = render(
        <CrossExaminationCard evidenceName='劳动合同' result={mockResult} />
      );

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
