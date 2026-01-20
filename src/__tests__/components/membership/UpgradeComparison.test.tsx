import React from 'react';
import { render, screen } from '@testing-library/react';
import { UpgradeComparison } from '@/components/membership/UpgradeComparison';
import { MembershipTier, BillingCycle } from '@/types/membership';

describe('UpgradeComparison', () => {
  const currentTierMock = {
    id: MembershipTier.FREE,
    name: '免费版',
    displayName: '免费版',
    description: '基础功能',
    tier: MembershipTier.FREE,
    price: 0,
    currency: 'CNY',
    billingCycle: BillingCycle.MONTHLY,
    features: ['基础辩论生成', '每日3次AI对话'],
    permissions: {
      canCreateCase: true,
      canCreateDebate: true,
      canAnalyzeDocument: false,
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const targetTierMock = {
    id: MembershipTier.PROFESSIONAL,
    name: '专业版',
    displayName: '专业版',
    description: '高级功能',
    tier: MembershipTier.PROFESSIONAL,
    price: 99,
    currency: 'CNY',
    billingCycle: BillingCycle.MONTHLY,
    features: ['无限次AI对话', '高级辩论生成', '文档分析', '历史记录导出'],
    permissions: {
      canCreateCase: true,
      canCreateDebate: true,
      canAnalyzeDocument: true,
      canSearchLawArticle: true,
      canUseAdvancedFeatures: true,
      canExportData: true,
      canUseBatchProcessing: true,
      canUseDeepSeek: true,
      canUseZhipuAI: true,
      canUseCustomModel: false,
      prioritySupport: true,
      dedicatedSupport: false,
      customPermissions: {},
    },
    isActive: true,
    sortOrder: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('应该正确渲染组件', () => {
    render(
      <UpgradeComparison
        currentTier={currentTierMock}
        targetTier={targetTierMock}
      />
    );

    expect(screen.getByText('功能')).toBeInTheDocument();
    expect(screen.getByText('当前等级')).toBeInTheDocument();
    expect(screen.getByText('升级后等级')).toBeInTheDocument();
  });

  it('应该正确显示当前等级名称', () => {
    render(
      <UpgradeComparison
        currentTier={currentTierMock}
        targetTier={targetTierMock}
      />
    );

    expect(screen.getByText('免费版')).toBeInTheDocument();
  });

  it('应该正确显示目标等级名称', () => {
    render(
      <UpgradeComparison
        currentTier={currentTierMock}
        targetTier={targetTierMock}
      />
    );

    expect(screen.getByText('专业版')).toBeInTheDocument();
  });

  it('应该正确显示所有功能', () => {
    render(
      <UpgradeComparison
        currentTier={currentTierMock}
        targetTier={targetTierMock}
      />
    );

    expect(screen.getByText('基础辩论生成')).toBeInTheDocument();
    expect(screen.getByText('每日3次AI对话')).toBeInTheDocument();
    expect(screen.getByText('无限次AI对话')).toBeInTheDocument();
    expect(screen.getByText('高级辩论生成')).toBeInTheDocument();
  });

  it('应该为新增功能显示标记', () => {
    render(
      <UpgradeComparison
        currentTier={currentTierMock}
        targetTier={targetTierMock}
      />
    );

    const newFeatures = ['无限次AI对话', '高级辩论生成'];
    newFeatures.forEach(feature => {
      const featureText = screen.getByText(feature);
      expect(featureText).toHaveClass('text-blue-600');
    });
  });

  it('应该正确显示功能在当前等级中的状态', () => {
    render(
      <UpgradeComparison
        currentTier={currentTierMock}
        targetTier={targetTierMock}
      />
    );

    // 检查基础功能应该有对勾
    expect(screen.getByText('基础辩论生成')).toBeInTheDocument();
  });

  it('应该正确显示功能在目标等级中的状态', () => {
    render(
      <UpgradeComparison
        currentTier={currentTierMock}
        targetTier={targetTierMock}
      />
    );

    // 所有目标功能都应该在右侧显示
    expect(screen.getByText('文档分析')).toBeInTheDocument();
  });

  it('应该处理currentTier为null的情况', () => {
    render(
      <UpgradeComparison currentTier={null} targetTier={targetTierMock} />
    );

    expect(screen.getByText('当前等级')).toBeInTheDocument();
    expect(screen.getByText('免费版')).toBeInTheDocument();
  });

  it('应该正确合并两个等级的功能', () => {
    render(
      <UpgradeComparison
        currentTier={currentTierMock}
        targetTier={targetTierMock}
      />
    );

    // 应该显示所有功能（合并去重）
    const allFeatures = new Set([
      ...currentTierMock.features,
      ...targetTierMock.features,
    ]);

    allFeatures.forEach(feature => {
      expect(screen.getByText(feature)).toBeInTheDocument();
    });
  });
});
