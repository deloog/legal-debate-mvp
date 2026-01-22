/**
 * 团队表单组件测试
 * 测试团队表单组件的功能、验证和提交
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TeamForm } from '@/components/team/TeamForm';
import { TeamType, TeamStatus } from '@/types/team';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
    back: mockBack,
  });
});

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('TeamForm', () => {
  const mockTeam = {
    id: 'team-1',
    name: '测试律师事务所',
    type: TeamType.LAW_FIRM,
    description: '专业法律服务',
    logo: null,
    status: TeamStatus.ACTIVE,
    metadata: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    memberCount: 5,
  };

  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  describe('创建团队表单', () => {
    it('应该渲染创建团队表单', () => {
      render(<TeamForm />);

      expect(screen.getByText('团队名称')).toBeInTheDocument();
      expect(screen.getByLabelText(/团队名称/)).toBeInTheDocument();
      expect(screen.getByLabelText(/团队类型/)).toBeInTheDocument();
      expect(screen.getByLabelText(/状态/)).toBeInTheDocument();
      expect(screen.getByLabelText(/团队描述/)).toBeInTheDocument();
    });

    it('应该显示所有团队类型选项', () => {
      render(<TeamForm />);

      expect(screen.getByText('律师事务所')).toBeInTheDocument();
      expect(screen.getByText('企业法务部门')).toBeInTheDocument();
      expect(screen.getByText('其他')).toBeInTheDocument();
    });

    it('应该显示所有团队状态选项', () => {
      render(<TeamForm />);

      expect(screen.getByText('活跃')).toBeInTheDocument();
      expect(screen.getByText('非活跃')).toBeInTheDocument();
      expect(screen.getByText('已暂停')).toBeInTheDocument();
    });

    it('应该验证必填字段', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'new-team' }),
      });

      render(<TeamForm />);

      const submitButton = screen.getByText('创建');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/团队名称是必填项/)).toBeInTheDocument();
      });
    });

    it('应该成功创建团队', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'new-team' }),
      });

      render(<TeamForm />);

      const nameInput = screen.getByLabelText(/团队名称/);
      const typeSelect = screen.getByLabelText(/团队类型/);
      const descriptionTextarea = screen.getByLabelText(/团队描述/);

      fireEvent.change(nameInput, { target: { value: '新团队' } });
      fireEvent.change(typeSelect, { target: { value: TeamType.LAW_FIRM } });
      fireEvent.change(descriptionTextarea, {
        target: { value: '团队描述' },
      });

      const submitButton = screen.getByText('创建');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: '新团队',
            type: TeamType.LAW_FIRM,
            status: TeamStatus.ACTIVE,
            description: '团队描述',
          }),
        });
      });
    });
  });

  describe('编辑团队表单', () => {
    it('应该渲染编辑团队表单', () => {
      render(<TeamForm team={mockTeam} />);

      expect(screen.getByDisplayValue('测试律师事务所')).toBeInTheDocument();
      expect(screen.getByDisplayValue('专业法律服务')).toBeInTheDocument();
    });

    it('应该成功更新团队', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTeam,
      });

      render(<TeamForm team={mockTeam} />);

      const nameInput = screen.getByDisplayValue('测试律师事务所');
      fireEvent.change(nameInput, { target: { value: '更新后的名称' } });

      const submitButton = screen.getByText('保存');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(`/api/teams/${mockTeam.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: '更新后的名称',
            type: mockTeam.type,
            status: mockTeam.status,
            description: mockTeam.description,
          }),
        });
      });
    });
  });

  describe('表单验证', () => {
    it('应该验证团队名称长度', async () => {
      render(<TeamForm />);

      const nameInput = screen.getByLabelText(/团队名称/);
      const submitButton = screen.getByText('创建');

      // 输入过长名称
      fireEvent.change(nameInput, { target: { value: 'A'.repeat(101) } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/团队名称不能超过100个字符/)
        ).toBeInTheDocument();
      });
    });

    it('应该验证描述长度', async () => {
      render(<TeamForm />);

      const nameInput = screen.getByLabelText(/团队名称/);
      const descriptionTextarea = screen.getByLabelText(/团队描述/);
      const submitButton = screen.getByText('创建');

      // 输入有效名称
      fireEvent.change(nameInput, { target: { value: '测试团队' } });

      // 输入过长描述
      fireEvent.change(descriptionTextarea, {
        target: { value: 'A'.repeat(501) },
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/团队描述不能超过500个字符/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('错误处理', () => {
    it('应该显示创建失败错误', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ message: '创建失败' }),
      });

      render(<TeamForm />);

      const nameInput = screen.getByLabelText(/团队名称/);
      fireEvent.change(nameInput, { target: { value: '测试团队' } });

      const submitButton = screen.getByText('创建');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/创建失败/)).toBeInTheDocument();
      });
    });

    it('应该显示网络错误', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('网络错误'));

      render(<TeamForm />);

      const nameInput = screen.getByLabelText(/团队名称/);
      fireEvent.change(nameInput, { target: { value: '测试团队' } });

      const submitButton = screen.getByText('创建');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/网络错误/)).toBeInTheDocument();
      });
    });
  });

  describe('取消操作', () => {
    it('点击取消应该返回上一页', () => {
      render(<TeamForm />);

      const cancelButton = screen.getByText('取消');
      fireEvent.click(cancelButton);

      expect(mockBack).toHaveBeenCalled();
    });
  });
});
