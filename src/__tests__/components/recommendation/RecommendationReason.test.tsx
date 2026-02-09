/**
 * 推荐原因组件测试
 * 测试覆盖率目标：90%+
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecommendationReason } from '@/components/recommendation/RecommendationReason';

describe('RecommendationReason', () => {
  describe('基本渲染', () => {
    it('应该正确渲染推荐原因文本', () => {
      render(<RecommendationReason reason='该法条与案件类型匹配' />);

      expect(screen.getByText('该法条与案件类型匹配')).toBeInTheDocument();
    });

    it('应该显示推荐分数', () => {
      render(<RecommendationReason reason='相关法条' score={0.85} />);

      expect(screen.getByText(/85%|0\.85/)).toBeInTheDocument();
    });

    it('应该显示关系类型', () => {
      render(
        <RecommendationReason
          reason='相关法条'
          relationType='CITES'
          showRelationType={true}
        />
      );

      expect(screen.getByText('引用')).toBeInTheDocument();
    });

    it('应该显示详细信息', () => {
      render(
        <RecommendationReason
          reason='相关法条'
          details={['关键词匹配: 违约责任', '案件类型匹配']}
          showDetails={true}
        />
      );

      expect(screen.getByText('关键词匹配: 违约责任')).toBeInTheDocument();
      expect(screen.getByText('案件类型匹配')).toBeInTheDocument();
    });
  });

  describe('显示选项控制', () => {
    it('当showScore为false时不应该显示分数', () => {
      render(
        <RecommendationReason
          reason='相关法条'
          score={0.85}
          showScore={false}
        />
      );

      expect(screen.queryByText(/85%|0\.85/)).not.toBeInTheDocument();
    });

    it('当showRelationType为false时不应该显示关系类型', () => {
      render(
        <RecommendationReason
          reason='相关法条'
          relationType='CITES'
          showRelationType={false}
        />
      );

      expect(screen.queryByText('引用')).not.toBeInTheDocument();
    });

    it('当showDetails为false时不应该显示详细信息', () => {
      render(
        <RecommendationReason
          reason='相关法条'
          details={['关键词匹配: 违约责任']}
          showDetails={false}
        />
      );

      expect(
        screen.queryByText('关键词匹配: 违约责任')
      ).not.toBeInTheDocument();
    });

    it('紧凑模式应该应用正确的样式', () => {
      const { container } = render(
        <RecommendationReason reason='相关法条' compact={true} />
      );

      const element = container.firstChild as HTMLElement;
      expect(element).toHaveClass('compact');
    });
  });

  describe('边界情况', () => {
    it('应该处理空原因文本', () => {
      render(<RecommendationReason reason='' />);

      expect(screen.queryByText(/.+/)).not.toBeInTheDocument();
    });

    it('应该处理缺少分数的情况', () => {
      render(<RecommendationReason reason='相关法条' showScore={true} />);

      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('应该处理缺少关系类型的情况', () => {
      const { container } = render(
        <RecommendationReason reason='相关法条' showRelationType={true} />
      );

      const relationElement = container.querySelector('[data-relation-type]');
      expect(relationElement).not.toBeInTheDocument();
    });

    it('应该处理空详细信息数组', () => {
      render(
        <RecommendationReason
          reason='相关法条'
          details={[]}
          showDetails={true}
        />
      );

      const detailsList = screen.queryByRole('list');
      expect(detailsList).not.toBeInTheDocument();
    });

    it('应该处理缺少详细信息的情况', () => {
      render(<RecommendationReason reason='相关法条' showDetails={true} />);

      const detailsList = screen.queryByRole('list');
      expect(detailsList).not.toBeInTheDocument();
    });

    it('应该处理分数为0的情况', () => {
      render(<RecommendationReason reason='相关法条' score={0} />);

      expect(screen.getByText(/0%|0\.0/)).toBeInTheDocument();
    });

    it('应该处理分数为1的情况', () => {
      render(<RecommendationReason reason='相关法条' score={1} />);

      expect(screen.getByText(/100%|1\.0/)).toBeInTheDocument();
    });

    it('应该处理长文本原因', () => {
      const longReason =
        '该法条与案件类型高度匹配，关键词重叠度达到85%，包括违约责任、合同义务、赔偿损失等核心概念，同时该法条在相关案例中被频繁引用，具有很高的参考价值。';

      render(<RecommendationReason reason={longReason} />);

      expect(screen.getByText(longReason)).toBeInTheDocument();
    });
  });

  describe('样式和布局', () => {
    it('应该根据分数应用不同的样式', () => {
      const { container: highScoreContainer } = render(
        <RecommendationReason reason='相关法条' score={0.9} />
      );

      const { container: lowScoreContainer } = render(
        <RecommendationReason reason='相关法条' score={0.3} />
      );

      const highScoreElement = highScoreContainer.querySelector('[data-score]');
      const lowScoreElement = lowScoreContainer.querySelector('[data-score]');

      expect(highScoreElement).toHaveClass('high-score');
      expect(lowScoreElement).toHaveClass('low-score');
    });

    it('应该为不同的关系类型应用不同的样式', () => {
      const { container } = render(
        <RecommendationReason
          reason='相关法条'
          relationType='CITES'
          showRelationType={true}
        />
      );

      const relationElement = container.querySelector('[data-relation-type]');
      expect(relationElement).toHaveAttribute('data-relation-type', 'CITES');
    });

    it('应该为详细信息列表应用正确的样式', () => {
      const { container } = render(
        <RecommendationReason
          reason='相关法条'
          details={['关键词匹配', '案件类型匹配']}
          showDetails={true}
        />
      );

      const detailsList = container.querySelector('.details-list');
      expect(detailsList).toBeInTheDocument();
      expect(detailsList?.children).toHaveLength(2);
    });
  });

  describe('关系类型映射', () => {
    const relationTypes = [
      { type: 'CITES', label: '引用' },
      { type: 'CITED_BY', label: '被引用' },
      { type: 'CONFLICTS', label: '冲突' },
      { type: 'COMPLETES', label: '补充' },
      { type: 'COMPLETED_BY', label: '被补充' },
      { type: 'SUPERSEDES', label: '替代' },
      { type: 'SUPERSEDED_BY', label: '被替代' },
      { type: 'IMPLEMENTS', label: '实施' },
      { type: 'IMPLEMENTED_BY', label: '被实施' },
      { type: 'RELATED', label: '相关' },
    ];

    relationTypes.forEach(({ type, label }) => {
      it(`应该正确显示关系类型 ${type} 为 ${label}`, () => {
        render(
          <RecommendationReason
            reason='相关法条'
            relationType={type}
            showRelationType={true}
          />
        );

        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe('多详细信息项', () => {
    it('应该正确渲染多个详细信息项', () => {
      const details = [
        '关键词匹配: 违约责任、合同义务',
        '案件类型匹配: 民事',
        '相似度: 85%',
        '引用次数: 120次',
      ];

      render(
        <RecommendationReason
          reason='相关法条'
          details={details}
          showDetails={true}
        />
      );

      details.forEach(detail => {
        expect(screen.getByText(detail)).toBeInTheDocument();
      });
    });

    it('应该为每个详细信息项应用正确的样式', () => {
      const details = ['关键词匹配', '案件类型匹配'];

      const { container } = render(
        <RecommendationReason
          reason='相关法条'
          details={details}
          showDetails={true}
        />
      );

      const detailItems = container.querySelectorAll('.detail-item');
      expect(detailItems).toHaveLength(2);
    });
  });
});
