import { CaseDiscussion } from '@prisma/client';

/**
 * 创建讨论输入接口
 */
export interface CreateDiscussionInput {
  caseId: string;
  content: string;
  mentions?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * 更新讨论输入接口
 */
export interface UpdateDiscussionInput {
  content?: string;
  mentions?: string[];
  isPinned?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * 讨论查询参数接口
 */
export interface DiscussionQueryParams {
  caseId?: string;
  userId?: string;
  isPinned?: boolean;
  includeDeleted?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'isPinned';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 讨论列表响应接口
 */
export interface DiscussionListResponse {
  discussions: CaseDiscussion[];
  total: number;
  caseId?: string;
  page: number;
  limit: number;
}

/**
 * 提及解析结果接口
 */
export interface MentionParseResult {
  mentions: string[];
  text: string;
  valid: boolean;
}

/**
 * 讨论统计信息接口
 */
export interface DiscussionStatistics {
  totalDiscussions: number;
  pinnedDiscussions: number;
  recentDiscussions: number;
  activeUsers: number;
}

/**
 * 讨论详情扩展接口
 * 包含作者信息和案件信息
 */
export interface DiscussionWithAuthor extends CaseDiscussion {
  author: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}

/**
 * 类型守卫：验证是否为有效的讨论输入
 */
export function isValidCreateDiscussionInput(
  input: unknown
): input is CreateDiscussionInput {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const { caseId, content, mentions, metadata } =
    input as Partial<CreateDiscussionInput>;

  return (
    typeof caseId === 'string' &&
    typeof content === 'string' &&
    content.trim().length > 0 &&
    (mentions === undefined || Array.isArray(mentions)) &&
    (metadata === undefined || typeof metadata === 'object')
  );
}

/**
 * 类型守卫：验证是否为有效的更新讨论输入
 */
export function isValidUpdateDiscussionInput(
  input: unknown
): input is UpdateDiscussionInput {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const updates = input as Partial<UpdateDiscussionInput>;

  return (
    (updates.content === undefined || typeof updates.content === 'string') &&
    (updates.mentions === undefined || Array.isArray(updates.mentions)) &&
    (updates.isPinned === undefined || typeof updates.isPinned === 'boolean') &&
    (updates.metadata === undefined || typeof updates.metadata === 'object')
  );
}

/**
 * 验证是否为有效的讨论查询参数
 */
export function isValidDiscussionQueryParams(
  params: unknown
): params is DiscussionQueryParams {
  if (typeof params !== 'object' || params === null) {
    return false;
  }

  const {
    caseId,
    userId,
    isPinned,
    includeDeleted,
    page,
    limit,
    sortBy,
    sortOrder,
  } = params as Partial<DiscussionQueryParams>;

  return (
    (caseId === undefined || typeof caseId === 'string') &&
    (userId === undefined || typeof userId === 'string') &&
    (isPinned === undefined || typeof isPinned === 'boolean') &&
    (includeDeleted === undefined || typeof includeDeleted === 'boolean') &&
    (page === undefined || typeof page === 'number') &&
    (limit === undefined || typeof limit === 'number') &&
    (sortBy === undefined ||
      ['createdAt', 'updatedAt', 'isPinned'].includes(sortBy as string)) &&
    (sortOrder === undefined || ['asc', 'desc'].includes(sortOrder as string))
  );
}

/**
 * 提及通知输入接口
 */
export interface MentionNotificationInput {
  caseId: string;
  discussionId: string;
  discussionContent: string;
  mentionedUserIds: string[];
  mentionerId: string;
  mentionerName: string;
}

/**
 * 提及通知结果接口
 */
export interface MentionNotificationResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  errors: string[];
}

/**
 * 提及用户信息接口
 */
export interface MentionedUserInfo {
  id: string;
  username: string | null;
  name: string | null;
}
