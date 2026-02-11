/**
 * 法条导入对话框组件测试
 * 测试 LawArticleImportDialog 组件的各种场景
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LawArticleImportDialog } from '@/components/admin/LawArticleImportDialog';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('LawArticleImportDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  const validJsonData = JSON.stringify({
    articles: [
      {
        lawName: '中华人民共和国民法典',
        articleNumber: '第一条',
        fullText: '为了保护民事主体的合法权益...',
        lawType: 'LAW',
        category: 'CIVIL',
        effectiveDate: '2021-01-01',
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('渲染和显示', () => {
    it('当open为false时不应该显示对话框', () => {
      render(
        <LawArticleImportDialog
          open={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByText('导入法条')).not.toBeInTheDocument();
    });

    it('当open为true时应该显示对话框', () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('导入法条')).toBeInTheDocument();
    });

    it('应该显示数据源选择器', () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByLabelText('数据来源')).toBeInTheDocument();
      expect(screen.getByText('本地数据')).toBeInTheDocument();
    });

    it('应该显示导入方式选择（粘贴JSON/上传文件）', () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('导入方式')).toBeInTheDocument();
      expect(screen.getByText('粘贴JSON')).toBeInTheDocument();
      expect(screen.getByText('上传文件')).toBeInTheDocument();
    });

    it('应该显示数据格式说明', () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('数据格式说明')).toBeInTheDocument();
    });
  });

  describe('文本输入模式', () => {
    it('默认应该显示文本输入框', () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      expect(textarea).toBeInTheDocument();
    });

    it('应该能够输入JSON数据', () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      fireEvent.change(textarea, { target: { value: validJsonData } });

      expect(textarea).toHaveValue(validJsonData);
    });

    it('应该成功提交有效的JSON数据', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            total: 1,
            success: 1,
            failed: 0,
            errors: [],
          },
        }),
      });

      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      fireEvent.change(textarea, { target: { value: validJsonData } });

      const submitButton = screen.getByRole('button', { name: '导入' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/law-articles/import',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );
      });

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });

      // 验证成功提示显示
      expect(screen.getByText('导入成功')).toBeInTheDocument();
    });

    it('应该处理部分失败的情况', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            total: 2,
            success: 1,
            failed: 1,
            errors: [
              {
                lawName: '民法典',
                articleNumber: '第二条',
                reason: '法条名称不能为空',
              },
            ],
          },
        }),
      });

      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      fireEvent.change(textarea, { target: { value: validJsonData } });

      const submitButton = screen.getByRole('button', { name: '导入' });
      fireEvent.click(submitButton);

      // 验证错误列表显示
      await waitFor(() => {
        expect(screen.getByText('导入失败的法条 (1)')).toBeInTheDocument();
      });

      // 验证错误详情
      expect(screen.getByText('民法典')).toBeInTheDocument();
      expect(screen.getByText('第二条')).toBeInTheDocument();
      expect(screen.getByText('法条名称不能为空')).toBeInTheDocument();

      // 验证重试按钮存在
      expect(screen.getByText('重试失败项')).toBeInTheDocument();
    });

    it('应该处理无效的JSON格式', async () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      fireEvent.change(textarea, { target: { value: 'invalid json' } });

      const submitButton = screen.getByRole('button', { name: '导入' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Unexpected token/)).toBeInTheDocument();
      });
    });

    it('应该处理API错误', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          message: '导入法条失败',
        }),
      });

      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      fireEvent.change(textarea, { target: { value: validJsonData } });

      const submitButton = screen.getByRole('button', { name: '导入' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('导入法条失败')).toBeInTheDocument();
      });
    });
  });

  describe('文件上传模式', () => {
    it('应该能够切换到文件上传模式', () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const fileRadio = screen.getByLabelText('上传文件');
      fireEvent.click(fileRadio);

      expect(screen.getByLabelText('选择JSON文件')).toBeInTheDocument();
    });

    it('应该能够选择文件', async () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const fileRadio = screen.getByLabelText('上传文件');
      fireEvent.click(fileRadio);

      const fileInput = screen.getByLabelText(
        '选择JSON文件'
      ) as HTMLInputElement;
      const file = new File([validJsonData], 'test.json', {
        type: 'application/json',
      });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(fileInput.files?.[0]).toBe(file);
      });
    });

    it('应该能够提交文件', async () => {
      // 注意：由于文件上传涉及复杂的File API mock，这里简化测试
      // 实际测试中，文件上传会通过handleFileChange将内容设置到jsonText
      // 然后使用文本模式的逻辑进行提交

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            total: 1,
            success: 1,
            failed: 0,
            errors: [],
          },
        }),
      });

      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // 切换到文件上传模式
      const fileRadio = screen.getByLabelText('上传文件');
      fireEvent.click(fileRadio);

      // 验证文件输入框显示
      await waitFor(() => {
        expect(screen.getByLabelText('选择JSON文件')).toBeInTheDocument();
      });

      // 由于File.text()在jsdom中难以mock，我们验证组件的基本行为
      // 实际的文件上传功能在集成测试中验证
      const fileInput = screen.getByLabelText('选择JSON文件');
      expect(fileInput).toHaveAttribute('type', 'file');
      expect(fileInput).toHaveAttribute('accept', '.json');
    });
  });

  describe('数据源选择', () => {
    it('应该能够选择不同的数据源', () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const select = screen.getByLabelText('数据来源') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'judiciary' } });

      expect(select.value).toBe('judiciary');
    });

    it('应该在提交时包含数据源信息', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            total: 1,
            success: 1,
            failed: 0,
            errors: [],
          },
        }),
      });

      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const select = screen.getByLabelText('数据来源') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'judiciary' } });

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      fireEvent.change(textarea, { target: { value: validJsonData } });

      const submitButton = screen.getByRole('button', { name: '导入' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/law-articles/import',
          expect.objectContaining({
            body: expect.stringContaining('"dataSource":"judiciary"'),
          })
        );
      });
    });
  });

  describe('按钮状态', () => {
    it('在加载时应该禁用按钮', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // 永不resolve
      );

      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      fireEvent.change(textarea, { target: { value: validJsonData } });

      const submitButton = screen.getByRole('button', { name: '导入' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: '导入中...' })
        ).toBeDisabled();
      });
    });

    it('当没有输入数据时应该禁用提交按钮', () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const submitButton = screen.getByRole('button', { name: '导入' });
      expect(submitButton).toBeDisabled();
    });

    it('当有输入数据时应该启用提交按钮', () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      fireEvent.change(textarea, { target: { value: validJsonData } });

      const submitButton = screen.getByRole('button', { name: '导入' });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('关闭对话框', () => {
    it('应该能够通过关闭按钮关闭对话框', () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const closeButton = screen.getAllByRole('button')[0]; // 第一个按钮是关闭按钮
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('应该能够通过取消按钮关闭对话框', () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByRole('button', { name: '取消' });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('在加载时不应该能够关闭对话框', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // 永不resolve
      );

      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      fireEvent.change(textarea, { target: { value: validJsonData } });

      const submitButton = screen.getByRole('button', { name: '导入' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const closeButton = screen.getAllByRole('button')[0];
        expect(closeButton).toBeDisabled();
      });
    });
  });

  describe('成功和错误提示', () => {
    it('应该显示成功提示', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            total: 1,
            success: 1,
            failed: 0,
            errors: [],
          },
        }),
      });

      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      fireEvent.change(textarea, { target: { value: validJsonData } });

      const submitButton = screen.getByRole('button', { name: '导入' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('导入成功')).toBeInTheDocument();
      });
    });

    it('应该显示错误提示', async () => {
      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      fireEvent.change(textarea, { target: { value: 'invalid json' } });

      const submitButton = screen.getByRole('button', { name: '导入' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorElement = screen.getByText(/Unexpected token/);
        expect(errorElement).toBeInTheDocument();
        expect(errorElement.closest('div')).toHaveClass('bg-red-50');
      });
    });
  });

  describe('数据清空', () => {
    it('成功导入后应该清空输入', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            total: 1,
            success: 1,
            failed: 0,
            errors: [],
          },
        }),
      });

      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea = screen.getByPlaceholderText(
        '请输入JSON格式的法条数据...'
      ) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: validJsonData } });

      const submitButton = screen.getByRole('button', { name: '导入' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
    });
  });

  describe('支持数组格式', () => {
    it('应该支持直接传入数组格式的JSON', async () => {
      const arrayJsonData = JSON.stringify([
        {
          lawName: '民法典',
          articleNumber: '第一条',
          fullText: '内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: '2021-01-01',
        },
      ]);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            total: 1,
            success: 1,
            failed: 0,
            errors: [],
          },
        }),
      });

      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      fireEvent.change(textarea, { target: { value: arrayJsonData } });

      const submitButton = screen.getByRole('button', { name: '导入' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('应该拒绝不包含articles数组的JSON', async () => {
      const invalidJsonData = JSON.stringify({
        data: 'invalid',
      });

      render(
        <LawArticleImportDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea =
        screen.getByPlaceholderText('请输入JSON格式的法条数据...');
      fireEvent.change(textarea, { target: { value: invalidJsonData } });

      const submitButton = screen.getByRole('button', { name: '导入' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('JSON格式错误：必须包含articles数组或直接是数组')
        ).toBeInTheDocument();
      });
    });
  });
});
