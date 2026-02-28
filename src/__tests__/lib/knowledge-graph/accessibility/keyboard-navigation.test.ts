/**
 * @jest-environment jsdom
 */

/**
 * 键盘导航支持测试
 */

import {
  KeyboardNavigationManager,
  KeyboardEventHandlers,
} from '@/lib/knowledge-graph/accessibility/keyboard-navigation';
import { GraphNode } from '@/lib/law-article/graph-builder';

describe('键盘导航管理器', () => {
  let manager: KeyboardNavigationManager;
  let mockNodes: GraphNode[];
  let mockHandlers: KeyboardEventHandlers;

  beforeEach(() => {
    mockNodes = [
      { id: 'node-1', lawName: '民法典', articleNumber: '123', category: 'CIVIL', level: 0 },
      { id: 'node-2', lawName: '刑法', articleNumber: '456', category: 'CRIMINAL', level: 1 },
      { id: 'node-3', lawName: '行政法', articleNumber: '789', category: 'ADMINISTRATIVE', level: 1 },
    ];

    mockHandlers = {
      onNodeSelect: jest.fn(),
      onNodeFocus: jest.fn(),
      onDetailsToggle: jest.fn(),
      onZoom: jest.fn(),
      onPan: jest.fn(),
    };

    manager = new KeyboardNavigationManager(mockNodes, mockHandlers);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('初始化', () => {
    it('应该正确初始化', () => {
      expect(manager).toBeInstanceOf(KeyboardNavigationManager);
    });

    it('应该保存节点列表', () => {
      expect(manager['nodes']).toEqual(mockNodes);
    });

    it('应该保存事件处理器', () => {
      expect(manager['handlers']).toEqual(mockHandlers);
    });

    it('应该设置初始焦点', () => {
      expect(manager['focusedNodeId']).toBeNull();
    });
  });

  describe('启用/禁用', () => {
    it('应该启用键盘导航', () => {
      manager.enable();
      expect(manager['enabled']).toBe(true);
    });

    it('应该禁用键盘导航', () => {
      manager.enable();
      manager.disable();
      expect(manager['enabled']).toBe(false);
    });

    it('禁用后不应该处理键盘事件', () => {
      manager.disable();
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      
      expect(() => manager.handleKeyDown(event)).not.toThrow();
    });
  });

  describe('焦点管理', () => {
    it('应该能够设置焦点', () => {
      manager.setFocusedNode('node-2');
      expect(manager['focusedNodeId']).toBe('node-2');
    });

    it('应该能够获取当前焦点节点', () => {
      manager.setFocusedNode('node-1');
      const focused = manager.getFocusedNode();
      expect(focused).toEqual(mockNodes[0]);
    });

    it('应该处理不存在的节点ID', () => {
      manager.setFocusedNode('invalid-id');
      const focused = manager.getFocusedNode();
      expect(focused).toBeNull();
    });

    it('应该能够清除焦点', () => {
      manager.setFocusedNode('node-1');
      manager.clearFocus();
      expect(manager['focusedNodeId']).toBeNull();
    });

    it('焦点变化应该触发回调', () => {
      manager.setFocusedNode('node-2');
      expect(mockHandlers.onNodeFocus).toHaveBeenCalledWith(mockNodes[1]);
    });
  });

  describe('键盘事件处理', () => {
    beforeEach(() => {
      manager.enable();
    });

    describe('Tab键', () => {
      it('Tab键应该切换到下一个节点', () => {
        manager.setFocusedNode('node-1');
        const event = new KeyboardEvent('keydown', { key: 'Tab' });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
        
        manager.handleKeyDown(event);
        
        expect(event.preventDefault).toHaveBeenCalled();
        expect(manager['focusedNodeId']).toBe('node-2');
      });

      it('Shift+Tab应该切换到上一个节点', () => {
        manager.setFocusedNode('node-2');
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
        
        manager.handleKeyDown(event);
        
        expect(event.preventDefault).toHaveBeenCalled();
        expect(manager['focusedNodeId']).toBe('node-1');
      });

      it('Tab键应该循环', () => {
        manager.setFocusedNode('node-3');
        const event = new KeyboardEvent('keydown', { key: 'Tab' });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
        
        manager.handleKeyDown(event);
        
        expect(manager['focusedNodeId']).toBe('node-1');
      });
    });

    describe('方向键', () => {
      it('右箭头键应该选择下一个节点', () => {
        manager.setFocusedNode('node-1');
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
        
        manager.handleKeyDown(event);
        
        expect(event.preventDefault).toHaveBeenCalled();
        expect(mockHandlers.onNodeSelect).toHaveBeenCalledWith(mockNodes[1]);
      });

      it('左箭头键应该选择上一个节点', () => {
        manager.setFocusedNode('node-2');
        const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
        
        manager.handleKeyDown(event);
        
        expect(event.preventDefault).toHaveBeenCalled();
        expect(mockHandlers.onNodeSelect).toHaveBeenCalledWith(mockNodes[0]);
      });
    });

    describe('Enter键', () => {
      it('Enter键应该切换节点详情', () => {
        manager.setFocusedNode('node-1');
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
        
        manager.handleKeyDown(event);
        
        expect(event.preventDefault).toHaveBeenCalled();
        expect(mockHandlers.onDetailsToggle).toHaveBeenCalledWith(mockNodes[0]);
      });
    });

    describe('Escape键', () => {
      it('Escape键应该关闭详情并清除焦点', () => {
        manager.setFocusedNode('node-1');
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
        
        manager.handleKeyDown(event);
        
        expect(event.preventDefault).toHaveBeenCalled();
        expect(mockHandlers.onDetailsToggle).toHaveBeenCalledWith(null);
        expect(manager['focusedNodeId']).toBeNull();
      });
    });

    describe('其他键', () => {
      it('未处理的键不应该阻止默认行为', () => {
        const event = new KeyboardEvent('keydown', { key: 'a' });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
        
        manager.handleKeyDown(event);
        
        expect(event.preventDefault).not.toHaveBeenCalled();
      });
    });
  });

  describe('节点列表更新', () => {
    it('应该能够更新节点列表', () => {
      const newNodes = [
        { id: 'node-4', lawName: '新法', articleNumber: '1', category: 'CIVIL', level: 0 },
      ];
      
      manager.updateNodes(newNodes);
      expect(manager['nodes']).toEqual(newNodes);
    });

    it('更新节点列表应该清除焦点', () => {
      manager.setFocusedNode('node-1');
      manager.updateNodes([]);
      
      expect(manager['focusedNodeId']).toBeNull();
    });
  });

  describe('事件处理器更新', () => {
    it('应该能够更新事件处理器', () => {
      const newHandlers = {
        ...mockHandlers,
        onNodeSelect: jest.fn(),
      };
      
      manager.updateHandlers(newHandlers);
      expect(manager['handlers']).toEqual(newHandlers);
    });
  });

  describe('配置', () => {
    it('应该能够设置配置', () => {
      const config = {
        enabled: true,
        focusVisible: true,
        tabThroughNodes: true,
        arrowKeyNavigation: true,
        enterToActivate: true,
        escapeToClose: true,
      };
      
      manager.setConfig(config);
      expect(manager['config']).toEqual(config);
    });

    it('禁用tabThroughNodes后Tab键不应该工作', () => {
      manager.setConfig({
        enabled: true,
        tabThroughNodes: false,
      } as any);
      
      manager.setFocusedNode('node-1');
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      
      manager.handleKeyDown(event);
      
      expect(manager['focusedNodeId']).toBe('node-1');
    });
  });

  describe('清理', () => {
    it('destroy应该清除所有状态', () => {
      manager.setFocusedNode('node-1');
      manager.destroy();
      
      expect(manager['enabled']).toBe(false);
      expect(manager['nodes']).toEqual([]);
      expect(manager['handlers']).toBeNull();
      expect(manager['focusedNodeId']).toBeNull();
    });
  });
});
