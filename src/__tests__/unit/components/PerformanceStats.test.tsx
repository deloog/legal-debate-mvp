/**
 * 系统性能统计组件 单元测试
 */

import { render, screen } from '@testing-library/react';
import { PerformanceStats } from '@/components/dashboard/PerformanceStats';
import {
  DateGranularity,
  PerformanceErrorRateData,
  PerformanceResponseTimeData,
  TimeRange,
} from '@/types/stats';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('PerformanceStats 组件', () => {
  const mockResponseTimeData: PerformanceResponseTimeData = {
    trend: [
      {
        date: '2024-01-01',
        count: 30,
        averageResponseTime: 1400,
        p50ResponseTime: 1400,
        p95ResponseTime: 2800,
        p99ResponseTime: 4200,
        minResponseTime: 500,
        maxResponseTime: 4000,
      },
      {
        date: '2024-01-02',
        count: 40,
        averageResponseTime: 1500,
        p50ResponseTime: 1500,
        p95ResponseTime: 2900,
        p99ResponseTime: 4300,
        minResponseTime: 600,
        maxResponseTime: 4500,
      },
    ],
    summary: {
      totalRequests: 70,
      averageResponseTime: 1450,
      p95ResponseTime: 2850,
      p99ResponseTime: 4250,
      minResponseTime: 500,
      maxResponseTime: 4500,
    },
    byProvider: [
      {
        provider: 'deepseek',
        averageResponseTime: 1400,
        totalRequests: 40,
      },
      {
        provider: 'zhipu',
        averageResponseTime: 1600,
        totalRequests: 30,
      },
    ],
    byModel: [
      {
        model: 'deepseek-chat',
        averageResponseTime: 1350,
        totalRequests: 35,
      },
      {
        model: 'deepseek-reasoner',
        averageResponseTime: 1700,
        totalRequests: 5,
      },
    ],
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      granularity: DateGranularity.DAY,
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-01-30T23:59:59.999Z',
    },
  };

  const mockErrorRateData: PerformanceErrorRateData = {
    trend: [
      {
        date: '2024-01-01',
        totalRequests: 65,
        successCount: 62,
        errorCount: 3,
        errorRate: 4.62,
        recoveredCount: 1,
        recoveryRate: 33.33,
      },
      {
        date: '2024-01-02',
        totalRequests: 70,
        successCount: 66,
        errorCount: 4,
        errorRate: 5.71,
        recoveredCount: 2,
        recoveryRate: 50,
      },
    ],
    summary: {
      totalRequests: 135,
      successCount: 128,
      errorCount: 7,
      errorRate: 5.19,
      recoveredCount: 3,
      recoveryRate: 42.86,
    },
    byErrorType: [
      {
        errorType: 'API_TIMEOUT',
        count: 3,
        percentage: 42.86,
        recovered: 2,
        recoveryRate: 66.67,
      },
      {
        errorType: 'RATE_LIMIT',
        count: 2,
        percentage: 28.57,
        recovered: 1,
        recoveryRate: 50,
      },
      {
        errorType: 'INVALID_RESPONSE',
        count: 2,
        percentage: 28.57,
        recovered: 0,
        recoveryRate: 0,
      },
    ],
    bySeverity: [
      {
        severity: 'LOW',
        count: 2,
        percentage: 28.57,
      },
      {
        severity: 'MEDIUM',
        count: 4,
        percentage: 57.14,
      },
      {
        severity: 'HIGH',
        count: 1,
        percentage: 14.29,
      },
    ],
    byProvider: [
      {
        provider: 'deepseek',
        totalRequests: 80,
        errorCount: 4,
        errorRate: 5,
      },
      {
        provider: 'zhipu',
        totalRequests: 55,
        errorCount: 3,
        errorRate: 5.45,
      },
    ],
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-01-30T23:59:59.999Z',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该显示加载状态', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ success: true, data: null }),
              } as Response);
            }, 1000);
          })
      );

      render(<PerformanceStats />);
      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('应该成功渲染性能统计数据', async () => {
      (global.fetch as jest.Mock).mockImplementation(url =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.includes('response-time')) {
              return { success: true, data: mockResponseTimeData };
            }
            if (url.includes('error-rate')) {
              return { success: true, data: mockErrorRateData };
            }
            return { success: true, data: null };
          },
        } as Response)
      );

      render(<PerformanceStats />);

      await screen.findByText('响应时间汇总');

      // 响应时间汇总
      expect(screen.getByText('总请求数')).toBeInTheDocument();
      expect(screen.getByText('70')).toBeInTheDocument();
      expect(screen.getByText('平均响应时间')).toBeInTheDocument();
      expect(screen.getByText('1450ms')).toBeInTheDocument();
      expect(screen.getByText('P95响应时间')).toBeInTheDocument();
      expect(screen.getByText('2850ms')).toBeInTheDocument();
      expect(screen.getByText('P99响应时间')).toBeInTheDocument();
      expect(screen.getByText('4250ms')).toBeInTheDocument();
    });

    it('应该显示错误信息', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('获取统计数据失败')
      );

      render(<PerformanceStats />);

      await screen.findByText(/获取统计数据失败/);
      expect(screen.getByText(/获取统计数据失败/)).toBeInTheDocument();
    });
  });

  describe('响应时间统计', () => {
    it('应该显示响应时间汇总', async () => {
      (global.fetch as jest.Mock).mockImplementation(url =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.includes('response-time')) {
              return { success: true, data: mockResponseTimeData };
            }
            return { success: true, data: mockErrorRateData };
          },
        } as Response)
      );

      render(<PerformanceStats />);

      await screen.findByText('响应时间汇总');

      expect(screen.getByText('最快响应时间')).toBeInTheDocument();
      expect(screen.getByText('500ms')).toBeInTheDocument();
      expect(screen.getByText('最慢响应时间')).toBeInTheDocument();
      expect(screen.getByText('4500ms')).toBeInTheDocument();
    });

    it('应该显示按服务商统计', async () => {
      (global.fetch as jest.Mock).mockImplementation(url =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.includes('response-time')) {
              return { success: true, data: mockResponseTimeData };
            }
            return { success: true, data: mockErrorRateData };
          },
        } as Response)
      );

      render(<PerformanceStats />);

      await screen.findByText('按服务商统计');

      expect(screen.getByText('deepseek')).toBeInTheDocument();
      expect(screen.getByText('zhipu')).toBeInTheDocument();
    });

    it('应该显示按模型统计', async () => {
      (global.fetch as jest.Mock).mockImplementation(url =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.includes('response-time')) {
              return { success: true, data: mockResponseTimeData };
            }
            return { success: true, data: mockErrorRateData };
          },
        } as Response)
      );

      render(<PerformanceStats />);

      await screen.findByText('按模型统计（Top 10）');

      expect(screen.getByText('deepseek-chat')).toBeInTheDocument();
      expect(screen.getByText('deepseek-reasoner')).toBeInTheDocument();
    });

    it('应该显示响应时间趋势', async () => {
      (global.fetch as jest.Mock).mockImplementation(url =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.includes('response-time')) {
              return { success: true, data: mockResponseTimeData };
            }
            return { success: true, data: mockErrorRateData };
          },
        } as Response)
      );

      render(<PerformanceStats />);

      await screen.findByText('响应时间趋势');

      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
      expect(screen.getByText('2024-01-02')).toBeInTheDocument();
    });

    it('应该显示空数据状态', async () => {
      const emptyData: PerformanceResponseTimeData = {
        ...mockResponseTimeData,
        trend: [],
        byProvider: [],
        byModel: [],
        summary: {
          ...mockResponseTimeData.summary,
          totalRequests: 0,
        },
      };

      (global.fetch as jest.Mock).mockImplementation(url =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.includes('response-time')) {
              return { success: true, data: emptyData };
            }
            return { success: true, data: mockErrorRateData };
          },
        } as Response)
      );

      render(<PerformanceStats />);

      await screen.findByText('响应时间汇总');
      expect(screen.getAllByText('暂无数据')).toHaveLength(3);
    });
  });

  describe('错误率统计', () => {
    it('应该显示错误率汇总', async () => {
      (global.fetch as jest.Mock).mockImplementation(url =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.includes('response-time')) {
              return { success: true, data: mockResponseTimeData };
            }
            return { success: true, data: mockErrorRateData };
          },
        } as Response)
      );

      render(<PerformanceStats />);

      await screen.findByText('错误率汇总');

      expect(screen.getByText('总请求数')).toBeInTheDocument();
      expect(screen.getByText('135')).toBeInTheDocument();
      expect(screen.getByText('成功请求数')).toBeInTheDocument();
      expect(screen.getByText('128')).toBeInTheDocument();
      expect(screen.getByText('错误请求数')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('错误率')).toBeInTheDocument();
      expect(screen.getByText('5.19%')).toBeInTheDocument();
    });

    it('应该显示恢复统计', async () => {
      (global.fetch as jest.Mock).mockImplementation(url =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.includes('response-time')) {
              return { success: true, data: mockResponseTimeData };
            }
            return { success: true, data: mockErrorRateData };
          },
        } as Response)
      );

      render(<PerformanceStats />);

      await screen.findByText('恢复错误数');
      expect(screen.getByText('恢复错误数')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      await screen.findByText('恢复率');
      expect(screen.getByText('恢复率')).toBeInTheDocument();
      expect(screen.getByText('42.86%')).toBeInTheDocument();
    });

    it('应该显示按错误类型分布', async () => {
      (global.fetch as jest.Mock).mockImplementation(url =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.includes('response-time')) {
              return { success: true, data: mockResponseTimeData };
            }
            return { success: true, data: mockErrorRateData };
          },
        } as Response)
      );

      render(<PerformanceStats />);

      await screen.findByText('按错误类型分布');

      expect(screen.getByText('API_TIMEOUT')).toBeInTheDocument();
      expect(screen.getByText('RATE_LIMIT')).toBeInTheDocument();
      expect(screen.getByText('INVALID_RESPONSE')).toBeInTheDocument();
    });

    it('应该显示按严重程度分布', async () => {
      (global.fetch as jest.Mock).mockImplementation(url =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.includes('response-time')) {
              return { success: true, data: mockResponseTimeData };
            }
            return { success: true, data: mockErrorRateData };
          },
        } as Response)
      );

      render(<PerformanceStats />);

      await screen.findByText('按严重程度分布');

      expect(screen.getByText('LOW')).toBeInTheDocument();
      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('应该显示错误率趋势', async () => {
      (global.fetch as jest.Mock).mockImplementation(url =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.includes('response-time')) {
              return { success: true, data: mockResponseTimeData };
            }
            return { success: true, data: mockErrorRateData };
          },
        } as Response)
      );

      render(<PerformanceStats />);

      await screen.findByText('错误率趋势');

      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
      expect(screen.getByText('2024-01-02')).toBeInTheDocument();
    });

    it('应该显示空数据状态', async () => {
      const emptyData: PerformanceErrorRateData = {
        ...mockErrorRateData,
        trend: [],
        byErrorType: [],
        bySeverity: [],
        byProvider: [],
        summary: {
          ...mockErrorRateData.summary,
          totalRequests: 0,
        },
      };

      (global.fetch as jest.Mock).mockImplementation(url =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (url.includes('response-time')) {
              return { success: true, data: mockResponseTimeData };
            }
            return { success: true, data: emptyData };
          },
        } as Response)
      );

      render(<PerformanceStats />);

      await screen.findByText('错误率汇总');
      expect(screen.getAllByText('暂无数据')).toHaveLength(4);
    });
  });

  describe('Props处理', () => {
    it('应该正确传递查询参数', async () => {
      const fetchMock = (global.fetch as jest.Mock).mockImplementation(
        (url: string) => {
          if (url.includes('timeRange=TODAY')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true, data: mockResponseTimeData }),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockErrorRateData }),
          } as Response);
        }
      );

      render(<PerformanceStats timeRange='TODAY' />);

      await screen.findByText('响应时间汇总');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('timeRange=TODAY')
      );
    });

    it('应该支持granularity参数', async () => {
      const fetchMock = (global.fetch as jest.Mock).mockImplementation(
        (url: string) => {
          if (url.includes('granularity=WEEK')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true, data: mockResponseTimeData }),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockErrorRateData }),
          } as Response);
        }
      );

      render(<PerformanceStats granularity='WEEK' />);

      await screen.findByText('响应时间汇总');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('granularity=WEEK')
      );
    });

    it('应该支持provider参数', async () => {
      const fetchMock = (global.fetch as jest.Mock).mockImplementation(
        (url: string) => {
          if (url.includes('provider=deepseek')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true, data: mockResponseTimeData }),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockErrorRateData }),
          } as Response);
        }
      );

      render(<PerformanceStats provider='deepseek' />);

      await screen.findByText('响应时间汇总');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('provider=deepseek')
      );
    });

    it('应该支持model参数', async () => {
      const fetchMock = (global.fetch as jest.Mock).mockImplementation(
        (url: string) => {
          if (url.includes('model=deepseek-chat')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true, data: mockResponseTimeData }),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockErrorRateData }),
          } as Response);
        }
      );

      render(<PerformanceStats model='deepseek-chat' />);

      await screen.findByText('响应时间汇总');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('model=deepseek-chat')
      );
    });
  });
});
