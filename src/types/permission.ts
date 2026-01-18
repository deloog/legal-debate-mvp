/**
 * RBAC权限系统类型定义
 */

// =============================================================================
// 权限操作枚举
// =============================================================================

/**
 * 权限操作类型
 */
export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage', // 所有权限
  APPROVE = 'approve', // 审核
  REVIEW = 'review', // 查看审核
  EXPORT = 'export', // 导出
}

/**
 * 权限资源类型
 */
export enum PermissionResource {
  USER = 'user',
  CASE = 'case',
  DEBATE = 'debate',
  DOCUMENT = 'document',
  LAW = 'law',
  SYSTEM = 'system',
  REVIEW = 'review', // 审核管理
  QUALIFICATION = 'qualification', // 资格管理
  ENTERPRISE = 'enterprise', // 企业管理
  STATS = 'stats', // 统计数据
  EXPORT = 'export', // 数据导出
  REPORT = 'report', // 报告管理
}

// =============================================================================
// 权限相关接口
// =============================================================================

/**
 * 权限接口
 */
export interface Permission {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 角色接口
 */
export interface Role {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 带权限的角色接口
 */
export interface RoleWithPermissions extends Role {
  permissions: RolePermission[];
}

/**
 * 角色权限关联接口
 */
export interface RolePermission {
  id: string;
  roleId: string;
  permissionId: string;
  createdAt: Date;
  role?: Role & {
    permissions: Permission[];
  };
  permission?: Permission;
}

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
  hasPermission: boolean;
  reason?: string;
  requiredPermission?: string;
  actualPermissions?: string[];
}

/**
 * 用户权限缓存
 */
export interface UserPermissionsCache {
  userId: string;
  permissions: string[];
  cacheTime: Date;
  expiresAt: Date;
}

// =============================================================================
// 预定义权限常量
// =============================================================================

/**
 * 用户管理权限
 */
export const USER_PERMISSIONS = {
  CREATE: 'user:create',
  READ: 'user:read',
  UPDATE: 'user:update',
  DELETE: 'user:delete',
  MANAGE: 'user:manage',
} as const;

/**
 * 案件管理权限
 */
export const CASE_PERMISSIONS = {
  CREATE: 'case:create',
  READ: 'case:read',
  UPDATE: 'case:update',
  DELETE: 'case:delete',
  MANAGE: 'case:manage',
} as const;

/**
 * 辩论管理权限
 */
export const DEBATE_PERMISSIONS = {
  CREATE: 'debate:create',
  READ: 'debate:read',
  UPDATE: 'debate:update',
  DELETE: 'debate:delete',
  MANAGE: 'debate:manage',
} as const;

/**
 * 文档管理权限
 */
export const DOCUMENT_PERMISSIONS = {
  CREATE: 'document:create',
  READ: 'document:read',
  UPDATE: 'document:update',
  DELETE: 'document:delete',
  MANAGE: 'document:manage',
} as const;

/**
 * 法条管理权限
 */
export const LAW_PERMISSIONS = {
  CREATE: 'law:create',
  READ: 'law:read',
  UPDATE: 'law:update',
  DELETE: 'law:delete',
  MANAGE: 'law:manage',
} as const;

/**
 * 系统管理权限
 */
export const SYSTEM_PERMISSIONS = {
  CONFIG: 'system:config',
  MONITOR: 'system:monitor',
  BACKUP: 'system:backup',
  RESTORE: 'system:restore',
  MANAGE: 'system:manage',
} as const;

/**
 * 审核管理权限
 */
export const REVIEW_PERMISSIONS = {
  CREATE: 'review:create',
  READ: 'review:read',
  APPROVE: 'review:approve',
  MANAGE: 'review:manage',
} as const;

/**
 * 资格管理权限
 */
export const QUALIFICATION_PERMISSIONS = {
  CREATE: 'qualification:create',
  READ: 'qualification:read',
  APPROVE: 'qualification:approve',
  MANAGE: 'qualification:manage',
} as const;

/**
 * 企业管理权限
 */
export const ENTERPRISE_PERMISSIONS = {
  CREATE: 'enterprise:create',
  READ: 'enterprise:read',
  APPROVE: 'enterprise:approve',
  MANAGE: 'enterprise:manage',
} as const;

/**
 * 统计数据权限
 */
export const STATS_PERMISSIONS = {
  READ: 'stats:read',
  EXPORT: 'stats:export',
} as const;

/**
 * 数据导出权限
 */
export const EXPORT_PERMISSIONS = {
  CASE: 'export:case',
  STATS: 'export:stats',
} as const;

/**
 * 报告管理权限
 */
export const REPORT_PERMISSIONS = {
  CREATE: 'report:create',
  READ: 'report:read',
  UPDATE: 'report:update',
  DELETE: 'report:delete',
  MANAGE: 'report:manage',
} as const;

/**
 * 告警管理权限
 */
export const ALERT_PERMISSIONS = {
  READ: 'alert:read',
  ACKNOWLEDGE: 'alert:acknowledge',
  RESOLVE: 'alert:resolve',
  MANAGE: 'alert:manage',
} as const;

/**
 * 所有权限集合
 */
export const ALL_PERMISSIONS = [
  ...Object.values(USER_PERMISSIONS),
  ...Object.values(CASE_PERMISSIONS),
  ...Object.values(DEBATE_PERMISSIONS),
  ...Object.values(DOCUMENT_PERMISSIONS),
  ...Object.values(LAW_PERMISSIONS),
  ...Object.values(SYSTEM_PERMISSIONS),
  ...Object.values(REVIEW_PERMISSIONS),
  ...Object.values(QUALIFICATION_PERMISSIONS),
  ...Object.values(ENTERPRISE_PERMISSIONS),
  ...Object.values(STATS_PERMISSIONS),
  ...Object.values(EXPORT_PERMISSIONS),
  ...Object.values(REPORT_PERMISSIONS),
  ...Object.values(ALERT_PERMISSIONS),
] as const;

/**
 * 预定义权限定义
 */
export const PERMISSION_DEFINITIONS = [
  // 用户管理
  {
    name: USER_PERMISSIONS.CREATE,
    description: '创建用户',
    resource: PermissionResource.USER,
    action: PermissionAction.CREATE,
  },
  {
    name: USER_PERMISSIONS.READ,
    description: '查看用户',
    resource: PermissionResource.USER,
    action: PermissionAction.READ,
  },
  {
    name: USER_PERMISSIONS.UPDATE,
    description: '更新用户',
    resource: PermissionResource.USER,
    action: PermissionAction.UPDATE,
  },
  {
    name: USER_PERMISSIONS.DELETE,
    description: '删除用户',
    resource: PermissionResource.USER,
    action: PermissionAction.DELETE,
  },
  {
    name: USER_PERMISSIONS.MANAGE,
    description: '管理用户',
    resource: PermissionResource.USER,
    action: PermissionAction.MANAGE,
  },

  // 案件管理
  {
    name: CASE_PERMISSIONS.CREATE,
    description: '创建案件',
    resource: PermissionResource.CASE,
    action: PermissionAction.CREATE,
  },
  {
    name: CASE_PERMISSIONS.READ,
    description: '查看案件',
    resource: PermissionResource.CASE,
    action: PermissionAction.READ,
  },
  {
    name: CASE_PERMISSIONS.UPDATE,
    description: '更新案件',
    resource: PermissionResource.CASE,
    action: PermissionAction.UPDATE,
  },
  {
    name: CASE_PERMISSIONS.DELETE,
    description: '删除案件',
    resource: PermissionResource.CASE,
    action: PermissionAction.DELETE,
  },
  {
    name: CASE_PERMISSIONS.MANAGE,
    description: '管理案件',
    resource: PermissionResource.CASE,
    action: PermissionAction.MANAGE,
  },

  // 辩论管理
  {
    name: DEBATE_PERMISSIONS.CREATE,
    description: '创建辩论',
    resource: PermissionResource.DEBATE,
    action: PermissionAction.CREATE,
  },
  {
    name: DEBATE_PERMISSIONS.READ,
    description: '查看辩论',
    resource: PermissionResource.DEBATE,
    action: PermissionAction.READ,
  },
  {
    name: DEBATE_PERMISSIONS.UPDATE,
    description: '更新辩论',
    resource: PermissionResource.DEBATE,
    action: PermissionAction.UPDATE,
  },
  {
    name: DEBATE_PERMISSIONS.DELETE,
    description: '删除辩论',
    resource: PermissionResource.DEBATE,
    action: PermissionAction.DELETE,
  },
  {
    name: DEBATE_PERMISSIONS.MANAGE,
    description: '管理辩论',
    resource: PermissionResource.DEBATE,
    action: PermissionAction.MANAGE,
  },

  // 文档管理
  {
    name: DOCUMENT_PERMISSIONS.CREATE,
    description: '上传文档',
    resource: PermissionResource.DOCUMENT,
    action: PermissionAction.CREATE,
  },
  {
    name: DOCUMENT_PERMISSIONS.READ,
    description: '查看文档',
    resource: PermissionResource.DOCUMENT,
    action: PermissionAction.READ,
  },
  {
    name: DOCUMENT_PERMISSIONS.UPDATE,
    description: '更新文档',
    resource: PermissionResource.DOCUMENT,
    action: PermissionAction.UPDATE,
  },
  {
    name: DOCUMENT_PERMISSIONS.DELETE,
    description: '删除文档',
    resource: PermissionResource.DOCUMENT,
    action: PermissionAction.DELETE,
  },
  {
    name: DOCUMENT_PERMISSIONS.MANAGE,
    description: '管理文档',
    resource: PermissionResource.DOCUMENT,
    action: PermissionAction.MANAGE,
  },

  // 法条管理
  {
    name: LAW_PERMISSIONS.CREATE,
    description: '创建法条',
    resource: PermissionResource.LAW,
    action: PermissionAction.CREATE,
  },
  {
    name: LAW_PERMISSIONS.READ,
    description: '查看法条',
    resource: PermissionResource.LAW,
    action: PermissionAction.READ,
  },
  {
    name: LAW_PERMISSIONS.UPDATE,
    description: '更新法条',
    resource: PermissionResource.LAW,
    action: PermissionAction.UPDATE,
  },
  {
    name: LAW_PERMISSIONS.DELETE,
    description: '删除法条',
    resource: PermissionResource.LAW,
    action: PermissionAction.DELETE,
  },
  {
    name: LAW_PERMISSIONS.MANAGE,
    description: '管理法条',
    resource: PermissionResource.LAW,
    action: PermissionAction.MANAGE,
  },

  // 系统管理
  {
    name: SYSTEM_PERMISSIONS.CONFIG,
    description: '系统配置',
    resource: PermissionResource.SYSTEM,
    action: PermissionAction.CREATE,
  },
  {
    name: SYSTEM_PERMISSIONS.MONITOR,
    description: '系统监控',
    resource: PermissionResource.SYSTEM,
    action: PermissionAction.READ,
  },
  {
    name: SYSTEM_PERMISSIONS.BACKUP,
    description: '系统备份',
    resource: PermissionResource.SYSTEM,
    action: PermissionAction.UPDATE,
  },
  {
    name: SYSTEM_PERMISSIONS.RESTORE,
    description: '系统恢复',
    resource: PermissionResource.SYSTEM,
    action: PermissionAction.DELETE,
  },
  {
    name: SYSTEM_PERMISSIONS.MANAGE,
    description: '管理系统',
    resource: PermissionResource.SYSTEM,
    action: PermissionAction.MANAGE,
  },

  // 审核管理
  {
    name: REVIEW_PERMISSIONS.CREATE,
    description: '创建审核记录',
    resource: PermissionResource.REVIEW,
    action: PermissionAction.CREATE,
  },
  {
    name: REVIEW_PERMISSIONS.READ,
    description: '查看审核记录',
    resource: PermissionResource.REVIEW,
    action: PermissionAction.READ,
  },
  {
    name: REVIEW_PERMISSIONS.APPROVE,
    description: '审核通过/拒绝',
    resource: PermissionResource.REVIEW,
    action: PermissionAction.APPROVE,
  },
  {
    name: REVIEW_PERMISSIONS.MANAGE,
    description: '管理审核',
    resource: PermissionResource.REVIEW,
    action: PermissionAction.MANAGE,
  },

  // 资格管理
  {
    name: QUALIFICATION_PERMISSIONS.CREATE,
    description: '提交资格',
    resource: PermissionResource.QUALIFICATION,
    action: PermissionAction.CREATE,
  },
  {
    name: QUALIFICATION_PERMISSIONS.READ,
    description: '查看资格',
    resource: PermissionResource.QUALIFICATION,
    action: PermissionAction.READ,
  },
  {
    name: QUALIFICATION_PERMISSIONS.APPROVE,
    description: '审核资格',
    resource: PermissionResource.QUALIFICATION,
    action: PermissionAction.APPROVE,
  },
  {
    name: QUALIFICATION_PERMISSIONS.MANAGE,
    description: '管理资格',
    resource: PermissionResource.QUALIFICATION,
    action: PermissionAction.MANAGE,
  },

  // 企业管理
  {
    name: ENTERPRISE_PERMISSIONS.CREATE,
    description: '注册企业',
    resource: PermissionResource.ENTERPRISE,
    action: PermissionAction.CREATE,
  },
  {
    name: ENTERPRISE_PERMISSIONS.READ,
    description: '查看企业',
    resource: PermissionResource.ENTERPRISE,
    action: PermissionAction.READ,
  },
  {
    name: ENTERPRISE_PERMISSIONS.APPROVE,
    description: '审核企业',
    resource: PermissionResource.ENTERPRISE,
    action: PermissionAction.APPROVE,
  },
  {
    name: ENTERPRISE_PERMISSIONS.MANAGE,
    description: '管理企业',
    resource: PermissionResource.ENTERPRISE,
    action: PermissionAction.MANAGE,
  },

  // 统计数据
  {
    name: STATS_PERMISSIONS.READ,
    description: '查看统计数据',
    resource: PermissionResource.STATS,
    action: PermissionAction.READ,
  },
  {
    name: STATS_PERMISSIONS.EXPORT,
    description: '导出统计数据',
    resource: PermissionResource.STATS,
    action: PermissionAction.EXPORT,
  },

  // 数据导出
  {
    name: EXPORT_PERMISSIONS.CASE,
    description: '导出案件数据',
    resource: PermissionResource.EXPORT,
    action: PermissionAction.READ,
  },
  {
    name: EXPORT_PERMISSIONS.STATS,
    description: '导出统计数据',
    resource: PermissionResource.EXPORT,
    action: PermissionAction.READ,
  },

  // 报告管理
  {
    name: REPORT_PERMISSIONS.CREATE,
    description: '创建报告',
    resource: PermissionResource.REPORT,
    action: PermissionAction.CREATE,
  },
  {
    name: REPORT_PERMISSIONS.READ,
    description: '查看报告',
    resource: PermissionResource.REPORT,
    action: PermissionAction.READ,
  },
  {
    name: REPORT_PERMISSIONS.UPDATE,
    description: '更新报告',
    resource: PermissionResource.REPORT,
    action: PermissionAction.UPDATE,
  },
  {
    name: REPORT_PERMISSIONS.DELETE,
    description: '删除报告',
    resource: PermissionResource.REPORT,
    action: PermissionAction.DELETE,
  },
  {
    name: REPORT_PERMISSIONS.MANAGE,
    description: '管理报告',
    resource: PermissionResource.REPORT,
    action: PermissionAction.MANAGE,
  },
] as const;

// =============================================================================
// 预定义角色权限
// =============================================================================

/**
 * 普通用户角色权限
 */
export const USER_ROLE_PERMISSIONS = [
  USER_PERMISSIONS.READ,
  CASE_PERMISSIONS.CREATE,
  CASE_PERMISSIONS.READ,
  DEBATE_PERMISSIONS.CREATE,
  DEBATE_PERMISSIONS.READ,
  DOCUMENT_PERMISSIONS.CREATE,
  DOCUMENT_PERMISSIONS.READ,
  LAW_PERMISSIONS.READ,
] as const;

/**
 * 律师角色权限
 */
export const LAWYER_ROLE_PERMISSIONS = [
  ...USER_ROLE_PERMISSIONS,
  CASE_PERMISSIONS.UPDATE,
  DEBATE_PERMISSIONS.UPDATE,
  DOCUMENT_PERMISSIONS.UPDATE,
] as const;

/**
 * 企业角色权限
 */
export const ENTERPRISE_ROLE_PERMISSIONS = [
  ...USER_ROLE_PERMISSIONS,
  CASE_PERMISSIONS.UPDATE,
  DEBATE_PERMISSIONS.UPDATE,
  DOCUMENT_PERMISSIONS.UPDATE,
] as const;

/**
 * 管理员角色权限
 */
export const ADMIN_ROLE_PERMISSIONS = [...ALL_PERMISSIONS] as const;

/**
 * 超级管理员角色权限
 */
export const SUPER_ADMIN_ROLE_PERMISSIONS = [...ALL_PERMISSIONS] as const;
