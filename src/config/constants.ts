/**
 * 应用配置常量
 * 集中管理所有配置项，避免硬编码
 */

// =============================================================================
// 应用基础配置
// =============================================================================

export const APP_CONFIG = {
  name: '法律辩论平台',
  version: '1.0.0',
  description: 'AI驱动的法律辩论与案件分析平台',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
} as const;

// =============================================================================
// 文件上传配置
// =============================================================================

export const FILE_UPLOAD_CONFIG = {
  // 最大文件大小（字节）
  maxFileSize: {
    document: 10 * 1024 * 1024, // 10MB - 文档
    image: 5 * 1024 * 1024, // 5MB - 图片
    video: 100 * 1024 * 1024, // 100MB - 视频
    audio: 20 * 1024 * 1024, // 20MB - 音频
  },

  // 允许的文件类型
  allowedTypes: {
    document: ['.pdf', '.doc', '.docx', '.txt'],
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    video: ['.mp4', '.avi', '.mov', '.wmv'],
    audio: ['.mp3', '.wav', '.ogg', '.m4a'],
    all: [
      '.pdf',
      '.doc',
      '.docx',
      '.txt',
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.mp4',
      '.avi',
      '.mov',
      '.wmv',
      '.mp3',
      '.wav',
      '.ogg',
      '.m4a',
    ],
  },

  // MIME类型
  mimeTypes: {
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: [
      'video/mp4',
      'video/x-msvideo',
      'video/quicktime',
      'video/x-ms-wmv',
    ],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
  },
} as const;

// =============================================================================
// 分页配置
// =============================================================================

export const PAGINATION_CONFIG = {
  defaultPage: 1,
  defaultPageSize: 20,
  maxPageSize: 100,
  pageSizeOptions: [10, 20, 50, 100],
} as const;

// =============================================================================
// 缓存配置
// =============================================================================

export const CACHE_CONFIG = {
  // 缓存时间（秒）
  ttl: {
    short: 60, // 1分钟
    medium: 300, // 5分钟
    long: 3600, // 1小时
    veryLong: 86400, // 24小时
  },

  // 缓存键前缀
  keyPrefix: {
    user: 'user:',
    case: 'case:',
    debate: 'debate:',
    lawArticle: 'law_article:',
    contract: 'contract:',
    consultation: 'consultation:',
  },
} as const;

// =============================================================================
// API配置
// =============================================================================

export const API_CONFIG = {
  // 请求超时时间（毫秒）
  timeout: {
    default: 30000, // 30秒
    upload: 120000, // 2分钟
    analysis: 180000, // 3分钟
  },

  // 重试配置
  retry: {
    maxAttempts: 3,
    delay: 1000, // 1秒
    backoff: 2, // 指数退避因子
  },

  // 速率限制
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000, // 1分钟
  },
} as const;

// =============================================================================
// AI服务配置
// =============================================================================

export const AI_CONFIG = {
  // 模型配置
  models: {
    default: 'gpt-3.5-turbo',
    advanced: 'gpt-4',
    embedding: 'text-embedding-ada-002',
  },

  // Token限制
  maxTokens: {
    chat: 4000,
    completion: 2000,
    embedding: 8000,
  },

  // 温度参数
  temperature: {
    creative: 0.9,
    balanced: 0.7,
    precise: 0.3,
  },

  // 使用真实AI服务（从环境变量读取）
  useRealAI: process.env.USE_REAL_AI === 'true',
} as const;

// =============================================================================
// 法律相关配置
// =============================================================================

export const LEGAL_CONFIG = {
  // 案件类型
  caseTypes: [
    { value: 'CIVIL', label: '民事案件' },
    { value: 'CRIMINAL', label: '刑事案件' },
    { value: 'ADMINISTRATIVE', label: '行政案件' },
    { value: 'COMMERCIAL', label: '商事案件' },
    { value: 'LABOR', label: '劳动争议' },
    { value: 'INTELLECTUAL_PROPERTY', label: '知识产权' },
    { value: 'OTHER', label: '其他' },
  ],

  // 证据类型
  evidenceTypes: [
    { value: 'DOCUMENT', label: '书证' },
    { value: 'PHYSICAL', label: '物证' },
    { value: 'WITNESS', label: '证人证言' },
    { value: 'EXPERT_OPINION', label: '鉴定意见' },
    { value: 'AUDIO_VIDEO', label: '音视频' },
    { value: 'OTHER', label: '其他' },
  ],

  // 法条关系类型
  relationTypes: [
    { value: 'REFERENCES', label: '引用' },
    { value: 'SUPERSEDES', label: '废止' },
    { value: 'AMENDS', label: '修改' },
    { value: 'IMPLEMENTS', label: '实施' },
    { value: 'INTERPRETS', label: '解释' },
    { value: 'CONFLICTS', label: '冲突' },
    { value: 'COMPLEMENTS', label: '补充' },
  ],
} as const;

// =============================================================================
// 用户相关配置
// =============================================================================

export const USER_CONFIG = {
  // 密码要求
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: false,
  },

  // 用户名要求
  username: {
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_-]+$/,
  },

  // Session配置
  session: {
    maxAge: 7 * 24 * 60 * 60, // 7天（秒）
    updateAge: 24 * 60 * 60, // 24小时（秒）
  },

  // 验证码配置
  verificationCode: {
    length: 6,
    expiresIn: 10 * 60, // 10分钟（秒）
    maxAttempts: 5,
  },
} as const;

// =============================================================================
// 通知配置
// =============================================================================

export const NOTIFICATION_CONFIG = {
  // 通知类型
  types: {
    info: 'INFO',
    success: 'SUCCESS',
    warning: 'WARNING',
    error: 'ERROR',
  },

  // 通知持续时间（毫秒）
  duration: {
    short: 3000, // 3秒
    medium: 5000, // 5秒
    long: 10000, // 10秒
  },

  // 最大通知数量
  maxNotifications: 5,
} as const;

// =============================================================================
// 导出配置
// =============================================================================

export const EXPORT_CONFIG = {
  // 导出格式
  formats: [
    { value: 'CSV', label: 'CSV' },
    { value: 'EXCEL', label: 'Excel' },
    { value: 'PDF', label: 'PDF' },
    { value: 'JSON', label: 'JSON' },
  ],

  // 导出类型
  types: [
    { value: 'CASES', label: '案件' },
    { value: 'CONSULTATIONS', label: '咨询' },
    { value: 'CONTRACTS', label: '合同' },
    { value: 'STATS', label: '统计数据' },
    { value: 'MEMBERSHIPS', label: '会员数据' },
    { value: 'DOCUMENTS', label: '文档' },
  ],

  // 最大导出记录数
  maxRecords: {
    csv: 100000,
    excel: 50000,
    pdf: 10000,
    json: 100000,
  },
} as const;

// =============================================================================
// 支付配置
// =============================================================================

export const PAYMENT_CONFIG = {
  // 支付方式
  methods: [
    { value: 'WECHAT', label: '微信支付' },
    { value: 'ALIPAY', label: '支付宝' },
    { value: 'BANK_CARD', label: '银行卡' },
    { value: 'BALANCE', label: '余额支付' },
  ],

  // 货币
  currency: 'CNY',

  // 最小支付金额（分）
  minAmount: 1,

  // 最大支付金额（分）
  maxAmount: 1000000000, // 1000万元
} as const;

// =============================================================================
// 辩论配置
// =============================================================================

export const DEBATE_CONFIG = {
  // 辩论模式
  modes: [
    { value: 'STANDARD', label: '标准模式' },
    { value: 'QUICK', label: '快速模式' },
    { value: 'ADVANCED', label: '高级模式' },
  ],

  // 辩论时长（分钟）
  duration: {
    quick: 15,
    standard: 30,
    advanced: 60,
  },

  // 最大参与人数
  maxParticipants: 10,

  // 最小参与人数
  minParticipants: 2,
} as const;

// =============================================================================
// 搜索配置
// =============================================================================

export const SEARCH_CONFIG = {
  // 最小搜索长度
  minLength: 2,

  // 最大搜索长度
  maxLength: 100,

  // 搜索结果数量
  defaultLimit: 20,
  maxLimit: 100,

  // 搜索高亮
  highlight: {
    preTag: '<mark>',
    postTag: '</mark>',
  },
} as const;

// =============================================================================
// 日期格式配置
// =============================================================================

export const DATE_FORMAT = {
  date: 'yyyy-MM-dd',
  datetime: 'yyyy-MM-dd HH:mm:ss',
  time: 'HH:mm:ss',
  dateShort: 'MM-dd',
  datetimeShort: 'MM-dd HH:mm',
  year: 'yyyy',
  month: 'yyyy-MM',
} as const;

// =============================================================================
// 错误消息
// =============================================================================

export const ERROR_MESSAGES = {
  // 通用错误
  UNKNOWN_ERROR: '未知错误',
  NETWORK_ERROR: '网络错误，请检查网络连接',
  SERVER_ERROR: '服务器错误，请稍后重试',
  TIMEOUT_ERROR: '请求超时，请稍后重试',

  // 认证错误
  UNAUTHORIZED: '未登录或登录已过期',
  FORBIDDEN: '没有权限访问',
  INVALID_CREDENTIALS: '用户名或密码错误',
  TOKEN_EXPIRED: '登录已过期，请重新登录',

  // 验证错误
  VALIDATION_ERROR: '数据验证失败',
  REQUIRED_FIELD: '必填字段不能为空',
  INVALID_FORMAT: '格式不正确',
  INVALID_EMAIL: '邮箱格式不正确',
  INVALID_PHONE: '手机号格式不正确',

  // 文件错误
  FILE_TOO_LARGE: '文件大小超过限制',
  INVALID_FILE_TYPE: '不支持的文件类型',
  FILE_UPLOAD_FAILED: '文件上传失败',

  // 数据错误
  NOT_FOUND: '数据不存在',
  ALREADY_EXISTS: '数据已存在',
  DUPLICATE_ENTRY: '重复的数据',

  // 业务错误
  INSUFFICIENT_BALANCE: '余额不足',
  PAYMENT_FAILED: '支付失败',
  REFUND_FAILED: '退款失败',
} as const;

// =============================================================================
// 成功消息
// =============================================================================

export const SUCCESS_MESSAGES = {
  // 通用成功
  OPERATION_SUCCESS: '操作成功',
  SAVE_SUCCESS: '保存成功',
  DELETE_SUCCESS: '删除成功',
  UPDATE_SUCCESS: '更新成功',
  CREATE_SUCCESS: '创建成功',

  // 认证成功
  LOGIN_SUCCESS: '登录成功',
  LOGOUT_SUCCESS: '退出成功',
  REGISTER_SUCCESS: '注册成功',

  // 文件成功
  UPLOAD_SUCCESS: '上传成功',
  DOWNLOAD_SUCCESS: '下载成功',
  EXPORT_SUCCESS: '导出成功',

  // 支付成功
  PAYMENT_SUCCESS: '支付成功',
  REFUND_SUCCESS: '退款成功',
} as const;

// =============================================================================
// 类型导出
// =============================================================================

export type CaseType = (typeof LEGAL_CONFIG.caseTypes)[number]['value'];
export type EvidenceType = (typeof LEGAL_CONFIG.evidenceTypes)[number]['value'];
export type RelationType = (typeof LEGAL_CONFIG.relationTypes)[number]['value'];
export type ExportFormat = (typeof EXPORT_CONFIG.formats)[number]['value'];
export type ExportType = (typeof EXPORT_CONFIG.types)[number]['value'];
export type PaymentMethod = (typeof PAYMENT_CONFIG.methods)[number]['value'];
export type DebateMode = (typeof DEBATE_CONFIG.modes)[number]['value'];
