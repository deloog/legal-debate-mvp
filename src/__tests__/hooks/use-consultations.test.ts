/**
 * useConsultations Hook 测试
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConsultations } from '@/lib/hooks/use-consultations';
import { ConsultStatus, ConsultationType } from '@/types/consultation';

// Mock fetch
global.fetch = jest.fn();

describe('useConsultations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('初始状态', () => {
    test('应该初始化为加载状态', () => {
      const { result } = renderHook(() => useConsultations({}, ''));

      expect(result.current.loading).toBe(true);
      expect(result.current.consultations).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    test('应该初始化分页状态', () => {
      const { result } = renderHook(() => useConsultations({}, ''));

      expect(result.current.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe('数据获取', () => {
    test('应该成功获取咨询列表', async () => {
      const mockData = {
        success: true,
        data: [
          {
            id: '1',
            consultNumber: 'ZX20260128001',
            clientName: '张三',
            consultType: 'PHONE',
            consultTime: '2026-01-28T10:00:00.000Z',
            status: 'PENDING',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(() => useConsultations({}, ''));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(1);
      expect(result.current.consultations[0].id).toBe('1');
      expect(result.current.pagination.total).toBe(1);
    });

    test('应该处理获取失败', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('网络错误'));

      const { result } = renderHook(() => useConsultations({}, ''));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('网络错误');
    });

    test('应该处理API错误响应', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: '获取失败',
        }),
      });

      const { result } = renderHook(() => useConsultations({}, ''));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('筛选功能', () => {
    test('应该在筛选条件变化时重新获取数据', async () => {
      const mockData = {
        success: true,
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };

      let fetchCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        fetchCount++;
        return Promise.resolve({
          ok: true,
          json: async () => mockData,
        });
      });

      const { result, rerender } = renderHook(
        ({ filters }) => useConsultations(filters, ''),
        {
          initialProps: { filters: {} },
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialFetchCount = fetchCount;

      // 更新筛选条件
      rerender({ filters: { status: ConsultStatus.PENDING } });

      await waitFor(() => {
        expect(fetchCount).toBe(initialFetchCount + 1);
      });
    });

    test('应该传递status筛选参数', async () => {
      const mockData = {
        success: true,
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      renderHook(({ filters }) => useConsultations(filters, ''), {
        initialProps: { filters: { status: ConsultStatus.PENDING } },
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchUrl).toContain('status=PENDING');
    });

    test('应该传递consultType筛选参数', async () => {
      const mockData = {
        success: true,
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      renderHook(({ filters }) => useConsultations(filters, ''), {
        initialProps: { filters: { consultType: ConsultationType.PHONE } },
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchUrl).toContain('consultType=PHONE');
    });

    test('应该传递日期范围筛选参数', async () => {
      const mockData = {
        success: true,
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-12-31');

      renderHook(({ filters }) => useConsultations(filters, ''), {
        initialProps: { filters: { dateFrom: startDate, dateTo: endDate } },
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchUrl).toContain('dateFrom=');
      expect(fetchUrl).toContain('dateTo=');
    });
  });

  describe('搜索功能', () => {
    test('应该在搜索词变化时重新获取数据', async () => {
      const mockData = {
        success: true,
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };

      let fetchCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        fetchCount++;
        return Promise.resolve({
          ok: true,
          json: async () => mockData,
        });
      });

      const { result, rerender } = renderHook(
        ({ searchQuery }) => useConsultations({}, searchQuery),
        {
          initialProps: { searchQuery: '' },
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialFetchCount = fetchCount;

      // 更新搜索词
      rerender({ searchQuery: '张三' });

      await waitFor(() => {
        expect(fetchCount).toBe(initialFetchCount + 1);
      });
    });

    test('应该传递keyword参数', async () => {
      const mockData = {
        success: true,
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      renderHook(({ searchQuery }) => useConsultations({}, searchQuery), {
        initialProps: { searchQuery: '张三' },
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchUrl).toContain('search=张三');
    });

    test('应该传递空搜索词', async () => {
      const mockData = {
        success: true,
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      renderHook(({ searchQuery }) => useConsultations({}, searchQuery), {
        initialProps: { searchQuery: '' },
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchUrl).not.toContain('search=');
    });
  });

  describe('分页功能', () => {
    test('应该初始化分页状态为第一页', () => {
      const { result } = renderHook(() => useConsultations({}, ''));

      expect(result.current.pagination.page).toBe(1);
    });

    test('应该支持切换到指定页码', async () => {
      const mockData = {
        success: true,
        data: [],
        pagination: { page: 2, pageSize: 20, total: 100, totalPages: 5 },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(() => useConsultations({}, ''));

      // 等待初始加载完成
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 切换到第2页
      act(() => {
        result.current.goToPage(2);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    test('应该在页码变化时更新分页状态', async () => {
      const mockData = {
        success: true,
        data: [],
        pagination: { page: 3, pageSize: 20, total: 100, totalPages: 5 },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(() => useConsultations({}, ''));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.goToPage(3);
      });

      await waitFor(() => {
        expect(result.current.pagination.page).toBe(3);
      });
    });

    test('应该更新总页数', async () => {
      const mockData = {
        success: true,
        data: [],
        pagination: { page: 1, pageSize: 20, total: 100, totalPages: 5 },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(() => useConsultations({}, ''));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.pagination.totalPages).toBe(5);
    });

    test('应该更新总数', async () => {
      const mockData = {
        success: true,
        data: [],
        pagination: { page: 1, pageSize: 20, total: 100, totalPages: 5 },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(() => useConsultations({}, ''));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.pagination.total).toBe(100);
    });
  });

  describe('刷新功能', () => {
    test('应该支持刷新列表', async () => {
      const mockData = {
        success: true,
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };

      let fetchCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        fetchCount++;
        return Promise.resolve({
          ok: true,
          json: async () => mockData,
        });
      });

      const { result } = renderHook(() => useConsultations({}, ''));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialFetchCount = fetchCount;

      // 刷新列表
      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(fetchCount).toBe(initialFetchCount + 1);
      });
    });

    test('应该在刷新时重置错误状态', async () => {
      const errorMockData = {
        success: false,
        error: '服务器错误',
      };

      const successMockData = {
        success: true,
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => errorMockData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => successMockData,
        });

      const { result } = renderHook(() => useConsultations({}, ''));

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // 刷新列表
      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('边界情况', () => {
    test('应该处理空数据响应', async () => {
      const mockData = {
        success: true,
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(() => useConsultations({}, ''));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(0);
      expect(result.current.pagination.total).toBe(0);
    });

    test('应该处理pagination缺失的情况', async () => {
      const mockData = {
        success: true,
        data: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(() => useConsultations({}, ''));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 应该保持初始的pagination值
      expect(result.current.pagination.total).toBe(0);
      expect(result.current.pagination.totalPages).toBe(0);
    });

    test('应该处理网络超时', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('请求超时')), 100)
          )
      );

      const { result } = renderHook(() => useConsultations({}, ''));

      await waitFor(
        () => {
          expect(result.current.error).not.toBeNull();
        },
        { timeout: 200 }
      );

      expect(result.current.error?.message).toBe('请求超时');
    });
  });
});
