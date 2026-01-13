/**
 * UserDetail组件测试
 * @jest-environment jsdom
 */
// @ts-nocheck - 禁用此文件的 TypeScript 类型检查，因为 jest-dom 类型声明与测试环境存在兼容性问题，但测试运行完全正常

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UserDetail } from '@/components/admin/UserDetail';

// =============================================================================
// Mock配置
// =============================================================================

// 初始化fetch mock

(global as any).fetch = jest.fn() as jest.Mock;

// 修复 fetch mock 类型
// @ts-ignore - 测试文件中的 mock 初始化

(global as any).fetch = jest.fn((_url: unknown, _options?: RequestInit) => {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: null }),
  });
}) as jest.Mock;

describe('UserDetail组件', () => {
  const mockUserId = 'cmtest123456789';

  const mockUserData = {
    user: {
      id: mockUserId,
      email: 'test@example.com',
      username: 'testuser',
      name: '测试用户',
      role: 'USER',
      status: 'ACTIVE',
      phone: '13800138000',
      address: '北京市朝阳区',
      bio: '这是一个测试用户',
      avatar: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15'),
      lastLoginAt: new Date('2024-01-15'),
      loginCount: 10,
      emailVerified: new Date('2024-01-02'),
    },
    lawyerQualification: null,
    enterpriseAccount: null,
    statistics: {
      casesCount: 5,
      debatesCount: 3,
      documentsCount: 10,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // 加载状态测试
  // =============================================================================

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // 永不解决的Promise
      );

      render(<UserDetail userId={mockUserId} />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  // =============================================================================
  // 错误状态测试
  // =============================================================================

  describe('错误状态', () => {
    it('应该显示错误信息', async () => {
      const errorResponse: Record<string, unknown> = {
        ok: false,
        status: 500,
        json: async () => ({
          error: '服务器错误',
          message: '获取用户详情失败',
        }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(errorResponse);

      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('获取用户详情失败')).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // 正常显示测试
  // =============================================================================

  describe('正常显示', () => {
    beforeEach(() => {
      const successResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: mockUserData }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(successResponse);
    });

    it('应该显示用户基本信息', async () => {
      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('基本信息')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('testuser')).toBeInTheDocument();
        expect(screen.getByText('测试用户')).toBeInTheDocument();
      });
    });

    it('应该显示账户信息', async () => {
      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('账户信息')).toBeInTheDocument();
        expect(screen.getByText('已验证')).toBeInTheDocument();
      });
    });

    it('应该显示使用统计', async () => {
      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('使用统计')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('文档数')).toBeInTheDocument();
      });
    });

    it('应该显示编辑和删除按钮', async () => {
      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('编辑')).toBeInTheDocument();
        expect(screen.getByText('删除')).toBeInTheDocument();
      });
    });

    it('应该显示返回列表按钮', async () => {
      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        const button = screen.getByText('返回列表');
        expect(button).toBeInTheDocument();
        expect(button.tagName).toBe('A');
      });
    });
  });

  // =============================================================================
  // 编辑模式测试
  // =============================================================================

  describe('编辑模式', () => {
    beforeEach(() => {
      const getDataResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: mockUserData }),
      };
      const updateResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: mockUserData, message: '更新成功' }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(getDataResponse)
        .mockResolvedValueOnce(updateResponse);
    });

    it('应该进入编辑模式', async () => {
      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('编辑')).toBeInTheDocument();
      });

      const editButton = screen.getByText('编辑');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('用户名')).toBeInTheDocument();
        expect(screen.getByText('姓名')).toBeInTheDocument();
        expect(screen.getByText('角色')).toBeInTheDocument();
        expect(screen.getByText('状态')).toBeInTheDocument();
      });
    });

    it('应该显示表单输入框', async () => {
      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('编辑')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('编辑'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox');
        expect(inputs.length).toBeGreaterThan(0);

        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
      });
    });

    it('应该能够取消编辑', async () => {
      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('编辑')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('编辑'));

      await waitFor(() => {
        expect(screen.getByText('取消')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('取消'));

      await waitFor(() => {
        expect(screen.getByText('编辑')).toBeInTheDocument();
        const usernameLabel = screen
          .queryAllByText('用户名')
          .filter(el => el.tagName === 'LABEL');
        expect(usernameLabel.length).toBe(0);
      });
    });

    it('应该能够保存更改', async () => {
      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('编辑')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('编辑'));

      await waitFor(() => {
        expect(screen.getByText('保存')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('保存'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/users/'),
          expect.objectContaining({
            method: 'PUT',
          })
        );
      });
    });
  });

  // =============================================================================
  // 删除功能测试
  // =============================================================================

  describe('删除功能', () => {
    beforeEach(() => {
      const successResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: mockUserData }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(successResponse);

      Object.defineProperty(window, 'confirm', {
        writable: true,
        value: jest.fn(() => true),
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'confirm', {
        writable: true,
        value: () => true,
      });
    });

    it('应该显示删除确认对话框', async () => {
      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('删除')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('删除');
      fireEvent.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('确定要删除该用户吗')
      );
    });

    it('应该能够删除用户', async () => {
      // @ts-ignore - 测试文件中的 mock 实现类型断言
      (global.fetch as jest.Mock).mockImplementation(
        (_url: unknown, options?: RequestInit) => {
          const getResponse: Record<string, unknown> = {
            ok: true,
            status: 200,
            json: async () => ({ data: mockUserData }),
          };
          const deleteResponse: Record<string, unknown> = {
            ok: true,
            status: 200,
            json: async () => ({ message: '删除成功' }),
          };

          if (options?.method === undefined || options.method === 'GET') {
            return Promise.resolve(getResponse);
          }
          if (options?.method === 'DELETE') {
            return Promise.resolve(deleteResponse);
          }
          return Promise.resolve(getResponse);
        }
      );

      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('删除')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('删除'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/admin/users/${mockUserId}`,
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });
  });

  // =============================================================================
  // 律师资格认证显示测试
  // =============================================================================

  describe('律师资格认证', () => {
    it('应该显示律师资格认证信息', async () => {
      const userDataWithLawyer = {
        ...mockUserData,
        lawyerQualification: {
          id: 'lawyer1',
          licenseNumber: '11010112345678',
          fullName: '张律师',
          lawFirm: '某某律师事务所',
          status: 'APPROVED',
          submittedAt: new Date('2024-01-01'),
          reviewedAt: new Date('2024-01-05'),
          reviewNotes: '审核通过',
        },
      };

      const lawyerResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: userDataWithLawyer }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(lawyerResponse);

      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('律师资格认证')).toBeInTheDocument();
        expect(screen.getByText('11010112345678')).toBeInTheDocument();
        expect(screen.getByText('张律师')).toBeInTheDocument();
        expect(screen.getByText('某某律师事务所')).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // 企业认证显示测试
  // =============================================================================

  describe('企业认证', () => {
    it('应该显示企业认证信息', async () => {
      const userDataWithEnterprise = {
        ...mockUserData,
        enterpriseAccount: {
          id: 'enterprise1',
          enterpriseName: '某某科技有限公司',
          creditCode: '91110105123456789X',
          legalPerson: '李四',
          industryType: '软件开发',
          status: 'APPROVED',
          submittedAt: new Date('2024-01-01'),
          reviewedAt: new Date('2024-01-05'),
          expiresAt: new Date('2025-01-01'),
        },
      };

      const enterpriseResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: userDataWithEnterprise }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(enterpriseResponse);

      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('企业认证')).toBeInTheDocument();
        expect(screen.getByText('某某科技有限公司')).toBeInTheDocument();
        expect(screen.getByText('91110105123456789X')).toBeInTheDocument();
        expect(screen.getByText('李四')).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // 用户不存在测试
  // =============================================================================

  describe('用户不存在', () => {
    it('应该显示用户不存在提示', async () => {
      const nullResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: null }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock).mockResolvedValue(nullResponse);

      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('用户不存在')).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // 成功消息测试
  // =============================================================================

  describe('成功消息', () => {
    it('应该显示更新成功消息', async () => {
      const getDataResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: mockUserData }),
      };
      const updateSuccessResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({
          data: mockUserData,
          message: '更新成功',
        }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(getDataResponse)
        .mockResolvedValueOnce(updateSuccessResponse);

      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('编辑')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('编辑'));

      await waitFor(() => {
        expect(screen.getByText('保存')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('保存'));

      await waitFor(() => {
        expect(screen.getByText('更新成功')).toBeInTheDocument();
      });
    });

    it('应该显示删除成功消息', async () => {
      const getDataResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ data: mockUserData }),
      };
      const deleteSuccessResponse: Record<string, unknown> = {
        ok: true,
        status: 200,
        json: async () => ({ message: '删除成功' }),
      };
      // @ts-ignore - 测试文件中的 mock 类型断言
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(getDataResponse)
        .mockResolvedValueOnce(deleteSuccessResponse);

      Object.defineProperty(window, 'confirm', {
        writable: true,
        value: jest.fn(() => true),
      });

      render(<UserDetail userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('删除')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('删除'));

      await waitFor(() => {
        const successMessage = screen.queryByText('删除成功');
        expect(successMessage).toBeInTheDocument();
      });
    });
  });
});
