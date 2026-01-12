// 辩论生成模块导出

// 类型定义
export type {
  DebateInput,
  DebateResult,
  Argument,
  QualityAssessment,
  ValidationResult,
  PromptOptions,
  DebateGenerationConfig,
} from './types';

export { DEFAULT_DEBATE_CONFIG } from './types';

// 主生成器
export { DebateGenerator } from './debate-generator';

// 论点生成器
export { ArgumentGenerator } from './argument-generator';

// Prompt构建器
export { PromptBuilder } from './prompt-builder';

// 验证器
export { LogicValidator } from './validators/logic-validator';
export { LawValidator } from './validators/law-validator';

// 质量评估器
export { QualityAssessor } from './assessors/quality-assessor';
