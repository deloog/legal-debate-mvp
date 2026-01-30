/**
 * 首页路由测试
 *
 * 测试覆盖：
 * 1. 未登录用户展示普通用户版首页
 * 2. 律师用户展示律师版首页
 * 3. 企业法务用户展示企业法务版首页
 * 4. 双重角色用户展示律师版首页（默认）
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '@/app/page';
import { useAuth } from '@/app/providers/AuthProvider';
import { UserRole } from '@prisma/client';
import { QualificationStatus } from '@/types/qualification';
import { EnterpriseStatus } from '@/types/enterprise';

// Mock AuthProvider
jest.mock('@/app/providers/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

// Mock DynamicHomepage组件
jest.mock('@/components/homepage/DynamicHomepage', () => ({
  DynamicHomepage: ({ config }: { config: { role: string } }) => (
    <div data-testid='dynamic-homepage' data-role={config.role}>
      Dynamic Homepage - {config.role}
    </div>
  ),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('首页路由', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('未登录用户', () => {
    it('应该展示普通用户版首页', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
      });

      render(<Home />);

      await waitFor(() => {
        const homepage = screen.getByTestId('dynamic-homepage');
        expect(homepage).toBeInTheDocument();
        expect(homepage).toHaveAttribute('data-role', 'GENERAL');
      });
    });
  });

  describe('律师用户', () => {
    it('应该展示律师版首页', async () => {
      const mockLawyerUser = {
        id: 'user-1',
        email: 'lawyer@test.com',
        username: 'lawyer1',
        name: '张律师',
        role: UserRole.LAWYER,
        status: 'ACTIVE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lawyerQualifications: [
          {
            id: 'qual-1',
            userId: 'user-1',
            licenseNumber: '12345678901234567',
            fullName: '张律师',
            idCardNumber: '110101199001011234',
            lawFirm: '测试律师事务所',
            licensePhoto: null,
            status: QualificationStatus.APPROVED,
            submittedAt: new Date(),
            reviewedAt: new Date(),
            reviewerId: 'admin-1',
            reviewNotes: '审核通过',
            verificationData: null,
            metadata: null,
          },
        ],
        enterpriseAccount: null,
      };

      mockUseAuth.mockReturnValue({
        user: mockLawyerUser,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
      });

      render(<Home />);

      await waitFor(() => {
        const homepage = screen.getByTestId('dynamic-homepage');
        expect(homepage).toBeInTheDocument();
        expect(homepage).toHaveAttribute('data-role', 'LAWYER');
      });
    });
  });

  describe('企业法务用户', () => {
    it('应该展示企业法务版首页', async () => {
      const mockEnterpriseUser = {
        id: 'user-2',
        email: 'enterprise@test.com',
        username: 'enterprise1',
        name: '企业法务',
        role: UserRole.ENTERPRISE,
        status: 'ACTIVE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lawyerQualifications: [],
        enterpriseAccount: {
          id: 'ent-1',
          userId: 'user-2',
          enterpriseName: '测试科技有限公司',
          creditCode: '91110000000000000X',
          legalPerson: '李总',
          industryType: '科技',
          businessLicense: null,
          status: EnterpriseStatus.APPROVED,
          submittedAt: new Date(),
          reviewedAt: new Date(),
          reviewerId: 'admin-1',
          reviewNotes: '审核通过',
          verificationData: null,
          expiresAt: null,
          metadata: null,
        },
      };

      mockUseAuth.mockReturnValue({
        user: mockEnterpriseUser,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
      });

      render(<Home />);

      await waitFor(() => {
        const homepage = screen.getByTestId('dynamic-homepage');
        expect(homepage).toBeInTheDocument();
        expect(homepage).toHaveAttribute('data-role', 'ENTERPRISE');
      });
    });
  });

  describe('双重角色用户', () => {
    it('应该展示律师版首页（默认优先律师）', async () => {
      const mockDualRoleUser = {
        id: 'user-3',
        email: 'dual@test.com',
        username: 'dual1',
        name: '双重角色用户',
        role: UserRole.LAWYER,
        status: 'ACTIVE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lawyerQualifications: [
          {
            id: 'qual-2',
            userId: 'user-3',
            licenseNumber: '12345678901234568',
            fullName: '双重角色用户',
            idCardNumber: '110101199001011235',
            lawFirm: '测试律师事务所',
            licensePhoto: null,
            status: QualificationStatus.APPROVED,
            submittedAt: new Date(),
            reviewedAt: new Date(),
            reviewerId: 'admin-1',
            reviewNotes: '审核通过',
            verificationData: null,
            metadata: null,
          },
        ],
        enterpriseAccount: {
          id: 'ent-2',
          userId: 'user-3',
          enterpriseName: '双重角色科技有限公司',
          creditCode: '91110000000000001X',
          legalPerson: '双重角色用户',
          industryType: '科技',
          businessLicense: null,
          status: EnterpriseStatus.APPROVED,
          submittedAt: new Date(),
          reviewedAt: new Date(),
          reviewerId: 'admin-1',
          reviewNotes: '审核通过',
          verificationData: null,
          expiresAt: null,
          metadata: null,
        },
      };

      mockUseAuth.mockReturnValue({
        user: mockDualRoleUser,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
      });

      render(<Home />);

      await waitFor(() => {
        const homepage = screen.getByTestId('dynamic-homepage');
        expect(homepage).toBeInTheDocument();
        expect(homepage).toHaveAttribute('data-role', 'LAWYER');
      });
    });
  });

  describe('普通用户（无认证）', () => {
    it('应该展示普通用户版首页', async () => {
      const mockGeneralUser = {
        id: 'user-4',
        email: 'general@test.com',
        username: 'general1',
        name: '普通用户',
        role: UserRole.USER,
        status: 'ACTIVE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lawyerQualifications: [],
        enterpriseAccount: null,
      };

      mockUseAuth.mockReturnValue({
        user: mockGeneralUser,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
      });

      render(<Home />);

      await waitFor(() => {
        const homepage = screen.getByTestId('dynamic-homepage');
        expect(homepage).toBeInTheDocument();
        expect(homepage).toHaveAttribute('data-role', 'GENERAL');
      });
    });
  });

  describe('加载状态', () => {
    it('应该在加载时显示加载指示器', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
      });

      render(<Home />);

      expect(screen.getByText(/加载中/i)).toBeInTheDocument();
    });
  });

  describe('待审核用户', () => {
    it('待审核律师应该展示普通用户版首页', async () => {
      const mockPendingLawyerUser = {
        id: 'user-5',
        email: 'pending@test.com',
        username: 'pending1',
        name: '待审核律师',
        role: UserRole.USER,
        status: 'ACTIVE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lawyerQualifications: [
          {
            id: 'qual-3',
            userId: 'user-5',
            licenseNumber: '12345678901234569',
            fullName: '待审核律师',
            idCardNumber: '110101199001011236',
            lawFirm: '测试律师事务所',
            licensePhoto: null,
            status: QualificationStatus.PENDING,
            submittedAt: new Date(),
            reviewedAt: null,
            reviewerId: null,
            reviewNotes: null,
            verificationData: null,
            metadata: null,
          },
        ],
        enterpriseAccount: null,
      };

      mockUseAuth.mockReturnValue({
        user: mockPendingLawyerUser,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
      });

      render(<Home />);

      await waitFor(() => {
        const homepage = screen.getByTestId('dynamic-homepage');
        expect(homepage).toBeInTheDocument();
        expect(homepage).toHaveAttribute('data-role', 'GENERAL');
      });
    });
  });
});
