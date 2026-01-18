import { render, screen } from '@testing-library/react';
import { DashboardPage } from '@/app/dashboard/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('DashboardPage', () => {
  const mockStats = {
    users: {
      total: 100,
      active: 80,
      lawyers: 20,
      enterprises: 10,
      growth: 10.5,
    },
    cases: {
      total: 200,
      pending: 30,
      processing: 50,
      completed: 120,
      growth: 15.2,
    },
    debates: {
      total: 150,
      generated: 130,
      inProgress: 10,
      completed: 140,
      avgQuality: 4.5,
    },
    performance: {
      avgResponseTime: 250,
      errorRate: 0.5,
      uptime: 99.9,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockStats }),
      } as Response)
    ) as jest.Mock;
  });

  it('should render dashboard with stats', async () => {
    render(<DashboardPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
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
