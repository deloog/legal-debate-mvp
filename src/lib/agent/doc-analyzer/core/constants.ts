/**
 * DocAnalyzer常量定义
 * 
 * 包含所有文档分析相关的常量、配置和映射
 */

import type { DocAnalyzerConfig } from './types';

// =============================================================================
// 默认配置
// =============================================================================

export const DEFAULT_CONFIG: DocAnalyzerConfig = {
  aiTimeout: 25000, // 25秒超时
  maxRetries: 3,
  maxTextChunkSize: 8000,
  cacheEnabled: true,
  cacheTTL: 86400, // 24小时
  maxConcurrentDocuments: 5,
  reviewers: {
    aiReviewer: {
      enabled: true,
      threshold: 0.8,
      rules: ['ALL']
    },
    ruleReviewer: {
      enabled: true,
      threshold: 0.7,
      rules: ['ALL']
    },
    confidenceReviewer: {
      enabled: true,
      threshold: 0.75,
      rules: ['CONFIDENCE_THRESHOLD']
    }
  }
};

// =============================================================================
// 诉讼请求类型映射
// =============================================================================

export const CLAIM_TYPE_MAP: { [key: string]: string } = {
  '偿还本金': 'PAY_PRINCIPAL',
  '支付利息': 'PAY_INTEREST',
  '违约金': 'PAY_PENALTY',
  '赔偿损失': 'PAY_DAMAGES',
  '诉讼费用': 'LITIGATION_COST',
  '履行义务': 'PERFORMANCE',
  '解除合同': 'TERMINATION',
  'payment': 'PAY_PRINCIPAL',
  'penalty': 'PAY_PENALTY',
  'costs': 'LITIGATION_COST',
  'compensation': 'PAY_DAMAGES'
};

export const CLAIM_TYPE_LABELS: { [key: string]: string } = {
  'PAY_PRINCIPAL': '偿还本金',
  'PAY_INTEREST': '支付利息',
  'PAY_PENALTY': '支付违约金',
  'PAY_DAMAGES': '赔偿损失',
  'LITIGATION_COST': '承担诉讼费用',
  'PERFORMANCE': '履行义务',
  'TERMINATION': '解除合同',
  'OTHER': '其他'
};

// =============================================================================
// 中文数字映射
// =============================================================================

export const CHINESE_NUMBERS: { [key: string]: number } = {
  '零': 0,
  '一': 1,
  '二': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '七': 7,
  '八': 8,
  '九': 9,
  '十': 10,
  '百': 100,
  '千': 1000,
  '万': 10000,
  '亿': 100000000,
  '壹': 1,
  '贰': 2,
  '叁': 3,
  '肆': 4,
  '伍': 5,
  '陆': 6,
  '柒': 7,
  '捌': 8,
  '玖': 9,
  '拾': 10,
  '佰': 100,
  '仟': 1000,
  '圆': 1,
  '元': 1
};

// =============================================================================
// 缓存TTL映射
// =============================================================================

export const CACHE_TTL_MAP: { [key: string]: number } = {
  'PDF': 86400, // 24小时
  'DOCX': 86400,
  'DOC': 86400,
  'TXT': 3600, // 1小时
  'IMAGE': 7200 // 2小时
};

// =============================================================================
// 后处理规则
// =============================================================================

export const POST_PROCESSING_RULES = {
  // 强制补充诉讼费用
  LITIGATION_COST_PATTERNS: [
    /诉讼费用.*承担/,
    /本案.*诉讼费/,
    /由.*承担.*费用/,
    /诉讼费.*被告/,
    /费用.*由.*承担/
  ],

  // 强制补充本金请求
  PRINCIPAL_PATTERNS: [
    /本金/,
    /借款本金/,
    /货款本金/,
    /货款/,
    /欠款/,
    /支付货款/,
    /偿还货款/,
    /判令被告支付货款/,
    /判令被告偿还货款/,
    /判令被告支付.*万元/,
    /至今未还本金/,
    /判令被告偿还本金/,
    /判令被告偿还.*万元/,
    /承担.*万元/
  ],

  // 强制补充利息请求
  INTEREST_PATTERNS: [
    /利息/,
    /利率/,
    /年利率/,
    /月利率/
  ],

  // 强制补充违约金请求
  PENALTY_PATTERNS: [
    /违约金/,
    /罚息/,
    /滞纳金/
  ],

  // 复合请求模式
  COMPOUND_PATTERNS: [
    {
      regex: /本金.*?(\d+\.?\d*万?)元?.*?及.*?利息/,
      types: ['PAY_PRINCIPAL', 'PAY_INTEREST']
    },
    {
      regex: /货款.*?(\d+\.?\d*万?)元?.*?及.*?违约金/,
      types: ['PAY_PRINCIPAL', 'PAY_PENALTY']
    },
    {
      regex: /偿还.*?(\d+\.?\d*万?)元?.*?及.*?利息/,
      types: ['PAY_PRINCIPAL', 'PAY_INTEREST']
    },
    {
      regex: /本金.*?(\d+\.?\d*万?)元?.*?利息.*?共计/,
      types: ['PAY_PRINCIPAL', 'PAY_INTEREST']
    },
    {
      regex: /偿还.*?(\d+\.?\d*万?)元?.*?及.*?利息.*?共计/,
      types: ['PAY_PRINCIPAL', 'PAY_INTEREST']
    },
    {
      regex: /本金.*利息/,
      types: ['PAY_PRINCIPAL', 'PAY_INTEREST']
    },
    {
      regex: /本金.*违约金/,
      types: ['PAY_PRINCIPAL', 'PAY_PENALTY']
    },
    {
      regex: /利息.*违约金/,
      types: ['PAY_INTEREST', 'PAY_PENALTY']
    }
  ]
};

// =============================================================================
// 当事人角色识别标志
// =============================================================================

export const PARTY_ROLE_INDICATORS = {
  plaintiff: [
    '原告',
    '申请人',
    '起诉人',
    '上诉人'
  ],
  defendant: [
    '被告',
    '被申请人',
    '被起诉人',
    '被上诉人'
  ],
  other: [
    '第三人'
  ]
};

// =============================================================================
// 质量验证规则
// =============================================================================

export const QUALITY_VALIDATION_RULES = {
  MIN_PARTIES: 1,
  MIN_CLAIMS: 1,
  MIN_CONFIDENCE: 0.5,
  REQUIRED_CLAIM_TYPES: [],
  OPTIONAL_CLAIM_TYPES: [
    'LITIGATION_COST',
    'PAY_INTEREST',
    'PAY_PENALTY'
  ]
};

// =============================================================================
// 典型案例示例
// =============================================================================

export const TYPICAL_CLAIM_EXAMPLES = [
  {
    name: '标准借款纠纷',
    text: '1. 判令被告偿还借款本金100万元；2. 判令被告支付利息（按LPR四倍计算）；3. 诉讼费用由被告承担',
    expected: [
      { type: 'PAY_PRINCIPAL', content: '偿还借款本金100万元', amount: 1000000 },
      { type: 'PAY_INTEREST', content: '支付利息（按LPR四倍计算）', amount: null },
      { type: 'LITIGATION_COST', content: '诉讼费用由被告承担', amount: null }
    ]
  },
  {
    name: '复合请求拆解',
    text: '判令被告偿还本金及利息共计150万元',
    expected: [
      { type: 'PAY_PRINCIPAL', content: '偿还本金', amount: null },
      { type: 'PAY_INTEREST', content: '支付利息', amount: null }
    ]
  },
  {
    name: '买卖合同纠纷',
    text: '1. 判令被告支付货款50万元；2. 判令被告支付违约金5万元；3. 诉讼费用由被告承担',
    expected: [
      { type: 'PAY_PRINCIPAL', content: '支付货款50万元', amount: 500000 },
      { type: 'PAY_PENALTY', content: '支付违约金5万元', amount: 50000 },
      { type: 'LITIGATION_COST', content: '诉讼费用由被告承担', amount: null }
    ]
  }
];

// =============================================================================
// 错误消息
// =============================================================================

export const ERROR_MESSAGES = {
  INVALID_DOCUMENT_ID: '文档ID不能为空',
  INVALID_FILE_PATH: '文件路径无效',
  UNSUPPORTED_FILE_TYPE: '不支持的文档格式',
  EMPTY_DOCUMENT: '文档内容为空',
  AI_TIMEOUT: 'AI调用超时',
  AI_FAILURE: 'AI服务不可用',
  OCR_FAILURE: 'OCR识别失败',
  PARSE_ERROR: '文档解析失败',
  CACHE_ERROR: '缓存操作失败',
  VALIDATION_ERROR: '数据验证失败'
};

// =============================================================================
// 日志消息
// =============================================================================

export const LOG_MESSAGES = {
  ANALYSIS_STARTED: '开始文档分析',
  ANALYSIS_COMPLETED: '文档分析完成',
  ANALYSIS_FAILED: '文档分析失败',
  CACHE_HIT: '缓存命中',
  CACHE_MISS: '缓存未命中',
  CHUNK_PROCESSING: '处理文档分块',
  RULE_CORRECTION: '规则修正',
  REVIEW_ISSUE: '审查发现问题',
  RETRY_ATTEMPT: '重试尝试',
  FALLBACK_MODE: '降级模式'
};
