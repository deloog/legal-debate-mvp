/**
 * 可访问性管理器
 * 统一管理知识图谱的可访问性功能
 */

import { logger } from '@/lib/logger';
import { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';
import {
  AccessibilityConfig,
  defaultAccessibilityConfig,
  AccessibilityMode,
  ColorBlindType,
  ColorPalette,
  ColorBlindPalette,
} from './types';
import { getPalette } from './color-palettes';
import {
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
import {
  KeyboardNavigationManager,
  KeyboardEventHandlers,
  createKeyboardNavigationManager,
  generateFocusStyle,
} from './keyboard-navigation';

/**
 * 可访问性管理器
 */
export class AccessibilityManager {
  private config: AccessibilityConfig;
  private nodes: GraphNode[];
  private links: GraphLink[];
  private handlers: KeyboardEventHandlers | null;
  private keyboardManager: KeyboardNavigationManager;
  private currentPalette: ColorPalette | ColorBlindPalette | null;

  constructor(
    nodes: GraphNode[],
    links: GraphLink[],
    handlers: KeyboardEventHandlers
  ) {
    this.config = {
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
    };
    this.nodes = nodes;
    this.links = links;
    this.handlers = handlers;
    this.currentPalette = null;

    // 初始化键盘导航管理器
    this.keyboardManager = createKeyboardNavigationManager(nodes, handlers);

    // 初始化色板
    this.updatePalette();
  }

  /**
   * 获取配置
   */
  getConfig(): AccessibilityConfig {
    return { ...this.config };
  }

  /**
   * 设置模式
   */
  setMode(mode: AccessibilityMode): void {
    try {
      this.config.mode = mode;
      this.updatePalette();
      logger.info('可访问性模式已设置', { mode });
    } catch (error) {
      logger.error('设置可访问性模式失败', { error, mode });
    }
  }

  /**
   * 设置色盲类型
   */
  setColorBlindType(type: ColorBlindType | null): void {
    try {
      this.config.colorBlindType = type;
      this.updatePalette();
      logger.info('色盲类型已设置', { type });
    } catch (error) {
      logger.error('设置色盲类型失败', { error, type });
    }
  }

  /**
   * 设置高对比度
   */
  setHighContrast(enabled: boolean): void {
    try {
      this.config.highContrast = enabled;
      
      if (enabled) {
        this.setMode(AccessibilityMode.HIGH_CONTRAST);
      } else {
        this.setMode(AccessibilityMode.NORMAL);
      }
      
      logger.info('高对比度已设置', { enabled });
    } catch (error) {
      logger.error('设置高对比度失败', { error, enabled });
    }
  }

  /**
   * 更新键盘导航配置
   */
  updateKeyboardNavigationConfig(
    config: Partial<AccessibilityConfig['keyboardNavigation']>
  ): void {
    try {
      this.config.keyboardNavigation = {
        ...this.config.keyboardNavigation,
        ...config,
      };
      
      this.keyboardManager.setConfig({
        ...this.config.keyboardNavigation!,
        enabled: true,
      });
      
      logger.info('键盘导航配置已更新', { config });
    } catch (error) {
      logger.error('更新键盘导航配置失败', { error, config });
    }
  }

  /**
   * 更新屏幕阅读器配置
   */
  updateScreenReaderConfig(
    config: Partial<AccessibilityConfig['screenReader']>
  ): void {
    try {
      this.config.screenReader = {
        ...this.config.screenReader,
        ...config,
      };
      logger.info('屏幕阅读器配置已更新', { config });
    } catch (error) {
      logger.error('更新屏幕阅读器配置失败', { error, config });
    }
  }

  /**
   * 获取色板
   */
  getPalette(): ColorPalette | ColorBlindPalette {
    if (!this.currentPalette) {
      this.updatePalette();
    }
    
    return this.currentPalette as ColorPalette | ColorBlindPalette;
  }

  /**
   * 更新色板
   */
  private updatePalette(): void {
    this.currentPalette = getPalette(
      this.config.mode,
      this.config.colorBlindType
    );
  }

  /**
   * 获取节点ARIA属性
   */
  getNodeAriaProps(node: GraphNode): Record<string, string> {
    return getNodeAriaProps(node);
  }

  /**
   * 获取连线ARIA属性
   */
  getLinkAriaProps(link: GraphLink, source: GraphNode, target: GraphNode): Record<string, string> {
    return getLinkAriaProps(link, source, target);
  }

  /**
   * 获取图谱容器ARIA属性
   */
  getGraphContainerAriaProps(): Record<string, string> {
    return getGraphContainerAriaProps(this.nodes, this.links);
  }

  /**
   * 宣布节点选中
   */
  announceNodeSelection(node: GraphNode): void {
    if (!this.config.screenReader?.announceChanges) {
      return;
    }
    announceNodeSelection(node);
  }

  /**
   * 宣布图谱更新
   */
  announceGraphUpdate(nodeCount: number, linkCount: number): void {
    if (!this.config.screenReader?.announceChanges) {
      return;
    }
    announceGraphUpdate(nodeCount, linkCount);
  }

  /**
   * 宣布节点详情打开
   */
  announceNodeDetailsOpen(node: GraphNode): void {
    if (!this.config.screenReader?.announceChanges) {
      return;
    }
    announceNodeDetailsOpen(node);
  }

  /**
   * 宣布节点详情关闭
   */
  announceNodeDetailsClose(): void {
    if (!this.config.screenReader?.announceChanges) {
      return;
    }
    announceNodeDetailsClose();
  }

  /**
   * 宣布图谱缩放
   */
  announceGraphZoom(level: number): void {
    if (!this.config.screenReader?.announceChanges) {
      return;
    }
    announceGraphZoom(level);
  }

  /**
   * 处理键盘事件
   */
  handleKeyDown(event: KeyboardEvent): void {
    if (!this.config.keyboardNavigation?.enabled) {
      return;
    }
    this.keyboardManager.handleKeyDown(event);
  }

  /**
   * 设置焦点节点
   */
  setFocusedNode(nodeId: string): void {
    this.keyboardManager.setFocusedNode(nodeId);
  }

  /**
   * 获取当前焦点节点
   */
  getFocusedNode(): GraphNode | null {
    return this.keyboardManager.getFocusedNode();
  }

  /**
   * 清除焦点
   */
  clearFocus(): void {
    this.keyboardManager.clearFocus();
  }

  /**
   * 启用键盘导航
   */
  enableKeyboardNavigation(): void {
    this.config.keyboardNavigation = {
      ...this.config.keyboardNavigation,
      enabled: true,
    };
    this.keyboardManager.enable();
  }

  /**
   * 禁用键盘导航
   */
  disableKeyboardNavigation(): void {
    this.config.keyboardNavigation = {
      ...this.config.keyboardNavigation,
      enabled: false,
    };
    this.keyboardManager.disable();
  }

  /**
   * 更新节点
   */
  updateNodes(nodes: GraphNode[]): void {
    this.nodes = nodes;
    this.keyboardManager.updateNodes(nodes);
  }

  /**
   * 更新连线
   */
  updateLinks(links: GraphLink[]): void {
    this.links = links;
  }

  /**
   * 更新事件处理器
   */
  updateHandlers(handlers: KeyboardEventHandlers): void {
    this.handlers = handlers;
    this.keyboardManager.updateHandlers(handlers);
  }

  /**
   * 生成焦点样式
   */
  generateFocusStyle(focusColor: string): string {
    return generateFocusStyle(focusColor);
  }

  /**
   * 获取当前焦点样式
   */
  getCurrentFocusStyle(): string {
    const palette = this.getPalette();
    return generateFocusStyle(palette.focusColor);
  }

  /**
   * 启用屏幕阅读器支持
   */
  enableScreenReaderSupport(): void {
    this.config.screenReader = {
      ...this.config.screenReader,
      enabled: true,
    };
  }

  /**
   * 禁用屏幕阅读器支持
   */
  disableScreenReaderSupport(): void {
    this.config.screenReader = {
      ...this.config.screenReader,
      enabled: false,
    };
  }

  /**
   * 重置为默认配置
   */
  resetToDefaults(): void {
    this.config = {
      mode: defaultAccessibilityConfig.mode,
      keyboardNavigation: defaultAccessibilityConfig.keyboardNavigation,
      screenReader: defaultAccessibilityConfig.screenReader,
      highContrast: defaultAccessibilityConfig.highContrast,
      colorBlindType: defaultAccessibilityConfig.colorBlindType,
    };
    
    this.updatePalette();
    this.keyboardManager.setConfig({
      ...this.config.keyboardNavigation!,
      enabled: true,
    });
    
    logger.info('可访问性配置已重置为默认值');
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    try {
      this.keyboardManager.destroy();
      this.currentPalette = null;
      this.handlers = null;
      this.nodes = [];
      this.links = [];
      logger.info('可访问性管理器已销毁');
    } catch (error) {
      logger.error('销毁可访问性管理器失败', { error });
    }
  }
}

/**
 * 创建可访问性管理器的工厂函数
 */
export function createAccessibilityManager(
  nodes: GraphNode[],
  links: GraphLink[],
  handlers: KeyboardEventHandlers
): AccessibilityManager {
  return new AccessibilityManager(nodes, links, handlers);
}

/**
 * 获取可访问性状态
 */
export interface AccessibilityState {
  mode: AccessibilityMode;
  colorBlindType: ColorBlindType | null;
  highContrast: boolean;
  keyboardEnabled: boolean;
  screenReaderEnabled: boolean;
}

/**
 * 获取当前可访问性状态
 */
export function getAccessibilityState(
  manager: AccessibilityManager
): AccessibilityState {
  const config = manager.getConfig();
  
  return {
    mode: config.mode,
    colorBlindType: config.colorBlindType || null,
    highContrast: config.highContrast || false,
    keyboardEnabled: config.keyboardNavigation?.enabled || false,
    screenReaderEnabled: config.screenReader?.enabled || false,
  };
}
