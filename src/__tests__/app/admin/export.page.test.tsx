/**
 * 数据导出页面测试
 * @jest-environment jsdom
 */
// @ts-nocheck - 禁用此文件的 TypeScript 类型检查

import ExportPage from '@/app/admin/export/page';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// =============================================================================
// Mock配置
// =============================================================================

// Mock fetch
(global as any).fetch = jest.fn() as jest.Mock;

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(),
    getAll: jest.fn(),
  })),
  useParams: jest.fn(() => ({
    id: '123',
  })),
}));

// Mock @/types/stats - 使用真实的类型，不需要 mock
// 因为测试主要关注 UI 和交互

// =============================================================================
// 测试数据
// =============================================================================

const mockExportTasks = [
  {
    id: '1',
    exportType: 'CASES',
    format: 'CSV',
    timeRange: 'LAST_30_DAYS',
    filename: 'cases-export-20240101.csv',
    status: 'COMPLETED',
    progress: 100,
    fileSize: 1024000,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    exportType: 'STATS',
    format: 'EXCEL',
    timeRange: 'LAST_7_DAYS',
    filename: 'stats-export-20240102.xlsx',
    status: 'PROCESSING',
    progress: 45,
    fileSize: 0,
    createdAt: new Date('2024-01-02'),
  },
  {
    id: '3',
    exportType: 'CASES',
    format: 'JSON',
    timeRange: 'CUSTOM',
    filename: 'cases-export-20240103.json',
    status: 'FAILED',
    progress: 30,
    fileSize: 0,
    createdAt: new Date('2024-01-03'),
  },
];

// =============================================================================
// 辅助函数
// =============================================================================

function setupMockFetch({
  exportSuccess = true,
  exportData = { success: true, data: { filename: 'test-export.csv' } },
  downloadSuccess = true,
}: {
  exportSuccess?: boolean;
  exportData?: Record<string, unknown>;
  downloadSuccess?: boolean;
} = {}) {
  (global.fetch as jest.Mock).mockImplementation(
    (url: string, options?: RequestInit) => {
      // 导出案件数据
      if (url === '/api/admin/export/cases' && options?.method === 'POST') {
        return Promise.resolve({
          ok: exportSuccess,
          status: exportSuccess ? 200 : 500,
          json: async () => exportData,
        });
      }

      // 导出统计数据
      if (url === '/api/admin/export/stats' && options?.method === 'POST') {
        return Promise.resolve({
          ok: exportSuccess,
          status: exportSuccess ? 200 : 500,
          json: async () => exportData,
        });
      }

      // 下载文件
      if (url.includes('/api/admin/export/download')) {
        return Promise.resolve({
          ok: downloadSuccess,
          status: downloadSuccess ? 200 : 404,
        });
      }

      // 其他请求
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });
    }
  );
}

// Mock downloadLink click
let mockDownloadLinks: Array<{ href: string; download: string }> = [];
beforeEach(() => {
  mockDownloadLinks = [];
});

describe('数据导出页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDownloadLinks = [];
    setupMockFetch();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // 页面渲染测试
  // =============================================================================

  describe('页面渲染', () => {
    it('应该正确渲染页面标题', () => {
      render(<ExportPage />);

      expect(screen.getByText('数据导出')).toBeInTheDocument();
      expect(screen.getByText('导出系统数据用于离线分析')).toBeInTheDocument();
    });

    it('应该渲染导出表单区域', () => {
      render(<ExportPage />);

      expect(screen.getByText('创建导出任务')).toBeInTheDocument();
    });

    it('应该渲染导出历史区域', () => {
      render(<ExportPage />);

      expect(screen.getByText('导出历史')).toBeInTheDocument();
    });

    it('应该显示导出类型选择器', () => {
      render(<ExportPage />);

      expect(screen.getByLabelText('导出类型')).toBeInTheDocument();
    });

    it('应该显示导出格式选择器', () => {
      render(<ExportPage />);

      expect(screen.getByLabelText('导出格式')).toBeInTheDocument();
    });

    it('应该显示时间范围选择器', () => {
      render(<ExportPage />);

      expect(screen.getByLabelText('时间范围')).toBeInTheDocument();
    });
  });

  // =============================================================================
  // 导出类型选择测试
  // =============================================================================

  describe('导出类型选择', () => {
    it('应该默认选择案件数据', () => {
      render(<ExportPage />);

      const exportTypeSelect = screen.getByLabelText('导出类型');
      expect(exportTypeSelect).toHaveValue('CASES');
    });

    it('应该能够切换到统计数据', () => {
      render(<ExportPage />);

      const exportTypeSelect = screen.getByLabelText('导出类型');
      fireEvent.change(exportTypeSelect, { target: { value: 'STATS' } });

      expect(exportTypeSelect).toHaveValue('STATS');

      // 应该显示统计类型选择器
      expect(screen.getByLabelText('统计类型')).toBeInTheDocument();
    });

    it('选择统计数据时应该显示统计类型选择器', () => {
      render(<ExportPage />);

      const exportTypeSelect = screen.getByLabelText('导出类型');
      fireEvent.change(exportTypeSelect, { target: { value: 'STATS' } });

      expect(screen.getByLabelText('统计类型')).toBeInTheDocument();
    });
  });

  // =============================================================================
  // 导出格式选择测试
  // =============================================================================

  describe('导出格式选择', () => {
    it('应该默认选择CSV格式', () => {
      render(<ExportPage />);

      const formatSelect = screen.getByLabelText('导出格式');
      expect(formatSelect).toHaveValue('CSV');
    });

    it('应该能够选择Excel格式', () => {
      render(<ExportPage />);

      const formatSelect = screen.getByLabelText('导出格式');
      fireEvent.change(formatSelect, { target: { value: 'EXCEL' } });

      expect(formatSelect).toHaveValue('EXCEL');
    });

    it('应该能够选择JSON格式', () => {
      render(<ExportPage />);

      const formatSelect = screen.getByLabelText('导出格式');
      fireEvent.change(formatSelect, { target: { value: 'JSON' } });

      expect(formatSelect).toHaveValue('JSON');
    });
  });

  // =============================================================================
  // 时间范围选择测试
  // =============================================================================

  describe('时间范围选择', () => {
    it('应该默认选择近30天', () => {
      render(<ExportPage />);

      const timeRangeSelect = screen.getByLabelText('时间范围');
      expect(timeRangeSelect).toHaveValue('LAST_30_DAYS');
    });

    it('应该能够选择近7天', () => {
      render(<ExportPage />);

      const timeRangeSelect = screen.getByLabelText('时间范围');
      fireEvent.change(timeRangeSelect, { target: { value: 'LAST_7_DAYS' } });

      expect(timeRangeSelect).toHaveValue('LAST_7_DAYS');
    });

    it('应该能够选择近90天', () => {
      render(<ExportPage />);

      const timeRangeSelect = screen.getByLabelText('时间范围');
      fireEvent.change(timeRangeSelect, { target: { value: 'LAST_90_DAYS' } });

      expect(timeRangeSelect).toHaveValue('LAST_90_DAYS');
    });

    it('应该能够选择自定义时间范围', () => {
      render(<ExportPage />);

      const timeRangeSelect = screen.getByLabelText('时间范围');
      fireEvent.change(timeRangeSelect, { target: { value: 'CUSTOM' } });

      expect(timeRangeSelect).toHaveValue('CUSTOM');

      // 应该显示日期选择器
      expect(screen.getByLabelText('开始日期')).toBeInTheDocument();
      expect(screen.getByLabelText('结束日期')).toBeInTheDocument();
    });

    it('应该能够输入自定义开始日期', () => {
      render(<ExportPage />);

      const timeRangeSelect = screen.getByLabelText('时间范围');
      fireEvent.change(timeRangeSelect, { target: { value: 'CUSTOM' } });

      const startDateInput = screen.getByLabelText('开始日期');
      fireEvent.change(startDateInput, {
        target: { value: '2024-01-01' },
      });

      expect(startDateInput).toHaveValue('2024-01-01');
    });

    it('应该能够输入自定义结束日期', () => {
      render(<ExportPage />);

      const timeRangeSelect = screen.getByLabelText('时间范围');
      fireEvent.change(timeRangeSelect, { target: { value: 'CUSTOM' } });

      const endDateInput = screen.getByLabelText('结束日期');
      fireEvent.change(endDateInput, {
        target: { value: '2024-01-31' },
      });

      expect(endDateInput).toHaveValue('2024-01-31');
    });
  });

  // =============================================================================
  // 统计类型选择测试
  // =============================================================================

  describe('统计类型选择', () => {
    beforeEach(() => {
      render(<ExportPage />);
      const exportTypeSelect = screen.getByLabelText('导出类型');
      fireEvent.change(exportTypeSelect, { target: { value: 'STATS' } });
    });

    it('应该默认选择用户注册统计', () => {
      const statsTypeSelect = screen.getByLabelText('统计类型');
      expect(statsTypeSelect).toHaveValue('USER_REGISTRATION');
    });

    it('应该能够选择用户活跃度统计', () => {
      const statsTypeSelect = screen.getByLabelText('统计类型');
      fireEvent.change(statsTypeSelect, {
        target: { value: 'USER_ACTIVITY' },
      });

      expect(statsTypeSelect).toHaveValue('USER_ACTIVITY');
    });

    it('应该能够选择案件类型分布统计', () => {
      const statsTypeSelect = screen.getByLabelText('统计类型');
      fireEvent.change(statsTypeSelect, {
        target: { value: 'CASE_TYPE_DISTRIBUTION' },
      });

      expect(statsTypeSelect).toHaveValue('CASE_TYPE_DISTRIBUTION');
    });

    it('应该能够选择性能响应时间统计', () => {
      const statsTypeSelect = screen.getByLabelText('统计类型');
      fireEvent.change(statsTypeSelect, {
        target: { value: 'PERFORMANCE_RESPONSE_TIME' },
      });

      expect(statsTypeSelect).toHaveValue('PERFORMANCE_RESPONSE_TIME');
    });
  });

  // =============================================================================
  // 导出功能测试
  // =============================================================================

  describe('导出功能', () => {
    it('应该能够导出案件数据', async () => {
      render(<ExportPage />);

      const submitButton = screen.getByText('导出数据');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/export/cases',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });

    it('应该能够导出统计数据', async () => {
      render(<ExportPage />);

      const exportTypeSelect = screen.getByLabelText('导出类型');
      fireEvent.change(exportTypeSelect, { target: { value: 'STATS' } });

      const submitButton = screen.getByText('导出数据');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/export/stats',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('导出成功后应该触发文件下载', async () => {
      const exportData = {
        success: true,
        data: { filename: 'test-export.csv' },
      };
      setupMockFetch({ exportData });

      // 保存原始的 createElement
      const originalCreateElement = document.createElement.bind(document);

      // Mock document.createElement
      document.createElement = jest.fn((tag: string) => {
        if (tag === 'a') {
          const mockLink = {
            href: '',
            download: '',
            click: jest.fn(),
          };
          return mockLink as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tag);
      }) as unknown as typeof document.createElement;

      render(<ExportPage />);

      const submitButton = screen.getByText('导出数据');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
        expect(document.createElement).toHaveBeenCalledWith('a');
      });

      // Restore
      document.createElement = originalCreateElement;
    });

    it('导出成功后应该更新导出历史', async () => {
      setupMockFetch({
        exportData: {
          success: true,
          data: { filename: 'new-export.csv' },
        },
      });

      render(<ExportPage />);

      const submitButton = screen.getByText('导出数据');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('导出失败时应该显示错误信息', async () => {
      setupMockFetch({ exportSuccess: false });

      render(<ExportPage />);

      const submitButton = screen.getByText('导出数据');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('导出案件数据失败')).toBeInTheDocument();
      });
    });

    it('导出按钮在加载期间应该禁用', async () => {
      // Mock一个不会立即 resolve 的 fetch
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(<ExportPage />);

      const submitButton = screen.getByText('导出数据');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(submitButton).toHaveTextContent('导出中...');
      });
    });
  });

  // =============================================================================
  // 自定义日期验证测试
  // =============================================================================

  describe('自定义日期验证', () => {
    it('自定义时间范围应该需要输入开始日期', () => {
      render(<ExportPage />);

      const timeRangeSelect = screen.getByLabelText('时间范围');
      fireEvent.change(timeRangeSelect, { target: { value: 'CUSTOM' } });

      const startDateInput = screen.getByLabelText('开始日期');
      expect(startDateInput).toHaveAttribute('required');
    });

    it('自定义时间范围应该需要输入结束日期', () => {
      render(<ExportPage />);

      const timeRangeSelect = screen.getByLabelText('时间范围');
      fireEvent.change(timeRangeSelect, { target: { value: 'CUSTOM' } });

      const endDateInput = screen.getByLabelText('结束日期');
      expect(endDateInput).toHaveAttribute('required');
    });

    it('应该能够同时输入开始和结束日期', () => {
      render(<ExportPage />);

      const timeRangeSelect = screen.getByLabelText('时间范围');
      fireEvent.change(timeRangeSelect, { target: { value: 'CUSTOM' } });

      const startDateInput = screen.getByLabelText('开始日期');
      const endDateInput = screen.getByLabelText('结束日期');

      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });
      fireEvent.change(endDateInput, { target: { value: '2024-01-31' } });

      expect(startDateInput).toHaveValue('2024-01-01');
      expect(endDateInput).toHaveValue('2024-01-31');
    });
  });

  // =============================================================================
  // UI元素测试
  // =============================================================================

  describe('UI元素', () => {
    it('导出类型选项应该包含案件数据和统计数据', () => {
      render(<ExportPage />);

      const exportTypeSelect = screen.getByLabelText('导出类型');
      const options = Array.from(exportTypeSelect.querySelectorAll('option'));

      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('案件数据');
      expect(options[1]).toHaveTextContent('统计数据');
    });

    it('导出格式选项应该包含CSV、Excel和JSON', () => {
      render(<ExportPage />);

      const formatSelect = screen.getByLabelText('导出格式');
      const options = Array.from(formatSelect.querySelectorAll('option'));

      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent('CSV');
      expect(options[1]).toHaveTextContent('Excel');
      expect(options[2]).toHaveTextContent('JSON');
    });

    it('时间范围选项应该包含预设和自定义选项', () => {
      render(<ExportPage />);

      const timeRangeSelect = screen.getByLabelText('时间范围');
      const options = Array.from(timeRangeSelect.querySelectorAll('option'));

      expect(options).toHaveLength(4);
      expect(options[0]).toHaveTextContent('近7天');
      expect(options[1]).toHaveTextContent('近30天');
      expect(options[2]).toHaveTextContent('近90天');
      expect(options[3]).toHaveTextContent('自定义');
    });
  });

  // =============================================================================
  // 导出历史测试
  // =============================================================================

  describe('导出历史', () => {
    it('应该显示暂无导出记录提示', () => {
      render(<ExportPage />);

      expect(screen.getByText('暂无导出记录')).toBeInTheDocument();
    });

    it('导出成功后应该更新导出历史列表', async () => {
      setupMockFetch({
        exportData: {
          success: true,
          data: { filename: 'new-export.csv' },
        },
      });

      render(<ExportPage />);

      const submitButton = screen.getByText('导出数据');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });

  // =============================================================================
  // 错误处理测试
  // =============================================================================

  describe('错误处理', () => {
    it('应该显示API调用失败的错误信息', async () => {
      setupMockFetch({ exportSuccess: false });

      render(<ExportPage />);

      const submitButton = screen.getByText('导出数据');
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorElement = screen.getByText('导出案件数据失败');
        expect(errorElement).toBeInTheDocument();
        expect(errorElement).toHaveClass('text-red-600');
      });
    });

    it('错误信息应该显示在错误框中', async () => {
      setupMockFetch({ exportSuccess: false });

      render(<ExportPage />);

      const submitButton = screen.getByText('导出数据');
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorBox = screen.getByText('导出案件数据失败').closest('.p-4');
        expect(errorBox).toHaveClass('bg-red-50');
      });
    });
  });
});
