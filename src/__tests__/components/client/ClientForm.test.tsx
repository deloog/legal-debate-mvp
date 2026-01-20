/**
 * ClientForm 组件测试
 * 测试客户表单的各种交互和验证逻辑
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ClientForm,
  ClientFormProps,
} from '../../../components/client/ClientForm';
import {
  ClientType,
  ClientSource,
  ClientStatus,
  CreateClientInput,
  UpdateClientInput,
} from '../../../types/client';

// Mock 函数
const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();

// 默认 props
const defaultProps: ClientFormProps = {
  userId: 'test-user-id',
  onSubmit: mockOnSubmit,
  onCancel: mockOnCancel,
  mode: 'create',
  isSubmitting: false,
};

describe('ClientForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该正确渲染创建模式的表单', () => {
      render(<ClientForm {...defaultProps} />);

      expect(screen.getByText('创建客户')).toBeInTheDocument();
      expect(screen.getByLabelText(/客户类型/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/客户姓名/i)).toBeInTheDocument();
    });

    it('应该正确渲染编辑模式的表单', () => {
      const editProps: ClientFormProps = {
        ...defaultProps,
        mode: 'edit',
        initialData: {
          clientType: ClientType.INDIVIDUAL,
          name: '测试客户',
          status: ClientStatus.ACTIVE,
        },
      };

      render(<ClientForm {...editProps} />);

      expect(screen.getByText('编辑客户')).toBeInTheDocument();
      expect(screen.getByLabelText(/客户状态/i)).toBeInTheDocument();
    });

    it('应该显示企业客户类型的字段', () => {
      render(<ClientForm {...defaultProps} />);

      const clientTypeSelect = screen.getAllByLabelText(/客户类型/i)[0];
      fireEvent.change(clientTypeSelect, {
        target: { value: ClientType.ENTERPRISE },
      });

      expect(screen.getAllByLabelText(/企业名称/i)).toHaveLength(2);
      expect(screen.getByLabelText(/法人代表/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/统一社会信用代码/i)).toBeInTheDocument();
    });

    it('应该显示个人客户类型的字段', () => {
      render(<ClientForm {...defaultProps} />);

      const clientTypeSelect = screen.getByLabelText(/客户类型/i);
      fireEvent.change(clientTypeSelect, {
        target: { value: ClientType.INDIVIDUAL },
      });

      expect(screen.getByLabelText(/性别/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/年龄/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/身份证号/i)).toBeInTheDocument();
    });
  });

  describe('表单验证', () => {
    it('应该验证必填的客户名称', async () => {
      render(<ClientForm {...defaultProps} />);

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(screen.getByText('客户名称不能为空')).toBeInTheDocument();
        });
      }
    });

    it('应该验证企业客户的必填字段', async () => {
      render(<ClientForm {...defaultProps} />);

      const clientTypeSelect = screen.getAllByLabelText(/客户类型/i)[0];
      fireEvent.change(clientTypeSelect, {
        target: { value: ClientType.ENTERPRISE },
      });

      // 企业客户类型下有两个"企业名称"字段，需要都填充
      // 第一个是 name 字段（通用），第二个是 company 字段（企业专用）
      const nameInputs = screen.getAllByLabelText(/企业名称/);
      fireEvent.change(nameInputs[0], { target: { value: '测试企业' } });
      fireEvent.change(nameInputs[1], { target: { value: '测试企业公司' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(
            screen.queryByText('客户名称不能为空')
          ).not.toBeInTheDocument();
        });
      }
    });

    it('应该验证邮箱格式', async () => {
      render(<ClientForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/电子邮箱/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

      const nameInput = screen.getByLabelText(/客户姓名/);
      fireEvent.change(nameInput, { target: { value: '测试' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(screen.getByText('邮箱格式不正确')).toBeInTheDocument();
        });
      }
    });

    it('应该验证电话格式', async () => {
      render(<ClientForm {...defaultProps} />);

      const phoneInput = screen.getByLabelText(/联系电话/i);
      fireEvent.change(phoneInput, { target: { value: '123' } });

      const nameInput = screen.getByLabelText(/客户姓名/);
      fireEvent.change(nameInput, { target: { value: '测试' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(screen.getByText('电话格式不正确')).toBeInTheDocument();
        });
      }
    });

    it('应该接受有效的邮箱和电话', async () => {
      render(<ClientForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/电子邮箱/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const phoneInput = screen.getByLabelText(/联系电话/i);
      fireEvent.change(phoneInput, { target: { value: '13800138000' } });

      const nameInput = screen.getByLabelText(/客户姓名/);
      fireEvent.change(nameInput, { target: { value: '测试' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(screen.queryByText('邮箱格式不正确')).not.toBeInTheDocument();
          expect(screen.queryByText('电话格式不正确')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('表单提交', () => {
    it('应该在创建模式下提交包含所有必要字段的数据', async () => {
      render(<ClientForm {...defaultProps} />);

      fireEvent.change(screen.getByLabelText(/客户姓名/), {
        target: { value: '测试客户' },
      });
      fireEvent.change(screen.getByLabelText(/联系电话/i), {
        target: { value: '13800138000' },
      });
      fireEvent.change(screen.getByLabelText(/电子邮箱/i), {
        target: { value: 'test@example.com' },
      });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(mockOnSubmit).toHaveBeenCalled();
          const submittedData = mockOnSubmit.mock
            .calls[0][0] as CreateClientInput;
          expect(submittedData.name).toBe('测试客户');
          expect(submittedData.userId).toBe('test-user-id');
        });
      }
    });

    it('应该在编辑模式下提交更新数据', async () => {
      const editProps: ClientFormProps = {
        ...defaultProps,
        mode: 'edit',
        initialData: {
          clientType: ClientType.INDIVIDUAL,
          name: '原客户名',
          status: ClientStatus.ACTIVE,
        },
      };

      render(<ClientForm {...editProps} />);

      fireEvent.change(screen.getByLabelText(/客户姓名/), {
        target: { value: '更新客户名' },
      });

      const submitButton = screen.getByText('保存');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(mockOnSubmit).toHaveBeenCalled();
          const submittedData = mockOnSubmit.mock
            .calls[0][0] as UpdateClientInput;
          expect(submittedData.name).toBe('更新客户名');
        });
      }
    });

    it('应该在提交时禁用按钮并显示加载状态', () => {
      const submittingProps: ClientFormProps = {
        ...defaultProps,
        isSubmitting: true,
      };

      render(<ClientForm {...submittingProps} />);

      const submitButton = screen.getByText('提交中...');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('标签处理', () => {
    it('应该正确解析逗号分隔的标签', async () => {
      render(<ClientForm {...defaultProps} />);

      const tagsInput = screen.getByLabelText(/标签/i);
      fireEvent.change(tagsInput, {
        target: { value: '标签1, 标签2, 标签3' },
      });

      const nameInput = screen.getByLabelText(/客户姓名/);
      fireEvent.change(nameInput, { target: { value: '测试客户' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          const submittedData = mockOnSubmit.mock
            .calls[0][0] as CreateClientInput;
          expect(submittedData.tags).toEqual(['标签1', '标签2', '标签3']);
        });
      }
    });

    it('应该过滤空标签', async () => {
      render(<ClientForm {...defaultProps} />);

      const tagsInput = screen.getByLabelText(/标签/i);
      fireEvent.change(tagsInput, { target: { value: '标签1,,  ,标签2' } });

      const nameInput = screen.getByLabelText(/客户姓名/);
      fireEvent.change(nameInput, { target: { value: '测试客户' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          const submittedData = mockOnSubmit.mock
            .calls[0][0] as CreateClientInput;
          expect(submittedData.tags).toEqual(['标签1', '标签2']);
        });
      }
    });
  });

  describe('取消操作', () => {
    it('应该在点击取消按钮时调用 onCancel', () => {
      render(<ClientForm {...defaultProps} />);

      const cancelButton = screen.getByText('取消');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('应该在提交时禁用取消按钮', () => {
      const submittingProps: ClientFormProps = {
        ...defaultProps,
        isSubmitting: true,
      };

      render(<ClientForm {...submittingProps} />);

      const cancelButton = screen.getByText('取消');
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('客户来源选择', () => {
    it('应该正确选择客户来源', async () => {
      render(<ClientForm {...defaultProps} />);

      const sourceSelect = screen.getByLabelText(/客户来源/i);
      fireEvent.change(sourceSelect, {
        target: { value: ClientSource.REFERRAL },
      });

      const nameInput = screen.getByLabelText(/客户姓名/);
      fireEvent.change(nameInput, { target: { value: '测试' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          const submittedData = mockOnSubmit.mock
            .calls[0][0] as CreateClientInput;
          expect(submittedData.source).toBe(ClientSource.REFERRAL);
        });
      }
    });
  });

  describe('备注字段', () => {
    it('应该正确保存备注信息', async () => {
      render(<ClientForm {...defaultProps} />);

      const notesTextarea = screen.getByLabelText(/备注/i);
      fireEvent.change(notesTextarea, { target: { value: '这是备注信息' } });

      const nameInput = screen.getByLabelText(/客户姓名/);
      fireEvent.change(nameInput, { target: { value: '测试' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          const submittedData = mockOnSubmit.mock
            .calls[0][0] as CreateClientInput;
          expect(submittedData.notes).toBe('这是备注信息');
        });
      }
    });
  });

  describe('地址和职业字段', () => {
    it('应该正确保存地址', async () => {
      render(<ClientForm {...defaultProps} />);

      const addressInput = screen.getByLabelText(/地址/i);
      fireEvent.change(addressInput, { target: { value: '北京市朝阳区' } });

      const nameInput = screen.getByLabelText(/客户姓名/);
      fireEvent.change(nameInput, { target: { value: '测试' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          const submittedData = mockOnSubmit.mock
            .calls[0][0] as CreateClientInput;
          expect(submittedData.address).toBe('北京市朝阳区');
        });
      }
    });

    it('应该正确保存职业', async () => {
      render(<ClientForm {...defaultProps} />);

      const professionInput = screen.getByLabelText(/职业/i);
      fireEvent.change(professionInput, { target: { value: '律师' } });

      const nameInput = screen.getByLabelText(/客户姓名/);
      fireEvent.change(nameInput, { target: { value: '测试' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          const submittedData = mockOnSubmit.mock
            .calls[0][0] as CreateClientInput;
          expect(submittedData.profession).toBe('律师');
        });
      }
    });
  });

  describe('个人客户特定字段', () => {
    it('应该正确保存性别', async () => {
      render(<ClientForm {...defaultProps} />);

      const clientTypeSelect = screen.getByLabelText(/客户类型/i);
      fireEvent.change(clientTypeSelect, {
        target: { value: ClientType.INDIVIDUAL },
      });

      const genderSelect = screen.getByLabelText(/性别/i);
      fireEvent.change(genderSelect, { target: { value: '男' } });

      const nameInput = screen.getByLabelText(/客户姓名/);
      fireEvent.change(nameInput, { target: { value: '测试' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          const submittedData = mockOnSubmit.mock
            .calls[0][0] as CreateClientInput;
          expect(submittedData.gender).toBe('男');
        });
      }
    });

    it('应该正确保存年龄', async () => {
      render(<ClientForm {...defaultProps} />);

      const clientTypeSelect = screen.getByLabelText(/客户类型/i);
      fireEvent.change(clientTypeSelect, {
        target: { value: ClientType.INDIVIDUAL },
      });

      const ageInput = screen.getByLabelText(/年龄/i);
      fireEvent.change(ageInput, { target: { value: '30' } });

      const nameInput = screen.getByLabelText(/客户姓名/);
      fireEvent.change(nameInput, { target: { value: '测试' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          const submittedData = mockOnSubmit.mock
            .calls[0][0] as CreateClientInput;
          expect(submittedData.age).toBe(30);
        });
      }
    });
  });
});
