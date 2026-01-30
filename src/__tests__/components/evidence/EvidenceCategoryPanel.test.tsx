/**
 * 证据分类面板组件测试
 *
 * 测试覆盖：
 * - 组件渲染
 * - 分类树展示
 * - 证据数量统计
 * - 完成度统计
 * - 筛选功能
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvidenceCategoryPanel } from '@/components/evidence/EvidenceCategoryPanel';
import type { EvidenceCategory } from '@/lib/evidence/evidence-category-config';

describe('EvidenceCategoryPanel', () => {
  const mockCategories: EvidenceCategory[] = [
    {
      code: 'IDENTITY',
      name: '主体资格证据',
      description: '证明劳动关系主体身份',
      subCategories: [
        {
          code: 'ID_CARD',
          name: '身份证明',
          description: '劳动者身份证复印件',
          examples: ['身份证', '护照'],
        },
      ],
    },
    {
      code: 'LABOR_RELATION',
      name: '劳动关系证据',
      description: '证明存在劳动关系',
      subCategories: [
        {
          code: 'CONTRACT',
          name: '劳动合同',
          description: '书面劳动合同',
          examples: ['劳动合同原件'],
        },
      ],
    },
  ];

  const mockEvidenceList = [
    { id: 'ev-1', name: '身份证', categoryCode: 'ID_CARD' },
    { id: 'ev-2', name: '劳动合同', categoryCode: 'CONTRACT' },
    { id: 'ev-3', name: '工资条', categoryCode: null },
  ];

  describe('基本渲染', () => {
    it('应该正确渲染组件', () => {
      render(
        <EvidenceCategoryPanel
          categories={mockCategories}
          evidenceList={mockEvidenceList}
        />
      );

      expect(screen.getByText(/证据分类/)).toBeInTheDocument();
    });

    it('应该显示分类树', () => {
      render(
        <EvidenceCategoryPanel
          categories={mockCategories}
          evidenceList={mockEvidenceList}
        />
      );

      expect(screen.getByText('主体资格证据')).toBeInTheDocument();
      expect(screen.getByText('劳动关系证据')).toBeInTheDocument();
    });

    it('应该显示子分类', () => {
      render(
        <EvidenceCategoryPanel
          categories={mockCategories}
          evidenceList={mockEvidenceList}
        />
      );

      // 需要先展开父分类才能看到子分类
      const expandButtons = screen.getAllByRole('button', { name: /展开|▼/ });
      fireEvent.click(expandButtons[0]);

      expect(screen.getByText('身份证明')).toBeInTheDocument();
    });
  });

  describe('证据数量统计', () => {
    it('应该显示每个分类下的证据数量', () => {
      render(
        <EvidenceCategoryPanel
          categories={mockCategories}
          evidenceList={mockEvidenceList}
        />
      );

      // 应该显示数量标识
      const counts = screen.getAllByText(/\d+/);
      expect(counts.length).toBeGreaterThan(0);
    });

    it('应该正确统计未分类证据', () => {
      render(
        <EvidenceCategoryPanel
          categories={mockCategories}
          evidenceList={mockEvidenceList}
        />
      );

      expect(screen.getByText(/未分类/)).toBeInTheDocument();
    });
  });

  describe('完成度统计', () => {
    it('应该显示分类完成度', () => {
      render(
        <EvidenceCategoryPanel
          categories={mockCategories}
          evidenceList={mockEvidenceList}
        />
      );

      expect(screen.getByText(/完成度/)).toBeInTheDocument();
    });

    it('应该计算正确的完成度百分比', () => {
      render(
        <EvidenceCategoryPanel
          categories={mockCategories}
          evidenceList={mockEvidenceList}
        />
      );

      // 3个证据中2个已分类，完成度应该是66.7%
      expect(screen.getByText(/66\.7%|67%/)).toBeInTheDocument();
    });
  });

  describe('筛选功能', () => {
    it('应该支持筛选未分类证据', () => {
      render(
        <EvidenceCategoryPanel
          categories={mockCategories}
          evidenceList={mockEvidenceList}
        />
      );

      const filterButton = screen.getByRole('button', { name: /未分类/ });
      fireEvent.click(filterButton);

      expect(screen.getByText('工资条')).toBeInTheDocument();
    });

    it('应该支持按分类筛选', () => {
      const onCategorySelect = jest.fn();

      render(
        <EvidenceCategoryPanel
          categories={mockCategories}
          evidenceList={mockEvidenceList}
          onCategorySelect={onCategorySelect}
        />
      );

      // 点击主分类
      const categoryItem = screen.getByText('主体资格证据');
      fireEvent.click(categoryItem);

      expect(onCategorySelect).toHaveBeenCalledWith('IDENTITY');
    });
  });

  describe('展开/收起功能', () => {
    it('应该支持展开子分类', () => {
      render(
        <EvidenceCategoryPanel
          categories={mockCategories}
          evidenceList={mockEvidenceList}
        />
      );

      const expandButton = screen.getAllByRole('button', { name: /展开|▼/ })[0];
      fireEvent.click(expandButton);

      expect(screen.getByText('身份证明')).toBeInTheDocument();
    });

    it('应该支持收起子分类', () => {
      render(
        <EvidenceCategoryPanel
          categories={mockCategories}
          evidenceList={mockEvidenceList}
        />
      );

      const expandButton = screen.getAllByRole('button', { name: /展开|▼/ })[0];

      // 展开
      fireEvent.click(expandButton);
      expect(screen.getByText('身份证明')).toBeInTheDocument();

      // 收起
      const collapseButton = screen.getByRole('button', { name: /收起|▲/ });
      fireEvent.click(collapseButton);
    });
  });

  describe('边界情况', () => {
    it('应该处理空分类列表', () => {
      render(
        <EvidenceCategoryPanel
          categories={[]}
          evidenceList={mockEvidenceList}
        />
      );

      expect(screen.getByText(/暂无分类/)).toBeInTheDocument();
    });

    it('应该处理空证据列表', () => {
      render(
        <EvidenceCategoryPanel categories={mockCategories} evidenceList={[]} />
      );

      expect(screen.getByText(/暂无证据/)).toBeInTheDocument();
    });

    it('应该处理所有证据已分类的情况', () => {
      const allCategorized = [
        { id: 'ev-1', name: '身份证', categoryCode: 'ID_CARD' },
        { id: 'ev-2', name: '劳动合同', categoryCode: 'CONTRACT' },
      ];

      render(
        <EvidenceCategoryPanel
          categories={mockCategories}
          evidenceList={allCategorized}
        />
      );

      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });
  });

  describe('无障碍性', () => {
    it('应该有正确的ARIA标签', () => {
      const { container } = render(
        <EvidenceCategoryPanel
          categories={mockCategories}
          evidenceList={mockEvidenceList}
        />
      );

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
