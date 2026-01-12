/**
 * 争议焦点提取器 - 模块入口
 * 目标：争议焦点识别准确率>90%
 */

export {
  DisputeFocusExtractor,
  createDisputeFocusExtractor,
  extractDisputeFocusesFromText,
} from './core';

export type {
  DisputeFocusExtractionOptions,
  DisputeFocusExtractionOutput,
} from './core';
