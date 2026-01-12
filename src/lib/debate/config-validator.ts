/**
 * 辩论配置接口
 */
export interface DebateConfig {
  maxRounds?: number;
  timePerRound?: number; // 分钟
  allowNewEvidence?: boolean;
  debateMode?: 'standard' | 'fast' | 'detailed';
  aiProvider?: string;
  autoGenerate?: boolean;
  language?: string;
}

/**
 * 默认辩论配置
 */
export const DEFAULT_DEBATE_CONFIG: DebateConfig = {
  maxRounds: 3,
  timePerRound: 30, // 30分钟
  allowNewEvidence: true,
  debateMode: 'standard',
  aiProvider: 'deepseek',
  autoGenerate: true,
  language: 'zh-CN',
};

/**
 * 配置验证规则
 */
const CONFIG_RULES = {
  maxRounds: {
    min: 1,
    max: 10,
    required: false,
  },
  timePerRound: {
    min: 5,
    max: 120, // 2小时
    required: false,
  },
  allowNewEvidence: {
    type: 'boolean',
    required: false,
  },
  debateMode: {
    type: 'enum',
    values: ['standard', 'fast', 'detailed'],
    required: false,
  },
  aiProvider: {
    type: 'string',
    required: false,
  },
  autoGenerate: {
    type: 'boolean',
    required: false,
  },
  language: {
    type: 'string',
    pattern: /^[a-z]{2}-[A-Z]{2}$/,
    required: false,
  },
};

/**
 * 验证单个配置项
 */
function validateConfigField(
  key: string,
  value: any,
  rule: any
): { valid: boolean; error?: string } {
  // 检查必填项
  if (rule.required && (value === undefined || value === null)) {
    return { valid: false, error: `${key} 是必填项` };
  }

  // 如果值为空且非必填，跳过验证
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // 类型验证
  switch (rule.type) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: `${key} 必须是布尔值` };
      }
      break;
    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: `${key} 必须是字符串` };
      }
      break;
    case 'enum':
      if (!rule.values.includes(value)) {
        return {
          valid: false,
          error: `${key} 必须是以下值之一: ${rule.values.join(', ')}`,
        };
      }
      break;
  }

  // 范围验证
  if (rule.min !== undefined && value < rule.min) {
    return { valid: false, error: `${key} 不能小于 ${rule.min}` };
  }
  if (rule.max !== undefined && value > rule.max) {
    return { valid: false, error: `${key} 不能大于 ${rule.max}` };
  }

  // 正则验证
  if (rule.pattern && !rule.pattern.test(value)) {
    return {
      valid: false,
      error: `${key} 格式不正确`,
    };
  }

  return { valid: true };
}

/**
 * 验证辩论配置
 */
export function validateDebateConfig(config: DebateConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 验证每个配置项
  for (const [key, rule] of Object.entries(CONFIG_RULES)) {
    const value = config[key as keyof DebateConfig];
    const result = validateConfigField(key, value, rule);

    if (!result.valid) {
      errors.push(result.error!);
    }
  }

  // 业务逻辑验证
  if (config.maxRounds && config.timePerRound) {
    const totalTime = config.maxRounds * config.timePerRound;
    if (totalTime > 480) {
      // 8小时
      warnings.push('总辩论时间超过8小时，建议减少轮次或每轮时间');
    }
  }

  // 模式特定验证
  if (config.debateMode === 'fast') {
    if (config.maxRounds && config.maxRounds > 5) {
      warnings.push('快速模式下建议轮次不超过5轮');
    }
    if (config.timePerRound && config.timePerRound > 20) {
      warnings.push('快速模式下建议每轮时间不超过20分钟');
    }
  } else if (config.debateMode === 'detailed') {
    if (config.maxRounds && config.maxRounds < 3) {
      warnings.push('详细模式下建议至少3轮辩论');
    }
    if (config.timePerRound && config.timePerRound < 45) {
      warnings.push('详细模式下建议每轮时间至少45分钟');
    }
  }

  // AI服务验证
  if (config.autoGenerate && !config.aiProvider) {
    errors.push('启用自动生成时必须指定AI服务提供商');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 标准化配置（填充默认值）
 */
export function normalizeDebateConfig(
  config?: Partial<DebateConfig>
): DebateConfig {
  const normalized = { ...DEFAULT_DEBATE_CONFIG };

  if (config) {
    Object.assign(normalized, config);
  }

  // 根据模式调整默认值
  switch (normalized.debateMode) {
    case 'fast':
      normalized.maxRounds = normalized.maxRounds || 3;
      normalized.timePerRound = normalized.timePerRound || 15;
      break;
    case 'detailed':
      normalized.maxRounds = normalized.maxRounds || 5;
      normalized.timePerRound = normalized.timePerRound || 60;
      break;
    default:
      // 使用标准默认值
      break;
  }

  return normalized;
}

/**
 * 生成配置摘要
 */
export function generateConfigSummary(config: DebateConfig): string {
  const parts: string[] = [];

  parts.push(`${config.maxRounds}轮辩论`);
  parts.push(`每轮${config.timePerRound}分钟`);

  if (config.allowNewEvidence) {
    parts.push('允许新证据');
  } else {
    parts.push('不允许新证据');
  }

  parts.push(`${config.debateMode}模式`);

  if (config.autoGenerate) {
    parts.push(`使用${config.aiProvider}自动生成`);
  }

  parts.push(`语言: ${config.language}`);

  return parts.join(' | ');
}

/**
 * 验证轮次是否可以开始
 */
export function validateRoundStart(
  debateConfig: DebateConfig,
  currentRound: number,
  lastRoundStatus?: string
): { valid: boolean; reason?: string } {
  // 检查最大轮次限制
  if (
    currentRound > (debateConfig.maxRounds || DEFAULT_DEBATE_CONFIG.maxRounds)
  ) {
    return {
      valid: false,
      reason: `已达到最大轮次限制 ${debateConfig.maxRounds}`,
    };
  }

  // 检查前一轮次状态
  if (currentRound > 1) {
    if (lastRoundStatus !== 'COMPLETED') {
      return {
        valid: false,
        reason: '前一轮次尚未完成',
      };
    }
  }

  return { valid: true };
}

/**
 * 计算预计完成时间
 */
export function calculateEstimatedCompletion(
  config: DebateConfig,
  currentRound: number,
  startedAt?: Date
): { estimatedEnd: Date; remaining: number } {
  const totalRounds = config.maxRounds || DEFAULT_DEBATE_CONFIG.maxRounds;
  const roundTime =
    (config.timePerRound || DEFAULT_DEBATE_CONFIG.timePerRound) * 60 * 1000; // 转换为毫秒
  const remainingRounds = totalRounds - currentRound + 1; // 包括当前轮次

  const now = startedAt || new Date();
  const estimatedEnd = new Date(now.getTime() + remainingRounds * roundTime);
  const remaining = estimatedEnd.getTime() - now.getTime();

  return {
    estimatedEnd,
    remaining,
  };
}

/**
 * 配置预设
 */
export const DEBATE_PRESETS = {
  quick: {
    name: '快速辩论',
    description: '适用于简单案件的快速辩论',
    config: {
      maxRounds: 2,
      timePerRound: 15,
      allowNewEvidence: false,
      debateMode: 'fast' as const,
      autoGenerate: true,
      language: 'zh-CN',
    },
  },
  standard: {
    name: '标准辩论',
    description: '适用于一般案件的标准辩论',
    config: {
      maxRounds: 3,
      timePerRound: 30,
      allowNewEvidence: true,
      debateMode: 'standard' as const,
      autoGenerate: true,
      language: 'zh-CN',
    },
  },
  detailed: {
    name: '详细辩论',
    description: '适用于复杂案件的详细辩论',
    config: {
      maxRounds: 5,
      timePerRound: 60,
      allowNewEvidence: true,
      debateMode: 'detailed' as const,
      autoGenerate: true,
      language: 'zh-CN',
    },
  },
  custom: {
    name: '自定义',
    description: '完全自定义的辩论配置',
    config: DEFAULT_DEBATE_CONFIG,
  },
};

/**
 * 获取预设配置
 */
export function getPresetConfig(
  presetName: keyof typeof DEBATE_PRESETS
): DebateConfig {
  return DEBATE_PRESETS[presetName]?.config || DEFAULT_DEBATE_CONFIG;
}

/**
 * 列出所有预设
 */
export function listPresets() {
  return Object.entries(DEBATE_PRESETS).map(([key, preset]) => ({
    key,
    name: preset.name,
    description: preset.description,
    config: preset.config,
  }));
}
