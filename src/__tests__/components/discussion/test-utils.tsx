/**
 * 测试辅助函数
 */

import type { DiscussionListProps } from '@/components/discussion/DiscussionList';

/**
 * 创建测试用的讨论数据
 */
export function createTestDiscussion(overrides = {}) {
  return {
    id: 'test-discussion-id-1',
    caseId: 'test-case-id-1',
    userId: 'test-user-id-1',
    content: '这是一条测试讨论内容',
    mentions: ['user1', 'user2'],
    isPinned: false,
    metadata: null,
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    deletedAt: null,
    author: {
      id: 'test-user-id-1',
      name: '测试用户',
      email: 'test@example.com',
      avatar: null,
    },
    ...overrides,
  };
}

/**
 * 创建多个测试讨论数据
 */
export function createTestDiscussions(count = 5) {
  return Array.from({ length: count }, (_, index) =>
    createTestDiscussion({
      id: `test-discussion-id-${index + 1}`,
      userId: index % 2 === 0 ? 'test-user-id-1' : 'test-user-id-2',
      content: `测试讨论内容 ${index + 1}`,
      isPinned: index < 2,
      createdAt: new Date(2024, 0, 1, 10, index).toISOString(),
      author: {
        id: index % 2 === 0 ? 'test-user-id-1' : 'test-user-id-2',
        name: index % 2 === 0 ? '测试用户1' : '测试用户2',
        email: index % 2 === 0 ? 'test1@example.com' : 'test2@example.com',
        avatar: null,
      },
    })
  );
}

/**
 * Mock fetch response
 */
export function mockFetchResponse(
  data: unknown,
  ok = true,
  status = 200
): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

/**
 * 创建测试用props
 */
export function createTestProps(
  overrides: Partial<DiscussionListProps> = {}
): DiscussionListProps {
  return {
    caseId: 'test-case-id-1',
    currentUserId: 'test-user-id-1',
    canViewDiscussions: true,
    canCreateDiscussions: true,
    canEditDiscussions: true,
    canPinDiscussions: true,
    canDeleteDiscussions: true,
    ...overrides,
  };
}
