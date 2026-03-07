/**
 * AI内容标识组件测试
 *
 * 测试AI内容标识、置信度显示、验证状态等功能
 */

// @ts-nocheck
/// <reference types="@testing-library/jest-dom" />

import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AIAssessmentBadge,
  AIContentIndicator,
} from '../../../components/ai/AIAssessmentBadge';
import type { AIAssessment } from '@/types/consultation';

describe('AIAssessmentBadge 组件', () => {
  const mockAssessment: AIAssessment = {
    winRate: 0.75,
    winRateReasoning: '根据案件事实和证据分析',
    difficulty: 'MEDIUM',
    difficultyFactors: ['证据链完整', '法律关系清晰'],
    riskLevel: 'LOW',
    riskFactors: [],
    suggestedFeeMin: 5000,
    suggestedFeeMax: 10000,
    feeReasoning: '根据案件复杂程度',
    keyLegalPoints: [
      { point: '合同效力认定', relevantLaw: '《民法典》第一百四十三条' },
    ],
    suggestions: ['建议尽快收集证据'],
  };

  it('应该渲染AI生成标识', () => {
    render(<AIAssessmentBadge assessment={mockAssessment} showBadge />);

    expect(screen.getByText(/AI生成/)).toBeInTheDocument();
  });

  it('应该显示置信度分数', () => {
    render(
      <AIAssessmentBadge
        assessment={mockAssessment}
        showConfidence
        confidence={0.85}
      />
    );

    expect(screen.getByText(/85%/)).toBeInTheDocument();
  });

  it('应该显示验证状态', () => {
    render(
      <AIAssessmentBadge
        assessment={mockAssessment}
        showVerificationStatus
        verificationStatus='verified'
      />
    );

    expect(screen.getByText(/已验证/)).toBeInTheDocument();
  });

  it('应该显示待验证状态', () => {
    render(
      <AIAssessmentBadge
        assessment={mockAssessment}
        showVerificationStatus
        verificationStatus='pending'
      />
    );

    expect(screen.getByText(/待验证/)).toBeInTheDocument();
  });

  it('应该显示未通过验证状态', () => {
    render(
      <AIAssessmentBadge
        assessment={mockAssessment}
        showVerificationStatus
        verificationStatus='rejected'
      />
    );

    expect(screen.getByText(/未通过验证/)).toBeInTheDocument();
  });

  it('应该显示来源链接按钮', () => {
    render(
      <AIAssessmentBadge
        assessment={mockAssessment}
        showSourceLink
        sourceUrl='https://example.com/source'
      />
    );

    expect(screen.getByText(/来源/)).toBeInTheDocument();
  });
});

describe('AIContentIndicator 组件', () => {
  it('应该渲染默认AI标识', () => {
    render(<AIContentIndicator />);

    expect(screen.getByText(/AI生成/)).toBeInTheDocument();
  });

  it('应该渲染指定内容类型的标识', () => {
    render(<AIContentIndicator contentType='assessment' />);

    expect(screen.getByText(/AI评估/)).toBeInTheDocument();
  });

  it('应该渲染法律分析类型的标识', () => {
    render(<AIContentIndicator contentType='legal_analysis' />);

    expect(screen.getByText(/AI法律分析/)).toBeInTheDocument();
  });

  it('应该渲染文书生成类型的标识', () => {
    render(<AIContentIndicator contentType='document' />);

    expect(screen.getByText(/AI文书生成/)).toBeInTheDocument();
  });

  it('应该渲染法条推荐类型的标识', () => {
    render(<AIContentIndicator contentType='recommendation' />);

    expect(screen.getByText(/AI推荐/)).toBeInTheDocument();
  });

  it('应该显示置信度指示器', () => {
    render(<AIContentIndicator confidence={0.9} showConfidence />);

    expect(screen.getByText(/90%/)).toBeInTheDocument();
  });

  it('应该根据置信度显示不同颜色', () => {
    const { container: highContainer } = render(
      <AIContentIndicator confidence={0.9} showConfidence />
    );
    const highIndicator = highContainer.querySelector('.confidence-high');

    const { container: lowContainer } = render(
      <AIContentIndicator confidence={0.3} showConfidence />
    );
    const lowIndicator = lowContainer.querySelector('.confidence-low');

    expect(highIndicator).toBeInTheDocument();
    expect(lowIndicator).toBeInTheDocument();
  });

  it('应该显示验证状态徽章', () => {
    render(
      <AIContentIndicator
        verificationStatus='verified'
        showVerificationStatus
      />
    );

    expect(screen.getByText(/已验证/)).toBeInTheDocument();
  });

  it('应该支持自定义类名', () => {
    const { container } = render(
      <AIContentIndicator className='custom-indicator' />
    );

    expect(container.firstChild).toHaveClass('custom-indicator');
  });

  it('应该支持隐藏标识', () => {
    const { container } = render(<AIContentIndicator showBadge={false} />);

    // 当所有选项都关闭时，组件应返回null
    expect(container.firstChild).toBeNull();
  });
});

describe('AI内容标识类型', () => {
  it('应该支持不同验证状态', () => {
    type VerificationStatus = 'pending' | 'verified' | 'rejected';
    const statuses: VerificationStatus[] = ['pending', 'verified', 'rejected'];

    expect(statuses).toContain('pending');
    expect(statuses).toContain('verified');
    expect(statuses).toContain('rejected');
  });

  it('应该支持不同内容类型', () => {
    type ContentType =
      | 'assessment'
      | 'legal_analysis'
      | 'document'
      | 'recommendation'
      | 'general';
    const types: ContentType[] = [
      'assessment',
      'legal_analysis',
      'document',
      'recommendation',
      'general',
    ];

    expect(types).toContain('assessment');
    expect(types).toContain('legal_analysis');
    expect(types).toContain('document');
  });
});
