/**
 * 客户沟通记录页面测试
 * @jest-environment jsdom
 */
// @ts-nocheck

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
import ClientCommunicationsPage from '@/app/clients/[id]/communications/page';

// Mock fetch
(global as any).fetch = jest.fn() as jest.Mock;

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useParams: jest.fn(() => ({ id: 'client-123' })),
}));

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => {
    return <a href={href}>{children}</a>;
  };
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// 测试数据
const mockCommunications = [
  {
    id: 'comm-1',
    clientId: 'client-123',
    userId: 'user-1',
    type: 'PHONE',
    summary: '初次沟通，了解案情',
    content: '客户来电咨询合同纠纷事宜，已初步了解案情',
    nextFollowUpDate: '2024-02-01T10:00:00Z',
    isImportant: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'comm-2',
    clientId: 'client-123',
    userId: 'user-1',
    type: 'EMAIL',
    summary: '发送合同草案',
    content: '已通过邮件发送合同草案给客户',
    nextFollowUpDate: null,
    isImportant: false,
    createdAt: '2024-01-10T14:30:00Z',
    updatedAt: '2024-01-10T14:30:00Z',
  },
  {
    id: 'comm-3',
    clientId: 'client-123',
    userId: 'user-1',
    type: 'MEETING',
    summary: '面谈签约',
    content: '客户到场面谈并签署委托协议',
    nextFollowUpDate: null,
    isImportant: true,
    createdAt: '2024-01-05T09:00:00Z',
    updatedAt: '2024-01-05T09:00:00Z',
  },
];

const mockClient = {
  id: 'client-123',
  name: '张三',
  clientType: 'INDIVIDUAL',
  status: 'ACTIVE',
  phone: '13800138000',
  email: 'zhangsan@example.com',
};

function setupMockFetch({
  clientSuccess = true,
  clientData = mockClient,
  commSuccess = true,
  commData = { communications: mockCommunications, total: 3 },
}: {
  clientSuccess?: boolean;
  clientData?: typeof mockClient;
  commSuccess?: boolean;
  commData?: { communications: typeof mockCommunications; total: number };
} = {}) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (
      url.includes('/api/clients/client-123') &&
      !url.includes('/communications')
    ) {
      return Promise.resolve({
        ok: clientSuccess,
        status: clientSuccess ? 200 : 404,
        json: async () =>
          clientSuccess ? clientData : { error: 'Client not found' },
      });
    }
    if (url.includes('/api/clients/client-123/communications')) {
      return Promise.resolve({
        ok: commSuccess,
        status: commSuccess ? 200 : 500,
        json: async () =>
          commSuccess ? commData : { error: 'Failed to load' },
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ data: null }),
    });
  });
}

describe('客户沟通记录页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockFetch();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('页面渲染', () => {
    it('应该正确渲染页面标题和面包屑', async () => {
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        expect(screen.getByText('沟通记录')).toBeInTheDocument();
        expect(screen.getByText('张三')).toBeInTheDocument();
      });
    });

    it('应该渲染返回按钮', async () => {
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        expect(screen.getByText('返回客户详情')).toBeInTheDocument();
      });
    });

    it('应该渲染子页面导航链接', async () => {
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        expect(screen.getByText('基本信息')).toBeInTheDocument();
        expect(screen.getByText('沟通记录')).toBeInTheDocument();
        expect(screen.getByText('跟进任务')).toBeInTheDocument();
        expect(screen.getByText('案件历史')).toBeInTheDocument();
      });
    });
  });

  describe('沟通记录列表', () => {
    it('应该显示沟通记录列表', async () => {
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        expect(screen.getByText('初次沟通，了解案情')).toBeInTheDocument();
        expect(screen.getByText('发送合同草案')).toBeInTheDocument();
        expect(screen.getByText('面谈签约')).toBeInTheDocument();
      });
    });

    it('应该显示沟通类型标签', async () => {
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        expect(screen.getByText('电话')).toBeInTheDocument();
        expect(screen.getByText('邮件')).toBeInTheDocument();
        expect(screen.getByText('面谈')).toBeInTheDocument();
      });
    });

    it('应该标识重要记录', async () => {
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        const importantBadges = screen.getAllByText('重要');
        expect(importantBadges.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('应该显示下次跟进时间', async () => {
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        expect(screen.getByText(/下次跟进时间/)).toBeInTheDocument();
      });
    });
  });

  describe('筛选功能', () => {
    it('应该能够按类型筛选', async () => {
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        const typeSelect = screen.getByLabelText('沟通类型');
        fireEvent.change(typeSelect, { target: { value: 'PHONE' } });
        expect(typeSelect).toHaveValue('PHONE');
      });
    });

    it('应该能够按重要程度筛选', async () => {
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        const importantSelect = screen.getByLabelText('重要程度');
        fireEvent.change(importantSelect, { target: { value: 'true' } });
        expect(importantSelect).toHaveValue('true');
      });
    });
  });

  describe('新增沟通记录', () => {
    it('应该显示新增按钮', async () => {
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        expect(screen.getByText('新增沟通记录')).toBeInTheDocument();
      });
    });

    it('点击新增按钮应该打开表单对话框', async () => {
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        const addButton = screen.getByText('新增沟通记录');
        fireEvent.click(addButton);
        expect(screen.getByText('添加沟通记录')).toBeInTheDocument();
      });
    });
  });

  describe('加载状态', () => {
    it('应该显示加载状态', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(<ClientCommunicationsPage />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  describe('错误处理', () => {
    it('加载失败应该显示错误信息', async () => {
      setupMockFetch({ clientSuccess: false });
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        expect(screen.getByText(/加载失败/)).toBeInTheDocument();
      });
    });

    it('应该显示重试按钮', async () => {
      setupMockFetch({ clientSuccess: false });
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        expect(screen.getByText('重试')).toBeInTheDocument();
      });
    });
  });

  describe('空状态', () => {
    it('当没有沟通记录时显示空状态提示', async () => {
      setupMockFetch({
        commData: { communications: [], total: 0 },
      });
      render(<ClientCommunicationsPage />);

      await waitFor(() => {
        expect(screen.getByText('暂无沟通记录')).toBeInTheDocument();
      });
    });
  });
});
