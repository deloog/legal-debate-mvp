/**
 * EvidenceForm 组件测试
 * 测试证据表单组件的渲染、验证、提交等功能
 */

import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { EvidenceForm } from '../../../components/evidence/EvidenceForm';
import {
  EvidenceDetail,
  EvidenceStatus,
  EvidenceType,
} from '../../../types/evidence';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('EvidenceForm - 基础功能', () => {
  // 每个测试后清理
  afterEach(cleanup);
  const mockCaseId = 'test-case-123';
  const mockEvidence: EvidenceDetail = {
    id: 'evidence-1',
    caseId: mockCaseId,
    type: EvidenceType.DOCUMENT,
    name: '合同书',
    description: '原被告签订的合同',
    fileUrl: 'https://example.com/contract.pdf',
    submitter: '张三',
    source: '原告',
    status: EvidenceStatus.ACCEPTED,
    relevanceScore: 0.9,
    metadata: null,
    createdAt: new Date('2024-01-15T09:00:00Z'),
    updatedAt: new Date('2024-01-15T09:00:00Z'),
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('新建模式渲染', () => {
    it('应该正确渲染新建证据表单', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      expect(screen.getByText('新建证据')).toBeInTheDocument();
      expect(screen.getByText('证据类型')).toBeInTheDocument();
      expect(screen.getByText('证据名称')).toBeInTheDocument();
      expect(screen.getByText('描述')).toBeInTheDocument();
      expect(screen.getByText('提交人')).toBeInTheDocument();
      expect(screen.getByText('来源')).toBeInTheDocument();
      expect(screen.getByText('相关性评分 (0-1)')).toBeInTheDocument();
      expect(screen.getByText('证据文件')).toBeInTheDocument();
    });

    it('应该显示提交按钮', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      expect(screen.getByText('提交')).toBeInTheDocument();
    });

    it('应该显示保存草稿按钮', () => {
      render(<EvidenceForm caseId={mockCaseId} showDraftButton />);

      expect(screen.getByText('保存草稿')).toBeInTheDocument();
    });

    it('应该显示预览按钮', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      expect(screen.getByText('预览')).toBeInTheDocument();
    });

    it('应该显示取消按钮当传入onCancel回调', () => {
      const onCancel = jest.fn();
      render(
        <EvidenceForm caseId={mockCaseId} onCancel={onCancel} showDraftButton />
      );

      // 应该有两个取消按钮（header和form-actions）
      const cancelButtons = screen.getAllByText('取消');
      expect(cancelButtons.length).toBe(2);
    });
  });

  describe('编辑模式渲染', () => {
    it('应该在编辑模式显示编辑证据标题', () => {
      render(<EvidenceForm caseId={mockCaseId} evidence={mockEvidence} />);

      expect(screen.getByText('编辑证据')).toBeInTheDocument();
    });

    it('应该填充现有证据数据', () => {
      render(<EvidenceForm caseId={mockCaseId} evidence={mockEvidence} />);

      expect(screen.getByDisplayValue('合同书')).toBeInTheDocument();
      expect(screen.getByDisplayValue('原被告签订的合同')).toBeInTheDocument();
      expect(screen.getByDisplayValue('张三')).toBeInTheDocument();
      expect(screen.getByDisplayValue('原告')).toBeInTheDocument();
      expect(screen.getByDisplayValue('0.9')).toBeInTheDocument();
    });

    it('应该显示已上传文件信息', () => {
      render(<EvidenceForm caseId={mockCaseId} evidence={mockEvidence} />);

      expect(screen.getByText(/已上传:/)).toBeInTheDocument();
    });
  });

  describe('表单验证', () => {
    it('应该显示错误当证据名称为空', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockEvidence }),
      });

      render(<EvidenceForm caseId={mockCaseId} />);

      const submitButton = screen.getByText('提交');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('证据名称不能为空')).toBeInTheDocument();
      });
    });

    it('应该显示错误当提交人为空', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockEvidence }),
      });

      render(<EvidenceForm caseId={mockCaseId} />);

      const submitButton = screen.getByText('提交');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('提交人不能为空')).toBeInTheDocument();
      });
    });

    it('应该显示字符计数', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      const nameInput = screen.getByPlaceholderText('请输入证据名称');
      fireEvent.change(nameInput, { target: { value: '测试证据名称' } });

      expect(screen.getByText('6/200')).toBeInTheDocument();
    });
  });

  describe('字段输入', () => {
    it('应该支持选择证据类型', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      const typeSelect = screen.getByLabelText(/证据类型/i);
      fireEvent.change(typeSelect, { target: { value: EvidenceType.WITNESS } });

      expect(screen.getByDisplayValue('证人证言')).toBeInTheDocument();
    });

    it('应该支持输入证据名称', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      const nameInput = screen.getByPlaceholderText('请输入证据名称');
      fireEvent.change(nameInput, { target: { value: '测试证据' } });

      expect(screen.getByDisplayValue('测试证据')).toBeInTheDocument();
    });

    it('应该支持输入证据描述', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      const descriptionInput = screen.getByPlaceholderText('请输入证据描述');
      fireEvent.change(descriptionInput, {
        target: { value: '测试描述内容' },
      });

      expect(screen.getByDisplayValue('测试描述内容')).toBeInTheDocument();
    });

    it('应该支持输入提交人', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      const submitterInput = screen.getByPlaceholderText('请输入提交人');
      fireEvent.change(submitterInput, { target: { value: '张三' } });

      expect(screen.getByDisplayValue('张三')).toBeInTheDocument();
    });

    it('应该支持输入来源', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      const sourceInput = screen.getByPlaceholderText('请输入证据来源');
      fireEvent.change(sourceInput, { target: { value: '原告' } });

      expect(screen.getByDisplayValue('原告')).toBeInTheDocument();
    });
  });

  describe('提交功能', () => {
    it('应该提交新建证据', async () => {
      const onSubmitSuccess = jest.fn();

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockEvidence }),
      });

      render(
        <EvidenceForm caseId={mockCaseId} onSubmitSuccess={onSubmitSuccess} />
      );

      const nameInput = screen.getByPlaceholderText('请输入证据名称');
      fireEvent.change(nameInput, { target: { value: '测试证据' } });

      const submitterInput = screen.getByPlaceholderText('请输入提交人');
      fireEvent.change(submitterInput, { target: { value: '张三' } });

      const typeSelect = screen.getByLabelText(/证据类型/i);
      fireEvent.change(typeSelect, { target: { value: EvidenceType.WITNESS } });

      const submitButton = screen.getByText('提交');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/evidence', expect.any(Object));
        expect(onSubmitSuccess).toHaveBeenCalledWith(mockEvidence);
      });
    });

    it('应该提交编辑证据', async () => {
      const onSubmitSuccess = jest.fn();

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockEvidence }),
      });

      render(
        <EvidenceForm
          caseId={mockCaseId}
          evidence={mockEvidence}
          onSubmitSuccess={onSubmitSuccess}
        />
      );

      const submitButton = screen.getByText('提交');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/evidence/evidence-1',
          expect.any(Object)
        );
        expect(onSubmitSuccess).toHaveBeenCalledWith(mockEvidence);
      });
    });

    it('应该在提交时禁用按钮', async () => {
      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ data: mockEvidence }),
                } as Response),
              100
            )
          )
      );

      render(<EvidenceForm caseId={mockCaseId} />);

      const nameInput = screen.getByPlaceholderText('请输入证据名称');
      fireEvent.change(nameInput, { target: { value: '测试证据' } });

      const submitterInput = screen.getByPlaceholderText('请输入提交人');
      fireEvent.change(submitterInput, { target: { value: '张三' } });

      const typeSelect = screen.getByLabelText(/证据类型/i);
      fireEvent.change(typeSelect, { target: { value: EvidenceType.WITNESS } });

      const submitButton = screen.getByText('提交');
      fireEvent.click(submitButton);

      expect(screen.getByText('提交中...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('重置功能', () => {
    it('应该重置表单', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      const nameInput = screen.getByPlaceholderText(
        '请输入证据名称'
      ) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: '测试证据' } });

      const submitterInput = screen.getByPlaceholderText(
        '请输入提交人'
      ) as HTMLInputElement;
      fireEvent.change(submitterInput, { target: { value: '张三' } });

      const resetButton = screen.getByText('重置');
      fireEvent.click(resetButton);

      expect(nameInput.value).toBe('');
      expect(submitterInput.value).toBe('');
    });
  });

  describe('预览功能', () => {
    it('应该切换到预览模式', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      const previewButton = screen.getByText('预览');
      fireEvent.click(previewButton);

      expect(screen.getByText('证据预览')).toBeInTheDocument();
    });

    it('应该在预览模式显示表单数据', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      const nameInput = screen.getByPlaceholderText('请输入证据名称');
      fireEvent.change(nameInput, { target: { value: '测试证据' } });

      const submitterInput = screen.getByPlaceholderText('请输入提交人');
      fireEvent.change(submitterInput, { target: { value: '张三' } });

      const previewButton = screen.getByText('预览');
      fireEvent.click(previewButton);

      expect(screen.getByText('测试证据')).toBeInTheDocument();
      expect(screen.getByText('张三')).toBeInTheDocument();
    });

    it('应该从预览模式返回编辑', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      const previewButton = screen.getByText('预览');
      fireEvent.click(previewButton);

      const backButtons = screen.getAllByText('返回编辑');
      fireEvent.click(backButtons[0]);

      expect(screen.getByText('新建证据')).toBeInTheDocument();
    });
  });

  describe('取消功能', () => {
    it('应该调用onCancel回调', () => {
      const onCancel = jest.fn();

      render(
        <EvidenceForm caseId={mockCaseId} onCancel={onCancel} showDraftButton />
      );

      const cancelButtons = screen.getAllByText('取消');
      // 点击第一个取消按钮（header中的）
      fireEvent.click(cancelButtons[0]);

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('文件上传', () => {
    it('应该显示文件上传输入', () => {
      render(<EvidenceForm caseId={mockCaseId} />);

      const fileInput = screen.getByLabelText(/证据文件/i);
      expect(fileInput).toBeInTheDocument();
    });

    it('应该显示上传中状态', async () => {
      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    fileUrl: 'https://example.com/file.pdf',
                  }),
                } as Response),
              100
            )
          )
      );

      render(<EvidenceForm caseId={mockCaseId} />);

      const fileInput = screen.getByLabelText(/证据文件/i);
      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('上传中...')).toBeInTheDocument();
      });
    });
  });
});
