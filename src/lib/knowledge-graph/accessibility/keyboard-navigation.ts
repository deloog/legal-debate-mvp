/**
 * 键盘导航支持
 * 提供图谱的键盘导航功能
 */

import { logger } from '@/lib/logger';
import { GraphNode } from '@/lib/law-article/graph-builder';
import { KeyboardNavigationConfig, defaultAccessibilityConfig } from './types';

/**
 * 键盘事件处理器接口
 */
export interface KeyboardEventHandlers {
  /** 节点选择事件 */
  onNodeSelect: (node: GraphNode) => void;
  /** 节点焦点事件 */
  onNodeFocus: (node: GraphNode) => void;
  /** 详情切换事件 */
  onDetailsToggle: (node: GraphNode | null) => void;
  /** 缩放事件 */
  onZoom: (level: number) => void;
  /** 平移事件 */
  onPan: (dx: number, dy: number) => void;
}

/**
 * 键盘导航管理器
 */
export class KeyboardNavigationManager {
  private nodes: GraphNode[];
  private handlers: KeyboardEventHandlers | null;
  private focusedNodeId: string | null;
  private enabled: boolean;
  private config: KeyboardNavigationConfig;

  constructor(nodes: GraphNode[], handlers: KeyboardEventHandlers) {
    this.nodes = nodes;
    this.handlers = handlers;
    this.focusedNodeId = null;
    this.enabled = true;
    this.config = {
      enabled: true,
      focusVisible: defaultAccessibilityConfig.keyboardNavigation?.focusVisible ?? true,
      tabThroughNodes: defaultAccessibilityConfig.keyboardNavigation?.tabThroughNodes ?? true,
      arrowKeyNavigation: defaultAccessibilityConfig.keyboardNavigation?.arrowKeyNavigation ?? true,
      enterToActivate: defaultAccessibilityConfig.keyboardNavigation?.enterToActivate ?? true,
      escapeToClose: defaultAccessibilityConfig.keyboardNavigation?.escapeToClose ?? true,
    };
  }

  /**
   * 启用键盘导航
   */
  enable(): void {
    try {
      this.enabled = true;
      logger.info('键盘导航已启用');
    } catch (error) {
      logger.error('启用键盘导航失败', { error });
    }
  }

  /**
   * 禁用键盘导航
   */
  disable(): void {
    try {
      this.enabled = false;
      this.focusedNodeId = null;
      logger.info('键盘导航已禁用');
    } catch (error) {
      logger.error('禁用键盘导航失败', { error });
    }
  }

  /**
   * 设置焦点节点
   */
  setFocusedNode(nodeId: string): void {
    try {
      const node = this.nodes.find((n) => n.id === nodeId);
      if (!node) {
        logger.warn('节点不存在', { nodeId });
        return;
      }

      this.focusedNodeId = nodeId;

      if (this.handlers) {
        this.handlers.onNodeFocus(node);
      }
    } catch (error) {
      logger.error('设置焦点节点失败', { error, nodeId });
    }
  }

  /**
   * 获取当前焦点节点
   */
  getFocusedNode(): GraphNode | null {
    if (!this.focusedNodeId) {
      return null;
    }

    return this.nodes.find((n) => n.id === this.focusedNodeId) || null;
  }

  /**
   * 清除焦点
   */
  clearFocus(): void {
    this.focusedNodeId = null;
  }

  /**
   * 更新节点列表
   */
  updateNodes(nodes: GraphNode[]): void {
    try {
      this.nodes = nodes;
      this.focusedNodeId = null;
    } catch (error) {
      logger.error('更新节点列表失败', { error });
    }
  }

  /**
   * 更新事件处理器
   */
  updateHandlers(handlers: KeyboardEventHandlers): void {
    this.handlers = handlers;
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<KeyboardNavigationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 处理键盘事件
   */
  handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) {
      return;
    }

    try {
      switch (event.key) {
        case 'Tab':
          this.handleTab(event);
          break;
        case 'ArrowRight':
          this.handleArrowRight(event);
          break;
        case 'ArrowLeft':
          this.handleArrowLeft(event);
          break;
        case 'ArrowUp':
          this.handleArrowUp(event);
          break;
        case 'ArrowDown':
          this.handleArrowDown(event);
          break;
        case 'Enter':
          this.handleEnter(event);
          break;
        case 'Escape':
          this.handleEscape(event);
          break;
        case '+':
        case '=':
          this.handleZoomIn(event);
          break;
        case '-':
          this.handleZoomOut(event);
          break;
        default:
          // 不处理其他键
          return;
      }
    } catch (error) {
      logger.error('处理键盘事件失败', { error, key: event.key });
    }
  }

  /**
   * 处理Tab键
   */
  private handleTab(event: KeyboardEvent): void {
    if (!this.config.tabThroughNodes) {
      return;
    }

    event.preventDefault();

    if (this.nodes.length === 0) {
      return;
    }

    if (this.focusedNodeId === null) {
      // 如果没有焦点，选中第一个节点
      this.setFocusedNode(this.nodes[0].id);
      return;
    }

    const currentIndex = this.nodes.findIndex((n) => n.id === this.focusedNodeId);
    if (currentIndex === -1) {
      this.setFocusedNode(this.nodes[0].id);
      return;
    }

    if (event.shiftKey) {
      // Shift+Tab：上一个节点
      const newIndex = currentIndex === 0 ? this.nodes.length - 1 : currentIndex - 1;
      this.setFocusedNode(this.nodes[newIndex].id);
    } else {
      // Tab：下一个节点
      const newIndex = currentIndex === this.nodes.length - 1 ? 0 : currentIndex + 1;
      this.setFocusedNode(this.nodes[newIndex].id);
    }
  }

  /**
   * 处理右箭头键
   */
  private handleArrowRight(event: KeyboardEvent): void {
    if (!this.config.arrowKeyNavigation) {
      return;
    }

    event.preventDefault();

    if (this.focusedNodeId === null) {
      return;
    }

    const currentIndex = this.nodes.findIndex((n) => n.id === this.focusedNodeId);
    if (currentIndex === -1 || currentIndex === this.nodes.length - 1) {
      return;
    }

    const nextNode = this.nodes[currentIndex + 1];
    this.setFocusedNode(nextNode.id);

    if (this.handlers) {
      this.handlers.onNodeSelect(nextNode);
    }
  }

  /**
   * 处理左箭头键
   */
  private handleArrowLeft(event: KeyboardEvent): void {
    if (!this.config.arrowKeyNavigation) {
      return;
    }

    event.preventDefault();

    if (this.focusedNodeId === null) {
      return;
    }

    const currentIndex = this.nodes.findIndex((n) => n.id === this.focusedNodeId);
    if (currentIndex === -1 || currentIndex === 0) {
      return;
    }

    const prevNode = this.nodes[currentIndex - 1];
    this.setFocusedNode(prevNode.id);

    if (this.handlers) {
      this.handlers.onNodeSelect(prevNode);
    }
  }

  /**
   * 处理上箭头键（平移）
   */
  private handleArrowUp(event: KeyboardEvent): void {
    event.preventDefault();

    if (this.handlers) {
      this.handlers.onPan(0, -50);
    }
  }

  /**
   * 处理下箭头键（平移）
   */
  private handleArrowDown(event: KeyboardEvent): void {
    event.preventDefault();

    if (this.handlers) {
      this.handlers.onPan(0, 50);
    }
  }

  /**
   * 处理Enter键
   */
  private handleEnter(event: KeyboardEvent): void {
    if (!this.config.enterToActivate) {
      return;
    }

    event.preventDefault();

    const node = this.getFocusedNode();
    if (!node) {
      return;
    }

    if (this.handlers) {
      this.handlers.onDetailsToggle(node);
    }
  }

  /**
   * 处理Escape键
   */
  private handleEscape(event: KeyboardEvent): void {
    if (!this.config.escapeToClose) {
      return;
    }

    event.preventDefault();

    if (this.handlers) {
      this.handlers.onDetailsToggle(null);
    }

    this.clearFocus();
  }

  /**
   * 处理放大
   */
  private handleZoomIn(event: KeyboardEvent): void {
    event.preventDefault();

    if (this.handlers) {
      this.handlers.onZoom(1.2);
    }
  }

  /**
   * 处理缩小
   */
  private handleZoomOut(event: KeyboardEvent): void {
    event.preventDefault();

    if (this.handlers) {
      this.handlers.onZoom(0.8);
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    try {
      this.enabled = false;
      this.nodes = [];
      this.handlers = null;
      this.focusedNodeId = null;
    } catch (error) {
      logger.error('销毁键盘导航管理器失败', { error });
    }
  }
}

/**
 * 创建键盘导航管理器的工厂函数
 */
export function createKeyboardNavigationManager(
  nodes: GraphNode[],
  handlers: KeyboardEventHandlers
): KeyboardNavigationManager {
  return new KeyboardNavigationManager(nodes, handlers);
}

/**
 * 生成焦点样式
 */
export function generateFocusStyle(focusColor: string): string {
  return `
    outline: 2px solid ${focusColor};
    outline-offset: 2px;
    box-shadow: 0 0 0 4px ${focusColor}33;
  `;
}
