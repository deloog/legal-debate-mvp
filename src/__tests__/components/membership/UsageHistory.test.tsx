import { render, screen, fireEvent } from '@testing-library/react';
import { UsageHistory } from '@/components/membership/UsageHistory';
import {
  MembershipHistory,
  MembershipChangeType,
  MembershipStatus,
  MembershipTier,
} from '@/types/membership';

describe('UsageHistory', () => {
  const mockHistory: MembershipHistory[] = [
    {
      id: '1',
      userId: 'user-1',
      membershipId: 'membership-1',
      changeType: MembershipChangeType.UPGRADE,
      previousTier: MembershipTier.FREE,
      newTier: MembershipTier.BASIC,
      previousStatus: MembershipStatus.ACTIVE,
      newStatus: MembershipStatus.ACTIVE,
      reason: '升级到基础版',
      performedBy: 'system',
      createdAt: new Date('2024-01-01'),
    },
    {
      id: '2',
      userId: 'user-1',
      membershipId: 'membership-2',
      changeType: MembershipChangeType.RENEW,
      previousTier: MembershipTier.BASIC,
      newTier: MembershipTier.BASIC,
      previousStatus: MembershipStatus.ACTIVE,
      newStatus: MembershipStatus.ACTIVE,
      reason: '续费',
      performedBy: 'system',
      createdAt: new Date('2024-02-01'),
    },
  ];

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      render(<UsageHistory history={[]} isLoading={true} />);

      expect(screen.getByText('会员变更历史')).toBeInTheDocument();
      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  describe('空状态', () => {
    it('应该显示暂无记录提示', () => {
      render(<UsageHistory history={[]} isLoading={false} />);

      expect(screen.getByText('会员变更历史')).toBeInTheDocument();
      expect(screen.getByText('暂无变更记录')).toBeInTheDocument();
    });
  });

  describe('历史记录显示', () => {
    it('应该显示历史记录列表', () => {
      render(<UsageHistory history={mockHistory} isLoading={false} />);

      const container = screen.getByText('会员变更历史');
      expect(container).toBeInTheDocument();
      expect(screen.getByText('升级')).toBeInTheDocument();
      expect(screen.getAllByText('续费').length).toBeGreaterThan(0);
    });

    it('应该显示变更类型标签', () => {
      render(<UsageHistory history={mockHistory} isLoading={false} />);

      const upgradeBadge = screen.getByText('升级');
      const renewBadge = screen.getAllByText('续费');
      expect(upgradeBadge).toBeInTheDocument();
      expect(renewBadge.length).toBeGreaterThan(0);
    });

    it('应该显示时间信息', () => {
      render(<UsageHistory history={mockHistory} isLoading={false} />);

      const dates = screen.getAllByText(/2024/);
      expect(dates.length).toBeGreaterThan(0);
    });

    it('应该显示等级变更', () => {
      render(<UsageHistory history={mockHistory} isLoading={false} />);

      expect(screen.getByText('FREE')).toBeInTheDocument();
      expect(screen.getByText('BASIC')).toBeInTheDocument();
    });

    it('应该显示原因', () => {
      render(<UsageHistory history={mockHistory} isLoading={false} />);

      const reasons = screen.getAllByText('升级到基础版');
      expect(reasons.length).toBeGreaterThan(0);
    });
  });

  describe('分页功能', () => {
    const longHistory: MembershipHistory[] = Array.from(
      { length: 10 },
      (_, i) => ({
        id: `${i}`,
        userId: 'user-1',
        membershipId: `membership-${i}`,
        changeType: MembershipChangeType.UPGRADE,
        previousTier: MembershipTier.FREE,
        newTier: MembershipTier.BASIC,
        previousStatus: MembershipStatus.ACTIVE,
        newStatus: MembershipStatus.ACTIVE,
        reason: null,
        performedBy: 'system',
        createdAt: new Date(`2024-0${Math.floor(i / 3) + 1}-01`),
      })
    );

    it('应该显示分页控件', () => {
      render(<UsageHistory history={longHistory} isLoading={false} />);

      expect(screen.getByText(/第 1 页/)).toBeInTheDocument();
      expect(screen.getByText(/共 2 页/)).toBeInTheDocument();
      expect(screen.getByText('上一页')).toBeInTheDocument();
      expect(screen.getByText('下一页')).toBeInTheDocument();
    });

    it('第一页时上一页按钮应该禁用', () => {
      render(<UsageHistory history={longHistory} isLoading={false} />);

      const prevButton = screen.getByText('上一页').closest('button');
      expect(prevButton).toBeDisabled();
    });

    it('第一页时下一页按钮应该启用', () => {
      render(<UsageHistory history={longHistory} isLoading={false} />);

      const nextButton = screen.getByText('下一页').closest('button');
      expect(nextButton).not.toBeDisabled();
    });

    it('点击下一页应该翻页', () => {
      render(<UsageHistory history={longHistory} isLoading={false} />);

      const nextButton = screen.getByText('下一页').closest('button');
      fireEvent.click(nextButton);

      expect(screen.getByText(/第 2 页/)).toBeInTheDocument();
    });

    it('第二页时上一页按钮应该启用', () => {
      render(<UsageHistory history={longHistory} isLoading={false} />);

      const nextButton = screen.getByText('下一页').closest('button');
      fireEvent.click(nextButton);

      const prevButton = screen.getByText('上一页').closest('button');
      expect(prevButton).not.toBeDisabled();
    });

    it('第二页时下一页按钮应该禁用', () => {
      render(<UsageHistory history={longHistory} isLoading={false} />);

      const nextButton = screen.getByText('下一页').closest('button');
      fireEvent.click(nextButton);

      const nextButtonAfter = screen.getByText('下一页').closest('button');
      expect(nextButtonAfter).toBeDisabled();
    });

    it('点击上一页应该翻回第一页', () => {
      render(<UsageHistory history={longHistory} isLoading={false} />);

      const nextButton = screen.getByText('下一页').closest('button');
      fireEvent.click(nextButton);

      const prevButton = screen.getByText('上一页').closest('button');
      fireEvent.click(prevButton);

      expect(screen.getByText(/第 1 页/)).toBeInTheDocument();
    });
  });

  describe('变更类型颜色', () => {
    it('升级应该显示绿色', () => {
      const upgradeOnlyHistory: MembershipHistory[] = [
        {
          ...mockHistory[0],
          changeType: MembershipChangeType.UPGRADE,
        },
      ];

      render(<UsageHistory history={upgradeOnlyHistory} isLoading={false} />);

      const upgradeBadge = screen.getByText('升级');
      expect(upgradeBadge).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('降级应该显示橙色', () => {
      const downgradeHistory: MembershipHistory[] = [
        {
          id: '1',
          userId: 'user-1',
          membershipId: 'membership-1',
          changeType: MembershipChangeType.DOWNGRADE,
          previousTier: MembershipTier.PROFESSIONAL,
          newTier: MembershipTier.BASIC,
          previousStatus: MembershipStatus.ACTIVE,
          newStatus: MembershipStatus.ACTIVE,
          reason: null,
          performedBy: 'system',
          createdAt: new Date('2024-01-01'),
        },
      ];

      render(<UsageHistory history={downgradeHistory} isLoading={false} />);

      const downgradeBadge = screen.getByText('降级');
      expect(downgradeBadge).toHaveClass('bg-orange-100', 'text-orange-800');
    });

    it('取消应该显示红色', () => {
      const cancelHistory: MembershipHistory[] = [
        {
          id: '1',
          userId: 'user-1',
          membershipId: 'membership-1',
          changeType: MembershipChangeType.CANCEL,
          previousTier: MembershipTier.BASIC,
          newTier: MembershipTier.FREE,
          previousStatus: MembershipStatus.ACTIVE,
          newStatus: MembershipStatus.CANCELLED,
          reason: null,
          performedBy: 'user-1',
          createdAt: new Date('2024-01-01'),
        },
      ];

      render(<UsageHistory history={cancelHistory} isLoading={false} />);

      const cancelBadge = screen.getByText('取消');
      expect(cancelBadge).toHaveClass('bg-red-100', 'text-red-800');
    });

    it('续费应该显示蓝色', () => {
      const renewOnlyHistory: MembershipHistory[] = [
        {
          id: '2',
          userId: 'user-1',
          membershipId: 'membership-2',
          changeType: MembershipChangeType.RENEW,
          previousTier: MembershipTier.BASIC,
          newTier: MembershipTier.BASIC,
          previousStatus: MembershipStatus.ACTIVE,
          newStatus: MembershipStatus.ACTIVE,
          reason: '续费',
          performedBy: 'system',
          createdAt: new Date('2024-02-01'),
        },
      ];

      render(<UsageHistory history={renewOnlyHistory} isLoading={false} />);

      const renewBadges = screen.getAllByText('续费');
      const renewBadge = renewBadges.find(badge =>
        badge.className.includes('bg-blue-100')
      );
      expect(renewBadge).toBeDefined();
      expect(renewBadge).toHaveClass('bg-blue-100', 'text-blue-800');
    });
  });
});
