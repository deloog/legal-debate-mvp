/**
 * 可访问性模块
 * 
 * 提供知识图谱的可访问性支持，包括：
 * - 色盲友好模式
 * - 高对比度模式
 * - 键盘导航
 * - 屏幕阅读器兼容
 */

// 类型定义
export {
  AccessibilityMode,
  ColorBlindType,
  RelationType,
  ArticleCategory,
  defaultAccessibilityConfig,
} from './types';

export type {
  KeyboardNavigationConfig,
  ScreenReaderConfig,
  AccessibilityConfig,
  ColorPalette,
  ColorBlindPalette,
} from './types';

// 色板管理
export {
  getNormalPalette,
  getColorBlindPalette,
  getHighContrastPalette,
  getPalette,
  validateColorContrast,
} from './color-palettes';

// 屏幕阅读器工具
export {
  generateNodeAriaLabel,
  generateLinkAriaLabel,
  generateGraphAriaDescription,
  announceNodeSelection,
  announceGraphUpdate,
  announceNodeDetailsOpen,
  announceNodeDetailsClose,
  announceGraphZoom,
  getNodeAriaProps,
  getLinkAriaProps,
  getGraphContainerAriaProps,
} from './screen-reader-utils';

// 键盘导航
export {
  KeyboardNavigationManager,
  createKeyboardNavigationManager,
  generateFocusStyle,
} from './keyboard-navigation';

export type {
  KeyboardEventHandlers,
} from './keyboard-navigation';

// 可访问性管理器
export {
  AccessibilityManager,
  createAccessibilityManager,
} from './accessibility-manager';

export type { AccessibilityState } from './accessibility-manager';
export { getAccessibilityState } from './accessibility-manager';
