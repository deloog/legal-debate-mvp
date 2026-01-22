/**
 * 案件协作类型定义
 * 用于案件团队成员管理、权限控制等功能
 */

/**
 * 案件角色枚举
 */
export enum CaseRole {
  LEAD = 'LEAD', // 主办律师
  ASSISTANT = 'ASSISTANT', // 协办律师
  PARALEGAL = 'PARALEGAL', // 律师助理
  OBSERVER = 'OBSERVER', // 观察者
}

/**
 * 案件权限枚举
 */
export enum CasePermission {
  // 案件基本权限
  VIEW_CASE = 'VIEW_CASE', // 查看案件
  EDIT_CASE = 'EDIT_CASE', // 编辑案件
  DELETE_CASE = 'DELETE_CASE', // 删除案件

  // 时间线权限
  VIEW_TIMELINE = 'VIEW_TIMELINE', // 查看时间线
  EDIT_TIMELINE = 'EDIT_TIMELINE', // 编辑时间线
  DELETE_TIMELINE = 'DELETE_TIMELINE', // 删除时间线

  // 法庭日程权限
  VIEW_SCHEDULES = 'VIEW_SCHEDULES', // 查看法庭日程
  EDIT_SCHEDULES = 'EDIT_SCHEDULES', // 编辑法庭日程
  DELETE_SCHEDULES = 'DELETE_SCHEDULES', // 删除法庭日程

  // 证据管理权限
  VIEW_EVIDENCE = 'VIEW_EVIDENCE', // 查看证据
  EDIT_EVIDENCE = 'EDIT_EVIDENCE', // 编辑证据
  DELETE_EVIDENCE = 'DELETE_EVIDENCE', // 删除证据
  UPLOAD_EVIDENCE = 'UPLOAD_EVIDENCE', // 上传证据

  // 文档管理权限
  VIEW_DOCUMENTS = 'VIEW_DOCUMENTS', // 查看文档
  EDIT_DOCUMENTS = 'EDIT_DOCUMENTS', // 编辑文档
  DELETE_DOCUMENTS = 'DELETE_DOCUMENTS', // 删除文档
  UPLOAD_DOCUMENTS = 'UPLOAD_DOCUMENTS', // 上传文档

  // 辩论管理权限
  VIEW_DEBATES = 'VIEW_DEBATES', // 查看辩论
  EDIT_DEBATES = 'EDIT_DEBATES', // 编辑辩论
  DELETE_DEBATES = 'DELETE_DEBATES', // 删除辩论

  // 法条引用权限
  VIEW_LEGAL_REFERENCES = 'VIEW_LEGAL_REFERENCES', // 查看法条引用
  EDIT_LEGAL_REFERENCES = 'EDIT_LEGAL_REFERENCES', // 编辑法条引用
  DELETE_LEGAL_REFERENCES = 'DELETE_LEGAL_REFERENCES', // 删除法条引用

  // 团队管理权限
  VIEW_TEAM_MEMBERS = 'VIEW_TEAM_MEMBERS', // 查看团队成员
  ADD_TEAM_MEMBERS = 'ADD_TEAM_MEMBERS', // 添加团队成员
  EDIT_TEAM_MEMBERS = 'EDIT_TEAM_MEMBERS', // 编辑团队成员
  REMOVE_TEAM_MEMBERS = 'REMOVE_TEAM_MEMBERS', // 移除团队成员

  // 沟通权限
  VIEW_DISCUSSIONS = 'VIEW_DISCUSSIONS', // 查看讨论
  POST_DISCUSSIONS = 'POST_DISCUSSIONS', // 发表讨论
  EDIT_DISCUSSIONS = 'EDIT_DISCUSSIONS', // 编辑讨论
  DELETE_DISCUSSIONS = 'DELETE_DISCUSSIONS', // 删除讨论

  // 导出权限
  EXPORT_DATA = 'EXPORT_DATA', // 导出数据
}

/**
 * 角色默认权限映射
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<CaseRole, CasePermission[]> = {
  [CaseRole.LEAD]: [
    // 主办律师拥有所有权限
    CasePermission.VIEW_CASE,
    CasePermission.EDIT_CASE,
    CasePermission.DELETE_CASE,
    CasePermission.VIEW_TIMELINE,
    CasePermission.EDIT_TIMELINE,
    CasePermission.DELETE_TIMELINE,
    CasePermission.VIEW_SCHEDULES,
    CasePermission.EDIT_SCHEDULES,
    CasePermission.DELETE_SCHEDULES,
    CasePermission.VIEW_EVIDENCE,
    CasePermission.EDIT_EVIDENCE,
    CasePermission.DELETE_EVIDENCE,
    CasePermission.UPLOAD_EVIDENCE,
    CasePermission.VIEW_DOCUMENTS,
    CasePermission.EDIT_DOCUMENTS,
    CasePermission.DELETE_DOCUMENTS,
    CasePermission.UPLOAD_DOCUMENTS,
    CasePermission.VIEW_DEBATES,
    CasePermission.EDIT_DEBATES,
    CasePermission.DELETE_DEBATES,
    CasePermission.VIEW_LEGAL_REFERENCES,
    CasePermission.EDIT_LEGAL_REFERENCES,
    CasePermission.DELETE_LEGAL_REFERENCES,
    CasePermission.VIEW_TEAM_MEMBERS,
    CasePermission.ADD_TEAM_MEMBERS,
    CasePermission.EDIT_TEAM_MEMBERS,
    CasePermission.REMOVE_TEAM_MEMBERS,
    CasePermission.VIEW_DISCUSSIONS,
    CasePermission.POST_DISCUSSIONS,
    CasePermission.EDIT_DISCUSSIONS,
    CasePermission.DELETE_DISCUSSIONS,
    CasePermission.EXPORT_DATA,
  ],
  [CaseRole.ASSISTANT]: [
    // 协办律师拥有大部分权限，但不能删除案件和移除团队成员
    CasePermission.VIEW_CASE,
    CasePermission.EDIT_CASE,
    CasePermission.VIEW_TIMELINE,
    CasePermission.EDIT_TIMELINE,
    CasePermission.VIEW_SCHEDULES,
    CasePermission.EDIT_SCHEDULES,
    CasePermission.VIEW_EVIDENCE,
    CasePermission.EDIT_EVIDENCE,
    CasePermission.UPLOAD_EVIDENCE,
    CasePermission.VIEW_DOCUMENTS,
    CasePermission.EDIT_DOCUMENTS,
    CasePermission.UPLOAD_DOCUMENTS,
    CasePermission.VIEW_DEBATES,
    CasePermission.EDIT_DEBATES,
    CasePermission.VIEW_LEGAL_REFERENCES,
    CasePermission.EDIT_LEGAL_REFERENCES,
    CasePermission.VIEW_TEAM_MEMBERS,
    CasePermission.VIEW_DISCUSSIONS,
    CasePermission.POST_DISCUSSIONS,
    CasePermission.EDIT_DISCUSSIONS,
    CasePermission.EXPORT_DATA,
  ],
  [CaseRole.PARALEGAL]: [
    // 律师助理拥有基础权限
    CasePermission.VIEW_CASE,
    CasePermission.VIEW_TIMELINE,
    CasePermission.VIEW_SCHEDULES,
    CasePermission.VIEW_EVIDENCE,
    CasePermission.UPLOAD_EVIDENCE,
    CasePermission.VIEW_DOCUMENTS,
    CasePermission.UPLOAD_DOCUMENTS,
    CasePermission.VIEW_DEBATES,
    CasePermission.VIEW_LEGAL_REFERENCES,
    CasePermission.VIEW_TEAM_MEMBERS,
    CasePermission.VIEW_DISCUSSIONS,
    CasePermission.POST_DISCUSSIONS,
    CasePermission.EXPORT_DATA,
  ],
  [CaseRole.OBSERVER]: [
    // 观察者只有查看权限
    CasePermission.VIEW_CASE,
    CasePermission.VIEW_TIMELINE,
    CasePermission.VIEW_SCHEDULES,
    CasePermission.VIEW_EVIDENCE,
    CasePermission.VIEW_DOCUMENTS,
    CasePermission.VIEW_DEBATES,
    CasePermission.VIEW_LEGAL_REFERENCES,
    CasePermission.VIEW_TEAM_MEMBERS,
    CasePermission.VIEW_DISCUSSIONS,
    CasePermission.EXPORT_DATA,
  ],
};

/**
 * 添加团队成员输入接口
 */
export interface AddCaseTeamMemberInput {
  caseId: string;
  userId: string;
  role: CaseRole;
  permissions?: CasePermission[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 更新团队成员输入接口
 */
export interface UpdateCaseTeamMemberInput {
  role?: CaseRole;
  permissions?: CasePermission[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 案件团队成员详情接口
 */
export interface CaseTeamMemberDetail {
  id: string;
  caseId: string;
  userId: string;
  role: CaseRole;
  permissions: CasePermission[];
  joinedAt: Date;
  notes?: string | null;
  metadata: Record<string, unknown> | null;
  case?: {
    id: string;
    title: string;
    type: string;
    status: string;
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
 * 案件团队成员列表响应接口
 */
export interface CaseTeamMemberListResponse {
  members: CaseTeamMemberDetail[];
  total: number;
  caseId: string;
}

/**
 * 案件成员查询参数接口
 */
export interface CaseTeamMemberQueryParams {
  caseId?: string;
  userId?: string;
  role?: CaseRole;
  page?: number;
  limit?: number;
  sortBy?: 'joinedAt' | 'role' | 'name';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 权限检查结果接口
 */
export interface PermissionCheckResult {
  hasPermission: boolean;
  permission: CasePermission;
  userId: string;
  caseId: string;
  memberRole?: CaseRole;
}

/**
 * 权限验证错误接口
 */
export interface PermissionValidationError {
  field: string;
  message: string;
}

/**
 * 添加团队成员验证结果接口
 */
export interface AddTeamMemberValidationResult {
  isValid: boolean;
  errors: PermissionValidationError[];
}

/**
 * 案件角色标签映射
 */
export const CASE_ROLE_LABELS: Record<CaseRole, string> = {
  [CaseRole.LEAD]: '主办律师',
  [CaseRole.ASSISTANT]: '协办律师',
  [CaseRole.PARALEGAL]: '律师助理',
  [CaseRole.OBSERVER]: '观察者',
};

/**
 * 权限标签映射
 */
export const CASE_PERMISSION_LABELS: Partial<Record<CasePermission, string>> = {
  [CasePermission.VIEW_CASE]: '查看案件',
  [CasePermission.EDIT_CASE]: '编辑案件',
  [CasePermission.DELETE_CASE]: '删除案件',
  [CasePermission.VIEW_TIMELINE]: '查看时间线',
  [CasePermission.EDIT_TIMELINE]: '编辑时间线',
  [CasePermission.DELETE_TIMELINE]: '删除时间线',
  [CasePermission.VIEW_SCHEDULES]: '查看法庭日程',
  [CasePermission.EDIT_SCHEDULES]: '编辑法庭日程',
  [CasePermission.DELETE_SCHEDULES]: '删除法庭日程',
  [CasePermission.VIEW_EVIDENCE]: '查看证据',
  [CasePermission.EDIT_EVIDENCE]: '编辑证据',
  [CasePermission.DELETE_EVIDENCE]: '删除证据',
  [CasePermission.UPLOAD_EVIDENCE]: '上传证据',
  [CasePermission.VIEW_DOCUMENTS]: '查看文档',
  [CasePermission.EDIT_DOCUMENTS]: '编辑文档',
  [CasePermission.DELETE_DOCUMENTS]: '删除文档',
  [CasePermission.UPLOAD_DOCUMENTS]: '上传文档',
  [CasePermission.VIEW_DEBATES]: '查看辩论',
  [CasePermission.EDIT_DEBATES]: '编辑辩论',
  [CasePermission.DELETE_DEBATES]: '删除辩论',
  [CasePermission.VIEW_LEGAL_REFERENCES]: '查看法条引用',
  [CasePermission.EDIT_LEGAL_REFERENCES]: '编辑法条引用',
  [CasePermission.DELETE_LEGAL_REFERENCES]: '删除法条引用',
  [CasePermission.VIEW_TEAM_MEMBERS]: '查看团队成员',
  [CasePermission.ADD_TEAM_MEMBERS]: '添加团队成员',
  [CasePermission.EDIT_TEAM_MEMBERS]: '编辑团队成员',
  [CasePermission.REMOVE_TEAM_MEMBERS]: '移除团队成员',
  [CasePermission.VIEW_DISCUSSIONS]: '查看讨论',
  [CasePermission.POST_DISCUSSIONS]: '发表讨论',
  [CasePermission.EDIT_DISCUSSIONS]: '编辑讨论',
  [CasePermission.DELETE_DISCUSSIONS]: '删除讨论',
  [CasePermission.EXPORT_DATA]: '导出数据',
};

/**
 * 类型守卫：验证是否为有效的CaseRole
 */
export function isValidCaseRole(value: string): value is CaseRole {
  return Object.values(CaseRole).includes(value as CaseRole);
}

/**
 * 类型守卫：验证是否为有效的CasePermission
 */
export function isValidCasePermission(value: string): value is CasePermission {
  return Object.values(CasePermission).includes(value as CasePermission);
}

/**
 * 类型守卫：验证是否为CasePermission数组
 */
export function isCasePermissionArray(
  value: unknown
): value is CasePermission[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every(item => isValidCasePermission(item as string));
}

/**
 * 获取角色标签
 */
export function getCaseRoleLabel(role: CaseRole): string {
  return CASE_ROLE_LABELS[role] || role;
}

/**
 * 获取权限标签
 */
export function getCasePermissionLabel(permission: CasePermission): string {
  return CASE_PERMISSION_LABELS[permission] || permission;
}

/**
 * 获取角色默认权限
 */
export function getRoleDefaultPermissions(role: CaseRole): CasePermission[] {
  return ROLE_DEFAULT_PERMISSIONS[role] || [];
}

/**
 * 验证添加团队成员输入
 */
export function validateAddTeamMemberInput(
  input: AddCaseTeamMemberInput
): AddTeamMemberValidationResult {
  const errors: PermissionValidationError[] = [];

  if (!input.caseId || typeof input.caseId !== 'string') {
    errors.push({ field: 'caseId', message: '案件ID是必填项' });
  }

  if (!input.userId || typeof input.userId !== 'string') {
    errors.push({ field: 'userId', message: '用户ID是必填项' });
  }

  if (!input.role || !isValidCaseRole(input.role)) {
    errors.push({
      field: 'role',
      message:
        '角色必须是有效的案件角色（LEAD、ASSISTANT、PARALEGAL、OBSERVER）',
    });
  }

  if (input.permissions && !isCasePermissionArray(input.permissions)) {
    errors.push({
      field: 'permissions',
      message: '权限必须是有效的案件权限数组',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
