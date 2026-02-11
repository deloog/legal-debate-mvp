/**
 * ClientStatistics组件测试
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClientStatistics from '@/components/client/ClientStatistics';
import type { ClientStatistics as ClientStatisticsType } from '@/types/client';
import { ClientType, ClientStatus } from '@/types/client';

describe('ClientStatistics', () => {
  const mockStatistics: ClientStatisticsType = {
    totalClients: 100,
    activeClients: 70,
    inactiveClients: 20,
    lostClients: 8,
    blacklistedClients: 2,
    clientsByType: {
      INDIVIDUAL: 60,
      ENTERPRISE: 30,
      POTENTIAL: 10,
    },
    clientsBySource: {
      REFERRAL: 50,
      ONLINE: 30,
      EVENT: 15,
      ADVERTISING: 5,
    },
    clientsByTags: {
      重要客户: 30,
      潜力客户: 20,
      新客户: 50,
    },
    monthlyGrowth: [
      { month: '2025-02', count: 5 },
      { month: '2025-03', count: 8 },
      { month: '2025-04', count: 12 },
      { month: '2025-05', count: 15 },
      { month: '2025-06', count: 18 },
      { month: '2025-07', count: 20 },
      { month: '2025-08', count: 22 },
      { month: '2025-09', count: 25 },
      { month: '2025-10', count: 28 },
      { month: '2025-11', count: 30 },
      { month: '2025-12', count: 32 },
      { month: '2026-01', count: 35 },
    ],
    recentClients: [
      {
        id: '1',
        userId: 'user1',
        clientType: ClientType.INDIVIDUAL,
        name: '张三',
        status: ClientStatus.ACTIVE,
        tags: [],
        metadata: null,
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-01-15'),
        phone: '13800138000',
        email: 'zhangsan@example.com',
      },
      {
        id: '2',
        userId: 'user1',
        clientType: ClientType.ENTERPRISE,
        name: '某某科技有限公司',
        status: ClientStatus.ACTIVE,
        tags: [],
        metadata: null,
        createdAt: new Date('2026-01-14'),
        updatedAt: new Date('2026-01-14'),
        phone: '13900139000',
        email: 'company@example.com',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('基础渲染', () => {
    it('应该正确渲染加载状态', () => {
      render(<ClientStatistics userId='user1' />);
      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('应该在数据加载完成后渲染统计卡片', async () => {
      global.fetch = jest.fn(
        () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStatistics),
          }) as Promise<Response>
      );

      render(<ClientStatistics userId='user1' />);

      await screen.findByText('客户总数');

      expect(screen.getByText('客户总数')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('活跃客户')).toBeInTheDocument();
      expect(screen.getByText('70')).toBeInTheDocument();
      expect(screen.getByText('非活跃客户')).toBeInTheDocument();
      expect(screen.getAllByText('20').length).toBeGreaterThan(0);
      expect(screen.getByText('流失客户')).toBeInTheDocument();
      expect(screen.getAllByText('8').length).toBeGreaterThan(0);
      expect(screen.getByText('黑名单')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('应该渲染客户类型分布', async () => {
      global.fetch = jest.fn(
        () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStatistics),
          }) as Promise<Response>
      );

      render(<ClientStatistics userId='user1' />);

      await screen.findByText('客户类型分布');

      expect(screen.getByText('个人客户')).toBeInTheDocument();
      expect(screen.getByText('60 (60.0%)')).toBeInTheDocument();
      expect(screen.getByText('企业客户')).toBeInTheDocument();
      expect(screen.getAllByText('30 (30.0%)').length).toBeGreaterThan(0);
      expect(screen.getByText('潜在客户')).toBeInTheDocument();
      expect(screen.getByText('10 (10.0%)')).toBeInTheDocument();
    });

    it('应该渲染客户来源分布', async () => {
      global.fetch = jest.fn(
        () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStatistics),
          }) as Promise<Response>
      );

      render(<ClientStatistics userId='user1' />);

      await screen.findByText('客户来源分布');

      expect(screen.getByText('REFERRAL')).toBeInTheDocument();
      expect(screen.getByText('ONLINE')).toBeInTheDocument();
      expect(screen.getByText('EVENT')).toBeInTheDocument();
      expect(screen.getByText('ADVERTISING')).toBeInTheDocument();
    });

    it('应该渲染客户标签分布', async () => {
      global.fetch = jest.fn(
        () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStatistics),
          }) as Promise<Response>
      );

      render(<ClientStatistics userId='user1' />);

      await screen.findByText('客户标签分布');

      expect(screen.getByText('重要客户')).toBeInTheDocument();
      expect(screen.getAllByText('30').length).toBeGreaterThan(0);
      expect(screen.getByText('潜力客户')).toBeInTheDocument();
      expect(screen.getAllByText('20').length).toBeGreaterThan(0);
      expect(screen.getByText('新客户')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('应该渲染月度增长趋势', async () => {
      global.fetch = jest.fn(
        () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStatistics),
          }) as Promise<Response>
      );

      render(<ClientStatistics userId='user1' />);

      await screen.findByText('客户增长趋势');

      expect(screen.getByText('2025-02')).toBeInTheDocument();
      expect(screen.getByText('2026-01')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('35')).toBeInTheDocument();
    });

    it('应该渲染最近创建的客户', async () => {
      global.fetch = jest.fn(
        () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStatistics),
          }) as Promise<Response>
      );

      render(<ClientStatistics userId='user1' />);

      await screen.findByText('最近创建的客户');

      expect(screen.getByText('张三')).toBeInTheDocument();
      expect(screen.getByText('某某科技有限公司')).toBeInTheDocument();
    });
  });

  describe('错误处理', () => {
    it('应该正确显示错误信息', async () => {
      global.fetch = jest.fn(
        () =>
          Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: '获取统计数据失败' }),
          }) as Promise<Response>
      );

      render(<ClientStatistics userId='user1' />);

      await screen.findByText('获取统计数据失败');
    });

    it('应该正确处理网络错误', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('网络错误'))
      ) as jest.Mock;

      render(<ClientStatistics userId='user1' />);

      await screen.findByText('网络错误');
    });
  });

  describe('空数据处理', () => {
    it('应该显示暂无客户来源数据', async () => {
      const emptyStatistics = { ...mockStatistics, clientsBySource: {} };
      global.fetch = jest.fn(
        () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(emptyStatistics),
          }) as Promise<Response>
      );

      render(<ClientStatistics userId='user1' />);

      await screen.findByText('暂无客户来源数据');
    });

    it('应该显示暂无标签数据', async () => {
      const emptyStatistics = { ...mockStatistics, clientsByTags: {} };
      global.fetch = jest.fn(
        () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(emptyStatistics),
          }) as Promise<Response>
      );

      render(<ClientStatistics userId='user1' />);

      await screen.findByText('暂无标签数据');
    });

    it('应该显示暂无客户数据', async () => {
      global.fetch = jest.fn(
        () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(null),
          }) as Promise<Response>
      );

      render(<ClientStatistics userId='user1' />);

      await screen.findByText('暂无数据');
    });
  });

  describe('数据更新', () => {
    it('应该在userId变化时重新加载数据', async () => {
      const fetchMock = jest.fn(
        () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStatistics),
          }) as Promise<Response>
      );

      global.fetch = fetchMock;

      const { rerender } = render(<ClientStatistics userId='user1' />);

      await screen.findByText('客户总数');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      rerender(<ClientStatistics userId='user2' />);

      await screen.findByText('客户总数');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('数据格式化', () => {
    it('应该正确显示百分比', async () => {
      global.fetch = jest.fn(
        () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStatistics),
          }) as Promise<Response>
      );

      render(<ClientStatistics userId='user1' />);

      await screen.findByText('个人客户');

      const percentageElements = screen.getAllByText(/\d+\.\d+%/);
      expect(percentageElements.length).toBeGreaterThan(0);
    });

    it('应该正确显示日期格式', async () => {
      global.fetch = jest.fn(
        () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStatistics),
          }) as Promise<Response>
      );

      render(<ClientStatistics userId='user1' />);

      await screen.findByText('最近创建的客户');

      expect(screen.getAllByText(/创建时间:/).length).toBeGreaterThan(0);
    });
  });
});
