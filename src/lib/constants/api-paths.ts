/**
 * API 路径常量
 * 集中管理所有 API 路径，避免硬编码字符串
 */

/**
 * API 版本前缀
 */
export const API_VERSION = {
  V1: '/api/v1',
  DEFAULT: '/api',
} as const;

/**
 * 案件相关 API
 */
export const CASE_API = {
  // 基础路径
  BASE: `${API_VERSION.V1}/cases`,
  LIST: `${API_VERSION.V1}/cases`,
  CREATE: `${API_VERSION.V1}/cases`,

  // 详情和操作（需要动态ID）
  detail: (id: string) => `${API_VERSION.V1}/cases/${id}`,
  update: (id: string) => `${API_VERSION.V1}/cases/${id}`,
  delete: (id: string) => `${API_VERSION.V1}/cases/${id}`,

  // 案件分享
  share: (id: string) => `${API_VERSION.DEFAULT}/cases/${id}/share`,
  getShared: (id: string) => `${API_VERSION.DEFAULT}/cases/${id}/share`,

  // 案件团队
  teamMembers: (id: string) =>
    `${API_VERSION.DEFAULT}/cases/${id}/team-members`,

  // 案件见证人
  witnesses: (caseId: string) =>
    `${API_VERSION.DEFAULT}/cases/${caseId}/witnesses`,
} as const;

/**
 * 咨询相关 API
 */
export const CONSULTATION_API = {
  BASE: `${API_VERSION.DEFAULT}/consultations`,
  LIST: `${API_VERSION.DEFAULT}/consultations`,
  CREATE: `${API_VERSION.DEFAULT}/consultations`,

  detail: (id: string) => `${API_VERSION.DEFAULT}/consultations/${id}`,
  update: (id: string) => `${API_VERSION.DEFAULT}/consultations/${id}`,
  delete: (id: string) => `${API_VERSION.DEFAULT}/consultations/${id}`,

  // 费用计算
  CALCULATE_FEE: `${API_VERSION.DEFAULT}/consultations/calculate-fee`,
} as const;

/**
 * 辩论相关 API
 */
export const DEBATE_API = {
  BASE: `${API_VERSION.V1}/debates`,
  LIST: `${API_VERSION.V1}/debates`,
  CREATE: `${API_VERSION.V1}/debates`,

  detail: (id: string) => `${API_VERSION.V1}/debates/${id}`,
  update: (id: string) => `${API_VERSION.V1}/debates/${id}`,
  delete: (id: string) => `${API_VERSION.V1}/debates/${id}`,

  // 辩论状态
  status: (id: string) => `${API_VERSION.V1}/debates/${id}/status`,

  // 辩论轮次
  rounds: (id: string) => `${API_VERSION.V1}/debates/${id}/rounds`,

  // 辩论论点
  arguments: (id: string) => `${API_VERSION.V1}/debates/${id}/arguments`,
} as const;

/**
 * 证据相关 API
 */
export const EVIDENCE_API = {
  BASE: `${API_VERSION.DEFAULT}/evidence`,
  LIST: `${API_VERSION.DEFAULT}/evidence`,
  CREATE: `${API_VERSION.DEFAULT}/evidence`,

  detail: (id: string) => `${API_VERSION.DEFAULT}/evidence/${id}`,
  update: (id: string) => `${API_VERSION.DEFAULT}/evidence/${id}`,
  delete: (id: string) => `${API_VERSION.DEFAULT}/evidence/${id}`,

  // 证据上传
  UPLOAD: `${API_VERSION.DEFAULT}/evidence/upload`,

  // 批量操作
  BULK: `${API_VERSION.DEFAULT}/evidence/bulk`,
} as const;

/**
 * 订单相关 API
 */
export const ORDER_API = {
  BASE: `${API_VERSION.DEFAULT}/orders`,
  LIST: `${API_VERSION.DEFAULT}/orders`,
  CREATE: `${API_VERSION.DEFAULT}/orders/create`,

  detail: (id: string) => `${API_VERSION.DEFAULT}/orders/${id}`,
  update: (id: string) => `${API_VERSION.DEFAULT}/orders/${id}`,
  cancel: (id: string) => `${API_VERSION.DEFAULT}/orders/${id}/cancel`,
} as const;

/**
 * 通知相关 API
 */
export const NOTIFICATION_API = {
  BASE: `${API_VERSION.DEFAULT}/notifications`,
  LIST: `${API_VERSION.DEFAULT}/notifications`,

  // 标记已读
  MARK_READ: `${API_VERSION.DEFAULT}/notifications/mark-read`,
  MARK_ALL_READ: `${API_VERSION.DEFAULT}/notifications/mark-all-read`,

  detail: (id: string) => `${API_VERSION.DEFAULT}/notifications/${id}`,
} as const;

/**
 * 提醒相关 API
 */
export const REMINDER_API = {
  BASE: `${API_VERSION.DEFAULT}/reminders`,
  LIST: `${API_VERSION.DEFAULT}/reminders`,
  CREATE: `${API_VERSION.DEFAULT}/reminders`,

  detail: (id: string) => `${API_VERSION.DEFAULT}/reminders/${id}`,
  update: (id: string) => `${API_VERSION.DEFAULT}/reminders/${id}`,
  delete: (id: string) => `${API_VERSION.DEFAULT}/reminders/${id}`,
  complete: (id: string) => `${API_VERSION.DEFAULT}/reminders/${id}`,
} as const;

/**
 * 用户相关 API
 */
export const USER_API = {
  BASE: `${API_VERSION.DEFAULT}/user`,

  // 用户偏好设置
  PREFERENCES: `${API_VERSION.DEFAULT}/user/preferences`,
} as const;

/**
 * 见证人相关 API
 */
export const WITNESS_API = {
  BASE: `${API_VERSION.DEFAULT}/witnesses`,
  LIST: `${API_VERSION.DEFAULT}/witnesses`,
  CREATE: `${API_VERSION.DEFAULT}/witnesses`,

  detail: (id: string) => `${API_VERSION.DEFAULT}/witnesses/${id}`,
  update: (id: string) => `${API_VERSION.DEFAULT}/witnesses/${id}`,
  delete: (id: string) => `${API_VERSION.DEFAULT}/witnesses/${id}`,
} as const;

/**
 * 团队相关 API
 */
export const TEAM_API = {
  BASE: `${API_VERSION.DEFAULT}/teams`,
  LIST: `${API_VERSION.DEFAULT}/teams`,
  CREATE: `${API_VERSION.DEFAULT}/teams`,

  detail: (id: string) => `${API_VERSION.DEFAULT}/teams/${id}`,
  update: (id: string) => `${API_VERSION.DEFAULT}/teams/${id}`,
  delete: (id: string) => `${API_VERSION.DEFAULT}/teams/${id}`,

  // 团队成员
  member: (teamId: string, memberId: string) =>
    `${API_VERSION.DEFAULT}/teams/${teamId}/members/${memberId}`,
} as const;

/**
 * 沟通记录相关 API
 */
export const COMMUNICATION_API = {
  BASE: `${API_VERSION.DEFAULT}/communications`,
  LIST: `${API_VERSION.DEFAULT}/communications`,
  CREATE: `${API_VERSION.DEFAULT}/communications`,

  detail: (id: string) => `${API_VERSION.DEFAULT}/communications/${id}`,
  update: (id: string) => `${API_VERSION.DEFAULT}/communications/${id}`,
  delete: (id: string) => `${API_VERSION.DEFAULT}/communications/${id}`,
} as const;

/**
 * 讨论相关 API
 */
export const DISCUSSION_API = {
  BASE: `${API_VERSION.DEFAULT}/discussions`,
  LIST: `${API_VERSION.DEFAULT}/discussions`,
  CREATE: `${API_VERSION.DEFAULT}/discussions`,

  detail: (id: string) => `${API_VERSION.DEFAULT}/discussions/${id}`,
  update: (id: string) => `${API_VERSION.DEFAULT}/discussions/${id}`,
  delete: (id: string) => `${API_VERSION.DEFAULT}/discussions/${id}`,

  // 置顶讨论
  pin: (id: string) => `${API_VERSION.DEFAULT}/discussions/${id}/pin`,
} as const;

/**
 * 时间线事件相关 API
 */
export const TIMELINE_API = {
  BASE: `${API_VERSION.V1}/timeline-events`,
  LIST: `${API_VERSION.V1}/timeline-events`,
  CREATE: `${API_VERSION.V1}/timeline-events`,

  detail: (id: string) => `${API_VERSION.V1}/timeline-events/${id}`,
  update: (id: string) => `${API_VERSION.V1}/timeline-events/${id}`,
  delete: (id: string) => `${API_VERSION.V1}/timeline-events/${id}`,
} as const;

/**
 * 发票相关 API
 */
export const INVOICE_API = {
  BASE: `${API_VERSION.DEFAULT}/invoices`,
  LIST: `${API_VERSION.DEFAULT}/invoices`,

  // 申请发票
  APPLY: `${API_VERSION.DEFAULT}/invoices/apply`,

  detail: (id: string) => `${API_VERSION.DEFAULT}/invoices/${id}`,
} as const;

/**
 * 计算相关 API
 */
export const CALCULATION_API = {
  // 费用计算
  FEES: `${API_VERSION.DEFAULT}/calculate/fees`,

  // 诉讼时效计算
  STATUTE: `${API_VERSION.DEFAULT}/statute/calculate`,
} as const;

/**
 * 法庭日程相关 API
 */
export const COURT_SCHEDULE_API = {
  BASE: `${API_VERSION.DEFAULT}/court-schedules`,
  LIST: `${API_VERSION.DEFAULT}/court-schedules`,
  CREATE: `${API_VERSION.DEFAULT}/court-schedules`,

  // 冲突检查
  CONFLICTS: `${API_VERSION.DEFAULT}/court-schedules/conflicts`,

  detail: (id: string) => `${API_VERSION.DEFAULT}/court-schedules/${id}`,
  update: (id: string) => `${API_VERSION.DEFAULT}/court-schedules/${id}`,
  delete: (id: string) => `${API_VERSION.DEFAULT}/court-schedules/${id}`,
} as const;

/**
 * 合同相关 API
 */
export const CONTRACT_API = {
  BASE: `${API_VERSION.DEFAULT}/contracts`,
  LIST: `${API_VERSION.DEFAULT}/contracts`,
  CREATE: `${API_VERSION.DEFAULT}/contracts`,

  detail: (id: string) => `${API_VERSION.DEFAULT}/contracts/${id}`,
  update: (id: string) => `${API_VERSION.DEFAULT}/contracts/${id}`,
  delete: (id: string) => `${API_VERSION.DEFAULT}/contracts/${id}`,

  // 发送合同邮件
  sendEmail: (id: string) =>
    `${API_VERSION.DEFAULT}/contracts/${id}/send-email`,
} as const;

/**
 * 反馈相关 API
 */
export const FEEDBACK_API = {
  BASE: `${API_VERSION.V1}/feedbacks`,

  // 推荐反馈
  RECOMMENDATION: `${API_VERSION.V1}/feedbacks/recommendation`,

  // 关系反馈
  RELATION: `${API_VERSION.V1}/feedbacks/relation`,
} as const;

/**
 * 客户相关 API
 */
export const CLIENT_API = {
  BASE: `${API_VERSION.DEFAULT}/clients`,
  LIST: `${API_VERSION.DEFAULT}/clients`,
  CREATE: `${API_VERSION.DEFAULT}/clients`,

  detail: (id: string) => `${API_VERSION.DEFAULT}/clients/${id}`,
  update: (id: string) => `${API_VERSION.DEFAULT}/clients/${id}`,
  delete: (id: string) => `${API_VERSION.DEFAULT}/clients/${id}`,

  // 客户统计
  STATISTICS: `${API_VERSION.DEFAULT}/clients/statistics`,
} as const;

/**
 * 统计相关 API
 */
export const STATS_API = {
  // 性能统计
  PERFORMANCE: {
    RESPONSE_TIME: `${API_VERSION.DEFAULT}/stats/performance/response-time`,
    ERROR_RATE: `${API_VERSION.DEFAULT}/stats/performance/error-rate`,
  },

  // 辩论统计
  DEBATES: {
    GENERATION_COUNT: `${API_VERSION.DEFAULT}/stats/debates/generation-count`,
    QUALITY_SCORE: `${API_VERSION.DEFAULT}/stats/debates/quality-score`,
  },

  // 案件统计
  CASES: {
    TYPE_DISTRIBUTION: `${API_VERSION.DEFAULT}/stats/cases/type-distribution`,
    EFFICIENCY: `${API_VERSION.DEFAULT}/stats/cases/efficiency`,
  },
} as const;

/**
 * 管理员 API
 */
export const ADMIN_API = {
  BASE: `${API_VERSION.DEFAULT}/admin`,

  // 用户管理
  USERS: {
    BASE: `${API_VERSION.DEFAULT}/admin/users`,
    LIST: `${API_VERSION.DEFAULT}/admin/users`,
    CREATE: `${API_VERSION.DEFAULT}/admin/users`,

    detail: (id: string) => `${API_VERSION.DEFAULT}/admin/users/${id}`,
    update: (id: string) => `${API_VERSION.DEFAULT}/admin/users/${id}`,
    delete: (id: string) => `${API_VERSION.DEFAULT}/admin/users/${id}`,
  },

  // 角色管理
  ROLES: {
    BASE: `${API_VERSION.DEFAULT}/admin/roles`,
    LIST: `${API_VERSION.DEFAULT}/admin/roles`,
    CREATE: `${API_VERSION.DEFAULT}/admin/roles`,

    detail: (id: string) => `${API_VERSION.DEFAULT}/admin/roles/${id}`,
    update: (id: string) => `${API_VERSION.DEFAULT}/admin/roles/${id}`,
    delete: (id: string) => `${API_VERSION.DEFAULT}/admin/roles/${id}`,
  },

  // 权限管理
  PERMISSIONS: {
    BASE: `${API_VERSION.DEFAULT}/admin/permissions`,
    LIST: `${API_VERSION.DEFAULT}/admin/permissions`,
  },

  // 订单管理
  ORDERS: {
    BASE: `${API_VERSION.DEFAULT}/admin/orders`,
    LIST: `${API_VERSION.DEFAULT}/admin/orders`,

    detail: (id: string) => `${API_VERSION.DEFAULT}/admin/orders/${id}`,
    update: (id: string) => `${API_VERSION.DEFAULT}/admin/orders/${id}`,
  },

  // 会员管理
  MEMBERSHIPS: {
    BASE: `${API_VERSION.DEFAULT}/admin/memberships`,
    LIST: `${API_VERSION.DEFAULT}/admin/memberships`,
    CREATE: `${API_VERSION.DEFAULT}/admin/memberships`,
    EXPORT: `${API_VERSION.DEFAULT}/admin/memberships/export`,

    detail: (id: string) => `${API_VERSION.DEFAULT}/admin/memberships/${id}`,
    update: (id: string) => `${API_VERSION.DEFAULT}/admin/memberships/${id}`,
    delete: (id: string) => `${API_VERSION.DEFAULT}/admin/memberships/${id}`,
  },

  // 案件管理
  CASES: {
    BASE: `${API_VERSION.DEFAULT}/admin/cases`,
    LIST: `${API_VERSION.DEFAULT}/admin/cases`,

    detail: (id: string) => `${API_VERSION.DEFAULT}/admin/cases/${id}`,
    update: (id: string) => `${API_VERSION.DEFAULT}/admin/cases/${id}`,
    delete: (id: string) => `${API_VERSION.DEFAULT}/admin/cases/${id}`,
  },

  // 法律条文管理
  LAW_ARTICLES: {
    BASE: `${API_VERSION.DEFAULT}/admin/law-articles`,
    LIST: `${API_VERSION.DEFAULT}/admin/law-articles`,
    CREATE: `${API_VERSION.DEFAULT}/admin/law-articles`,
    IMPORT: `${API_VERSION.DEFAULT}/admin/law-articles/import`,

    detail: (id: string) => `${API_VERSION.DEFAULT}/admin/law-articles/${id}`,
    update: (id: string) => `${API_VERSION.DEFAULT}/admin/law-articles/${id}`,
    delete: (id: string) => `${API_VERSION.DEFAULT}/admin/law-articles/${id}`,
    review: (id: string) =>
      `${API_VERSION.DEFAULT}/admin/law-articles/${id}/review`,
  },

  // 资格审查
  QUALIFICATIONS: {
    BASE: `${API_VERSION.DEFAULT}/admin/qualifications`,
    LIST: `${API_VERSION.DEFAULT}/admin/qualifications`,
  },
} as const;

/**
 * 认证相关 API
 */
export const AUTH_API = {
  BASE: '/auth',

  // 登录
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',

  // 注册
  REGISTER: '/auth/register',

  // 密码重置
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',

  // OAuth
  OAUTH: {
    CALLBACK: '/auth/callback',
  },
} as const;

/**
 * 辅助函数：构建带查询参数的 URL
 */
export function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  if (!params) return path;

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

/**
 * 辅助函数：验证 API 路径是否有效
 */
export function isValidApiPath(path: string): boolean {
  return path.startsWith('/api/') || path.startsWith('/auth/');
}
