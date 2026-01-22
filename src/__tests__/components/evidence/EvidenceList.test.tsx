/**
 * EvidenceList 组件测试
 * 测试证据列表组件的渲染、筛选、分页、批量操作等功能
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EvidenceList } from '../../../components/evidence/EvidenceList';
import {
  EvidenceDetail,
  EvidenceType,
  EvidenceStatus,
  EvidenceListResponse,
} from '../../../types/evidence';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('EvidenceList - 基础功能', () => {
  const mockCaseId = 'test-case-123';
  const mockEvidence: EvidenceDetail[] = [
    {
      id: 'evidence-1',
      caseId: mockCaseId,
      type: EvidenceType.DOCUMENT,
      name: '合同书',
      description: '原被告签订的合同',
      fileUrl: 'https://example.com/contract.pdf',
      submitter: '张三',
      source: '原告',
      status: EvidenceStatus.ACCEPTED,
      relevanceScore: 0.9,
      metadata: null,
      createdAt: new Date('2024-01-15T09:00:00Z'),
      updatedAt: new Date('2024-01-15T09:00:00Z'),
      deletedAt: null,
    },
    {
      id: 'evidence-2',
      caseId: mockCaseId,
      type: EvidenceType.WITNESS,
      name: '证人证言',
      description: '目击证人的证言',
      fileUrl: null,
      submitter: '李四',
      source: '证人',
      status: EvidenceStatus.PENDING,
      relevanceScore: 0.7,
      metadata: null,
      createdAt: new Date('2024-01-20T10:00:00Z'),
      updatedAt: new Date('2024-01-20T10:00:00Z'),
      deletedAt: null,
    },
  ];

  const mockResponse: EvidenceListResponse = {
    evidence: mockEvidence,
    total: 2,
    caseId: mockCaseId,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('基础渲染', () => {
    it('应该正确渲染证据列表组件', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('证据列表')).toBeInTheDocument();
      });

      expect(screen.getByText('共 2 条证据')).toBeInTheDocument();
    });

    it('应该显示所有证据', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('合同书')).toBeInTheDocument();
        // 使用getAllByText，因为"证人证言"同时出现在筛选器和证据行中
        const witnessTexts = screen.getAllByText('证人证言');
        expect(witnessTexts.length).toBeGreaterThan(1);
      });
    });

    it('应该显示证据的类型、状态等信息', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('书证')).toBeInTheDocument();
        expect(screen.getByText('证人证言')).toBeInTheDocument();
        expect(screen.getByText('已采纳')).toBeInTheDocument();
        expect(screen.getByText('待审核')).toBeInTheDocument();
      });
    });

    it('应该在初始数据为空时显示空状态', async () => {
      const emptyResponse: EvidenceListResponse = {
        evidence: [],
        total: 0,
        caseId: mockCaseId,
        page: 1,
        limit: 20,
        totalPages: 0,
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: emptyResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('暂无证据')).toBeInTheDocument();
      });
    });
  });

  describe('筛选功能', () => {
    it('应该支持按类型筛选', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('证据列表')).toBeInTheDocument();
      });

      const typeSelects = screen.getAllByRole('combobox');
      const typeSelect = typeSelects[0];
      fireEvent.change(typeSelect, {
        target: { value: EvidenceType.DOCUMENT },
      });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`type=${EvidenceType.DOCUMENT}`),
          expect.any(Object)
        );
      });
    });

    it('应该支持按状态筛选', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('证据列表')).toBeInTheDocument();
      });

      const typeSelects = screen.getAllByRole('combobox');
      const statusSelect = typeSelects[1];
      fireEvent.change(statusSelect, {
        target: { value: EvidenceStatus.ACCEPTED },
      });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`status=${EvidenceStatus.ACCEPTED}`),
          expect.any(Object)
        );
      });
    });

    it('应该支持按排序字段筛选', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('证据列表')).toBeInTheDocument();
      });

      const typeSelects = screen.getAllByRole('combobox');
      const sortBySelect = typeSelects[2];
      fireEvent.change(sortBySelect, { target: { value: 'relevanceScore' } });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('sortBy=relevanceScore'),
          expect.any(Object)
        );
      });
    });
  });

  describe('分页功能', () => {
    it('应该显示分页控件', async () => {
      const paginatedResponse: EvidenceListResponse = {
        evidence: mockEvidence,
        total: 25,
        caseId: mockCaseId,
        page: 1,
        limit: 20,
        totalPages: 2,
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: paginatedResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('上一页')).toBeInTheDocument();
        expect(screen.getByText('下一页')).toBeInTheDocument();
        expect(screen.getByText('第 1 / 2 页')).toBeInTheDocument();
      });
    });

    it('应该支持翻页', async () => {
      const paginatedResponse: EvidenceListResponse = {
        evidence: mockEvidence,
        total: 25,
        caseId: mockCaseId,
        page: 1,
        limit: 20,
        totalPages: 2,
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: paginatedResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('证据列表')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('下一页');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('page=2'),
          expect.any(Object)
        );
      });
    });

    it('应该在第一页时禁用上一页按钮', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} />);

      await waitFor(() => {
        const prevButton = screen.getByText('上一页');
        expect(prevButton).toBeDisabled();
      });
    });
  });

  describe('批量操作', () => {
    it('应该显示选择框当showSelection为true时', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} showSelection />);

      await waitFor(() => {
        expect(screen.getByText('证据列表')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('应该支持全选和取消全选', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} showSelection />);

      await waitFor(() => {
        expect(screen.getByText('证据列表')).toBeInTheDocument();
      });

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      await waitFor(() => {
        expect(screen.getByText('已选择 2 条证据')).toBeInTheDocument();
      });
    });

    it('应该显示批量操作按钮当有选中证据时', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} showSelection />);

      await waitFor(() => {
        expect(screen.getByText('证据列表')).toBeInTheDocument();
      });

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      // 点击后立即检查，因为selectedIds会立即更新
      expect(screen.getByText('已选择 2 条证据')).toBeInTheDocument();
      expect(screen.getByText('标记为已采纳')).toBeInTheDocument();
      expect(screen.getByText('标记为已拒绝')).toBeInTheDocument();
      // 使用getAllByText，因为"删除"同时出现在批量操作按钮和单个证据行中
      const deleteButtons = screen.getAllByText('删除');
      expect(deleteButtons.length).toBeGreaterThan(1);
    });
  });

  describe('删除功能', () => {
    it('应该支持删除单个证据', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('证据列表')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('删除');
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('删除时应该显示确认对话框', async () => {
      const confirmSpy = jest
        .spyOn(window, 'confirm')
        .mockReturnValueOnce(true);

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('证据列表')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('删除');
      fireEvent.click(deleteButtons[0]);

      expect(confirmSpy).toHaveBeenCalledWith('确定要删除这条证据吗？');

      confirmSpy.mockRestore();
    });
  });

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ data: mockResponse }),
                } as Response),
              100
            )
          )
      );

      render(<EvidenceList caseId={mockCaseId} />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  describe('错误状态', () => {
    it('应该显示错误信息', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: '加载失败',
        }),
      });

      render(<EvidenceList caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText(/加载证据列表失败/i)).toBeInTheDocument();
      });
    });
  });

  describe('回调函数', () => {
    it('应该调用onSelectEvidence回调', async () => {
      const onSelectMock = jest.fn();

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(
        <EvidenceList caseId={mockCaseId} onSelectEvidence={onSelectMock} />
      );

      await waitFor(() => {
        expect(screen.getByText('合同书')).toBeInTheDocument();
      });

      const evidenceName = screen.getByText('合同书');
      fireEvent.click(evidenceName);

      expect(onSelectMock).toHaveBeenCalledWith('evidence-1');
    });

    it('应该调用onEditEvidence回调', async () => {
      const onEditMock = jest.fn();

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockResponse,
        }),
      });

      render(<EvidenceList caseId={mockCaseId} onEditEvidence={onEditMock} />);

      await waitFor(() => {
        expect(screen.getAllByText('编辑').length).toBeGreaterThan(0);
      });

      const editButtons = screen.getAllByText('编辑');
      fireEvent.click(editButtons[0]);

      expect(onEditMock).toHaveBeenCalledWith('evidence-1');
    });
  });
});
