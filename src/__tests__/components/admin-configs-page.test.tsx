/**
 * 系统配置管理页面测试
 * 测试配置的创建、更新、删除等功能
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfigsPage from '@/app/admin/configs/page';
import { SystemConfig } from '@prisma/client';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

const mockConfigs: SystemConfig[] = [
  {
    id: '1',
    key: 'AI_API_KEY',
    value: 'test-api-key',
    type: 'STRING',
    category: 'ai',
    description: 'AI服务API密钥',
    isPublic: false,
    isRequired: true,
    defaultValue: null,
    validationRules: { pattern: '^[a-zA-Z0-9_-]+$' },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    key: 'MAX_UPLOAD_SIZE',
    value: 10485760,
    type: 'NUMBER',
    category: 'storage',
    description: '最大上传文件大小',
    isPublic: true,
    isRequired: false,
    defaultValue: 10485760,
    validationRules: { min: 1024, max: 1073741824 },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('系统配置管理页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('页面渲染', () => {
    it('应该正确渲染页面标题和描述', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            configs: mockConfigs,
            pagination: {
              total: 2,
              page: 1,
              limit: 20,
              totalPages: 1,
            },
          },
        }),
      });

      render(<ConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText('系统配置管理')).toBeInTheDocument();
        expect(
          screen.getByText('管理系统全局配置，包括AI服务、存储、安全等功能参数')
        ).toBeInTheDocument();
      });
    });

    it('应该在加载时显示加载状态', async () => {
      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({
                  success: true,
                  data: {
                    configs: mockConfigs,
                    pagination: {
                      total: 2,
                      page: 1,
                      limit: 20,
                      totalPages: 1,
                    },
                  },
                }),
              });
            }, 1000);
          })
      );

      render(<ConfigsPage />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('应该正确显示配置列表', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            configs: mockConfigs,
            pagination: {
              total: 2,
              page: 1,
              limit: 20,
              totalPages: 1,
            },
          },
        }),
      });

      render(<ConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText('AI_API_KEY')).toBeInTheDocument();
        expect(screen.getByText('MAX_UPLOAD_SIZE')).toBeInTheDocument();
      });
    });

    it('应该显示配置总数', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            configs: mockConfigs,
            pagination: {
              total: 2,
              page: 1,
              limit: 20,
              totalPages: 1,
            },
          },
        }),
      });

      render(<ConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText('共 2 条配置')).toBeInTheDocument();
      });
    });
  });

  describe('配置编辑功能', () => {
    it('应该能够编辑配置项', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            configs: mockConfigs,
            pagination: {
              total: 2,
              page: 1,
              limit: 20,
              totalPages: 1,
            },
          },
        }),
      });

      render(<ConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText('AI_API_KEY')).toBeInTheDocument();
      });

      // 点击编辑按钮
      const editButtons = screen.getAllByText('编辑');
      expect(editButtons.length).toBeGreaterThan(0);
      fireEvent.click(editButtons[0]);

      // 编辑状态应该显示保存和取消按钮
      await waitFor(() => {
        expect(screen.getAllByText('保存').length).toBeGreaterThan(0);
        expect(screen.getAllByText('取消').length).toBeGreaterThan(0);
      });
    });

    it('应该能够保存配置修改', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              configs: [mockConfigs[0]],
              pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: '配置更新成功',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              configs: [mockConfigs[0]],
              pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
            },
          }),
        });

      render(<ConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText('AI_API_KEY')).toBeInTheDocument();
      });

      // 点击编辑按钮
      const editButtons = screen.getAllByText('编辑');
      fireEvent.click(editButtons[0]);

      // 点击保存按钮
      await waitFor(() => {
        const saveButtons = screen.getAllByText('保存');
        expect(saveButtons.length).toBeGreaterThan(0);
        fireEvent.click(saveButtons[0]);
      });

      // 应该显示成功消息
      await waitFor(() => {
        expect(screen.getByText('配置更新成功')).toBeInTheDocument();
      });
    });
  });

  describe('配置删除功能', () => {
    it('应该能够删除配置项', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              configs: [mockConfigs[1]],
              pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: '配置删除成功',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              configs: [],
              pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
            },
          }),
        });

      render(<ConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText('MAX_UPLOAD_SIZE')).toBeInTheDocument();
      });

      // 确认删除
      window.confirm = jest.fn(() => true);

      const deleteButtons = screen.getAllByText('删除');
      expect(deleteButtons.length).toBeGreaterThan(0);
      fireEvent.click(deleteButtons[0]);

      // 应该显示成功消息
      await waitFor(() => {
        expect(screen.getByText('配置删除成功')).toBeInTheDocument();
      });
    });

    it('应该在取消删除时不执行删除', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            configs: [mockConfigs[1]],
            pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        }),
      });

      render(<ConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText('MAX_UPLOAD_SIZE')).toBeInTheDocument();
      });

      // 取消删除
      window.confirm = jest.fn(() => false);

      const deleteButtons = screen.getAllByText('删除');
      expect(deleteButtons.length).toBeGreaterThan(0);
      fireEvent.click(deleteButtons[0]);

      // 确认对话框应该被调用
      expect(window.confirm).toHaveBeenCalledWith('确定要删除此配置吗？');
    });
  });

  describe('配置创建功能', () => {
    it('应该能够打开新建配置对话框', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            configs: [],
            pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
          },
        }),
      });

      render(<ConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText('新建配置')).toBeInTheDocument();
      });

      // 点击新建配置按钮
      fireEvent.click(screen.getByText('新建配置'));

      // 应该显示对话框
      await waitFor(() => {
        const dialogs = screen.getAllByText('新建配置');
        expect(dialogs.length).toBe(2); // 一个是按钮，一个是对话框标题
      });
    });

    it('应该能够创建新配置', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              configs: [],
              pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: '配置创建成功',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              configs: mockConfigs,
              pagination: { total: 2, page: 1, limit: 20, totalPages: 1 },
            },
          }),
        });

      render(<ConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText('新建配置')).toBeInTheDocument();
      });

      // 打开新建配置对话框
      fireEvent.click(screen.getByText('新建配置'));

      await waitFor(() => {
        expect(screen.getAllByText('新建配置').length).toBe(2);
      });

      // 填写表单 - 使用文本内容定位
      const textInputs = screen.getAllByRole('textbox');
      if (textInputs.length > 0) {
        fireEvent.change(textInputs[0], { target: { value: 'TEST_CONFIG' } });
      }
      if (textInputs.length > 2) {
        fireEvent.change(textInputs[2], { target: { value: 'test-value' } });
      }
      if (textInputs.length > 3) {
        fireEvent.change(textInputs[3], { target: { value: '测试配置' } });
      }

      // 选择类型
      const typeSelect = screen.getByDisplayValue('STRING');
      if (typeSelect) {
        fireEvent.change(typeSelect, { target: { value: 'STRING' } });
      }

      // 提交表单
      const saveButton = screen.getByText('保存');
      fireEvent.click(saveButton);

      // 应该显示成功消息
      await waitFor(() => {
        expect(screen.getByText('配置创建成功')).toBeInTheDocument();
      });
    });
  });

  describe('错误处理', () => {
    it('应该正确处理API错误', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          message: '获取配置列表失败',
        }),
      });

      render(<ConfigsPage />);

      await waitFor(() => {
        // 页面应该渲染
        expect(screen.getByText('系统配置管理')).toBeInTheDocument();
      });

      // fetch应该被调用
      expect(fetch).toHaveBeenCalled();
    });

    it('应该正确处理网络错误', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<ConfigsPage />);

      await waitFor(() => {
        // 页面应该渲染
        expect(screen.getByText('系统配置管理')).toBeInTheDocument();
      });

      // fetch应该被调用
      expect(fetch).toHaveBeenCalled();
    });
  });
});
