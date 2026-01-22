/**
 * 团队管理类型定义
 * 用于团队和团队成员管理功能
 */

/**
 * 团队类型枚举
 */
export enum TeamType {
  LAW_FIRM = 'LAW_FIRM', // 律师事务所
  LEGAL_DEPT = 'LEGAL_DEPT', // 企业法务部门
  OTHER = 'OTHER', // 其他
}

/**
 * 团队状态枚举
 */
export enum TeamStatus {
  ACTIVE = 'ACTIVE', // 活跃
  INACTIVE = 'INACTIVE', // 非活跃
  SUSPENDED = 'SUSPENDED', // 已暂停
}

/**
 * 团队角色枚举
 */
export enum TeamRole {
  ADMIN = 'ADMIN', // 团队管理员
  LAWYER = 'LAWYER', // 律师
  PARALEGAL = 'PARALEGAL', // 律师助理
  OTHER = 'OTHER', // 其他
}

/**
 * 成员状态枚举
 */
export enum MemberStatus {
  ACTIVE = 'ACTIVE', // 活跃
  INACTIVE = 'INACTIVE', // 非活跃
  REMOVED = 'REMOVED', // 已移除
}

/**
 * 创建团队输入接口
 */
export interface CreateTeamInput {
  name: string;
  type: TeamType;
  description?: string;
  logo?: string;
  status?: TeamStatus;
  metadata?: Record<string, unknown>;
}

/**
 * 更新团队输入接口
 */
export interface UpdateTeamInput {
  name?: string;
  type?: TeamType;
  description?: string;
  logo?: string;
  status?: TeamStatus;
  metadata?: Record<string, unknown>;
}

/**
 * 团队查询参数接口
 */
export interface TeamQueryParams {
  type?: TeamType;
  status?: TeamStatus;
  search?: string; // 搜索关键词（团队名称）
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 团队详情接口
 */
export interface TeamDetail {
  id: string;
  name: string;
  type: TeamType;
  description: string | null;
  logo: string | null;
  status: TeamStatus;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  members?: number; // 成员数
  memberCount?: number; // 成员数量
}

/**
 * 团队列表响应接口
 */
export interface TeamListResponse {
  teams: TeamDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 创建团队成员输入接口
 */
export interface CreateTeamMemberInput {
  teamId: string;
  userId: string;
  role: TeamRole;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 更新团队成员输入接口
 */
export interface UpdateTeamMemberInput {
  role?: TeamRole;
  status?: MemberStatus;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 团队成员查询参数接口
 */
export interface TeamMemberQueryParams {
  teamId?: string;
  userId?: string;
  role?: TeamRole;
  status?: MemberStatus;
  page?: number;
  limit?: number;
  sortBy?: 'joinedAt' | 'role' | 'name';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 团队成员详情接口
 */
export interface TeamMemberDetail {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  status: MemberStatus;
  joinedAt: Date;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  team?: {
    id: string;
    name: string;
    type: TeamType;
    status: TeamStatus;
  };
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
    role: string;
  };
}

/**
 * 团队成员列表响应接口
 */
export interface TeamMemberListResponse {
  members: TeamMemberDetail[];
  total: number;
  teamId: string;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 团队验证错误接口
 */
export interface TeamValidationError {
  field: string;
  message: string;
}

/**
 * 团队验证结果接口
 */
export interface TeamValidationResult {
  isValid: boolean;
  errors: TeamValidationError[];
}

/**
 * 团队成员验证结果接口
 */
export interface TeamMemberValidationResult {
  isValid: boolean;
  errors: TeamValidationError[];
}

/**
 * 团队标签映射
 */
export const TEAM_TYPE_LABELS: Record<TeamType, string> = {
  [TeamType.LAW_FIRM]: '律师事务所',
  [TeamType.LEGAL_DEPT]: '企业法务部门',
  [TeamType.OTHER]: '其他',
};

/**
 * 团队状态标签映射
 */
export const TEAM_STATUS_LABELS: Record<TeamStatus, string> = {
  [TeamStatus.ACTIVE]: '活跃',
  [TeamStatus.INACTIVE]: '非活跃',
  [TeamStatus.SUSPENDED]: '已暂停',
};

/**
 * 团队角色标签映射
 */
export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  [TeamRole.ADMIN]: '团队管理员',
  [TeamRole.LAWYER]: '律师',
  [TeamRole.PARALEGAL]: '律师助理',
  [TeamRole.OTHER]: '其他',
};

/**
 * 成员状态标签映射
 */
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  [MemberStatus.ACTIVE]: '活跃',
  [MemberStatus.INACTIVE]: '非活跃',
  [MemberStatus.REMOVED]: '已移除',
};

/**
 * 类型守卫：验证是否为有效的TeamType
 */
export function isValidTeamType(value: string): value is TeamType {
  return Object.values(TeamType).includes(value as TeamType);
}

/**
 * 类型守卫：验证是否为有效的TeamStatus
 */
export function isValidTeamStatus(value: string): value is TeamStatus {
  return Object.values(TeamStatus).includes(value as TeamStatus);
}

/**
 * 类型守卫：验证是否为有效的TeamRole
 */
export function isValidTeamRole(value: string): value is TeamRole {
  return Object.values(TeamRole).includes(value as TeamRole);
}

/**
 * 类型守卫：验证是否为有效的MemberStatus
 */
export function isValidMemberStatus(value: string): value is MemberStatus {
  return Object.values(MemberStatus).includes(value as MemberStatus);
}

/**
 * 获取团队类型标签
 */
export function getTeamTypeLabel(type: TeamType): string {
  return TEAM_TYPE_LABELS[type] || type;
}

/**
 * 获取团队状态标签
 */
export function getTeamStatusLabel(status: TeamStatus): string {
  return TEAM_STATUS_LABELS[status] || status;
}

/**
 * 获取团队角色标签
 */
export function getTeamRoleLabel(role: TeamRole): string {
  return TEAM_ROLE_LABELS[role] || role;
}

/**
 * 获取成员状态标签
 */
export function getMemberStatusLabel(status: MemberStatus): string {
  return MEMBER_STATUS_LABELS[status] || status;
}

/**
 * 验证创建团队输入
 */
export function validateCreateTeamInput(
  input: CreateTeamInput
): TeamValidationResult {
  const errors: TeamValidationError[] = [];

  if (
    !input.name ||
    typeof input.name !== 'string' ||
    input.name.trim().length === 0
  ) {
    errors.push({ field: 'name', message: '团队名称是必填项' });
  }

  if (input.name && input.name.length > 100) {
    errors.push({ field: 'name', message: '团队名称不能超过100个字符' });
  }

  if (!input.type || !isValidTeamType(input.type)) {
    errors.push({
      field: 'type',
      message: '团队类型必须是有效的值（LAW_FIRM、LEGAL_DEPT、OTHER）',
    });
  }

  if (input.description && input.description.length > 500) {
    errors.push({ field: 'description', message: '团队描述不能超过500个字符' });
  }

  if (input.status && !isValidTeamStatus(input.status)) {
    errors.push({
      field: 'status',
      message: '团队状态必须是有效的值（ACTIVE、INACTIVE、SUSPENDED）',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 验证创建团队成员输入
 */
export function validateCreateTeamMemberInput(
  input: CreateTeamMemberInput
): TeamMemberValidationResult {
  const errors: TeamValidationError[] = [];

  if (!input.teamId || typeof input.teamId !== 'string') {
    errors.push({ field: 'teamId', message: '团队ID是必填项' });
  }

  if (!input.userId || typeof input.userId !== 'string') {
    errors.push({ field: 'userId', message: '用户ID是必填项' });
  }

  if (!input.role || !isValidTeamRole(input.role)) {
    errors.push({
      field: 'role',
      message: '角色必须是有效的值（ADMIN、LAWYER、PARALEGAL、OTHER）',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 验证更新团队成员输入
 */
export function validateUpdateTeamMemberInput(
  input: UpdateTeamMemberInput
): TeamMemberValidationResult {
  const errors: TeamValidationError[] = [];

  if (input.role !== undefined && !isValidTeamRole(input.role)) {
    errors.push({
      field: 'role',
      message: '角色必须是有效的值（ADMIN、LAWYER、PARALEGAL、OTHER）',
    });
  }

  if (input.status !== undefined && !isValidMemberStatus(input.status)) {
    errors.push({
      field: 'status',
      message: '状态必须是有效的值（ACTIVE、INACTIVE、REMOVED）',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
