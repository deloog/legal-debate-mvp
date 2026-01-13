/**
 * AdminCaseList组件测试
 * @jest-environment jsdom
 */
// @ts-nocheck - 禁用此文件的 TypeScript 类型检查，因为 jest-dom 类型声明与测试环境存在兼容性问题，但测试运行完全正常

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdminCaseList } from '@/components/admin/AdminCaseList';

// =============================================================================
// Mock配置
// =============================================================================

// 初始化fetch mock
(global as any).fetch = jest.fn() as jest.Mock;

// 修复 fetch mock 类型
// @ts-ignore - 测试文件中的 mock 初始化
(global as any).fetch = jest.fn((_url: unknown, _options?: RequestInit) => {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: null }),
  });
}) as jest.Mock;

describe('AdminCaseList组件', () => {
  const mockCasesData = {
    cases: [
      {
        id: '1',
        title: '民事纠纷案',
        description: '合同纠纷案件',
        type: 'CIVIL',
        status: 'ACTIVE',
        amount: '10000.00',
        caseNumber: 'CF-2024-001',
        cause: '合同纠纷',
        court: '北京市海淀区人民法院',
        plaintiffName: '张三',
        defendantName: '李四',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
        user: {
          id: 'user1',
          email: 'user1@example.com',
          username: 'user1',
          name: '张三',
        },
        documentsCount: 3,
        debatesCount: 1,
      },
      {
        id: '2',
        title: '刑事案件',
        description: '盗窃案件',
        type: 'CRIMINAL',
        status: 'DRAFT',
        amount: null,
        caseNumber: 'XS-2024-002',
        cause: '盗窃',
        court: '北京市朝阳区人民法院',
        plaintiffName: null,
        defendantName: '王五',
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-15'),
        user: {
          id: 'user2',
          email: 'user2@example.com',
          username: 'user2',
          name: '李四',
        },
        documentsCount: 1,
        debatesCount: 0,
      },
    ],
    pagination: {
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // 加载状态测试
  // =============================================================================

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // 永不解决的Promise
      );

      render(<AdminCaseList />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  // =============================================================================
  // 错误状态测试
  // =============================================================================

  describe('错误状态', () => {
    it('应该显示错误信息', async () => {
      const errorResponse: Record<string, unknown> = {
        ok: false,
        status: 500,
        json: async () => ({
          error: '服务器错误',
          message: '获取案件列表失败',
        }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(errorResponse);

      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText('获取案件列表失败')).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // 空数据状态测试
  // =============================================================================

  describe('空数据状态', () => {
    it('应该显示暂无案件数据', async () => {
      const emptyResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            cases: [],
            pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
          },
        }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(emptyResponse);

      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText('暂无案件数据')).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // 正常显示测试
  // =============================================================================

  describe('正常显示', () => {
    beforeEach(() => {
      const successResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: mockCasesData }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(successResponse);
    });

    it('应该显示案件列表', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText('民事纠纷案')).toBeInTheDocument();
        expect(screen.getByText('刑事案件')).toBeInTheDocument();
      });
    });

    it('应该显示搜索表单', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('搜索标题、案号、案由或当事人')
        ).toBeInTheDocument();
      });
    });

    it('应该显示筛选下拉框', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText('全部类型')).toBeInTheDocument();
        expect(screen.getByText('全部状态')).toBeInTheDocument();
      });
    });

    it('应该显示用户ID输入框', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('用户ID')).toBeInTheDocument();
      });
    });

    it('应该显示案件表格', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText('标题')).toBeInTheDocument();
        expect(screen.getByText('类型')).toBeInTheDocument();
        expect(screen.getByText('状态')).toBeInTheDocument();
        expect(screen.getByText('用户')).toBeInTheDocument();
        expect(screen.getByText('文档数')).toBeInTheDocument();
        expect(screen.getByText('辩论数')).toBeInTheDocument();
        expect(screen.getByText('创建时间')).toBeInTheDocument();
        expect(screen.getByText('操作')).toBeInTheDocument();
      });
    });

    it('应该显示分页信息', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText(/共 2 条记录/)).toBeInTheDocument();
        expect(screen.getByText(/第 1 \//)).toBeInTheDocument();
        expect(screen.getByText('上一页')).toBeInTheDocument();
        expect(screen.getByText('下一页')).toBeInTheDocument();
      });
    });

    it('应该显示案件案号', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText('CF-2024-001')).toBeInTheDocument();
        expect(screen.getByText('XS-2024-002')).toBeInTheDocument();
      });
    });

    it('应该显示案件类型', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText('民事')).toBeInTheDocument();
        expect(screen.getByText('刑事')).toBeInTheDocument();
      });
    });

    it('应该显示用户信息', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument();
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
        expect(screen.getByText('李四')).toBeInTheDocument();
        expect(screen.getByText('user2@example.com')).toBeInTheDocument();
      });
    });

    it('应该显示文档和辩论数量', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        const documentCounts = screen.getAllByText('3');
        expect(documentCounts.length).toBeGreaterThan(0);
        const debateCounts = screen.getAllByText('1');
        expect(debateCounts.length).toBeGreaterThan(0);
      });
    });

    it('应该显示查看和删除按钮', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        const viewButtons = screen.getAllByText('查看');
        expect(viewButtons.length).toBe(2);
        const deleteButtons = screen.getAllByText('删除');
        expect(deleteButtons.length).toBe(2);
      });
    });
  });

  // =============================================================================
  // 搜索功能测试
  // =============================================================================

  describe('搜索功能', () => {
    beforeEach(() => {
      const successResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: mockCasesData }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(successResponse);
    });

    it('应该能够输入搜索词', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('搜索标题、案号、案由或当事人')
        ).toBeInTheDocument();
      });

      const searchInput =
        screen.getByPlaceholderText('搜索标题、案号、案由或当事人');
      fireEvent.change(searchInput, { target: { value: '民事' } });

      expect(searchInput).toHaveValue('民事');
    });

    it('应该能够提交搜索', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('搜索标题、案号、案由或当事人')
        ).toBeInTheDocument();
      });

      const searchInput =
        screen.getByPlaceholderText('搜索标题、案号、案由或当事人');
      fireEvent.change(searchInput, { target: { value: '民事' } });

      const searchButton = screen.getByText('搜索');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('?search=%E6%B0%91%E4%BA%8B'),
          expect.anything()
        );
      });
    });
  });

  // =============================================================================
  // 筛选功能测试
  // =============================================================================

  describe('筛选功能', () => {
    beforeEach(() => {
      const successResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: mockCasesData }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(successResponse);
    });

    it('应该能够按类型筛选', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText('全部类型')).toBeInTheDocument();
      });

      const typeSelect = screen.getByText('全部类型').closest('select');
      expect(typeSelect).toBeInTheDocument();
      fireEvent.change(typeSelect, { target: { value: 'CIVIL' } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('type=CIVIL'),
          expect.anything()
        );
      });
    });

    it('应该能够按状态筛选', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText('全部状态')).toBeInTheDocument();
      });

      const statusSelect = screen.getByText('全部状态').closest('select');
      expect(statusSelect).toBeInTheDocument();
      fireEvent.change(statusSelect, { target: { value: 'ACTIVE' } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('status=ACTIVE'),
          expect.anything()
        );
      });
    });

    it('应该能够按用户ID筛选', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('用户ID')).toBeInTheDocument();
      });

      const userIdInput = screen.getByPlaceholderText('用户ID');
      fireEvent.change(userIdInput, { target: { value: 'user1' } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('userId=user1'),
          expect.anything()
        );
      });
    });

    it('应该能够组合筛选条件', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('搜索标题、案号、案由或当事人')
        ).toBeInTheDocument();
      });

      const searchInput =
        screen.getByPlaceholderText('搜索标题、案号、案由或当事人');
      fireEvent.change(searchInput, { target: { value: '民事' } });

      const typeSelect = screen.getByText('全部类型').closest('select');
      fireEvent.change(typeSelect, { target: { value: 'CIVIL' } });

      const searchButton = screen.getByText('搜索');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=%E6%B0%91%E4%BA%8B&type=CIVIL'),
          expect.anything()
        );
      });
    });
  });

  // =============================================================================
  // 删除功能测试
  // =============================================================================

  describe('删除功能', () => {
    beforeEach(() => {
      const successResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: mockCasesData }),
      };
      const deleteSuccessResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ message: '案件删除成功' }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(successResponse)
        .mockResolvedValueOnce(deleteSuccessResponse)
        .mockResolvedValue(successResponse);

      Object.defineProperty(window, 'confirm', {
        writable: true,
        value: jest.fn(() => true),
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'confirm', {
        writable: true,
        value: () => true,
      });
    });

    it('应该显示删除确认对话框', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getAllByText('删除').length).toBeGreaterThan(0);
      });

      const deleteButtons = screen.getAllByText('删除');
      fireEvent.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('确定要删除案件"民事纠纷案"吗？')
      );
    });

    it('应该能够删除案件', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getAllByText('删除').length).toBeGreaterThan(0);
      });

      const deleteButtons = screen.getAllByText('删除');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/cases/'),
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });

    it('删除成功后应该重新加载列表', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getAllByText('删除').length).toBeGreaterThan(0);
      });

      const deleteButtons = screen.getAllByText('删除');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        const fetchCalls = (global.fetch as jest.Mock).mock.calls;
        expect(fetchCalls.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // =============================================================================
  // 分页功能测试
  // =============================================================================

  describe('分页功能', () => {
    const multiPageData = {
      cases: mockCasesData.cases,
      pagination: {
        total: 100,
        page: 1,
        limit: 20,
        totalPages: 5,
      },
    };

    beforeEach(() => {
      const successResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: multiPageData }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(successResponse);
    });

    it('应该显示分页信息', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText(/共 100 条记录/)).toBeInTheDocument();
        expect(screen.getByText(/第 1 \//)).toBeInTheDocument();
        expect(screen.getByText('5 页')).toBeInTheDocument();
      });
    });

    it('应该能够点击下一页', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText('下一页')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('下一页');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('page=2'),
          expect.anything()
        );
      });
    });

    it('第一页时上一页按钮应该禁用', async () => {
      const firstPageData = {
        cases: mockCasesData.cases,
        pagination: {
          total: 20,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      const successResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: firstPageData }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(successResponse);

      render(<AdminCaseList />);

      await waitFor(() => {
        const prevButton = screen.getByText('上一页');
        expect(prevButton).toBeDisabled();
      });
    });

    it('最后一页时下一页按钮应该禁用', async () => {
      const lastPageData = {
        cases: mockCasesData.cases,
        pagination: {
          total: 100,
          page: 5,
          limit: 20,
          totalPages: 5,
        },
      };

      const successResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: lastPageData }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(successResponse);

      render(<AdminCaseList />);

      await waitFor(() => {
        const nextButton = screen.getByText('下一页');
        expect(nextButton).toBeDisabled();
      });
    });
  });

  // =============================================================================
  // 状态显示测试
  // =============================================================================

  describe('状态显示', () => {
    beforeEach(() => {
      const successResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: mockCasesData }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(successResponse);
    });

    it('应该正确显示不同案件状态', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText('ACTIVE')).toBeInTheDocument();
        expect(screen.getByText('DRAFT')).toBeInTheDocument();
      });
    });

    it('应该正确显示案件类型', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        expect(screen.getByText('民事')).toBeInTheDocument();
        expect(screen.getByText('刑事')).toBeInTheDocument();
      });
    });

    it('应该显示创建时间', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        const dates = screen.getAllByText(/2024/);
        expect(dates.length).toBeGreaterThan(0);
      });
    });
  });

  // =============================================================================
  // 用户交互测试
  // =============================================================================

  describe('用户交互', () => {
    beforeEach(() => {
      const successResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: mockCasesData }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(successResponse);
    });

    it('应该能够点击查看按钮', async () => {
      render(<AdminCaseList />);

      await waitFor(() => {
        const viewButtons = screen.getAllByText('查看');
        expect(viewButtons.length).toBeGreaterThan(0);
      });

      const viewButtons = screen.getAllByText('查看');
      fireEvent.click(viewButtons[0]);
    });
  });
});
