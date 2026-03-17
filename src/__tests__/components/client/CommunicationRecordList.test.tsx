import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommunicationRecordList } from '../../../components/client/CommunicationRecordList';
import { CommunicationType } from '../../../types/client';

describe('CommunicationRecordList', () => {
  const mockClientId = 'client-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该渲染工具栏', () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: [],
              total: 0,
              pagination: {
                page: 1,
                limit: 10,
                total: 0,
                totalPages: 0,
              },
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      expect(screen.getByText('全部类型')).toBeInTheDocument();
      expect(screen.getByText('全部')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: '添加记录' })
      ).toBeInTheDocument();
    });

    it('应该显示加载状态（骨架屏）', () => {
      global.fetch = jest.fn(
        () =>
          new Promise(() => {
            void 0;
          })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      // 组件加载中显示骨架屏（animate-pulse 的 div），而非文字"加载中"
      // 验证骨架屏占位块存在
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('应该在无记录时显示空状态', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: [],
              total: 0,
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      await waitFor(() => {
        expect(screen.getByText('暂无沟通记录')).toBeInTheDocument();
      });
    });
  });

  describe('筛选功能', () => {
    it('应该支持按沟通类型筛选', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: [],
              total: 0,
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      // 第一个 combobox 是类型筛选
      const typeSelect = screen.getAllByRole('combobox')[0];
      await userEvent.selectOptions(typeSelect, '邮件');

      // select 切换为邮件后，显示该 option
      expect(screen.getByDisplayValue('邮件')).toBeInTheDocument();
    });

    it('应该支持按重要性筛选', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: [],
              total: 0,
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      // 第二个 combobox 是重要性筛选
      const importantSelect = screen.getAllByRole('combobox')[1];
      await userEvent.selectOptions(importantSelect, '重要');

      // option value="true"，所以 select 显示值为 'true'
      expect(screen.getByDisplayValue('重要')).toBeInTheDocument();
    });
  });

  describe('沟通记录列表', () => {
    const mockCommunications = [
      {
        id: 'comm-1',
        clientId: mockClientId,
        userId: 'user-1',
        type: CommunicationType.PHONE,
        summary: '电话沟通',
        content: '测试内容',
        nextFollowUpDate: new Date('2026-01-25T10:00:00'),
        isImportant: true,
        metadata: null,
        createdAt: new Date('2026-01-20T10:00:00'),
        updatedAt: new Date('2026-01-20T10:00:00'),
      },
      {
        id: 'comm-2',
        clientId: mockClientId,
        userId: 'user-1',
        type: CommunicationType.EMAIL,
        summary: '邮件沟通',
        content: null,
        nextFollowUpDate: null,
        isImportant: false,
        metadata: null,
        createdAt: new Date('2026-01-19T10:00:00'),
        updatedAt: new Date('2026-01-19T10:00:00'),
      },
    ];

    it('应该显示沟通记录列表', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: mockCommunications,
              total: 2,
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      await waitFor(() => {
        expect(screen.getByText('电话沟通')).toBeInTheDocument();
        expect(screen.getByText('邮件沟通')).toBeInTheDocument();
      });
    });

    it('应该显示沟通类型徽章', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: mockCommunications,
              total: 2,
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      await waitFor(() => {
        expect(screen.getByText('电话')).toBeInTheDocument();
        expect(screen.getByText('邮件')).toBeInTheDocument();
      });
    });

    it('应该显示重要标记', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: mockCommunications,
              total: 2,
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      await waitFor(() => {
        expect(screen.getByText('重要')).toBeInTheDocument();
      });
    });

    it('应该显示下次跟进时间', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: mockCommunications,
              total: 2,
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      await waitFor(() => {
        expect(screen.getByText(/下次跟进时间/)).toBeInTheDocument();
      });
    });
  });

  describe('编辑功能', () => {
    const mockCommunication = {
      id: 'comm-1',
      clientId: mockClientId,
      userId: 'user-1',
      type: CommunicationType.PHONE,
      summary: '电话沟通',
      content: '测试内容',
      nextFollowUpDate: null,
      isImportant: false,
      metadata: null,
      createdAt: new Date('2026-01-20T10:00:00'),
      updatedAt: new Date('2026-01-20T10:00:00'),
    };

    it('应该在点击编辑按钮时显示表单', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: [mockCommunication],
              total: 1,
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      await waitFor(() => {
        const editButton = screen.getByRole('button', { name: '编辑' });
        expect(editButton).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: '编辑' });
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('编辑沟通记录')).toBeInTheDocument();
      });
    });
  });

  describe('删除功能', () => {
    const mockCommunication = {
      id: 'comm-1',
      clientId: mockClientId,
      userId: 'user-1',
      type: CommunicationType.PHONE,
      summary: '电话沟通',
      content: '测试内容',
      nextFollowUpDate: null,
      isImportant: false,
      metadata: null,
      createdAt: new Date('2026-01-20T10:00:00'),
      updatedAt: new Date('2026-01-20T10:00:00'),
    };

    it('应该在删除记录时调用删除API', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: [mockCommunication],
              total: 1,
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: '删除' });
        expect(deleteButton).toBeInTheDocument();
      });

      window.confirm = jest.fn(() => true);

      const deleteButton = screen.getByRole('button', { name: '删除' });
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/communications/comm-1',
          {
            method: 'DELETE',
          }
        );
      });
    });

    it('应该在取消删除时不调用删除API', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: [mockCommunication],
              total: 1,
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: '删除' });
        expect(deleteButton).toBeInTheDocument();
      });

      window.confirm = jest.fn(() => false);

      const deleteButton = screen.getByRole('button', { name: '删除' });
      await userEvent.click(deleteButton);

      expect(global.fetch).not.toHaveBeenCalledWith(
        '/api/communications/comm-1',
        {
          method: 'DELETE',
        }
      );
    });
  });

  describe('添加记录', () => {
    it('应该在点击添加记录按钮时显示表单', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: [],
              total: 0,
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      const addButton = screen.getByRole('button', { name: '添加记录' });
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('添加沟通记录')).toBeInTheDocument();
      });
    });
  });

  describe('分页功能', () => {
    const mockCommunications = Array.from({ length: 15 }, (_, i) => ({
      id: `comm-${i + 1}`,
      clientId: mockClientId,
      userId: 'user-1',
      type: CommunicationType.PHONE,
      summary: `沟通记录 ${i + 1}`,
      content: null,
      nextFollowUpDate: null,
      isImportant: false,
      metadata: null,
      createdAt: new Date(`2026-01-${20 - i}T10:00:00`),
      updatedAt: new Date(`2026-01-${20 - i}T10:00:00`),
    }));

    it('应该显示分页信息', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: mockCommunications.slice(0, 10),
              total: 15,
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      await waitFor(() => {
        expect(screen.getByText(/共 15 条记录/)).toBeInTheDocument();
        expect(screen.getByText(/第 1 页/)).toBeInTheDocument();
      });
    });

    it('应该支持翻页', async () => {
      // 第一次调用返回第1页数据（total=15 触发分页控件），后续调用返回第2页
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              communications: mockCommunications.slice(0, 10),
              total: 15,
            }),
        })
      ) as jest.Mock;

      render(<CommunicationRecordList clientId={mockClientId} />);

      // 等待分页控件出现
      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: '下一页' });
        expect(nextButton).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: '下一页' });
      await userEvent.click(nextButton);

      await waitFor(() => {
        // 组件 fetch 列表时不传第二个参数，只检查 URL 是否包含 page=2
        const calls = (global.fetch as jest.Mock).mock.calls;
        const hasPage2Call = calls.some(
          ([url]: [string]) => typeof url === 'string' && url.includes('page=2')
        );
        expect(hasPage2Call).toBe(true);
      });
    });
  });
});
