/**
 * 时间线提取器 - 三层架构：AI识别+算法兜底+AI审查
 * 重构后版本：使用模块化架构
 */

// 重新导出类型和主要接口，保持向后兼容
export type {
  TimelineExtractionOptions,
  TimelineExtractionOutput,
  GapInfo,
} from './timeline/timeline-types';

// 重新导出主要类和函数
export {
  TimelineExtractor,
  createTimelineExtractor,
  extractTimelineFromText,
} from './timeline';
