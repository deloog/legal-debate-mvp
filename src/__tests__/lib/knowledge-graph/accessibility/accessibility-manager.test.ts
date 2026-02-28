/**
 * @jest-environment jsdom
 */

/**
 * 可访问性管理器测试
 */

import { AccessibilityManager } from '@/lib/knowledge-graph/accessibility/accessibility-manager';
import { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';
import { AccessibilityMode, ColorBlindType } from '@/lib/knowledge-graph/accessibility/types';

describe('可访问性管理器', () => {
  let manager: AccessibilityManager;
  let mockNodes: GraphNode[];
  let mockLinks: GraphLink[];
  let mockHandlers: any;

  beforeEach(() => {
    mockNodes = [
      { id: 'node-1', lawName: '民法典', articleNumber: '123', category: 'CIVIL', level: 0 },
      { id: 'node-2', lawName: '刑法', articleNumber: '456', category: 'CRIMINAL', level: 1 },
    ];

    mockLinks = [
      { source: 'node-1', target: 'node-2', relationType: 'CITES', strength: 0.8, confidence: 0.9 },
    ];

    mockHandlers = {
      onNodeSelect: jest.fn(),
      onNodeFocus: jest.fn(),
      onDetailsToggle: jest.fn(),
      onZoom: jest.fn(),
      onPan: jest.fn(),
    };

    manager = new AccessibilityManager(mockNodes, mockLinks, mockHandlers);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('初始化', () => {
    it('应该正确初始化', () => {
      expect(manager).toBeInstanceOf(AccessibilityManager);
    });

    it('应该使用默认配置', () => {
      const config = manager.getConfig();
      expect(config.mode).toBe(AccessibilityMode.NORMAL);
    });

    it('应该初始化键盘导航管理器', () => {
      expect(manager['keyboardManager']).toBeDefined();
    });
  });

  describe('配置管理', () => {
    it('应该能够获取配置', () => {
      const config = manager.getConfig();
      expect(config).toHaveProperty('mode');
      expect(config).toHaveProperty('keyboardNavigation');
      expect(config).toHaveProperty('screenReader');
    });

    it('应该能够设置模式', () => {
      manager.setMode(AccessibilityMode.COLOR_BLIND);
      expect(manager.getConfig().mode).toBe(AccessibilityMode.COLOR_BLIND);
    });

    it('应该能够设置色盲类型', () => {
      manager.setMode(AccessibilityMode.COLOR_BLIND);
      manager.setColorBlindType(ColorBlindType.PROTANOPIA);
      expect(manager.getConfig().colorBlindType).toBe(ColorBlindType.PROTANOPIA);
    });

    it('应该能够设置高对比度', () => {
      manager.setHighContrast(true);
      expect(manager.getConfig().highContrast).toBe(true);
    });

    it('应该能够更新键盘导航配置', () => {
      manager.updateKeyboardNavigationConfig({ tabThroughNodes: false });
      const config = manager.getConfig();
      expect(config.keyboardNavigation?.tabThroughNodes).toBe(false);
    });

    it('应该能够更新屏幕阅读器配置', () => {
      manager.updateScreenReaderConfig({ verboseMode: true });
      const config = manager.getConfig();
      expect(config.screenReader?.verboseMode).toBe(true);
    });
  });

  describe('色板获取', () => {
    it('应该返回正常模式色板', () => {
      const palette = manager.getPalette();
      expect(palette).toHaveProperty('relationColors');
      expect(palette).toHaveProperty('categoryColors');
      expect(palette).toHaveProperty('backgroundColor');
    });

    it('应该返回色盲模式色板', () => {
      manager.setMode(AccessibilityMode.COLOR_BLIND);
      manager.setColorBlindType(ColorBlindType.PROTANOPIA);
      const palette = manager.getPalette();
      expect(palette).toHaveProperty('relationShapes');
      expect(palette).toHaveProperty('categoryShapes');
    });

    it('应该返回高对比度模式色板', () => {
      manager.setMode(AccessibilityMode.HIGH_CONTRAST);
      const palette = manager.getPalette();
      expect(palette.backgroundColor).toBe('#000000');
      expect(palette.textColor).toBe('#FFFFFF');
    });
  });

  describe('ARIA属性', () => {
    it('应该生成节点ARIA属性', () => {
      const props = manager.getNodeAriaProps(mockNodes[0]);
      expect(props).toHaveProperty('aria-label');
      expect(props).toHaveProperty('role', 'button');
      expect(props).toHaveProperty('tabindex', '0');
    });

    it('应该生成连线ARIA属性', () => {
      const props = manager.getLinkAriaProps(mockLinks[0], mockNodes[0], mockNodes[1]);
      expect(props).toHaveProperty('aria-label');
      expect(props).toHaveProperty('role', 'presentation');
    });

    it('应该生成图谱容器ARIA属性', () => {
      const props = manager.getGraphContainerAriaProps();
      expect(props).toHaveProperty('role', 'region');
      expect(props).toHaveProperty('aria-label');
      expect(props).toHaveProperty('aria-description');
    });
  });

  describe('屏幕阅读器通知', () => {
    it('应该通知节点选中', () => {
      manager.announceNodeSelection(mockNodes[0]);
      // 应该不抛出错误
      expect(() => manager.announceNodeSelection(mockNodes[0])).not.toThrow();
    });

    it('应该通知图谱更新', () => {
      manager.announceGraphUpdate(5, 3);
      // 应该不抛出错误
      expect(() => manager.announceGraphUpdate(5, 3)).not.toThrow();
    });

    it('应该通知节点详情打开', () => {
      manager.announceNodeDetailsOpen(mockNodes[0]);
      expect(() => manager.announceNodeDetailsOpen(mockNodes[0])).not.toThrow();
    });

    it('应该通知节点详情关闭', () => {
      manager.announceNodeDetailsClose();
      expect(() => manager.announceNodeDetailsClose()).not.toThrow();
    });

    it('应该通知图谱缩放', () => {
      manager.announceGraphZoom(1.5);
      expect(() => manager.announceGraphZoom(1.5)).not.toThrow();
    });
  });

  describe('键盘导航', () => {
    it('应该处理键盘事件', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      expect(() => manager.handleKeyDown(event)).not.toThrow();
    });

    it('应该设置焦点节点', () => {
      manager.setFocusedNode('node-2');
      const focused = manager.getFocusedNode();
      expect(focused?.id).toBe('node-2');
    });

    it('应该清除焦点', () => {
      manager.setFocusedNode('node-1');
      manager.clearFocus();
      expect(manager.getFocusedNode()).toBeNull();
    });

    it('应该启用键盘导航', () => {
      manager.enableKeyboardNavigation();
      expect(() => manager.enableKeyboardNavigation()).not.toThrow();
    });

    it('应该禁用键盘导航', () => {
      manager.disableKeyboardNavigation();
      expect(() => manager.disableKeyboardNavigation()).not.toThrow();
    });
  });

  describe('图谱数据更新', () => {
    it('应该能够更新节点', () => {
      const newNodes = [
        { id: 'node-3', lawName: '新法', articleNumber: '1', category: 'CIVIL', level: 0 },
      ];
      manager.updateNodes(newNodes);
      expect(() => manager.updateNodes(newNodes)).not.toThrow();
    });

    it('应该能够更新连线', () => {
      const newLinks = [
        { source: 'node-3', target: 'node-4', relationType: 'CITES', strength: 0.5, confidence: 0.6 },
      ];
      manager.updateLinks(newLinks);
      expect(() => manager.updateLinks(newLinks)).not.toThrow();
    });

    it('应该能够更新事件处理器', () => {
      const newHandlers = {
        ...mockHandlers,
        onNodeSelect: jest.fn(),
      };
      manager.updateHandlers(newHandlers);
      expect(() => manager.updateHandlers(newHandlers)).not.toThrow();
    });
  });

  describe('焦点样式', () => {
    it('应该生成焦点样式', () => {
      const style = manager.generateFocusStyle('#3b82f6');
      expect(style).toContain('outline: 2px solid #3b82f6');
    });

    it('应该根据当前色板生成焦点样式', () => {
      const style = manager.getCurrentFocusStyle();
      expect(style).toBeDefined();
      expect(typeof style).toBe('string');
    });
  });

  describe('模式切换', () => {
    it('切换模式应该更新色板', () => {
      const palette1 = manager.getPalette();
      manager.setMode(AccessibilityMode.HIGH_CONTRAST);
      const palette2 = manager.getPalette();
      
      expect(palette1.backgroundColor).not.toBe(palette2.backgroundColor);
    });

    it('切换到色盲模式应该保留色盲类型', () => {
      manager.setColorBlindType(ColorBlindType.PROTANOPIA);
      manager.setMode(AccessibilityMode.COLOR_BLIND);
      expect(manager.getConfig().colorBlindType).toBe(ColorBlindType.PROTANOPIA);
    });
  });

  describe('清理', () => {
    it('destroy应该清理所有资源', () => {
      manager.destroy();
      expect(() => manager.destroy()).not.toThrow();
    });

    it('destroy后不应该处理事件', () => {
      manager.destroy();
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      expect(() => manager.handleKeyDown(event)).not.toThrow();
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的模式', () => {
      expect(() => manager.setMode('invalid' as AccessibilityMode)).not.toThrow();
    });

    it('应该处理无效的节点ID', () => {
      expect(() => manager.setFocusedNode('invalid-id')).not.toThrow();
    });

    it('应该处理空的节点列表', () => {
      expect(() => manager.updateNodes([])).not.toThrow();
    });

    it('应该处理空的连线列表', () => {
      expect(() => manager.updateLinks([])).not.toThrow();
    });
  });
});
