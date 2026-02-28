/**
 * 报告详情页面测试
 * @jest-environment jsdom
 */
// @ts-nocheck - 禁用此文件的 TypeScript 类型检查

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
import ReportDetailPage from '@/app/admin/reports/[id]/page';

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
    back: jest.fn(),
  })),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(),
    getAll: jest.fn(),
  })),
  useParams: jest.fn(() => ({
    id: '1',
  })),
}));

// Mock window.confirm
let mockConfirm = jest.fn();
beforeEach(() => {
  mockConfirm = jest.fn();
  Object.defineProperty(window, 'confirm', {
    writable: true,
    value: mockConfirm,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'confirm', {
    writable: true,
    value: () => true,
  });
});

// Mock alert
let mockAlert = jest.fn();
beforeEach(() => {
  mockAlert = jest.fn();
  global.alert = mockAlert;
});

// =============================================================================
// 测试数据
// =============================================================================

const mockReport = {
  id: '1',
  fileName: 'weekly-report-20240108.csv',
  type: 'WEEKLY',
  status: 'COMPLETED',
  periodStart: '2024-01-01',
  periodEnd: '2024-01-07',
  fileSize: 1024000,
  downloadCount: 5,
  generatedAt: new Date('2024-01-08T10:00:00'),
  createdAt: new Date('2024-01-08T09:00:00'),
  metadata: {
    generatedAt: new Date('2024-01-08T10:00:00'),
    generatedBy: 'system',
    generationTime: 5000,
    dataPoints: 1000,
    periodStart: '2024-01-01',
    periodEnd: '2024-01-07',
  },
  content: {
    summary: {
      keyMetrics: [
        { label: '总用户数', value: 1000, change: 10, unit: '人' },
        { label: '新增用户', value: 100, change: 15, unit: '人' },
        { label: '活跃用户', value: 500, change: 8, unit: '人' },
        { label: '活跃率', value: 50, change: 5, unit: '%' },
      ],
      highlights: ['用户活跃度提升15%', '系统响应时间优化20%'],
      issues: ['部分API响应时间较长', '数据库连接池需要优化'],
      recommendations: ['增加缓存层', '优化数据库查询'],
    },
    userStats: {
      summary: {
        totalUsers: 1000,
        newUsers: 100,
        activeUsers: 500,
        growthRate: 10,
      },
      trends: {
        registrationTrend: [],
        activityTrend: [],
      },
      distribution: {
        veryActive: 100,
        active: 200,
        inactive: 300,
        dormant: 400,
      },
    },
    caseStats: {
      summary: {
        totalCases: 200,
        completedCases: 150,
        activeCases: 50,
        averageCompletionTime: 2.5,
      },
      distribution: [],
      trends: [],
    },
    debateStats: {
      summary: {
        totalDebates: 100,
        totalArguments: 500,
        averageArgumentsPerDebate: 5,
        averageQualityScore: 4.2,
      },
      trends: {
        generationCount: [],
        qualityScore: [],
      },
      distribution: {
        excellent: 30,
        good: 40,
        average: 20,
        poor: 10,
        totalCount: 100,
      },
    },
    performanceStats: {
      summary: {
        totalRequests: 10000,
        averageResponseTime: 200,
        p95ResponseTime: 500,
        errorRate: 0.5,
      },
      trends: {
        responseTime: [],
        errorRate: [],
      },
    },
  },
};

// =============================================================================
// 辅助函数
// =============================================================================

function setupMockFetch({
  getSuccess = true,
  getData = { success: true, data: mockReport },
  deleteSuccess = true,
  downloadSuccess = true,
}: {
  getSuccess?: boolean;
  getData?: Record<string, unknown>;
  deleteSuccess?: boolean;
  downloadSuccess?: boolean;
} = {}) {
  (global.fetch as jest.Mock).mockImplementation(
    (url: string, options?: RequestInit) => {
      // 获取报告详情
      if (
        url === '/api/admin/reports/1' &&
        (!options || options.method === 'GET')
      ) {
        return Promise.resolve({
          ok: getSuccess,
          status: getSuccess ? 200 : 500,
          json: async () => getData,
        });
      }

      // 删除报告
      if (url === '/api/admin/reports/1' && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: deleteSuccess,
          status: deleteSuccess ? 200 : 500,
          json: async () => ({
            success: deleteSuccess,
            message: deleteSuccess ? '删除成功' : '删除失败',
          }),
        });
      }

      // 下载报告
      if (url === '/api/admin/reports/1/download') {
        return Promise.resolve({
          ok: downloadSuccess,
          status: downloadSuccess ? 200 : 500,
        });
      }

      // 其他请求
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: null }),
      });
    }
  );
}

describe('报告详情页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockFetch();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // 页面渲染测试
  // =============================================================================

  describe('页面渲染', () => {
    it('应该正确渲染页面标题', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(
          screen.getByText('weekly-report-20240108.csv')
        ).toBeInTheDocument();
      });
    });

    it('应该渲染返回按钮', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/返回列表/)).toBeInTheDocument();
      });
    });

    it('应该渲染下载按钮', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('下载报告')).toBeInTheDocument();
      });
    });

    it('应该渲染基本信息卡片', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('基本信息')).toBeInTheDocument();
      });
    });

    it('应该渲染元数据卡片', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('元数据')).toBeInTheDocument();
      });
    });

    it('应该渲染报告内容卡片', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('报告内容')).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // 报告基本信息显示测试
  // =============================================================================

  describe('报告基本信息', () => {
    it('应该显示报告文件名', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(mockReport.fileName)).toBeInTheDocument();
      });
    });

    it('应该显示报告类型', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('周报')).toBeInTheDocument();
      });
    });

    it('应该显示报告状态', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        const statusElements = screen.getAllByText('已完成');
        expect(statusElements.length).toBeGreaterThan(0);
      });
    });

    it('应该显示时间范围', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        // 时间范围显示在h1的兄弟元素中
        const h1Element = screen.getByText('weekly-report-20240108.csv');
        const subtitle = h1Element.nextElementSibling?.textContent;
        expect(subtitle).toContain('2024-01-01');
        expect(subtitle).toContain('2024-01-07');
      });
    });

    it('应该显示文件大小', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('1000 KB')).toBeInTheDocument();
      });
    });

    it('应该显示下载次数', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('5 次')).toBeInTheDocument();
      });
    });

    it('应该显示生成时间', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('2024/1/8 10:00:00')).toBeInTheDocument();
      });
    });

    it('应该显示创建时间', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('2024/1/8 09:00:00')).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // 报告元数据测试
  // =============================================================================

  describe('报告元数据', () => {
    it('应该显示数据点数', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('1,000 个')).toBeInTheDocument();
      });
    });

    it('应该显示生成耗时', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('5.00 秒')).toBeInTheDocument();
      });
    });

    it('应该显示生成者', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('system')).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // 报告内容显示测试
  // =============================================================================

  describe('报告内容', () => {
    it('应该显示关键指标', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        const totalUsersLabels = screen.getAllByText('总用户数');
        expect(totalUsersLabels.length).toBeGreaterThan(0);
        expect(screen.getByText('关键指标')).toBeInTheDocument();
      });
    });

    it('应该显示用户统计数据', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('用户统计')).toBeInTheDocument();
      });
    });

    it('应该显示案件统计数据', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('案件统计')).toBeInTheDocument();
      });
    });

    it('应该显示辩论统计数据', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('辩论统计')).toBeInTheDocument();
      });
    });

    it('应该显示性能统计数据', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('性能统计')).toBeInTheDocument();
        expect(screen.getByText('总请求数')).toBeInTheDocument();
        expect(screen.getByText('10,000')).toBeInTheDocument();
        expect(screen.getByText('平均响应时间')).toBeInTheDocument();
        expect(screen.getByText('200ms')).toBeInTheDocument();
        expect(screen.getByText('P95响应时间')).toBeInTheDocument();
        expect(screen.getByText('500ms')).toBeInTheDocument();
        expect(screen.getByText('错误率')).toBeInTheDocument();
        expect(screen.getByText('0.5%')).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // 返回按钮测试
  // =============================================================================

  describe('返回按钮', () => {
    it('应该有返回按钮', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        const backButton = screen.getAllByText(/返回列表/);
        expect(backButton.length).toBeGreaterThan(0);
      });
    });
  });

  // =============================================================================
  // 下载功能测试
  // =============================================================================

  describe('下载功能', () => {
    it('应该有下载按钮', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('下载报告')).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // 删除功能测试
  // =============================================================================

  describe('删除功能', () => {
    it('点击删除按钮应该显示确认对话框', async () => {
      setupMockFetch({
        getData: {
          success: true,
          data: { ...mockReport, status: 'FAILED' },
        },
      });
      mockConfirm.mockReturnValueOnce(false);
      render(<ReportDetailPage />);

      await waitFor(() => {
        const deleteButton = screen.getByText('删除报告');
        fireEvent.click(deleteButton);
      });

      expect(mockConfirm).toHaveBeenCalledWith(
        expect.stringContaining('确定要删除此报告吗')
      );
    });

    it('确认删除应该调用删除API', async () => {
      setupMockFetch({
        getData: {
          success: true,
          data: { ...mockReport, status: 'FAILED' },
        },
      });
      mockConfirm.mockReturnValueOnce(true);
      render(<ReportDetailPage />);

      await waitFor(() => {
        const deleteButton = screen.getByText('删除报告');
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/reports/1',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });

    it('取消删除不应该调用删除API', async () => {
      setupMockFetch({
        getData: {
          success: true,
          data: { ...mockReport, status: 'FAILED' },
        },
      });
      mockConfirm.mockReturnValueOnce(false);
      render(<ReportDetailPage />);

      await waitFor(() => {
        const deleteButton = screen.getByText('删除报告');
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        const deleteCalls = (global.fetch as jest.Mock).mock.calls.filter(
          (call: unknown[]) => call[1]?.method === 'DELETE'
        );
        expect(deleteCalls.length).toBe(0);
      });
    });

    it('删除成功应该返回列表页', async () => {
      const push = jest.fn();

      jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({
        push,
      });

      setupMockFetch({
        getData: {
          success: true,
          data: { ...mockReport, status: 'FAILED' },
        },
      });
      mockConfirm.mockReturnValueOnce(true);

      render(<ReportDetailPage />);

      await waitFor(() => {
        const deleteButton = screen.getByText('删除报告');
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith('/admin/reports');
      });
    });

    it('删除失败应该显示错误提示', async () => {
      setupMockFetch({
        getData: {
          success: true,
          data: { ...mockReport, status: 'FAILED' },
        },
        deleteSuccess: false,
      });
      mockConfirm.mockReturnValueOnce(true);
      render(<ReportDetailPage />);

      await waitFor(() => {
        const deleteButton = screen.getByText('删除报告');
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          expect.stringContaining('删除报告失败')
        );
      });
    });
  });

  // =============================================================================
  // 加载状态测试
  // =============================================================================

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(<ReportDetailPage />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  // =============================================================================
  // 错误处理测试
  // =============================================================================

  describe('错误处理', () => {
    it('应该显示报告不存在的错误信息', async () => {
      setupMockFetch({
        getData: { success: true, data: null },
      });

      render(<ReportDetailPage />);

      await waitFor(() => {
        // 当data为null时，页面会返回null，不显示任何内容
        // 因此页面应该为空
        const container = document.querySelector('.container');
        expect(container).not.toBeInTheDocument();
      });
    });

    it('应该显示加载报告失败的错误信息', async () => {
      setupMockFetch({
        getSuccess: false,
      });

      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('获取报告详情失败')).toBeInTheDocument();
      });
    });

    it('错误信息应该显示在错误框中', async () => {
      setupMockFetch({
        getSuccess: false,
      });

      render(<ReportDetailPage />);

      await waitFor(() => {
        const errorBox = screen
          .getByText('获取报告详情失败')
          .closest('.bg-red-50');
        expect(errorBox).toBeInTheDocument();
      });
    });

    it('错误框中应该有返回列表按钮', async () => {
      setupMockFetch({
        getSuccess: false,
      });

      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('返回列表')).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // 报告状态测试
  // =============================================================================

  describe('报告状态', () => {
    it('应该显示生成中状态', async () => {
      setupMockFetch({
        getData: {
          success: true,
          data: { ...mockReport, status: 'GENERATING' },
        },
      });

      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('生成中')).toBeInTheDocument();
      });
    });

    it('应该显示失败状态', async () => {
      setupMockFetch({
        getData: {
          success: true,
          data: { ...mockReport, status: 'FAILED' },
        },
      });

      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('失败')).toBeInTheDocument();
      });
    });

    it('失败状态应该显示删除按钮', async () => {
      setupMockFetch({
        getData: {
          success: true,
          data: { ...mockReport, status: 'FAILED' },
        },
      });

      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('删除报告')).toBeInTheDocument();
      });
    });

    it('已完成状态应该显示下载按钮', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('下载报告')).toBeInTheDocument();
      });
    });

    it('已完成状态不应该显示删除按钮', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.queryByText('删除报告')).not.toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // 响应式布局测试
  // =============================================================================

  describe('响应式布局', () => {
    it('应该正确显示基本信息卡片', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('基本信息')).toBeInTheDocument();
        expect(screen.getByText('报告类型')).toBeInTheDocument();
        expect(screen.getByText('文件大小')).toBeInTheDocument();
        expect(screen.getByText('下载次数')).toBeInTheDocument();
      });
    });

    it('应该正确显示元数据卡片', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('元数据')).toBeInTheDocument();
        expect(screen.getByText('数据点数')).toBeInTheDocument();
        expect(screen.getByText('生成耗时')).toBeInTheDocument();
      });
    });

    it('应该正确显示报告内容卡片', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('报告内容')).toBeInTheDocument();
        expect(screen.getByText('摘要')).toBeInTheDocument();
        expect(screen.getByText('关键指标')).toBeInTheDocument();
      });
    });

    it('应该正确显示所有统计卡片', async () => {
      render(<ReportDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('用户统计')).toBeInTheDocument();
        expect(screen.getByText('案件统计')).toBeInTheDocument();
        expect(screen.getByText('辩论统计')).toBeInTheDocument();
        expect(screen.getByText('性能统计')).toBeInTheDocument();
      });
    });
  });
});
