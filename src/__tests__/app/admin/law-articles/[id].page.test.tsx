/**
 * 法条详情页面测试
 * @jest-environment jsdom
 */
// @ts-nocheck - 禁用此文件的 TypeScript 类型检查，因为 jest-dom 类型声明与测试环境存在兼容性问题

import { LawArticleDetail } from '@/components/admin/LawArticleDetail';
import { LawCategory, LawStatus, LawType } from '@prisma/client';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// 初始化fetch mock
(global as any).fetch = jest.fn() as jest.Mock;

// 修复 fetch mock 类型
(global as any).fetch = jest.fn((_url: unknown, _options?: RequestInit) => {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: null }),
  });
}) as jest.Mock;

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

import { useRouter } from 'next/navigation';

const mockPush = jest.fn();

describe('法条详情页面', () => {
  const mockArticleId = 'test-article-id';
  const mockArticle = {
    id: mockArticleId,
    lawName: '测试法条',
    articleNumber: '第一条',
    fullText: '这是测试法条的内容',
    lawType: LawType.LAW,
    category: LawCategory.CIVIL,
    subCategory: '合同',
    tags: ['合同', '民事'],
    keywords: ['合同法', '民事'],
    version: '1.0',
    effectiveDate: new Date('2020-01-01'),
    expiryDate: null,
    status: LawStatus.VALID,
    amendmentHistory: null,
    issuingAuthority: '全国人民代表大会',
    jurisdiction: '全国',
    relatedArticles: [],
    legalBasis: null,
    viewCount: 100,
    referenceCount: 50,
    createdAt: new Date('2020-01-01'),
    updatedAt: new Date('2020-01-01'),
    parent: null,
    children: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('页面加载', () => {
    it('应该显示加载状态', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(() => {
            // 永不resolve以保持加载状态
          }) as Promise<Response>
      );

      render(<LawArticleDetail id={mockArticleId} />);

      // 检查加载动画div是否存在
      const loadingDiv = document.querySelector('.animate-spin');
      expect(loadingDiv).toBeInTheDocument();
    });

    it('应该成功加载法条详情', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        expect(screen.getByText('基本信息')).toBeInTheDocument();
        expect(screen.getByText('法条内容')).toBeInTheDocument();
      });
    });

    it('应该显示错误信息当加载失败', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          message: '加载失败',
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        expect(screen.getByText('加载失败')).toBeInTheDocument();
      });
    });

    it('应该显示法条不存在的信息', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: null,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        expect(screen.getByText('法条不存在')).toBeInTheDocument();
      });
    });
  });

  describe('法条信息展示', () => {
    it('应该显示法条名称', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        expect(screen.getByText('测试法条')).toBeInTheDocument();
      });
    });

    it('应该显示条号', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        expect(screen.getByText('第一条')).toBeInTheDocument();
      });
    });

    it('应该显示法条内容', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        expect(screen.getByText('这是测试法条的内容')).toBeInTheDocument();
      });
    });

    it('应该显示标签', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        // 使用getAllByText因为文本在标签和关键词中都出现了
        const contractElements = screen.getAllByText('合同');
        expect(contractElements.length).toBeGreaterThan(0);
      });
    });

    it('应该显示关键词', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        const contractLawElements = screen.getAllByText('合同法');
        expect(contractLawElements.length).toBeGreaterThan(0);
        const civilElements = screen.getAllByText('民事');
        expect(civilElements.length).toBeGreaterThan(0);
      });
    });

    it('应该显示统计信息', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('50')).toBeInTheDocument();
      });
    });

    it('应该显示版本信息', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        expect(screen.getByText('版本1.0')).toBeInTheDocument();
      });
    });
  });

  describe('编辑功能', () => {
    it('应该进入编辑模式点击编辑按钮', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        const editButton = screen.getByText('编辑');
        expect(editButton).toBeInTheDocument();
      });

      const editButton = screen.getByText('编辑');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('取消编辑')).toBeInTheDocument();
      });
    });

    it('应该显示编辑表单在编辑模式', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        const editButton = screen.getByText('编辑');
        expect(editButton).toBeInTheDocument();
      });

      const editButton = screen.getByText('编辑');
      fireEvent.click(editButton);

      await waitFor(() => {
        const nameInput = screen.getByDisplayValue('测试法条');
        expect(nameInput).toBeInTheDocument();
      });
    });

    it('应该能够修改法条名称', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        const editButton = screen.getByText('编辑');
        fireEvent.click(editButton);
      });

      await waitFor(() => {
        const nameInput = screen.getByDisplayValue('测试法条');
        fireEvent.change(nameInput, {
          target: { value: '更新后的法条名称' },
        });
        expect(nameInput).toHaveValue('更新后的法条名称');
      });
    });

    it('应该保存修改', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: mockArticle,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { ...mockArticle, lawName: '更新后的法条名称' },
          }),
        } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        const editButton = screen.getByText('编辑');
        fireEvent.click(editButton);
      });

      await waitFor(() => {
        const nameInput = screen.getByDisplayValue('测试法条');
        fireEvent.change(nameInput, {
          target: { value: '更新后的法条名称' },
        });
      });

      const saveButton = screen.getByText('保存');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('保存成功！')).toBeInTheDocument();
      });
    });
  });

  describe('删除功能', () => {
    it('应该显示删除按钮', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        expect(screen.getByText('删除')).toBeInTheDocument();
      });
    });

    it('应该能够删除法条', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: mockArticle,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { id: mockArticleId },
          }),
        } as Response);

      // Mock window.confirm
      Object.defineProperty(window, 'confirm', {
        writable: true,
        value: jest.fn(() => true),
      });

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        const deleteButton = screen.getByText('删除');
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith(
          '确定要删除这条法条吗？此操作不可恢复！'
        );
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/admin/law-articles/${mockArticleId}`,
          expect.objectContaining({
            method: 'DELETE',
          })
        );
        expect(mockPush).toHaveBeenCalledWith('/admin/law-articles');
      });
    });

    it('应该不删除当用户取消确认', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      // Mock window confirm returns false
      Object.defineProperty(window, 'confirm', {
        writable: true,
        value: jest.fn(() => false),
      });

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        const deleteButton = screen.getByText('删除');
        fireEvent.click(deleteButton);
      });

      expect(window.confirm).toHaveBeenCalled();
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(1); // Only initial load
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('导航功能', () => {
    it('应该能够返回列表', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        const backButton = screen.getByText('返回列表');
        expect(backButton).toBeInTheDocument();
        fireEvent.click(backButton);
      });

      expect(mockPush).toHaveBeenCalledWith('/admin/law-articles');
    });
  });

  describe('审核功能', () => {
    it('应该显示审核按钮当法条状态为草稿', async () => {
      const draftArticle = {
        ...mockArticle,
        status: LawStatus.DRAFT,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: draftArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        expect(screen.getByText('通过')).toBeInTheDocument();
        expect(screen.getByText('拒绝')).toBeInTheDocument();
      });
    });

    it('应该不显示审核按钮当法条状态为已生效', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockArticle,
        }),
      } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        expect(screen.queryByText('通过')).not.toBeInTheDocument();
        expect(screen.queryByText('拒绝')).not.toBeInTheDocument();
      });
    });

    it('应该能够通过审核', async () => {
      const draftArticle = {
        ...mockArticle,
        status: LawStatus.DRAFT,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: draftArticle,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { ...draftArticle, status: LawStatus.VALID },
          }),
        } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        const approveButton = screen.getByText('通过');
        fireEvent.click(approveButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/admin/law-articles/${mockArticleId}/review`,
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ status: 'APPROVED' }),
          })
        );
      });
    });

    it('应该能够拒绝审核', async () => {
      const draftArticle = {
        ...mockArticle,
        status: LawStatus.DRAFT,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: draftArticle,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { ...draftArticle, status: LawStatus.DRAFT },
          }),
        } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        const rejectButton = screen.getByText('拒绝');
        fireEvent.click(rejectButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/admin/law-articles/${mockArticleId}/review`,
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ status: 'REJECTED' }),
          })
        );
      });
    });
  });

  describe('错误处理', () => {
    it('应该显示错误提示当保存失败', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: mockArticle,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            success: false,
            message: '保存失败',
          }),
        } as Response);

      render(<LawArticleDetail id={mockArticleId} />);

      await waitFor(() => {
        const editButton = screen.getByText('编辑');
        fireEvent.click(editButton);
      });

      await waitFor(() => {
        const saveButton = screen.getByText('保存');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('保存失败')).toBeInTheDocument();
      });
    });
  });
});
