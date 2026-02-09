import { render, screen, fireEvent } from '@testing-library/react';
import { TierUpgradeCard } from '@/components/membership/TierUpgradeCard';
import {
  MembershipTierDef,
  MembershipTier,
  BillingCycle,
} from '@/types/membership';

describe('TierUpgradeCard', () => {
  const mockTier: MembershipTierDef = {
    id: 'tier-1',
    name: 'BASIC',
    displayName: '基础版',
    description: '适合个人用户的基础功能',
    tier: MembershipTier.BASIC,
    level: 1,
    price: 99,
    currency: 'CNY',
    billingCycle: BillingCycle.MONTHLY,
    features: ['创建案件', '生成辩论', '分析文档', '搜索法条', '数据导出'],
    limits: {
      cases: 50,
      debates: 20,
      documents: 100,
      storage: 1024,
      aiTokens: 100000,
      users: 1,
      features: ['创建案件', '生成辩论', '分析文档', '搜索法条', '数据导出'],
    },
    permissions: {
      canCreateCase: true,
      canCreateDebate: true,
      canAnalyzeDocument: true,
      canSearchLawArticle: true,
      canUseAdvancedFeatures: false,
      canExportData: true,
      canUseBatchProcessing: false,
      canUseDeepSeek: true,
      canUseZhipuAI: true,
      canUseCustomModel: false,
      prioritySupport: true,
      dedicatedSupport: false,
      customPermissions: {},
    },
    isActive: true,
    sortOrder: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('卡片显示', () => {
    it('应该显示等级名称', () => {
      render(<TierUpgradeCard tier={mockTier} />);

      expect(screen.getByText('基础版')).toBeInTheDocument();
    });

    it('应该显示等级描述', () => {
      render(<TierUpgradeCard tier={mockTier} />);

      expect(screen.getByText('适合个人用户的基础功能')).toBeInTheDocument();
    });

    it('应该显示价格', () => {
      render(<TierUpgradeCard tier={mockTier} />);

      expect(screen.getByText('¥99')).toBeInTheDocument();
      expect(screen.getByText('/ 月')).toBeInTheDocument();
    });

    it('应该显示功能列表', () => {
      render(<TierUpgradeCard tier={mockTier} />);

      const features = screen.getAllByText('创建案件');
      expect(features.length).toBeGreaterThan(0);
      expect(screen.getAllByText('生成辩论').length).toBeGreaterThan(0);
      expect(screen.getAllByText('分析文档').length).toBeGreaterThan(0);
      expect(screen.getAllByText('搜索法条').length).toBeGreaterThan(0);
      expect(screen.getAllByText('数据导出').length).toBeGreaterThan(0);
    });

    it('应该显示权限说明', () => {
      render(<TierUpgradeCard tier={mockTier} />);

      expect(screen.getAllByText('创建案件').length).toBeGreaterThan(0);
      expect(screen.getAllByText('生成辩论').length).toBeGreaterThan(0);
      expect(screen.getAllByText('分析文档').length).toBeGreaterThan(0);
      expect(screen.getAllByText('搜索法条').length).toBeGreaterThan(0);
      expect(screen.getAllByText('数据导出').length).toBeGreaterThan(0);
      expect(screen.getAllByText('优先支持').length).toBeGreaterThan(0);
    });

    it('不应该显示专属客服', () => {
      render(<TierUpgradeCard tier={mockTier} />);

      expect(screen.queryByText('专属客服')).not.toBeInTheDocument();
    });
  });

  describe('当前等级标识', () => {
    it('应该显示当前方案标签', () => {
      render(
        <TierUpgradeCard tier={mockTier} currentTier={MembershipTier.BASIC} />
      );

      expect(screen.getByText('当前方案')).toBeInTheDocument();
    });

    it('应该禁用升级按钮', () => {
      render(
        <TierUpgradeCard tier={mockTier} currentTier={MembershipTier.BASIC} />
      );

      const upgradeButton = screen.queryByText('立即升级');
      expect(upgradeButton).not.toBeInTheDocument();
    });

    it('不应该显示当前方案标签（非当前等级）', () => {
      render(
        <TierUpgradeCard tier={mockTier} currentTier={MembershipTier.FREE} />
      );

      expect(screen.queryByText('当前方案')).not.toBeInTheDocument();
    });

    it('应该显示升级按钮（非当前等级）', () => {
      render(
        <TierUpgradeCard
          tier={mockTier}
          currentTier={MembershipTier.FREE}
          onUpgrade={jest.fn()}
        />
      );

      expect(screen.getByText('立即升级')).toBeInTheDocument();
    });
  });

  describe('推荐标识', () => {
    it('应该显示推荐标签', () => {
      render(
        <TierUpgradeCard
          tier={mockTier}
          currentTier={MembershipTier.FREE}
          isRecommended={true}
        />
      );

      expect(screen.getByText('推荐')).toBeInTheDocument();
    });

    it('应该显示蓝色边框', () => {
      const { container } = render(
        <TierUpgradeCard
          tier={mockTier}
          currentTier={MembershipTier.FREE}
          isRecommended={true}
        />
      );

      const card = container.querySelector('.border-2');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('border-blue-500');
    });

    it('不应该显示推荐标签（非推荐）', () => {
      render(
        <TierUpgradeCard
          tier={mockTier}
          currentTier={MembershipTier.FREE}
          isRecommended={false}
        />
      );

      expect(screen.queryByText('推荐')).not.toBeInTheDocument();
    });
  });

  describe('等级颜色', () => {
    it('企业版应该显示紫色边框和背景', () => {
      const enterpriseTier: MembershipTierDef = {
        ...mockTier,
        tier: MembershipTier.ENTERPRISE,
        level: 3,
      };

      const { container } = render(<TierUpgradeCard tier={enterpriseTier} />);

      const card = container.querySelector('.border-purple-500');
      expect(card).toBeInTheDocument();
      expect(container.querySelector('.bg-purple-50')).toBeInTheDocument();
    });

    it('专业版应该显示蓝色边框和背景', () => {
      const professionalTier: MembershipTierDef = {
        ...mockTier,
        tier: MembershipTier.PROFESSIONAL,
        level: 2,
      };

      const { container } = render(<TierUpgradeCard tier={professionalTier} />);

      const card = container.querySelector('.border-blue-500');
      expect(card).toBeInTheDocument();
      expect(container.querySelector('.bg-blue-50')).toBeInTheDocument();
    });

    it('基础版应该显示绿色边框和背景', () => {
      const { container } = render(<TierUpgradeCard tier={mockTier} />);

      const card = container.querySelector('.border-green-500');
      expect(card).toBeInTheDocument();
      expect(container.querySelector('.bg-green-50')).toBeInTheDocument();
    });

    it('免费版应该显示灰色边框和背景', () => {
      const freeTier: MembershipTierDef = {
        ...mockTier,
        tier: MembershipTier.FREE,
        level: 0,
        price: 0,
      };

      const { container } = render(<TierUpgradeCard tier={freeTier} />);

      const card = container.querySelector('.border-gray-500');
      expect(card).toBeInTheDocument();
      expect(container.querySelector('.bg-gray-50')).toBeInTheDocument();
    });
  });

  describe('计费周期', () => {
    it('应该正确显示月付价格', () => {
      const monthlyTier: MembershipTierDef = {
        ...mockTier,
        billingCycle: BillingCycle.MONTHLY,
      };

      render(<TierUpgradeCard tier={monthlyTier} />);

      expect(screen.getByText('/ 月')).toBeInTheDocument();
    });

    it('应该正确显示季付价格', () => {
      const quarterlyTier: MembershipTierDef = {
        ...mockTier,
        billingCycle: BillingCycle.QUARTERLY,
      };

      render(<TierUpgradeCard tier={quarterlyTier} />);

      expect(screen.getByText('/ 季')).toBeInTheDocument();
    });

    it('应该正确显示年付价格', () => {
      const yearlyTier: MembershipTierDef = {
        ...mockTier,
        billingCycle: BillingCycle.YEARLY,
      };

      render(<TierUpgradeCard tier={yearlyTier} />);

      expect(screen.getByText('/ 年')).toBeInTheDocument();
    });

    it('应该正确显示永久价格', () => {
      const lifetimeTier: MembershipTierDef = {
        ...mockTier,
        billingCycle: BillingCycle.LIFETIME,
      };

      render(<TierUpgradeCard tier={lifetimeTier} />);

      // 组件中显示的是 "/ 永久"，使用正则表达式匹配
      expect(screen.getByText(/永久/)).toBeInTheDocument();
    });
  });

  describe('升级按钮交互', () => {
    it('应该调用 onUpgrade 回调函数', () => {
      const handleUpgrade = jest.fn();
      render(
        <TierUpgradeCard
          tier={mockTier}
          currentTier={MembershipTier.FREE}
          onUpgrade={handleUpgrade}
        />
      );

      const upgradeButton = screen.getByText('立即升级');
      fireEvent.click(upgradeButton);

      expect(handleUpgrade).toHaveBeenCalledTimes(1);
      expect(handleUpgrade).toHaveBeenCalledWith('tier-1');
    });

    it('应该不调用 onUpgrade 回调函数（当前等级）', () => {
      const handleUpgrade = jest.fn();
      render(
        <TierUpgradeCard
          tier={mockTier}
          currentTier={MembershipTier.BASIC}
          onUpgrade={handleUpgrade}
        />
      );

      const upgradeButton = screen.queryByText('立即升级');
      expect(upgradeButton).not.toBeInTheDocument();
      expect(handleUpgrade).not.toHaveBeenCalled();
    });

    it('应该不调用 onUpgrade 回调函数（无 onUpgrade）', () => {
      const { container } = render(
        <TierUpgradeCard tier={mockTier} currentTier={MembershipTier.FREE} />
      );

      const upgradeButton = container.querySelector('button');
      expect(upgradeButton).not.toBeInTheDocument();
    });
  });
});
