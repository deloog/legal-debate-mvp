/**
 * SimilarCasesViewer 组件测试
 * 测试相似案例查看器组件的渲染、排序、显示等功能
 */

import React from 'react';
import { render, screen, _fireEvent } from '@testing-library/react';
import { SimilarCasesViewer } from '../../../components/case/SimilarCasesViewer';
import type {
  SimilaritySearchResult,
  SimilarCaseMatch,
} from '../../../types/case-example';
import { CaseResult, CaseType } from '@prisma/client';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('SimilarCasesViewer', () => {
  const mockCaseId = 'test-case-123';

  const createMockMatch = (
    similarity: number,
    result: CaseResult,
    type: CaseType,
    daysOffset = 0
  ): SimilarCaseMatch => ({
    caseExample: {
      id: `case-${Math.random()}`,
      title: '测试案例',
      caseNumber: '(2024)京01民初字第001号',
      court: '北京市朝阳区人民法院',
      type,
      cause: '合同纠纷',
      facts: '这是一个测试案例的事实描述，用于验证相似案例显示功能。',
      judgment: '判决结果如下...',
      result,
      judgmentDate: new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000),
      embedding: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      dataSource: 'cail',
      sourceId: null,
      importedAt: null,
    },
    similarity,
    matchingFactors: ['案由相似', '标的物相似'],
  });

  const createMockSearchResult = (
    matchCount: number,
    searchTime = 100
  ): SimilaritySearchResult => ({
    caseId: mockCaseId,
    matches: [
      createMockMatch(0.95, CaseResult.WIN, CaseType.CIVIL, 0),
      createMockMatch(0.85, CaseResult.LOSE, CaseType.CIVIL, -10),
      createMockMatch(0.75, CaseResult.PARTIAL, CaseType.COMMERCIAL, -20),
      createMockMatch(0.65, CaseResult.WITHDRAW, CaseType.CRIMINAL, -30),
      createMockMatch(0.55, CaseResult.WIN, CaseType.LABOR, -40),
    ].slice(0, matchCount),
    totalMatches: matchCount,
    searchTime,
    metadata: {
      algorithm: 'cosine',
      vectorDimension: 1536,
      casesSearched: 1000,
    },
  });

  describe('基础渲染', () => {
    it('应该正确渲染相似案例列表', () => {
      const mockResult = createMockSearchResult(3);

      render(
        <SimilarCasesViewer
          searchResult={mockResult}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('相似案例（3）')).toBeInTheDocument();
      expect(screen.getByText('按相似度排序')).toBeInTheDocument();
      expect(screen.getByText('按日期排序')).toBeInTheDocument();
    });

    it('应该显示所有相似案例的标题', () => {
      const mockResult = createMockSearchResult(3);

      render(
        <SimilarCasesViewer
          searchResult={mockResult}
          loading={false}
          error={null}
        />
      );

      const titles = screen.getAllByText('测试案例');
      expect(titles.length).toBeGreaterThan(0);
    });

    it('应该显示相似度评分', () => {
      const mockResult = createMockSearchResult(3);

      render(
        <SimilarCasesViewer
          searchResult={mockResult}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getAllByText('相似度').length).toBeGreaterThan(0);
    });

    it('应该显示案例类型标签', () => {
      const mockResult = createMockSearchResult(3);

      render(
        <SimilarCasesViewer
          searchResult={mockResult}
          loading={false}
          error={null}
        />
      );

      expect(screen.getAllByText('民事').length).toBeGreaterThan(0);
      expect(screen.getAllByText('商事').length).toBeGreaterThan(0);
    });

    it('应该显示案例结果标签', () => {
      const mockResult = createMockSearchResult(3);

      render(
        <SimilarCasesViewer
          searchResult={mockResult}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('胜诉')).toBeInTheDocument();
      expect(screen.getByText('败诉')).toBeInTheDocument();
      expect(screen.getByText('部分胜诉')).toBeInTheDocument();
    });
  });

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      render(
        <SimilarCasesViewer searchResult={null} loading={true} error={null} />
      );

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  describe('错误状态', () => {
    it('应该显示错误信息', () => {
      const errorMessage = '检索相似案例失败';

      render(
        <SimilarCasesViewer
          searchResult={null}
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
      const emptyResult: SimilaritySearchResult = {
        caseId: mockCaseId,
        matches: [],
        totalMatches: 0,
        searchTime: 50,
      };

      render(
        <SimilarCasesViewer
          searchResult={emptyResult}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('暂无相似案例')).toBeInTheDocument();
      expect(screen.getByText('请先执行相似案例检索')).toBeInTheDocument();
    });

    it('searchResult为null时应该显示空状态', () => {
      render(
        <SimilarCasesViewer searchResult={null} loading={false} error={null} />
      );

      expect(screen.getByText('暂无相似案例')).toBeInTheDocument();
      expect(screen.getByText('🔍')).toBeInTheDocument();
    });
  });
});
