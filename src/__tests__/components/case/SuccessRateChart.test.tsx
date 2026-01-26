/**
 * SuccessRateChart 组件测试
 * 测试胜败率分析图表组件的渲染、显示等功能
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { SuccessRateChart } from '../../../components/case/SuccessRateChart';
import type { SuccessRateAnalysis } from '../../../types/case-example';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('SuccessRateChart', () => {
  const createMockAnalysis = (
    winRate: number,
    winProbability: number,
    confidence: number,
    riskLevel: 'low' | 'medium' | 'high',
    trend: 'increasing' | 'decreasing' | 'stable'
  ): SuccessRateAnalysis => ({
    caseId: 'test-case-123',
    winRate,
    winProbability,
    confidence,
    similarCasesCount: 10,
    winCasesCount: Math.round(10 * winRate),
    loseCasesCount: Math.round(10 * (1 - winRate - 0.1)),
    partialCasesCount: Math.round(10 * 0.05),
    withdrawCasesCount: Math.round(10 * 0.05),
    analysis: {
      trend,
      recommendation: '基于历史数据分析，建议加强证据准备以提高胜诉概率。',
      riskLevel,
    },
  });

  describe('基础渲染', () => {
    it('应该正确渲染胜败率图表', () => {
      const mockAnalysis = createMockAnalysis(0.75, 0.8, 0.9, 'low', 'stable');

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('胜败率分析')).toBeInTheDocument();
    });

    it('应该显示胜诉率', () => {
      const mockAnalysis = createMockAnalysis(0.75, 0.8, 0.9, 'low', 'stable');

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('胜诉率')).toBeInTheDocument();
    });

    it('应该显示预测胜诉概率', () => {
      const mockAnalysis = createMockAnalysis(0.75, 0.8, 0.9, 'low', 'stable');

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText('预测胜诉概率')).toBeInTheDocument();
    });

    it('应该显示分析置信度', () => {
      const mockAnalysis = createMockAnalysis(0.75, 0.8, 0.9, 'low', 'stable');

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('90%')).toBeInTheDocument();
      expect(screen.getByText('分析置信度')).toBeInTheDocument();
    });
  });

  describe('风险等级显示', () => {
    it('低风险应该显示绿色标识和✅图标', () => {
      const mockAnalysis = createMockAnalysis(0.8, 0.85, 0.9, 'low', 'stable');

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('低风险')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
      expect(screen.getByText('风险评估等级')).toBeInTheDocument();
    });

    it('中风险应该显示黄色标识和⚠️图标', () => {
      const mockAnalysis = createMockAnalysis(
        0.5,
        0.55,
        0.7,
        'medium',
        'stable'
      );

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('中风险')).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('高风险应该显示红色标识和❌图标', () => {
      const mockAnalysis = createMockAnalysis(
        0.3,
        0.35,
        0.5,
        'high',
        'decreasing'
      );

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('高风险')).toBeInTheDocument();
      expect(screen.getByText('❌')).toBeInTheDocument();
    });
  });

  describe('案例分布条', () => {
    it('应该显示胜诉案例数和百分比', () => {
      const mockAnalysis = createMockAnalysis(0.75, 0.8, 0.9, 'low', 'stable');
      mockAnalysis.winCasesCount = 8;
      mockAnalysis.similarCasesCount = 10;

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('胜诉')).toBeInTheDocument();
      expect(screen.getByText(/8个/)).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('应该渲染所有分布条', () => {
      const mockAnalysis = createMockAnalysis(0.75, 0.8, 0.9, 'low', 'stable');

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('胜诉')).toBeInTheDocument();
      expect(screen.getByText('败诉')).toBeInTheDocument();
      expect(screen.getByText('部分胜诉')).toBeInTheDocument();
      expect(screen.getByText('撤诉')).toBeInTheDocument();
    });
  });

  describe('趋势分析', () => {
    it('上升趋势应该显示📈图标', () => {
      const mockAnalysis = createMockAnalysis(
        0.75,
        0.8,
        0.9,
        'low',
        'increasing'
      );

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('上升趋势')).toBeInTheDocument();
      expect(screen.getByText('📈')).toBeInTheDocument();
    });

    it('下降趋势应该显示📉图标', () => {
      const mockAnalysis = createMockAnalysis(
        0.5,
        0.55,
        0.7,
        'medium',
        'decreasing'
      );

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('下降趋势')).toBeInTheDocument();
      expect(screen.getByText('📉')).toBeInTheDocument();
    });

    it('稳定趋势应该显示📊图标', () => {
      const mockAnalysis = createMockAnalysis(0.75, 0.8, 0.9, 'low', 'stable');

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('稳定')).toBeInTheDocument();
      expect(screen.getByText('📊')).toBeInTheDocument();
    });
  });

  describe('分析建议', () => {
    it('应该显示💡图标', () => {
      const mockAnalysis = createMockAnalysis(0.75, 0.8, 0.9, 'low', 'stable');

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('💡')).toBeInTheDocument();
    });

    it('应该显示完整的建议文本', () => {
      const recommendation = '建议完善证据链，特别是关键证据的收集和保存。';
      const mockAnalysis = createMockAnalysis(0.75, 0.8, 0.9, 'low', 'stable');
      mockAnalysis.analysis.recommendation = recommendation;

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText(recommendation)).toBeInTheDocument();
    });
  });

  describe('数据质量提示', () => {
    it('相似案例数量少时应该显示数据质量提示', () => {
      const mockAnalysis = createMockAnalysis(0.75, 0.8, 0.9, 'low', 'stable');
      mockAnalysis.similarCasesCount = 3;

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('数据质量提示')).toBeInTheDocument();
      expect(screen.getByText(/相似案例数量较少/)).toBeInTheDocument();
    });

    it('相似案例数量足够时不应该显示数据质量提示', () => {
      const mockAnalysis = createMockAnalysis(0.75, 0.8, 0.9, 'low', 'stable');
      mockAnalysis.similarCasesCount = 10;

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.queryByText('数据质量提示')).not.toBeInTheDocument();
    });

    it('置信度低时应该显示数据质量提示', () => {
      const mockAnalysis = createMockAnalysis(0.75, 0.8, 0.65, 'low', 'stable');

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('数据质量提示')).toBeInTheDocument();
      expect(screen.getByText(/分析置信度较低/)).toBeInTheDocument();
    });

    it('置信度足够时不应该显示数据质量提示', () => {
      const mockAnalysis = createMockAnalysis(0.75, 0.8, 0.85, 'low', 'stable');

      render(
        <SuccessRateChart
          analysis={mockAnalysis}
          loading={false}
          error={null}
        />
      );

      expect(screen.queryByText('数据质量提示')).not.toBeInTheDocument();
    });
  });

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      render(<SuccessRateChart analysis={null} loading={true} error={null} />);

      expect(screen.getByText('分析中...')).toBeInTheDocument();
    });
  });

  describe('错误状态', () => {
    it('应该显示错误信息', () => {
      const errorMessage = '胜败率分析失败';

      render(
        <SuccessRateChart
          analysis={null}
          loading={false}
          error={errorMessage}
        />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByText('❌')).toBeInTheDocument();
    });
  });

  describe('空状态', () => {
    it('应该显示空状态提示', () => {
      render(<SuccessRateChart analysis={null} loading={false} error={null} />);

      expect(screen.getByText('暂无分析数据')).toBeInTheDocument();
      expect(screen.getByText('请先检索相似案例')).toBeInTheDocument();
    });

    it('应该显示图表图标', () => {
      render(<SuccessRateChart analysis={null} loading={false} error={null} />);

      expect(screen.getByText('📊')).toBeInTheDocument();
    });
  });
});
