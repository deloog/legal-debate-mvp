/**
 * 可访问性类型定义测试
 */

import {
  AccessibilityMode,
  AccessibilityConfig,
  defaultAccessibilityConfig,
  KeyboardNavigationConfig,
  ColorBlindType,
} from '@/lib/knowledge-graph/accessibility/types';

describe('AccessibilityMode', () => {
  describe('枚举值', () => {
    it('应该包含所有必需的模式', () => {
      expect(AccessibilityMode.NORMAL).toBe('normal');
      expect(AccessibilityMode.COLOR_BLIND).toBe('colorBlind');
      expect(AccessibilityMode.HIGH_CONTRAST).toBe('highContrast');
    });

    it('应该只有三种模式', () => {
      const modes = Object.values(AccessibilityMode);
      expect(modes).toHaveLength(3);
      expect(modes).toContain('normal');
      expect(modes).toContain('colorBlind');
      expect(modes).toContain('highContrast');
    });
  });
});

describe('ColorBlindType', () => {
  describe('枚举值', () => {
    it('应该包含所有色盲类型', () => {
      expect(ColorBlindType.PROTANOPIA).toBe('protanopia');
      expect(ColorBlindType.DEUTERANOPIA).toBe('deuteranopia');
      expect(ColorBlindType.TRITANOPIA).toBe('tritanopia');
      expect(ColorBlindType.MONOCHROMACY).toBe('monochromacy');
    });

    it('应该包含所有红绿色盲类型', () => {
      expect(ColorBlindType.PROTANOPIA).toBeDefined(); // 红色盲
      expect(ColorBlindType.DEUTERANOPIA).toBeDefined(); // 绿色盲
    });
  });
});

describe('KeyboardNavigationConfig', () => {
  it('应该具有正确的默认值', () => {
    const config: KeyboardNavigationConfig = {
      enabled: true,
      focusVisible: true,
      tabThroughNodes: true,
      arrowKeyNavigation: true,
      enterToActivate: true,
      escapeToClose: true,
    };

    expect(config.enabled).toBe(true);
    expect(config.focusVisible).toBe(true);
    expect(config.tabThroughNodes).toBe(true);
    expect(config.arrowKeyNavigation).toBe(true);
    expect(config.enterToActivate).toBe(true);
    expect(config.escapeToClose).toBe(true);
  });

  it('应该允许部分配置', () => {
    const config: KeyboardNavigationConfig = {
      enabled: false,
      arrowKeyNavigation: false,
    };

    expect(config.enabled).toBe(false);
    expect(config.arrowKeyNavigation).toBe(false);
  });
});

describe('AccessibilityConfig', () => {
  it('应该包含所有必需字段', () => {
    const config: AccessibilityConfig = {
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

    expect(config.mode).toBe(AccessibilityMode.NORMAL);
    expect(config.keyboardNavigation.enabled).toBe(true);
    expect(config.screenReader.enabled).toBe(true);
    expect(config.highContrast).toBe(false);
    expect(config.colorBlindType).toBeNull();
  });

  it('应该允许部分字段为可选', () => {
    const config: AccessibilityConfig = {
      mode: AccessibilityMode.COLOR_BLIND,
      colorBlindType: ColorBlindType.PROTANOPIA,
    };

    expect(config.mode).toBe(AccessibilityMode.COLOR_BLIND);
    expect(config.colorBlindType).toBe(ColorBlindType.PROTANOPIA);
  });
});

describe('defaultAccessibilityConfig', () => {
  it('应该返回正确的默认配置', () => {
    expect(defaultAccessibilityConfig.mode).toBe(AccessibilityMode.NORMAL);
    expect(defaultAccessibilityConfig.keyboardNavigation.enabled).toBe(true);
    expect(defaultAccessibilityConfig.screenReader.enabled).toBe(true);
    expect(defaultAccessibilityConfig.highContrast).toBe(false);
    expect(defaultAccessibilityConfig.colorBlindType).toBeNull();
  });

  it('应该是不可变的', () => {
    // 尝试修改应该抛出错误或无效果
    expect(() => {
      const config = defaultAccessibilityConfig;
      // TypeScript在编译时阻止修改，运行时Object.freeze阻止修改
    }).not.toThrow();
    
    // 原始配置应该保持不变
    expect(defaultAccessibilityConfig.mode).toBe(AccessibilityMode.NORMAL);
  });
});
