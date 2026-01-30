/**
 * 角色检测系统测试
 *
 * 测试覆盖：
 * 1. detectUserRole - 用户角色检测
 * 2. buildUserContext - 构建用户上下文
 * 3. detectPreferredRole - 检测首选角色
 * 4. switchUserRole - 角色切换
 */

import { UserRole } from '@prisma/client';
import {
  detectUserRole,
  buildUserContext,
  detectPreferredRole,
  switchUserRole,
  HomepageRole,
  UserContext,
} from '@/lib/user/role-detector';
import { QualificationStatus } from '@/types/qualification';
import { EnterpriseStatus } from '@/types/enterprise';

// =============================================================================
// 测试数据
// =============================================================================

const mockLawyerUser = {
  id: 'user-lawyer-1',
  email: 'lawyer@test.com',
  username: 'lawyer1',
  name: '张律师',
  role: UserRole.LAWYER,
  status: 'ACTIVE' as const,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  lawyerQualifications: [
    {
      id: 'qual-1',
      userId: 'user-lawyer-1',
      licenseNumber: '12345678901234567',
      fullName: '张律师',
      idCardNumber: '110101199001011234',
      lawFirm: '测试律师事务所',
      licensePhoto: null,
      status: QualificationStatus.APPROVED,
      submittedAt: new Date('2024-01-01'),
      reviewedAt: new Date('2024-01-02'),
      reviewerId: 'admin-1',
      reviewNotes: '审核通过',
      verificationData: null,
      metadata: null,
    },
  ],
  enterpriseAccount: null,
};

const mockEnterpriseUser = {
  id: 'user-enterprise-1',
  email: 'enterprise@test.com',
  username: 'enterprise1',
  name: '企业法务',
  role: UserRole.ENTERPRISE,
  status: 'ACTIVE' as const,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  lawyerQualifications: [],
  enterpriseAccount: {
    id: 'ent-1',
    userId: 'user-enterprise-1',
    enterpriseName: '测试科技有限公司',
    creditCode: '91110000000000000X',
    legalPerson: '李总',
    industryType: '科技',
    businessLicense: null,
    status: EnterpriseStatus.APPROVED,
    submittedAt: new Date('2024-01-01'),
    reviewedAt: new Date('2024-01-02'),
    reviewerId: 'admin-1',
    reviewNotes: '审核通过',
    verificationData: null,
    expiresAt: null,
    metadata: null,
  },
};

const mockDualRoleUser = {
  id: 'user-dual-1',
  email: 'dual@test.com',
  username: 'dual1',
  name: '双重角色用户',
  role: UserRole.LAWYER,
  status: 'ACTIVE' as const,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  lawyerQualifications: [
    {
      id: 'qual-2',
      userId: 'user-dual-1',
      licenseNumber: '12345678901234568',
      fullName: '双重角色用户',
      idCardNumber: '110101199001011235',
      lawFirm: '测试律师事务所',
      licensePhoto: null,
      status: QualificationStatus.APPROVED,
      submittedAt: new Date('2024-01-01'),
      reviewedAt: new Date('2024-01-02'),
      reviewerId: 'admin-1',
      reviewNotes: '审核通过',
      verificationData: null,
      metadata: null,
    },
  ],
  enterpriseAccount: {
    id: 'ent-2',
    userId: 'user-dual-1',
    enterpriseName: '双重角色科技有限公司',
    creditCode: '91110000000000001X',
    legalPerson: '双重角色用户',
    industryType: '科技',
    businessLicense: null,
    status: EnterpriseStatus.APPROVED,
    submittedAt: new Date('2024-01-01'),
    reviewedAt: new Date('2024-01-02'),
    reviewerId: 'admin-1',
    reviewNotes: '审核通过',
    verificationData: null,
    expiresAt: null,
    metadata: null,
  },
};

const mockGeneralUser = {
  id: 'user-general-1',
  email: 'general@test.com',
  username: 'general1',
  name: '普通用户',
  role: UserRole.USER,
  status: 'ACTIVE' as const,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  lawyerQualifications: [],
  enterpriseAccount: null,
};

const mockPendingLawyerUser = {
  id: 'user-pending-1',
  email: 'pending@test.com',
  username: 'pending1',
  name: '待审核律师',
  role: UserRole.USER,
  status: 'ACTIVE' as const,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  lawyerQualifications: [
    {
      id: 'qual-3',
      userId: 'user-pending-1',
      licenseNumber: '12345678901234569',
      fullName: '待审核律师',
      idCardNumber: '110101199001011236',
      lawFirm: '测试律师事务所',
      licensePhoto: null,
      status: QualificationStatus.PENDING,
      submittedAt: new Date('2024-01-01'),
      reviewedAt: null,
      reviewerId: null,
      reviewNotes: null,
      verificationData: null,
      metadata: null,
    },
  ],
  enterpriseAccount: null,
};

// =============================================================================
// 测试套件
// =============================================================================

describe('角色检测系统', () => {
  describe('detectUserRole - 用户角色检测', () => {
    it('应该正确检测律师用户', () => {
      const role = detectUserRole(mockLawyerUser);
      expect(role).toBe(HomepageRole.LAWYER);
    });

    it('应该正确检测企业法务用户', () => {
      const role = detectUserRole(mockEnterpriseUser);
      expect(role).toBe(HomepageRole.ENTERPRISE);
    });

    it('应该正确检测普通用户', () => {
      const role = detectUserRole(mockGeneralUser);
      expect(role).toBe(HomepageRole.GENERAL);
    });

    it('应该正确检测双重角色用户（默认律师）', () => {
      const role = detectUserRole(mockDualRoleUser);
      expect(role).toBe(HomepageRole.LAWYER);
    });

    it('应该正确检测待审核律师用户（作为普通用户）', () => {
      const role = detectUserRole(mockPendingLawyerUser);
      expect(role).toBe(HomepageRole.GENERAL);
    });

    it('应该处理没有认证信息的用户', () => {
      const userWithoutQualifications = {
        ...mockGeneralUser,
        lawyerQualifications: [],
        enterpriseAccount: null,
      };
      const role = detectUserRole(userWithoutQualifications);
      expect(role).toBe(HomepageRole.GENERAL);
    });

    it('应该处理被拒绝的律师认证', () => {
      const rejectedLawyerUser = {
        ...mockLawyerUser,
        role: UserRole.USER,
        lawyerQualifications: [
          {
            ...mockLawyerUser.lawyerQualifications[0],
            status: QualificationStatus.REJECTED,
          },
        ],
      };
      const role = detectUserRole(rejectedLawyerUser);
      expect(role).toBe(HomepageRole.GENERAL);
    });

    it('应该处理被拒绝的企业认证', () => {
      const rejectedEnterpriseUser = {
        ...mockEnterpriseUser,
        role: UserRole.USER,
        enterpriseAccount: {
          ...mockEnterpriseUser.enterpriseAccount!,
          status: EnterpriseStatus.REJECTED,
        },
      };
      const role = detectUserRole(rejectedEnterpriseUser);
      expect(role).toBe(HomepageRole.GENERAL);
    });

    it('应该处理过期的律师认证', () => {
      const expiredLawyerUser = {
        ...mockLawyerUser,
        role: UserRole.USER,
        lawyerQualifications: [
          {
            ...mockLawyerUser.lawyerQualifications[0],
            status: QualificationStatus.EXPIRED,
          },
        ],
      };
      const role = detectUserRole(expiredLawyerUser);
      expect(role).toBe(HomepageRole.GENERAL);
    });

    it('应该处理暂停的企业账户', () => {
      const suspendedEnterpriseUser = {
        ...mockEnterpriseUser,
        role: UserRole.USER,
        enterpriseAccount: {
          ...mockEnterpriseUser.enterpriseAccount!,
          status: EnterpriseStatus.SUSPENDED,
        },
      };
      const role = detectUserRole(suspendedEnterpriseUser);
      expect(role).toBe(HomepageRole.GENERAL);
    });
  });

  describe('buildUserContext - 构建用户上下文', () => {
    it('应该为律师用户构建完整上下文', () => {
      const context = buildUserContext(mockLawyerUser);

      expect(context.userId).toBe(mockLawyerUser.id);
      expect(context.email).toBe(mockLawyerUser.email);
      expect(context.name).toBe(mockLawyerUser.name);
      expect(context.role).toBe(UserRole.LAWYER);
      expect(context.homepageRole).toBe(HomepageRole.LAWYER);
      expect(context.isLawyer).toBe(true);
      expect(context.isEnterprise).toBe(false);
      expect(context.isDualRole).toBe(false);
      expect(context.lawyerQualification).toBeDefined();
      expect(context.lawyerQualification?.status).toBe(
        QualificationStatus.APPROVED
      );
      expect(context.enterpriseAccount).toBeNull();
    });

    it('应该为企业法务用户构建完整上下文', () => {
      const context = buildUserContext(mockEnterpriseUser);

      expect(context.userId).toBe(mockEnterpriseUser.id);
      expect(context.email).toBe(mockEnterpriseUser.email);
      expect(context.name).toBe(mockEnterpriseUser.name);
      expect(context.role).toBe(UserRole.ENTERPRISE);
      expect(context.homepageRole).toBe(HomepageRole.ENTERPRISE);
      expect(context.isLawyer).toBe(false);
      expect(context.isEnterprise).toBe(true);
      expect(context.isDualRole).toBe(false);
      expect(context.lawyerQualification).toBeNull();
      expect(context.enterpriseAccount).toBeDefined();
      expect(context.enterpriseAccount?.status).toBe(EnterpriseStatus.APPROVED);
    });

    it('应该为双重角色用户构建完整上下文', () => {
      const context = buildUserContext(mockDualRoleUser);

      expect(context.userId).toBe(mockDualRoleUser.id);
      expect(context.homepageRole).toBe(HomepageRole.LAWYER);
      expect(context.isLawyer).toBe(true);
      expect(context.isEnterprise).toBe(true);
      expect(context.isDualRole).toBe(true);
      expect(context.lawyerQualification).toBeDefined();
      expect(context.enterpriseAccount).toBeDefined();
      expect(context.availableRoles).toHaveLength(2);
      expect(context.availableRoles).toContain(HomepageRole.LAWYER);
      expect(context.availableRoles).toContain(HomepageRole.ENTERPRISE);
    });

    it('应该为普通用户构建基本上下文', () => {
      const context = buildUserContext(mockGeneralUser);

      expect(context.userId).toBe(mockGeneralUser.id);
      expect(context.homepageRole).toBe(HomepageRole.GENERAL);
      expect(context.isLawyer).toBe(false);
      expect(context.isEnterprise).toBe(false);
      expect(context.isDualRole).toBe(false);
      expect(context.lawyerQualification).toBeNull();
      expect(context.enterpriseAccount).toBeNull();
      expect(context.availableRoles).toHaveLength(1);
      expect(context.availableRoles).toContain(HomepageRole.GENERAL);
    });

    it('应该正确设置可用角色列表', () => {
      const lawyerContext = buildUserContext(mockLawyerUser);
      expect(lawyerContext.availableRoles).toEqual([HomepageRole.LAWYER]);

      const enterpriseContext = buildUserContext(mockEnterpriseUser);
      expect(enterpriseContext.availableRoles).toEqual([
        HomepageRole.ENTERPRISE,
      ]);

      const dualContext = buildUserContext(mockDualRoleUser);
      expect(dualContext.availableRoles).toEqual([
        HomepageRole.LAWYER,
        HomepageRole.ENTERPRISE,
      ]);

      const generalContext = buildUserContext(mockGeneralUser);
      expect(generalContext.availableRoles).toEqual([HomepageRole.GENERAL]);
    });
  });

  describe('detectPreferredRole - 检测首选角色', () => {
    it('应该返回用户偏好的角色（如果有效）', () => {
      const preferredRole = detectPreferredRole(
        mockDualRoleUser,
        HomepageRole.ENTERPRISE
      );
      expect(preferredRole).toBe(HomepageRole.ENTERPRISE);
    });

    it('应该在偏好角色无效时返回默认角色', () => {
      const preferredRole = detectPreferredRole(
        mockLawyerUser,
        HomepageRole.ENTERPRISE
      );
      expect(preferredRole).toBe(HomepageRole.LAWYER);
    });

    it('应该在没有偏好时返回默认角色', () => {
      const preferredRole = detectPreferredRole(mockLawyerUser, null);
      expect(preferredRole).toBe(HomepageRole.LAWYER);
    });

    it('应该在偏好角色为undefined时返回默认角色', () => {
      const preferredRole = detectPreferredRole(mockLawyerUser, undefined);
      expect(preferredRole).toBe(HomepageRole.LAWYER);
    });

    it('应该验证双重角色用户的偏好选择', () => {
      const lawyerPreferred = detectPreferredRole(
        mockDualRoleUser,
        HomepageRole.LAWYER
      );
      expect(lawyerPreferred).toBe(HomepageRole.LAWYER);

      const enterprisePreferred = detectPreferredRole(
        mockDualRoleUser,
        HomepageRole.ENTERPRISE
      );
      expect(enterprisePreferred).toBe(HomepageRole.ENTERPRISE);
    });

    it('应该拒绝普通用户选择律师角色', () => {
      const preferredRole = detectPreferredRole(
        mockGeneralUser,
        HomepageRole.LAWYER
      );
      expect(preferredRole).toBe(HomepageRole.GENERAL);
    });

    it('应该拒绝普通用户选择企业角色', () => {
      const preferredRole = detectPreferredRole(
        mockGeneralUser,
        HomepageRole.ENTERPRISE
      );
      expect(preferredRole).toBe(HomepageRole.GENERAL);
    });
  });

  describe('switchUserRole - 角色切换', () => {
    it('应该允许双重角色用户切换到律师角色', () => {
      const result = switchUserRole(mockDualRoleUser, HomepageRole.LAWYER);

      expect(result.success).toBe(true);
      expect(result.role).toBe(HomepageRole.LAWYER);
      expect(result.message).toContain('成功');
    });

    it('应该允许双重角色用户切换到企业角色', () => {
      const result = switchUserRole(mockDualRoleUser, HomepageRole.ENTERPRISE);

      expect(result.success).toBe(true);
      expect(result.role).toBe(HomepageRole.ENTERPRISE);
      expect(result.message).toContain('成功');
    });

    it('应该拒绝律师用户切换到企业角色', () => {
      const result = switchUserRole(mockLawyerUser, HomepageRole.ENTERPRISE);

      expect(result.success).toBe(false);
      expect(result.role).toBe(HomepageRole.LAWYER);
      expect(result.message).toContain('无权限');
    });

    it('应该拒绝企业用户切换到律师角色', () => {
      const result = switchUserRole(mockEnterpriseUser, HomepageRole.LAWYER);

      expect(result.success).toBe(false);
      expect(result.role).toBe(HomepageRole.ENTERPRISE);
      expect(result.message).toContain('无权限');
    });

    it('应该拒绝普通用户切换到律师角色', () => {
      const result = switchUserRole(mockGeneralUser, HomepageRole.LAWYER);

      expect(result.success).toBe(false);
      expect(result.role).toBe(HomepageRole.GENERAL);
      expect(result.message).toContain('无权限');
    });

    it('应该拒绝普通用户切换到企业角色', () => {
      const result = switchUserRole(mockGeneralUser, HomepageRole.ENTERPRISE);

      expect(result.success).toBe(false);
      expect(result.role).toBe(HomepageRole.GENERAL);
      expect(result.message).toContain('无权限');
    });

    it('应该允许用户切换到当前角色（无操作）', () => {
      const result = switchUserRole(mockLawyerUser, HomepageRole.LAWYER);

      expect(result.success).toBe(true);
      expect(result.role).toBe(HomepageRole.LAWYER);
    });

    it('应该返回正确的错误信息', () => {
      const result = switchUserRole(mockLawyerUser, HomepageRole.ENTERPRISE);

      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('边界情况和错误处理', () => {
    it('应该处理空的lawyerQualifications数组', () => {
      const userWithEmptyQualifications = {
        ...mockLawyerUser,
        lawyerQualifications: [],
      };
      const role = detectUserRole(userWithEmptyQualifications);
      expect(role).toBe(HomepageRole.GENERAL);
    });

    it('应该处理null的enterpriseAccount', () => {
      const userWithNullEnterprise = {
        ...mockEnterpriseUser,
        enterpriseAccount: null,
      };
      const role = detectUserRole(userWithNullEnterprise);
      expect(role).toBe(HomepageRole.GENERAL);
    });

    it('应该处理多个律师认证（取第一个已批准的）', () => {
      const userWithMultipleQualifications = {
        ...mockLawyerUser,
        lawyerQualifications: [
          {
            ...mockLawyerUser.lawyerQualifications[0],
            status: QualificationStatus.PENDING,
          },
          {
            ...mockLawyerUser.lawyerQualifications[0],
            id: 'qual-2',
            status: QualificationStatus.APPROVED,
          },
        ],
      };
      const context = buildUserContext(userWithMultipleQualifications);
      expect(context.lawyerQualification?.status).toBe(
        QualificationStatus.APPROVED
      );
    });

    it('应该处理审核中的认证状态', () => {
      const underReviewUser = {
        ...mockLawyerUser,
        role: UserRole.USER,
        lawyerQualifications: [
          {
            ...mockLawyerUser.lawyerQualifications[0],
            status: QualificationStatus.UNDER_REVIEW,
          },
        ],
      };
      const role = detectUserRole(underReviewUser);
      expect(role).toBe(HomepageRole.GENERAL);
    });

    it('应该处理过期的企业账户', () => {
      const expiredEnterpriseUser = {
        ...mockEnterpriseUser,
        role: UserRole.USER,
        enterpriseAccount: {
          ...mockEnterpriseUser.enterpriseAccount!,
          status: EnterpriseStatus.EXPIRED,
        },
      };
      const role = detectUserRole(expiredEnterpriseUser);
      expect(role).toBe(HomepageRole.GENERAL);
    });
  });

  describe('辅助函数测试', () => {
    it('isLawyerQualificationValid - 应该正确验证律师认证状态', () => {
      const {
        isLawyerQualificationValid,
      } = require('@/lib/user/role-detector');

      expect(isLawyerQualificationValid(QualificationStatus.APPROVED)).toBe(
        true
      );
      expect(isLawyerQualificationValid(QualificationStatus.PENDING)).toBe(
        false
      );
      expect(isLawyerQualificationValid(QualificationStatus.UNDER_REVIEW)).toBe(
        false
      );
      expect(isLawyerQualificationValid(QualificationStatus.REJECTED)).toBe(
        false
      );
      expect(isLawyerQualificationValid(QualificationStatus.EXPIRED)).toBe(
        false
      );
    });

    it('isEnterpriseAccountValid - 应该正确验证企业账户状态', () => {
      const { isEnterpriseAccountValid } = require('@/lib/user/role-detector');

      expect(isEnterpriseAccountValid(EnterpriseStatus.APPROVED)).toBe(true);
      expect(isEnterpriseAccountValid(EnterpriseStatus.PENDING)).toBe(false);
      expect(isEnterpriseAccountValid(EnterpriseStatus.UNDER_REVIEW)).toBe(
        false
      );
      expect(isEnterpriseAccountValid(EnterpriseStatus.REJECTED)).toBe(false);
      expect(isEnterpriseAccountValid(EnterpriseStatus.EXPIRED)).toBe(false);
      expect(isEnterpriseAccountValid(EnterpriseStatus.SUSPENDED)).toBe(false);
    });
  });
});
