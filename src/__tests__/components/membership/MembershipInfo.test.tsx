import { MembershipInfo } from '@/components/membership/MembershipInfo';
import {
  MembershipStatusValues,
  MembershipTierValues,
  MembershipTier,
  MembershipStatus,
  TierLimitConfig,
  UserMembership,
} from '@/types/membership';
import { render, screen } from '@testing-library/react';

describe('MembershipInfo', () => {
  const mockMembership: UserMembership = {
    id: '1',
    userId: 'user-1',
    tierId: 'tier-1',
    status: MembershipStatusValues.ACTIVE,
    tier: MembershipTierValues.BASIC,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-01-01'),
    autoRenew: true,
    limits: {
      cases: 50,
      debates: 20,
      documents: 100,
      storage: 1024,
      aiTokens: 100000,
      users: 1,
      features: [],
    },
    usage: {},
  };

  const mockTierLimit: TierLimitConfig = {
    cases: 50,
    debates: 20,
    documents: 100,
    storage: 1024,
    aiTokens: 100000,
    users: 1,
    features: [],
    limits: {
      MAX_CASES: 50,
      MAX_DEBATES: 20,
      MAX_DOCUMENTS: 100,
      MAX_AI_TOKENS_MONTHLY: 100000,
      MAX_STORAGE_MB: 1024,
      MAX_LAW_ARTICLE_SEARCHES: 0,
      MAX_CONCURRENT_REQUESTS: 5,
    },
  };

  const mockUsageStats = {
    casesCreated: 10,
    debatesGenerated: 5,
    documentsAnalyzed: 20,
    lawArticleSearches: 30,
    aiTokensUsed: 5000,
    storageUsedMB: 200,
  };

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      render(
        <MembershipInfo
          membership={null}
          tierLimit={null}
          usageStats={null}
          isLoading={true}
        />
      );

      expect(screen.getByText('会员信息')).toBeInTheDocument();
      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  describe('无会员状态', () => {
    it('应该显示免费用户提示', () => {
      render(
        <MembershipInfo
          membership={null}
          tierLimit={null}
          usageStats={null}
          isLoading={false}
        />
      );

      expect(screen.getByText('会员信息')).toBeInTheDocument();
      expect(screen.getByText('您当前是免费用户')).toBeInTheDocument();
      expect(screen.getByText('升级会员以解锁更多功能')).toBeInTheDocument();
    });
  });

  describe('活跃会员显示', () => {
    it('应该显示会员等级和状态', () => {
      render(
        <MembershipInfo
          membership={mockMembership}
          tierLimit={mockTierLimit}
          usageStats={mockUsageStats}
          isLoading={false}
        />
      );

      expect(screen.getByText('BASIC')).toBeInTheDocument();
      expect(screen.getByText('活跃')).toBeInTheDocument();
    });

    it('应该显示到期日期', () => {
      render(
        <MembershipInfo
          membership={mockMembership}
          tierLimit={mockTierLimit}
          usageStats={mockUsageStats}
          isLoading={false}
        />
      );

      expect(screen.getByText(/到期日期/)).toBeInTheDocument();
      expect(screen.getByText(/2025/)).toBeInTheDocument();
    });

    it('应该显示自动续费提示', () => {
      render(
        <MembershipInfo
          membership={mockMembership}
          tierLimit={mockTierLimit}
          usageStats={mockUsageStats}
          isLoading={false}
        />
      );

      expect(screen.getByText('已开启自动续费')).toBeInTheDocument();
    });

    it('不应该显示自动续费提示（当 autoRenew 为 false）', () => {
      const membershipWithoutAutoRenew = {
        ...mockMembership,
        autoRenew: false,
      };

      render(
        <MembershipInfo
          membership={membershipWithoutAutoRenew}
          tierLimit={mockTierLimit}
          usageStats={mockUsageStats}
          isLoading={false}
        />
      );

      expect(screen.queryByText('已开启自动续费')).not.toBeInTheDocument();
    });
  });

  describe('使用量统计显示', () => {
    it('应该显示所有使用量统计项', () => {
      render(
        <MembershipInfo
          membership={mockMembership}
          tierLimit={mockTierLimit}
          usageStats={mockUsageStats}
          isLoading={false}
        />
      );

      expect(screen.getByText('案件创建')).toBeInTheDocument();
      expect(screen.getByText('辩论生成')).toBeInTheDocument();
      expect(screen.getByText('文档分析')).toBeInTheDocument();
      expect(screen.getByText('法条搜索')).toBeInTheDocument();
      expect(screen.getByText('AI 令牌')).toBeInTheDocument();
      expect(screen.getByText('存储空间')).toBeInTheDocument();
    });

    it('应该正确显示限制范围内的使用量', () => {
      render(
        <MembershipInfo
          membership={mockMembership}
          tierLimit={mockTierLimit}
          usageStats={mockUsageStats}
          isLoading={false}
        />
      );

      // 检查案件创建
      expect(screen.getByText('案件创建')).toBeInTheDocument();
      expect(screen.getByText('10 / 50 个')).toBeInTheDocument();

      // 检查辩论生成
      expect(screen.getByText('辩论生成')).toBeInTheDocument();
      expect(screen.getByText('5 / 20 个')).toBeInTheDocument();

      // 检查文档分析
      expect(screen.getByText('文档分析')).toBeInTheDocument();
      expect(screen.getByText('20 / 100 个')).toBeInTheDocument();

      // 检查AI令牌
      expect(screen.getByText('AI 令牌')).toBeInTheDocument();
      expect(screen.getByText('5,000 / 100,000 个')).toBeInTheDocument();

      // 检查存储空间
      expect(screen.getByText('存储空间')).toBeInTheDocument();
      expect(screen.getByText('200 / 1,024 MB')).toBeInTheDocument();
    });

    it('应该正确显示无限制的使用量', () => {
      const unlimitedTierLimit: TierLimitConfig = {
        cases: 0,
        debates: 0,
        documents: 0,
        storage: 0,
        aiTokens: 0,
        users: 0,
        features: [],
        limits: {
          MAX_CASES: 0,
          MAX_DEBATES: 0,
          MAX_DOCUMENTS: 0,
          MAX_AI_TOKENS_MONTHLY: 0,
          MAX_STORAGE_MB: 0,
          MAX_LAW_ARTICLE_SEARCHES: 0,
          MAX_CONCURRENT_REQUESTS: 0,
        },
      };

      render(
        <MembershipInfo
          membership={{
            ...mockMembership,
            tier: MembershipTier.ENTERPRISE,
          }}
          tierLimit={unlimitedTierLimit}
          usageStats={mockUsageStats}
          isLoading={false}
        />
      );

      // 检查无限制显示（只显示当前使用量，不显示斜杠和限制）
      expect(screen.getByText('10 个')).toBeInTheDocument();
      expect(screen.getByText('5 个')).toBeInTheDocument();
    });
  });

  describe('状态显示', () => {
    const testCases: { status: MembershipStatus; expectedText: string }[] = [
      { status: MembershipStatus.ACTIVE, expectedText: '活跃' },
      { status: MembershipStatus.EXPIRED, expectedText: '已过期' },
      { status: MembershipStatus.CANCELLED, expectedText: '已取消' },
      { status: MembershipStatus.SUSPENDED, expectedText: '已暂停' },
      { status: MembershipStatus.PENDING, expectedText: '待处理' },
    ];

    testCases.forEach(({ status, expectedText }) => {
      it(`应该正确显示 ${expectedText} 状态`, () => {
        render(
          <MembershipInfo
            membership={{
              ...mockMembership,
              status,
            }}
            tierLimit={mockTierLimit}
            usageStats={mockUsageStats}
            isLoading={false}
          />
        );

        expect(screen.getByText(expectedText)).toBeInTheDocument();
      });
    });
  });

  describe('会员等级颜色', () => {
    it('企业版应该显示紫色', () => {
      const { container } = render(
        <MembershipInfo
          membership={{
            ...mockMembership,
            tier: MembershipTier.ENTERPRISE,
          }}
          tierLimit={mockTierLimit}
          usageStats={mockUsageStats}
          isLoading={false}
        />
      );

      expect(container.querySelector('.bg-purple-500')).toBeInTheDocument();
    });

    it('专业版应该显示蓝色', () => {
      const { container } = render(
        <MembershipInfo
          membership={{
            ...mockMembership,
            tier: MembershipTier.PROFESSIONAL,
          }}
          tierLimit={mockTierLimit}
          usageStats={mockUsageStats}
          isLoading={false}
        />
      );

      expect(container.querySelector('.bg-blue-500')).toBeInTheDocument();
    });

    it('基础版应该显示绿色', () => {
      const { container } = render(
        <MembershipInfo
          membership={{
            ...mockMembership,
            tier: MembershipTier.BASIC,
          }}
          tierLimit={mockTierLimit}
          usageStats={mockUsageStats}
          isLoading={false}
        />
      );

      expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
    });

    it('免费版应该显示灰色', () => {
      const { container } = render(
        <MembershipInfo
          membership={{
            ...mockMembership,
            tier: MembershipTier.FREE,
          }}
          tierLimit={mockTierLimit}
          usageStats={mockUsageStats}
          isLoading={false}
        />
      );

      expect(container.querySelector('.bg-gray-500')).toBeInTheDocument();
    });
  });

  describe('边界情况', () => {
    it('应该处理限制为 0 的情况', () => {
      const tierLimitWithZero: TierLimitConfig = {
        cases: 0,
        debates: 0,
        documents: 5,
        storage: 100,
        aiTokens: 10000,
        users: 1,
        features: [],
        limits: {
          MAX_CASES: 0,
          MAX_DEBATES: 0,
          MAX_DOCUMENTS: 5,
          MAX_AI_TOKENS_MONTHLY: 10000,
          MAX_STORAGE_MB: 100,
          MAX_LAW_ARTICLE_SEARCHES: 50,
          MAX_CONCURRENT_REQUESTS: 2,
        },
      };

      render(
        <MembershipInfo
          membership={{
            ...mockMembership,
            tier: MembershipTier.FREE,
          }}
          tierLimit={tierLimitWithZero}
          usageStats={mockUsageStats}
          isLoading={false}
        />
      );

      expect(screen.getByText('案件创建')).toBeInTheDocument();
    });
  });
});
