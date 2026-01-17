/**
 * 权限配置测试
 */

import type { MembershipPermissionConfig } from '@/types/membership';
import { prisma, runSeedScript } from './seed-membership-setup';

describe('权限配置', () => {
  beforeAll(async () => {
    // 运行seed脚本初始化会员等级配置
    await runSeedScript();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('免费版权限应该正确', async () => {
    const freeTier = await prisma.membershipTier.findUnique({
      where: { name: 'free' },
    });

    const permissions =
      freeTier?.permissions as unknown as MembershipPermissionConfig;

    expect(permissions?.canCreateCase).toBe(true);
    expect(permissions?.canCreateDebate).toBe(false);
    expect(permissions?.canAnalyzeDocument).toBe(true);
    expect(permissions?.canUseAdvancedFeatures).toBe(false);
    expect(permissions?.canExportData).toBe(false);
    expect(permissions?.canUseBatchProcessing).toBe(false);
    expect(permissions?.prioritySupport).toBe(false);
    expect(permissions?.dedicatedSupport).toBe(false);
  });

  it('基础版权限应该正确', async () => {
    const basicTier = await prisma.membershipTier.findUnique({
      where: { name: 'basic' },
    });

    const permissions =
      basicTier?.permissions as unknown as MembershipPermissionConfig;

    expect(permissions?.canCreateCase).toBe(true);
    expect(permissions?.canCreateDebate).toBe(true);
    expect(permissions?.canAnalyzeDocument).toBe(true);
    expect(permissions?.canUseAdvancedFeatures).toBe(true);
    expect(permissions?.canExportData).toBe(true);
    expect(permissions?.canUseBatchProcessing).toBe(false);
    expect(permissions?.prioritySupport).toBe(true);
    expect(permissions?.dedicatedSupport).toBe(false);
  });

  it('专业版权限应该正确', async () => {
    const professionalTier = await prisma.membershipTier.findUnique({
      where: { name: 'professional' },
    });

    const permissions =
      professionalTier?.permissions as unknown as MembershipPermissionConfig;

    expect(permissions?.canCreateCase).toBe(true);
    expect(permissions?.canCreateDebate).toBe(true);
    expect(permissions?.canAnalyzeDocument).toBe(true);
    expect(permissions?.canUseAdvancedFeatures).toBe(true);
    expect(permissions?.canExportData).toBe(true);
    expect(permissions?.canUseBatchProcessing).toBe(true);
    expect(permissions?.canUseCustomModel).toBe(true);
    expect(permissions?.prioritySupport).toBe(true);
    expect(permissions?.dedicatedSupport).toBe(true);
  });

  it('企业版权限应该正确', async () => {
    const enterpriseTier = await prisma.membershipTier.findUnique({
      where: { name: 'enterprise' },
    });

    const permissions =
      enterpriseTier?.permissions as unknown as MembershipPermissionConfig;

    expect(permissions?.canCreateCase).toBe(true);
    expect(permissions?.canCreateDebate).toBe(true);
    expect(permissions?.canAnalyzeDocument).toBe(true);
    expect(permissions?.canUseAdvancedFeatures).toBe(true);
    expect(permissions?.canExportData).toBe(true);
    expect(permissions?.canUseBatchProcessing).toBe(true);
    expect(permissions?.canUseCustomModel).toBe(true);
    expect(permissions?.prioritySupport).toBe(true);
    expect(permissions?.dedicatedSupport).toBe(true);
  });

  it('专业版应该有自定义权限', async () => {
    const professionalTier = await prisma.membershipTier.findUnique({
      where: { name: 'professional' },
    });

    const permissions =
      professionalTier?.permissions as unknown as MembershipPermissionConfig;

    expect(permissions?.customPermissions).toBeDefined();
    expect(
      (permissions?.customPermissions as Record<string, unknown>)
        .canAccessAdvancedAnalytics
    ).toBe(true);
  });

  it('企业版应该有完整的企业自定义权限', async () => {
    const enterpriseTier = await prisma.membershipTier.findUnique({
      where: { name: 'enterprise' },
    });

    const permissions =
      enterpriseTier?.permissions as unknown as MembershipPermissionConfig;
    const customPerms = permissions?.customPermissions as Record<
      string,
      unknown
    >;

    expect(customPerms?.canAccessApi).toBe(true);
    expect(customPerms?.canUseWhiteLabel).toBe(true);
    expect(customPerms?.canManageTeamMembers).toBe(true);
    expect(customPerms?.canAccessCustomReports).toBe(true);
  });
});
