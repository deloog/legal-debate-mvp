/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { TierSelection } from '@/components/payment/TierSelection';
import { MembershipTier, BillingCycle } from '@/types/membership';

const mockTiers = [
  {
    id: 'basic',
    name: 'basic',
    displayName: '基础版',
    description: '适合个人用户',
    tier: MembershipTier.BASIC,
    level: 1,
    price: 9.9,
    currency: 'CNY',
    billingCycle: BillingCycle.MONTHLY,
    features: ['创建案件', '创建辩论', '分析文档'],
    limits: {
      cases: 50,
      debates: 20,
      documents: 100,
      storage: 1024,
      aiTokens: 100000,
      users: 1,
      features: ['创建案件', '创建辩论', '分析文档'],
    },
    permissions: {
      canCreateCase: true,
      canCreateDebate: true,
      canAnalyzeDocument: true,
      canSearchLawArticle: true,
      canUseAdvancedFeatures: false,
      canExportData: false,
      canUseBatchProcessing: false,
      canUseDeepSeek: true,
      canUseZhipuAI: false,
      canUseCustomModel: false,
      prioritySupport: false,
      dedicatedSupport: false,
      customPermissions: {},
    },
    isActive: true,
    sortOrder: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'professional',
    name: 'professional',
    displayName: '专业版',
    description: '适合专业律师',
    tier: MembershipTier.PROFESSIONAL,
    level: 2,
    price: 29.9,
    currency: 'CNY',
    billingCycle: BillingCycle.MONTHLY,
    features: ['创建案件', '创建辩论', '分析文档', '搜索法条', '高级功能'],
    limits: {
      cases: 100,
      debates: 50,
      documents: 500,
      storage: 5120,
      aiTokens: 500000,
      users: 5,
      features: ['创建案件', '创建辩论', '分析文档', '搜索法条', '高级功能'],
    },
    permissions: {
      canCreateCase: true,
      canCreateDebate: true,
      canAnalyzeDocument: true,
      canSearchLawArticle: true,
      canUseAdvancedFeatures: true,
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
    sortOrder: 2,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

describe('TierSelection', () => {
  it('should render correctly with given props', () => {
    render(
      <TierSelection
        tiers={mockTiers}
        currentTier={null}
        selectedTierId={null}
        onTierSelect={jest.fn()}
        selectedBillingCycle={BillingCycle.MONTHLY}
        onBillingCycleChange={jest.fn()}
      />
    );

    expect(screen.getByText('计费周期')).toBeInTheDocument();
    expect(screen.getByText('月付')).toBeInTheDocument();
    expect(screen.getByText('季付')).toBeInTheDocument();
    expect(screen.getByText('年付')).toBeInTheDocument();
    expect(screen.getByText('基础版')).toBeInTheDocument();
    expect(screen.getByText('专业版')).toBeInTheDocument();
  });

  it('should display current tier badge', () => {
    render(
      <TierSelection
        tiers={mockTiers}
        currentTier={MembershipTier.BASIC}
        selectedTierId={null}
        onTierSelect={jest.fn()}
        selectedBillingCycle={BillingCycle.MONTHLY}
        onBillingCycleChange={jest.fn()}
      />
    );

    expect(screen.getByText('当前方案')).toBeInTheDocument();
  });

  it('should call onTierSelect when a tier is clicked', () => {
    const onTierSelect = jest.fn();
    render(
      <TierSelection
        tiers={mockTiers}
        currentTier={null}
        selectedTierId={null}
        onTierSelect={onTierSelect}
        selectedBillingCycle={BillingCycle.MONTHLY}
        onBillingCycleChange={jest.fn()}
      />
    );

    const basicTier = screen.getByText('基础版').closest('div');
    fireEvent.click(basicTier!);

    expect(onTierSelect).toHaveBeenCalledWith('basic');
  });

  it('should call onBillingCycleChange when a billing cycle is selected', () => {
    const onBillingCycleChange = jest.fn();
    render(
      <TierSelection
        tiers={mockTiers}
        currentTier={null}
        selectedTierId={null}
        onTierSelect={jest.fn()}
        selectedBillingCycle={BillingCycle.MONTHLY}
        onBillingCycleChange={onBillingCycleChange}
      />
    );

    const quarterlyButton = screen.getByText('季付');
    fireEvent.click(quarterlyButton);

    expect(onBillingCycleChange).toHaveBeenCalledWith(BillingCycle.QUARTERLY);
  });

  it('should show selected tier correctly', () => {
    render(
      <TierSelection
        tiers={mockTiers}
        currentTier={null}
        selectedTierId='professional'
        onTierSelect={jest.fn()}
        selectedBillingCycle={BillingCycle.MONTHLY}
        onBillingCycleChange={jest.fn()}
      />
    );

    expect(screen.getByText('已选择')).toBeInTheDocument();
  });

  it('should display correct price for monthly billing', () => {
    render(
      <TierSelection
        tiers={mockTiers}
        currentTier={null}
        selectedTierId={null}
        onTierSelect={jest.fn()}
        selectedBillingCycle={BillingCycle.MONTHLY}
        onBillingCycleChange={jest.fn()}
      />
    );

    // 月付价格：9.9四舍五入为10，29.9四舍五入为30
    expect(screen.getByText('¥10')).toBeInTheDocument();
    expect(screen.getByText('¥30')).toBeInTheDocument();
  });

  it('should display correct price for quarterly billing', () => {
    render(
      <TierSelection
        tiers={mockTiers}
        currentTier={null}
        selectedTierId={null}
        onTierSelect={jest.fn()}
        selectedBillingCycle={BillingCycle.QUARTERLY}
        onBillingCycleChange={jest.fn()}
      />
    );

    // 季付价格：10*3=30，30*3=90
    expect(screen.getByText('¥30')).toBeInTheDocument();
    expect(screen.getByText('¥90')).toBeInTheDocument();
  });

  it('should display correct price for yearly billing', () => {
    render(
      <TierSelection
        tiers={mockTiers}
        currentTier={null}
        selectedTierId={null}
        onTierSelect={jest.fn()}
        selectedBillingCycle={BillingCycle.YEARLY}
        onBillingCycleChange={jest.fn()}
      />
    );

    // 年付价格：9.9*12=119，29.9*12=359
    expect(screen.getByText('¥119')).toBeInTheDocument();
    expect(screen.getByText('¥359')).toBeInTheDocument();
  });

  it('should display savings for quarterly billing', () => {
    render(
      <TierSelection
        tiers={mockTiers}
        currentTier={null}
        selectedTierId={null}
        onTierSelect={jest.fn()}
        selectedBillingCycle={BillingCycle.QUARTERLY}
        onBillingCycleChange={jest.fn()}
      />
    );

    const savingsElements = screen.getAllByText(/节省 ¥/);
    expect(savingsElements.length).toBeGreaterThan(0);
  });

  it('should display savings for yearly billing', () => {
    render(
      <TierSelection
        tiers={mockTiers}
        currentTier={null}
        selectedTierId={null}
        onTierSelect={jest.fn()}
        selectedBillingCycle={BillingCycle.YEARLY}
        onBillingCycleChange={jest.fn()}
      />
    );

    const savingsElements = screen.getAllByText(/节省 ¥/);
    expect(savingsElements.length).toBeGreaterThan(0);
  });

  it('should display tier features', () => {
    render(
      <TierSelection
        tiers={mockTiers}
        currentTier={null}
        selectedTierId={null}
        onTierSelect={jest.fn()}
        selectedBillingCycle={BillingCycle.MONTHLY}
        onBillingCycleChange={jest.fn()}
      />
    );

    // 使用getAllByText检查特征是否在页面中显示
    expect(screen.getAllByText('创建案件').length).toBeGreaterThan(0);
    expect(screen.getAllByText('创建辩论').length).toBeGreaterThan(0);
    expect(screen.getAllByText('分析文档').length).toBeGreaterThan(0);
  });
});
