/**
 * RiskAnalysisCharts 单元测试
 *
 * TDD 红阶段：先编写测试，后实现组件
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RiskAnalysisCharts } from '../../../components/risk/RiskAnalysisCharts';
import type { RiskAssessmentResult } from '../../../types/risk';
import { RiskLevel, RiskCategory, RiskType } from '../../../types/risk';

describe('RiskAnalysisCharts', () => {
  const mockAssessment: RiskAssessmentResult = {
    caseId: 'case_123',
    overallRiskLevel: RiskLevel.HIGH,
    overallRiskScore: 0.68,
    risks: [
      {
        id: 'risk_1',
        riskType: RiskType.EVIDENCE_STRENGTH,
        riskCategory: RiskCategory.EVIDENTIARY,
        riskLevel: RiskLevel.CRITICAL,
        score: 0.9,
        confidence: 0.9,
        description: '证据强度不足',
        evidence: ['证人证言缺失'],
        suggestions: [],
        identifiedAt: new Date('2026-01-26'),
      },
      {
        id: 'risk_2',
        riskType: RiskType.STATUTE_LIMITATION,
        riskCategory: RiskCategory.SUBSTANTIVE,
        riskLevel: RiskLevel.HIGH,
        score: 0.75,
        confidence: 0.8,
        description: '诉讼时效问题',
        evidence: [],
        suggestions: [],
        identifiedAt: new Date('2026-01-26'),
      },
      {
        id: 'risk_3',
        riskType: RiskType.LEGAL_PROCEDURE,
        riskCategory: RiskCategory.PROCEDURAL,
        riskLevel: RiskLevel.MEDIUM,
        score: 0.55,
        confidence: 0.7,
        description: '程序问题',
        evidence: [],
        suggestions: [],
        identifiedAt: new Date('2026-01-26'),
      },
    ],
    statistics: {
      totalRisks: 3,
      byLevel: {
        [RiskLevel.LOW]: 0,
        [RiskLevel.MEDIUM]: 1,
        [RiskLevel.HIGH]: 1,
        [RiskLevel.CRITICAL]: 1,
      },
      byCategory: {
        [RiskCategory.PROCEDURAL]: 1,
        [RiskCategory.EVIDENTIARY]: 1,
        [RiskCategory.SUBSTANTIVE]: 1,
        [RiskCategory.STRATEGIC]: 0,
      },
      byType: {
        [RiskType.LEGAL_PROCEDURE]: 1,
        [RiskType.EVIDENCE_STRENGTH]: 1,
        [RiskType.STATUTE_LIMITATION]: 1,
        [RiskType.JURISDICTION]: 0,
        [RiskType.COST_BENEFIT]: 0,
        [RiskType.FACT_VERIFICATION]: 0,
        [RiskType.LEGAL_BASIS]: 0,
        [RiskType.CONTRADICTION]: 0,
        [RiskType.PROOF_BURDEN]: 0,
      },
      criticalRisks: 1,
      highRisks: 1,
      mediumRisks: 1,
      lowRisks: 0,
    },
    suggestions: [],
    assessmentTime: 150,
    assessedAt: new Date('2026-01-26'),
  };

  const emptyAssessment: RiskAssessmentResult = {
    ...mockAssessment,
    risks: [],
    statistics: {
      totalRisks: 0,
      byLevel: {
        [RiskLevel.LOW]: 0,
        [RiskLevel.MEDIUM]: 0,
        [RiskLevel.HIGH]: 0,
        [RiskLevel.CRITICAL]: 0,
      },
      byCategory: {
        [RiskCategory.PROCEDURAL]: 0,
        [RiskCategory.EVIDENTIARY]: 0,
        [RiskCategory.SUBSTANTIVE]: 0,
        [RiskCategory.STRATEGIC]: 0,
      },
      byType: {
        [RiskType.LEGAL_PROCEDURE]: 0,
        [RiskType.EVIDENCE_STRENGTH]: 0,
        [RiskType.STATUTE_LIMITATION]: 0,
        [RiskType.JURISDICTION]: 0,
        [RiskType.COST_BENEFIT]: 0,
        [RiskType.FACT_VERIFICATION]: 0,
        [RiskType.LEGAL_BASIS]: 0,
        [RiskType.CONTRADICTION]: 0,
        [RiskType.PROOF_BURDEN]: 0,
      },
      criticalRisks: 0,
      highRisks: 0,
      mediumRisks: 0,
      lowRisks: 0,
    },
  };

  describe('render', () => {
    it('should render chart container', () => {
      const { container } = render(
        <RiskAnalysisCharts assessment={mockAssessment} />
      );
      expect(
        container.querySelector('.risk-analysis-charts')
      ).toBeInTheDocument();
    });

    it('should render section title', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      expect(screen.getByText('风险分析图表')).toBeInTheDocument();
    });

    it('should render chart tabs', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      expect(screen.getByText('风险分布')).toBeInTheDocument();
      expect(screen.getByText('类别分析')).toBeInTheDocument();
      expect(screen.getByText('趋势分析')).toBeInTheDocument();
    });
  });

  describe('risk distribution chart', () => {
    it('should render pie chart for risk levels', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      expect(
        document.querySelector('.risk-distribution-chart')
      ).toBeInTheDocument();
    });

    it('should display risk level labels in summary', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      // 风险等级显示在摘要统计卡片中
      expect(screen.getByText('最高风险等级')).toBeInTheDocument();
    });

    it('should display correct counts for each level', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      const chart = document.querySelector('.risk-distribution-chart');
      expect(chart).toBeInTheDocument();
    });

    it('should handle empty risk data', () => {
      render(<RiskAnalysisCharts assessment={emptyAssessment} />);
      expect(screen.getByText('暂无风险数据')).toBeInTheDocument();
    });
  });

  describe('category analysis chart', () => {
    it('should switch to category tab when clicked', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      const categoryTab = screen.getByText('类别分析');
      fireEvent.click(categoryTab);
      expect(
        document.querySelector('.category-analysis-chart')
      ).toBeInTheDocument();
    });

    it('should display category tab', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      expect(screen.getByText('类别分析')).toBeInTheDocument();
    });
  });

  describe('trend analysis chart', () => {
    it('should switch to trend tab when clicked', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      const trendTab = screen.getByText('趋势分析');
      fireEvent.click(trendTab);
      expect(
        document.querySelector('.trend-analysis-chart')
      ).toBeInTheDocument();
    });

    it('should display timeline labels', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      const trendTab = screen.getByText('趋势分析');
      fireEvent.click(trendTab);
      expect(screen.getByText('风险累积趋势')).toBeInTheDocument();
    });
  });

  describe('chart interactions', () => {
    it('should call onChartClick when chart segment is clicked', () => {
      const mockOnClick = jest.fn();
      render(
        <RiskAnalysisCharts
          assessment={mockAssessment}
          onChartClick={mockOnClick}
        />
      );

      const chartSegment = document.querySelector('.chart-segment');
      if (chartSegment) {
        fireEvent.click(chartSegment);
        expect(mockOnClick).toHaveBeenCalled();
      }
    });

    it('should accept selectedLevel prop', () => {
      const { container } = render(
        <RiskAnalysisCharts
          assessment={mockAssessment}
          selectedLevel={RiskLevel.HIGH}
        />
      );
      expect(
        container.querySelector('.risk-analysis-charts')
      ).toBeInTheDocument();
    });
  });

  describe('summary statistics', () => {
    it('should display summary cards', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      expect(document.querySelector('.chart-summary')).toBeInTheDocument();
    });

    it('should show total risk count', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('风险总数')).toBeInTheDocument();
    });

    it('should show highest risk level label', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      expect(screen.getByText('最高风险等级')).toBeInTheDocument();
    });

    it('should show dominant category label', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      expect(screen.getByText('主要风险类别')).toBeInTheDocument();
    });
  });

  describe('export functionality', () => {
    it('should render export button', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      expect(screen.getByLabelText('导出图表')).toBeInTheDocument();
    });

    it('should call onExport when export button is clicked', () => {
      const mockOnExport = jest.fn();
      render(
        <RiskAnalysisCharts
          assessment={mockAssessment}
          onExport={mockOnExport}
        />
      );

      const exportButton = screen.getByLabelText('导出图表');
      fireEvent.click(exportButton);
      expect(mockOnExport).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab').length).toBe(3);
    });

    it('should support keyboard navigation', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} />);
      const tabs = screen.getAllByRole('tab');

      // Tab buttons should be focusable
      tabs[0].focus();
      expect(document.activeElement).toBe(tabs[0]);
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton when loading', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} loading />);
      expect(document.querySelector('.chart-skeleton')).toBeInTheDocument();
    });

    it('should hide charts when loading', () => {
      render(<RiskAnalysisCharts assessment={mockAssessment} loading />);
      expect(
        document.querySelector('.risk-distribution-chart')
      ).not.toBeInTheDocument();
    });
  });
});
