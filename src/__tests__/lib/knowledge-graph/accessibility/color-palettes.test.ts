/**
 * 色板定义测试
 */

import {
  getNormalPalette,
  getColorBlindPalette,
  getHighContrastPalette,
} from '@/lib/knowledge-graph/accessibility/color-palettes';
import { RelationType, ArticleCategory, ColorBlindType } from '@/lib/knowledge-graph/accessibility/types';

describe('色板定义', () => {
  describe('getNormalPalette', () => {
    it('应该返回正常模式色板', () => {
      const palette = getNormalPalette();

      expect(palette).toHaveProperty('relationColors');
      expect(palette).toHaveProperty('categoryColors');
      expect(palette).toHaveProperty('backgroundColor');
      expect(palette).toHaveProperty('textColor');
      expect(palette).toHaveProperty('focusColor');
    });

    it('应该包含所有关系类型颜色', () => {
      const palette = getNormalPalette();

      Object.values(RelationType).forEach((type) => {
        expect(palette.relationColors[type]).toBeDefined();
        expect(typeof palette.relationColors[type]).toBe('string');
      });
    });

    it('应该包含所有分类颜色', () => {
      const palette = getNormalPalette();

      Object.values(ArticleCategory).forEach((category) => {
        expect(palette.categoryColors[category]).toBeDefined();
        expect(typeof palette.categoryColors[category]).toBe('string');
      });
    });

    it('颜色应该是有效的十六进制颜色', () => {
      const palette = getNormalPalette();

      const allColors = [
        ...Object.values(palette.relationColors),
        ...Object.values(palette.categoryColors),
        palette.backgroundColor,
        palette.textColor,
        palette.focusColor,
      ];

      allColors.forEach((color) => {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });
  });

  describe('getColorBlindPalette', () => {
    it('应该返回色盲友好色板', () => {
      const palette = getColorBlindPalette(ColorBlindType.PROTANOPIA);

      expect(palette).toHaveProperty('relationColors');
      expect(palette).toHaveProperty('categoryColors');
      expect(palette).toHaveProperty('relationShapes');
      expect(palette).toHaveProperty('categoryShapes');
      expect(palette).toHaveProperty('backgroundColor');
      expect(palette).toHaveProperty('textColor');
      expect(palette).toHaveProperty('focusColor');
    });

    it('应该支持所有色盲类型', () => {
      const types = [
        ColorBlindType.PROTANOPIA,
        ColorBlindType.DEUTERANOPIA,
        ColorBlindType.TRITANOPIA,
        ColorBlindType.MONOCHROMACY,
      ];

      types.forEach((type) => {
        const palette = getColorBlindPalette(type);
        expect(palette).toBeDefined();
      });
    });

    it('应该包含所有关系类型形状', () => {
      const palette = getColorBlindPalette(ColorBlindType.PROTANOPIA);

      Object.values(RelationType).forEach((type) => {
        expect(palette.relationShapes[type]).toBeDefined();
        expect(typeof palette.relationShapes[type]).toBe('string');
      });
    });

    it('应该包含所有分类形状', () => {
      const palette = getColorBlindPalette(ColorBlindType.PROTANOPIA);

      Object.values(ArticleCategory).forEach((category) => {
        expect(palette.categoryShapes[category]).toBeDefined();
        expect(typeof palette.categoryShapes[category]).toBe('string');
      });
    });

    it('形状应该是有效的形状', () => {
      const palette = getColorBlindPalette(ColorBlindType.PROTANOPIA);

      const allShapes = [
        ...Object.values(palette.relationShapes),
        ...Object.values(palette.categoryShapes),
      ];

      const validShapes = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon', 'pentagon', 'circle-outline', 'square-outline', 'diamond-outline'];
      allShapes.forEach((shape) => {
        expect(validShapes).toContain(shape);
      });
    });
  });

  describe('getHighContrastPalette', () => {
    it('应该返回高对比度色板', () => {
      const palette = getHighContrastPalette();

      expect(palette).toHaveProperty('relationColors');
      expect(palette).toHaveProperty('categoryColors');
      expect(palette).toHaveProperty('backgroundColor');
      expect(palette).toHaveProperty('textColor');
      expect(palette).toHaveProperty('focusColor');
    });

    it('应该使用深色背景', () => {
      const palette = getHighContrastPalette();

      expect(palette.backgroundColor).toBe('#000000');
    });

    it('应该使用亮色文本', () => {
      const palette = getHighContrastPalette();

      expect(palette.textColor).toBe('#FFFFFF');
    });

    it('应该使用高对比度焦点颜色', () => {
      const palette = getHighContrastPalette();

      expect(palette.focusColor).toBe('#FFFF00');
    });
  });

  describe('WCAG颜色对比度', () => {
    it('正常模式颜色应该满足WCAG AA级（对比度≥4.5:1）', () => {
      const palette = getNormalPalette();

      // 检查文本颜色和背景色的对比度
      const contrast = calculateContrastRatio(palette.textColor, palette.backgroundColor);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });

    it('高对比度模式颜色应该满足WCAG AAA级（对比度≥7:1）', () => {
      const palette = getHighContrastPalette();

      const contrast = calculateContrastRatio(palette.textColor, palette.backgroundColor);
      expect(contrast).toBeGreaterThanOrEqual(7);
    });
  });
});

/**
 * 计算颜色对比度（用于测试）
 * 基于 WCAG 2.1 标准的对比度计算公式
 */
function calculateContrastRatio(foreground: string, background: string): number {
  const lum1 = getLuminance(foreground);
  const lum2 = getLuminance(background);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const { r, g, b } = rgb;

  const srgb = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}
