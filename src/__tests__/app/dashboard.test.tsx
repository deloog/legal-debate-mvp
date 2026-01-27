import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('DashboardPage', () => {
  const mockUsersStats = {
    total: 100,
    active: 80,
    lawyers: 20,
    enterprises: 10,
    growth: 10.5,
  };

  const mockCasesStats = {
    total: 200,
    pending: 30,
    processing: 50,
    completed: 120,
    growth: 15.2,
  };

  const mockDebatesStats = {
    total: 150,
    generated: 130,
    inProgress: 10,
    completed: 140,
    avgQuality: 4.5,
  };

  const mockPerformanceStats = {
    avgResponseTime: 250,
    errorRate: 0.5,
    uptime: 99.9,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(url => {
      if (url.includes('/users')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockUsersStats }),
        } as Response);
      } else if (url.includes('/cases')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockCasesStats }),
        } as Response);
      } else if (url.includes('/debates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockDebatesStats }),
        } as Response);
      } else if (url.includes('/performance')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockPerformanceStats }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
      } as Response);
    }) as jest.Mock;
  });

  it('should render dashboard with stats', async () => {
    render(<DashboardPage />);

    // 等待异步数据加载完成
    await waitFor(
      () => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });

  it('should display loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<DashboardPage />);

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('should handle fetch error', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: false,
      } as Response)
    );

    render(<DashboardPage />);

    expect(await screen.findByText('获取统计数据失败')).toBeInTheDocument();
  });
});
