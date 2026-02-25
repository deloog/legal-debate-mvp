/**
 * 可访问性类型定义
 */

/**
 * 可访问性模式
 */
export enum AccessibilityMode {
  /** 正常模式 */
  NORMAL = 'normal',
  /** 色盲友好模式 */
  COLOR_BLIND = 'colorBlind',
  /** 高对比度模式 */
  HIGH_CONTRAST = 'highContrast',
}

/**
 * 色盲类型
 */
export enum ColorBlindType {
  /** 红色盲 */
  PROTANOPIA = 'protanopia',
  /** 绿色盲 */
  DEUTERANOPIA = 'deuteranopia',
  /** 蓝黄色盲 */
  TRITANOPIA = 'tritanopia',
  /** 全色盲 */
  MONOCHROMACY = 'monochromacy',
}

/**
 * 键盘导航配置
 */
export interface KeyboardNavigationConfig {
  /** 是否启用键盘导航 */
  enabled: boolean;
  /** 焦点可见性 */
  focusVisible?: boolean;
  /** Tab键在节点间切换 */
  tabThroughNodes?: boolean;
  /** 方向键导航 */
  arrowKeyNavigation?: boolean;
  /** Enter键激活节点 */
  enterToActivate?: boolean;
  /** Escape键关闭详情 */
  escapeToClose?: boolean;
}

/**
 * 屏幕阅读器配置
 */
export interface ScreenReaderConfig {
  /** 是否启用屏幕阅读器支持 */
  enabled: boolean;
  /** 是否宣布变更 */
  announceChanges?: boolean;
  /** 详细模式 */
  verboseMode?: boolean;
}

/**
 * 可访问性配置
 */
export interface AccessibilityConfig {
  /** 当前模式 */
  mode: AccessibilityMode;
  /** 键盘导航配置 */
  keyboardNavigation?: Partial<KeyboardNavigationConfig>;
  /** 屏幕阅读器配置 */
  screenReader?: Partial<ScreenReaderConfig>;
  /** 是否启用高对比度 */
  highContrast?: boolean;
  /** 色盲类型（仅在COLOR_BLIND模式下有效） */
  colorBlindType?: ColorBlindType | null;
}

/**
 * 默认可访问性配置
 */
export const defaultAccessibilityConfig: Readonly<AccessibilityConfig> = Object.freeze({
  mode: AccessibilityMode.NORMAL,
  keyboardNavigation: {
    enabled: true,
    focusVisible: true,
    tabThroughNodes: true,
    arrowKeyNavigation: true,
    enterToActivate: true,
    escapeToClose: true,
  },
  screenReader: {
    enabled: true,
    announceChanges: true,
    verboseMode: false,
  },
  highContrast: false,
  colorBlindType: null,
});

/**
 * 关系类型枚举（用于颜色映射）
 */
export enum RelationType {
  /** 引用 */
  CITES = 'CITES',
  /** 被引用 */
  CITED_BY = 'CITED_BY',
  /** 冲突 */
  CONFLICTS = 'CONFLICTS',
  /** 补全 */
  COMPLETES = 'COMPLETES',
  /** 被补全 */
  COMPLETED_BY = 'COMPLETED_BY',
  /** 替代 */
  SUPERSEDES = 'SUPERSEDES',
  /** 被替代 */
  SUPERSEDED_BY = 'SUPERSEDED_BY',
  /** 实施 */
  IMPLEMENTS = 'IMPLEMENTS',
  /** 被实施 */
  IMPLEMENTED_BY = 'IMPLEMENTED_BY',
  /** 相关 */
  RELATED = 'RELATED',
}

/**
 * 法条分类枚举（用于颜色映射）
 */
export enum ArticleCategory {
  /** 民事 */
  CIVIL = 'CIVIL',
  /** 刑事 */
  CRIMINAL = 'CRIMINAL',
  /** 行政 */
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  /** 商事 */
  COMMERCIAL = 'COMMERCIAL',
  /** 劳动 */
  LABOR = 'LABOR',
}

/**
 * 色板配置
 */
export interface ColorPalette {
  /** 关系类型颜色映射 */
  relationColors: Record<RelationType, string>;
  /** 分类颜色映射 */
  categoryColors: Record<ArticleCategory, string>;
  /** 背景色 */
  backgroundColor: string;
  /** 文本色 */
  textColor: string;
  /** 焦点颜色 */
  focusColor: string;
}

/**
 * 色盲友好色板配置
 */
export interface ColorBlindPalette extends ColorPalette {
  /** 关系类型形状映射 */
  relationShapes: Record<RelationType, string>;
  /** 分类形状映射 */
  categoryShapes: Record<ArticleCategory, string>;
}
