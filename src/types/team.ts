/**
 * 团队类型定义
 * 集中定义团队相关的类型
 */

/**
 * 团队类型
 * 注意：这个类型必须与 Prisma schema 中的 TeamType 枚举保持一致
 */
export type TeamType = 'LAW_FIRM' | 'LEGAL_DEPT' | 'OTHER';

/**
 * 团队类型常量（运行时可用）
 */
export const TeamTypeValues = {
  LAW_FIRM: 'LAW_FIRM',
  LEGAL_DEPT: 'LEGAL_DEPT',
  OTHER: 'OTHER',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const TeamType = TeamTypeValues;

/**
 * 团队状态
 * 注意：这个类型必须与 Prisma schema 中的 TeamStatus 枚举保持一致
 */
export type TeamStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/**
 * 团队状态常量（运行时可用）
 */
export const TeamStatusValues = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

// 导出状态标签（兼容旧代码）
export const TEAM_TYPE_LABELS: Record<string, string> = {
  PROJECT: '项目',
  DEPARTMENT: '部门',
  COMMITTEE: '委员会',
  TASK_FORCE: '工作组',
  LAW_FIRM: '律师事务所',
  LEGAL_TEAM: '法律团队',
  LEGAL_DEPT: '法务部',
  OTHER: '其他',
};

export const TEAM_STATUS_LABELS: Record<string, string> = {
  ACTIVE: '活跃',
  ARCHIVED: '已归档',
  DISBANDED: '已解散',
  INACTIVE: ' inactive',
};

// 导出类型别名作为值（兼容旧代码）
export const TeamStatus = TeamStatusValues;

/**
 * 团队成员角色
 * 注意：这个类型必须与 Prisma schema 中的 TeamRole 枚举保持一致
 */
export type TeamRole = 'ADMIN' | 'LAWYER' | 'PARALEGAL' | 'OTHER';

/**
 * 团队成员角色常量（运行时可用）
 */
export const TeamRoleValues = {
  ADMIN: 'ADMIN',
  LAWYER: 'LAWYER',
  PARALEGAL: 'PARALEGAL',
  OTHER: 'OTHER',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const TeamRole = TeamRoleValues;

/**
 * 成员状态
 * 注意：这个类型必须与 Prisma schema 中的 MemberStatus 枚举保持一致
 */
export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'REMOVED';

/**
 * 成员状态常量（运行时可用）
 */
export const MemberStatusValues = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  REMOVED: 'REMOVED',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const MemberStatus = MemberStatusValues;

/**
 * 团队角色标签
 */
export const TEAM_ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理员',
  LAWYER: '律师',
  PARALEGAL: '律师助理',
  OTHER: '其他',
};

/**
 * 成员状态标签
 */
export const MEMBER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: '活跃',
  INACTIVE: '不活跃',
  REMOVED: '已移除',
};

/**
 * 团队成员详情
 */
export interface TeamMemberDetail {
  id: string;
  teamId: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
    role: string;
  };
  role: string;
  status: string;
  joinedAt: Date;
  permissions: string[];
  notes?: string | null;
}

/**
 * 团队详情
 */
export interface TeamDetail {
  id: string;
  name: string;
  description: string | null;
  logo?: string | null;
  type: string;
  status: string;
  metadata?: Record<string, unknown> | null;
  ownerId?: string;
  owner?: {
    id: string;
    name: string | null;
    email: string;
  };
  members?: TeamMemberDetail[];
  memberCount?: number;
  caseCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 团队列表响应
 */
export interface TeamListResponse {
  teams: TeamDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 团队成员列表响应
 */
export interface TeamMemberListResponse {
  members: {
    id: string;
    teamId: string;
    userId: string;
    role: TeamRole;
    status: MemberStatus;
    joinedAt: Date;
    notes: string | null;
    metadata: Record<string, unknown> | null;
  }[];
  total: number;
  teamId: string;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 团队查询参数
 */
export interface TeamQueryParams {
  page?: string;
  pageSize?: string;
  status?: string;
  type?: string;
  keyword?: string;
  sortBy?: string;
  sortOrder?: string;
}

/**
 * 团队创建请求
 */
export interface CreateTeamInput {
  name: string;
  description?: string;
  type: string;
  memberIds?: string[];
}

/**
 * 团队更新请求
 */
export interface UpdateTeamInput {
  name?: string;
  description?: string;
  status?: string;
}

/**
 * 添加成员请求
 */
export interface AddTeamMemberInput {
  userId: string;
  role: string;
}

/**
 * 更新成员请求
 */
export interface UpdateTeamMemberInput {
  role?: string;
  status?: string;
  permissions?: string[];
}

/**
 * 验证创建团队输入
 */
export function validateCreateTeamInput(input: CreateTeamInput): {
  isValid: boolean;
  errors: Array<{ field?: string; message: string }>;
} {
  const errors: Array<{ field?: string; message: string }> = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push({ field: 'name', message: '团队名称不能为空' });
  }

  if (!input.type) {
    errors.push({ field: 'type', message: '团队类型不能为空' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
