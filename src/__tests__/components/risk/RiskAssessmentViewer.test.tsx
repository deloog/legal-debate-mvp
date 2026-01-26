/**
 * RiskAssessmentViewer组件测试
 *
 * 测试覆盖率目标：>90%
 * 测试通过率目标：100%
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RiskAssessmentViewer } from '@/components/risk/RiskAssessmentViewer';
import type {
  RiskAssessmentResult,
  RiskIdentificationResult,
  RiskMitigationSuggestion,
} from '@/types/risk';
import {
  RiskType,
  RiskLevel,
  RiskCategory,
  MitigationSuggestionType,
  SuggestionPriority,
} from '@/types/risk';

// =============================================================================
// Mock数据
// =============================================================================

/**
 * 创建mock风险识别结果
 */
function createMockRisk(
  overrides: Partial<RiskIdentificationResult> = {}
): RiskIdentificationResult {
  return {
    id: `risk_${Date.now()}`,
    riskType: RiskType.EVIDENCE_STRENGTH,
    riskCategory: RiskCategory.EVIDENTIARY,
    riskLevel: RiskLevel.HIGH,
    score: 0.75,
    confidence: 0.85,
    description: '证据强度不足，缺乏关键支持材料',
    evidence: ['证人证言缺失', '物证数量不足'],
    suggestions: [],
    identifiedAt: new Date('2026-01-26T09:00:00.000Z'),
    ...overrides,
  };
}

/**
 * 创建mock风险缓解建议
 */
function createMockSuggestion(
  overrides: Partial<RiskMitigationSuggestion> = {}
): RiskMitigationSuggestion {
  return {
    id: `suggestion_${Date.now()}`,
    riskType: RiskType.EVIDENCE_STRENGTH,
    suggestionType: MitigationSuggestionType.GATHER_EVIDENCE,
    priority: SuggestionPriority.URGENT,
    action: '收集补充证据材料',
    reason: '当前证据不足以支撑主张',
    estimatedImpact: '显著提升胜诉概率',
    estimatedEffort: '2-3天',
    ...overrides,
  };
}

/**
 * 创建mock风险评估结果
 */
function createMockAssessment(
  overrides: Partial<RiskAssessmentResult> = {}
): RiskAssessmentResult {
  return {
    caseId: 'case_123',
    overallRiskLevel: RiskLevel.HIGH,
    overallRiskScore: 0.68,
    risks: [
      createMockRisk({
        id: 'risk_1',
        riskType: RiskType.EVIDENCE_STRENGTH,
        riskLevel: RiskLevel.CRITICAL,
        score: 0.9,
        confidence: 0.9,
      }),
      createMockRisk({
        id: 'risk_2',
        riskType: RiskType.STATUTE_LIMITATION,
        riskLevel: RiskLevel.HIGH,
        score: 0.75,
        confidence: 0.8,
      }),
      createMockRisk({
        id: 'risk_3',
        riskType: RiskType.LEGAL_PROCEDURE,
        riskLevel: RiskLevel.MEDIUM,
        score: 0.55,
        confidence: 0.7,
      }),
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
    suggestions: [
      createMockSuggestion({
        id: 'suggestion_1',
        suggestionType: MitigationSuggestionType.GATHER_EVIDENCE,
        priority: SuggestionPriority.URGENT,
      }),
      createMockSuggestion({
        id: 'suggestion_2',
        suggestionType: MitigationSuggestionType.AMEND_CLAIM,
        priority: SuggestionPriority.HIGH,
      }),
    ],
    assessmentTime: 150,
    assessedAt: new Date('2026-01-26T09:00:00.000Z'),
    ...overrides,
  };
}

/**
 * 创建无风险的mock评估结果
 */
function createNoRiskAssessment(): RiskAssessmentResult {
  return createMockAssessment({
    overallRiskLevel: RiskLevel.LOW,
    overallRiskScore: 0.15,
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
    suggestions: [],
  });
}

/**
 * 创建多高风险的mock评估结果
 */
function createManyHighRisksAssessment(): RiskAssessmentResult {
  const highRisks = Array.from({ length: 5 }, (_, i) =>
    createMockRisk({
      id: `risk_high_${i}`,
      riskLevel: RiskLevel.HIGH,
      score: 0.75,
      confidence: 0.8,
    })
  );

  const criticalRisks = Array.from({ length: 2 }, (_, i) =>
    createMockRisk({
      id: `risk_critical_${i}`,
      riskLevel: RiskLevel.CRITICAL,
      score: 0.9,
      confidence: 0.9,
    })
  );

  return createMockAssessment({
    overallRiskLevel: RiskLevel.CRITICAL,
    overallRiskScore: 0.85,
    risks: [...criticalRisks, ...highRisks],
    statistics: {
      totalRisks: 7,
      byLevel: {
        [RiskLevel.LOW]: 0,
        [RiskLevel.MEDIUM]: 0,
        [RiskLevel.HIGH]: 5,
        [RiskLevel.CRITICAL]: 2,
      },
      byCategory: {
        [RiskCategory.PROCEDURAL]: 3,
        [RiskCategory.EVIDENTIARY]: 2,
        [RiskCategory.SUBSTANTIVE]: 2,
        [RiskCategory.STRATEGIC]: 0,
      },
      byType: {
        [RiskType.LEGAL_PROCEDURE]: 2,
        [RiskType.EVIDENCE_STRENGTH]: 2,
        [RiskType.STATUTE_LIMITATION]: 1,
        [RiskType.JURISDICTION]: 1,
        [RiskType.COST_BENEFIT]: 1,
        [RiskType.FACT_VERIFICATION]: 0,
        [RiskType.LEGAL_BASIS]: 0,
        [RiskType.CONTRADICTION]: 0,
        [RiskType.PROOF_BURDEN]: 0,
      },
      criticalRisks: 2,
      highRisks: 5,
      mediumRisks: 0,
      lowRisks: 0,
    },
  });
}

/**
 * 创建低置信度的mock评估结果
 */
function createLowConfidenceAssessment(): RiskAssessmentResult {
  return createMockAssessment({
    overallRiskLevel: RiskLevel.MEDIUM,
    overallRiskScore: 0.5,
    risks: [
      createMockRisk({
        id: 'risk_low_confidence',
        confidence: 0.5,
        score: 0.6,
        riskLevel: RiskLevel.MEDIUM,
      }),
    ],
    statistics: {
      totalRisks: 1,
      byLevel: {
        [RiskLevel.LOW]: 0,
        [RiskLevel.MEDIUM]: 1,
        [RiskLevel.HIGH]: 0,
        [RiskLevel.CRITICAL]: 0,
      },
      byCategory: {
        [RiskCategory.PROCEDURAL]: 0,
        [RiskCategory.EVIDENTIARY]: 0,
        [RiskCategory.SUBSTANTIVE]: 1,
        [RiskCategory.STRATEGIC]: 0,
      },
      byType: {
        [RiskType.LEGAL_PROCEDURE]: 0,
        [RiskType.EVIDENCE_STRENGTH]: 0,
        [RiskType.STATUTE_LIMITATION]: 0,
        [RiskType.JURISDICTION]: 0,
        [RiskType.COST_BENEFIT]: 0,
        [RiskType.FACT_VERIFICATION]: 1,
        [RiskType.LEGAL_BASIS]: 0,
        [RiskType.CONTRADICTION]: 0,
        [RiskType.PROOF_BURDEN]: 0,
      },
      criticalRisks: 0,
      highRisks: 0,
      mediumRisks: 1,
      lowRisks: 0,
    },
  });
}

// =============================================================================
// 测试套件
// =============================================================================

describe('RiskAssessmentViewer', () => {
  // -------------------------------------------------------------------------
  // 加载状态测试
  // -------------------------------------------------------------------------

  describe('加载状态', () => {
    it('应该显示加载状态', () => {
      const { container } = render(
        <RiskAssessmentViewer assessment={createMockAssessment()} loading />
      );

      // 验证加载占位符存在
      const loadingBlocks = container.querySelectorAll('.animate-pulse > div');
      expect(loadingBlocks.length).toBeGreaterThan(0);
    });

    it('应该在加载时隐藏其他内容', () => {
      const { queryByText } = render(
        <RiskAssessmentViewer assessment={createMockAssessment()} loading />
      );

      // 验证正常内容不显示
      expect(queryByText('整体风险')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 错误状态测试
  // -------------------------------------------------------------------------

  describe('错误状态', () => {
    const mockError = '加载风险评估失败，请重试';

    it('应该显示错误信息', () => {
      render(
        <RiskAssessmentViewer
          assessment={createMockAssessment()}
          error={mockError}
        />
      );

      // 验证错误信息显示
      expect(screen.getByText('加载失败')).toBeInTheDocument();
      expect(screen.getByText(mockError)).toBeInTheDocument();
    });

    it('应该显示重试按钮', () => {
      const onRefresh = jest.fn();
      render(
        <RiskAssessmentViewer
          assessment={createMockAssessment()}
          error={mockError}
          onRefresh={onRefresh}
        />
      );

      // 验证重试按钮存在
      const refreshButton = screen.getByText('重试');
      expect(refreshButton).toBeInTheDocument();

      // 测试重试功能
      fireEvent.click(refreshButton);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('应该在错误时隐藏其他内容', () => {
      const { queryByText } = render(
        <RiskAssessmentViewer
          assessment={createMockAssessment()}
          error={mockError}
        />
      );

      // 验证正常内容不显示
      expect(queryByText('整体风险')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 正常状态测试 - 无风险
  // -------------------------------------------------------------------------

  describe('无风险情况', () => {
    it('应该显示无风险提示', () => {
      render(<RiskAssessmentViewer assessment={createNoRiskAssessment()} />);

      // 验证无风险提示
      expect(screen.getByText('未发现明显风险')).toBeInTheDocument();
      expect(
        screen.getByText('该案件整体风险较低，可以继续推进')
      ).toBeInTheDocument();
    });

    it('应该隐藏风险列表', () => {
      const { queryByText } = render(
        <RiskAssessmentViewer assessment={createNoRiskAssessment()} />
      );

      // 验证风险列表不显示
      expect(queryByText('识别到的风险')).not.toBeInTheDocument();
    });

    it('应该隐藏建议列表', () => {
      const { queryByText } = render(
        <RiskAssessmentViewer assessment={createNoRiskAssessment()} />
      );

      // 验证建议列表不显示
      expect(queryByText('风险规避建议')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 正常状态测试 - 有风险
  // -------------------------------------------------------------------------

  describe('有风险情况', () => {
    const mockAssessment = createMockAssessment();

    it('应该显示风险概览卡片', () => {
      render(<RiskAssessmentViewer assessment={mockAssessment} />);

      // 验证风险概览
      expect(screen.getByText(/整体风险/)).toBeInTheDocument();
      expect(
        screen.getByText(/风险较高，建议制定应对策略/)
      ).toBeInTheDocument();
      expect(screen.getByText(/风险等级：/i)).toBeInTheDocument();
      expect(screen.getByText(/评分：68%/i)).toBeInTheDocument();
    });

    it('应该显示评估耗时', () => {
      render(<RiskAssessmentViewer assessment={mockAssessment} />);

      // 验证评估耗时
      expect(screen.getByText('评估耗时')).toBeInTheDocument();
      expect(screen.getByText('150ms')).toBeInTheDocument();
    });

    it('应该显示风险统计卡片', () => {
      render(<RiskAssessmentViewer assessment={mockAssessment} />);

      // 验证统计卡片
      expect(screen.getByText('严重风险')).toBeInTheDocument();
      expect(screen.getByText('高风险')).toBeInTheDocument();
      expect(screen.getByText('中风险')).toBeInTheDocument();
      expect(screen.getByText('低风险')).toBeInTheDocument();
    });

    it('应该正确显示风险数量', () => {
      render(<RiskAssessmentViewer assessment={mockAssessment} />);

      // 验证风险数量 - 使用getAllByText获取所有匹配的元素
      const allOnes = screen.getAllByText('1');
      expect(allOnes.length).toBeGreaterThanOrEqual(3); // 统计卡片中的数字
    });

    it('应该显示风险列表标题', () => {
      render(<RiskAssessmentViewer assessment={mockAssessment} />);

      // 验证风险列表标题
      expect(screen.getByText('识别到的风险')).toBeInTheDocument();
    });

    it('应该显示所有风险卡片', () => {
      render(<RiskAssessmentViewer assessment={mockAssessment} />);

      // 验证风险数量
      const riskCards = screen.getAllByText(/风险评分/i);
      expect(riskCards.length).toBe(3);
    });

    it('应该显示建议列表标题', () => {
      render(<RiskAssessmentViewer assessment={mockAssessment} />);

      // 验证建议列表标题
      expect(screen.getByText('风险规避建议')).toBeInTheDocument();
    });

    it('应该显示所有建议卡片', () => {
      render(<RiskAssessmentViewer assessment={mockAssessment} />);

      // 验证建议数量
      const suggestionCards = screen.getAllByText(/预期影响/i);
      expect(suggestionCards.length).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // 不同风险等级测试
  // -------------------------------------------------------------------------

  describe('不同风险等级', () => {
    it('应该显示低风险状态', () => {
      const lowRiskAssessment = createMockAssessment({
        overallRiskLevel: RiskLevel.LOW,
        overallRiskScore: 0.2,
      });

      render(<RiskAssessmentViewer assessment={lowRiskAssessment} />);

      // 验证低风险描述 - 使用正则匹配
      expect(
        screen.getByText(/整体风险较低，案件相对安全/)
      ).toBeInTheDocument();
      expect(screen.getByText(/评分：20%/i)).toBeInTheDocument();
    });

    it('应该显示中风险状态', () => {
      const mediumRiskAssessment = createMockAssessment({
        overallRiskLevel: RiskLevel.MEDIUM,
        overallRiskScore: 0.5,
      });

      render(<RiskAssessmentViewer assessment={mediumRiskAssessment} />);

      // 验证中风险描述 - 使用正则匹配
      expect(screen.getByText(/存在中等风险，需要关注/)).toBeInTheDocument();
      expect(screen.getByText(/评分：50%/i)).toBeInTheDocument();
    });

    it('应该显示高风险状态', () => {
      const highRiskAssessment = createMockAssessment({
        overallRiskLevel: RiskLevel.HIGH,
        overallRiskScore: 0.75,
      });

      render(<RiskAssessmentViewer assessment={highRiskAssessment} />);

      // 验证高风险描述 - 使用正则匹配
      expect(
        screen.getByText(/风险较高，建议制定应对策略/)
      ).toBeInTheDocument();
      expect(screen.getByText(/评分：75%/i)).toBeInTheDocument();
    });

    it('应该显示严重风险状态', () => {
      const criticalRiskAssessment = createMockAssessment({
        overallRiskLevel: RiskLevel.CRITICAL,
        overallRiskScore: 0.9,
      });

      render(<RiskAssessmentViewer assessment={criticalRiskAssessment} />);

      // 验证严重风险描述 - 使用正则匹配
      expect(
        screen.getByText(/严重风险，必须立即采取措施/)
      ).toBeInTheDocument();
      expect(screen.getByText(/评分：90%/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 数据质量提示测试
  // -------------------------------------------------------------------------

  describe('数据质量提示', () => {
    it('应该在无风险时显示定期更新提示', () => {
      render(<RiskAssessmentViewer assessment={createNoRiskAssessment()} />);

      // 验证数据质量提示 - 使用正则匹配
      expect(
        screen.getByText(/建议定期更新案件信息以保持评估的准确性/)
      ).toBeInTheDocument();
    });

    it('应该在多高风险时显示优先处理提示', () => {
      render(
        <RiskAssessmentViewer assessment={createManyHighRisksAssessment()} />
      );

      // 验证多高风险提示
      expect(
        screen.getByText('存在较多高风险因素，建议优先处理最严重的问题')
      ).toBeInTheDocument();
    });

    it('应该在低置信度时显示补充信息提示', () => {
      render(
        <RiskAssessmentViewer assessment={createLowConfidenceAssessment()} />
      );

      // 验证低置信度提示
      expect(
        screen.getByText(
          '部分风险评估的置信度较低，建议补充更多信息以提高准确性'
        )
      ).toBeInTheDocument();
    });

    it('应该在数据质量良好时显示积极提示', () => {
      const goodQualityAssessment = createMockAssessment({
        overallRiskLevel: RiskLevel.MEDIUM,
        overallRiskScore: 0.5,
        risks: [
          createMockRisk({
            confidence: 0.85,
            score: 0.5,
            riskLevel: RiskLevel.MEDIUM,
          }),
        ],
        statistics: {
          totalRisks: 1,
          byLevel: {
            [RiskLevel.LOW]: 0,
            [RiskLevel.MEDIUM]: 1,
            [RiskLevel.HIGH]: 0,
            [RiskLevel.CRITICAL]: 0,
          },
          byCategory: {
            [RiskCategory.PROCEDURAL]: 0,
            [RiskCategory.EVIDENTIARY]: 0,
            [RiskCategory.SUBSTANTIVE]: 1,
            [RiskCategory.STRATEGIC]: 0,
          },
          byType: {
            [RiskType.LEGAL_PROCEDURE]: 0,
            [RiskType.EVIDENCE_STRENGTH]: 0,
            [RiskType.STATUTE_LIMITATION]: 0,
            [RiskType.JURISDICTION]: 0,
            [RiskType.COST_BENEFIT]: 0,
            [RiskType.FACT_VERIFICATION]: 1,
            [RiskType.LEGAL_BASIS]: 0,
            [RiskType.CONTRADICTION]: 0,
            [RiskType.PROOF_BURDEN]: 0,
          },
          criticalRisks: 0,
          highRisks: 0,
          mediumRisks: 1,
          lowRisks: 0,
        },
      });

      render(<RiskAssessmentViewer assessment={goodQualityAssessment} />);

      // 验证良好数据质量提示
      expect(
        screen.getByText('评估数据质量良好，建议定期更新以保持时效性')
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 交互测试
  // -------------------------------------------------------------------------

  describe('交互功能', () => {
    it('应该在点击重试按钮时调用onRefresh', () => {
      const onRefresh = jest.fn();
      render(
        <RiskAssessmentViewer
          assessment={createMockAssessment()}
          error='错误'
          onRefresh={onRefresh}
        />
      );

      const refreshButton = screen.getByText('重试');
      fireEvent.click(refreshButton);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('应该正确响应props变化', () => {
      const { rerender } = render(
        <RiskAssessmentViewer assessment={createMockAssessment()} loading />
      );

      // 初始状态应为加载
      expect(screen.queryByText(/整体风险/)).not.toBeInTheDocument();

      // 更新props
      const updatedAssessment = createMockAssessment();
      rerender(
        <RiskAssessmentViewer assessment={updatedAssessment} loading={false} />
      );

      // 验证内容更新
      expect(screen.getByText(/整体风险/)).toBeInTheDocument();
      expect(screen.getByText(/评分：68%/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 边界条件测试
  // -------------------------------------------------------------------------

  describe('边界条件', () => {
    it('应该正确处理空风险数组', () => {
      const emptyRisksAssessment = createMockAssessment({
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
        suggestions: [],
      });

      render(<RiskAssessmentViewer assessment={emptyRisksAssessment} />);

      // 验证无风险状态
      expect(screen.getByText('未发现明显风险')).toBeInTheDocument();
    });

    it('应该正确处理最大风险数量', () => {
      const maxRisksAssessment = createManyHighRisksAssessment();

      render(<RiskAssessmentViewer assessment={maxRisksAssessment} />);

      // 验证风险统计
      const criticalCount = screen.getAllByText('2');
      const highCount = screen.getAllByText('5');
      expect(criticalCount.length).toBeGreaterThan(0);
      expect(highCount.length).toBeGreaterThan(0);
    });

    it('应该正确处理低置信度风险', () => {
      const lowConfidenceRisk = createMockRisk({
        confidence: 0.3,
        score: 0.5,
        riskLevel: RiskLevel.MEDIUM,
        riskCategory: RiskCategory.SUBSTANTIVE,
        riskType: RiskType.FACT_VERIFICATION,
      });

      const assessment = createMockAssessment({
        risks: [lowConfidenceRisk],
        overallRiskLevel: RiskLevel.MEDIUM,
        overallRiskScore: 0.5,
        suggestions: [],
        statistics: {
          totalRisks: 1,
          byLevel: {
            [RiskLevel.LOW]: 0,
            [RiskLevel.MEDIUM]: 1,
            [RiskLevel.HIGH]: 0,
            [RiskLevel.CRITICAL]: 0,
          },
          byCategory: {
            [RiskCategory.PROCEDURAL]: 0,
            [RiskCategory.EVIDENTIARY]: 0,
            [RiskCategory.SUBSTANTIVE]: 1,
            [RiskCategory.STRATEGIC]: 0,
          },
          byType: {
            [RiskType.LEGAL_PROCEDURE]: 0,
            [RiskType.EVIDENCE_STRENGTH]: 0,
            [RiskType.STATUTE_LIMITATION]: 0,
            [RiskType.JURISDICTION]: 0,
            [RiskType.COST_BENEFIT]: 0,
            [RiskType.FACT_VERIFICATION]: 1,
            [RiskType.LEGAL_BASIS]: 0,
            [RiskType.CONTRADICTION]: 0,
            [RiskType.PROOF_BURDEN]: 0,
          },
          criticalRisks: 0,
          highRisks: 0,
          mediumRisks: 1,
          lowRisks: 0,
        },
      });

      const { container } = render(
        <RiskAssessmentViewer assessment={assessment} />
      );

      // 验证低置信度风险显示
      // 置信度被分成多个元素，分别检查
      expect(screen.getByText(/置信度：/i)).toBeInTheDocument();
      expect(screen.getByText(/30%/)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 可访问性测试
  // -------------------------------------------------------------------------

  describe('可访问性', () => {
    it('应该有正确的语义化标签', () => {
      render(<RiskAssessmentViewer assessment={createMockAssessment()} />);

      // 验证关键元素存在
      expect(
        screen.getByRole('heading', { name: /整体风险/i })
      ).toBeInTheDocument();
    });

    it('按钮应该有可访问的文本', () => {
      const onRefresh = jest.fn();
      render(
        <RiskAssessmentViewer
          assessment={createMockAssessment()}
          error='错误'
          onRefresh={onRefresh}
        />
      );

      // 验证按钮文本
      const refreshButton = screen.getByRole('button', { name: /重试/i });
      expect(refreshButton).toBeInTheDocument();
    });
  });
});
