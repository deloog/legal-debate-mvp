/**
 * 色板定义
 * 提供正常模式、色盲友好模式和高对比度模式的色板
 */

import { logger } from '@/lib/logger';
import {
  ColorPalette,
  ColorBlindPalette,
  RelationType,
  ArticleCategory,
  ColorBlindType,
} from './types';

/**
 * 正常模式色板
 */
export function getNormalPalette(): ColorPalette {
  return {
    relationColors: {
      [RelationType.CITES]: '#3b82f6', // 蓝色
      [RelationType.CITED_BY]: '#60a5fa', // 浅蓝
      [RelationType.CONFLICTS]: '#ef4444', // 红色
      [RelationType.COMPLETES]: '#22c55e', // 绿色
      [RelationType.COMPLETED_BY]: '#4ade80', // 浅绿
      [RelationType.SUPERSEDES]: '#a855f7', // 紫色
      [RelationType.SUPERSEDED_BY]: '#c084fc', // 浅紫
      [RelationType.IMPLEMENTS]: '#f59e0b', // 橙色
      [RelationType.IMPLEMENTED_BY]: '#fbbf24', // 浅橙
      [RelationType.RELATED]: '#6b7280', // 灰色
    },
    categoryColors: {
      [ArticleCategory.CIVIL]: '#3b82f6', // 蓝色
      [ArticleCategory.CRIMINAL]: '#ef4444', // 红色
      [ArticleCategory.ADMINISTRATIVE]: '#22c55e', // 绿色
      [ArticleCategory.COMMERCIAL]: '#f59e0b', // 橙色
      [ArticleCategory.LABOR]: '#a855f7', // 紫色
    },
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    focusColor: '#3b82f6',
  };
}

/**
 * 色盲友好色板
 * 使用高对比度颜色和形状区分
 */
export function getColorBlindPalette(
  colorBlindType: ColorBlindType
): ColorBlindPalette {
  const basePalette: ColorPalette = {
    relationColors: {
      [RelationType.CITES]: '#0066cc', // 深蓝
      [RelationType.CITED_BY]: '#3388cc', // 中蓝
      [RelationType.CONFLICTS]: '#cc0000', // 深红
      [RelationType.COMPLETES]: '#006600', // 深绿
      [RelationType.COMPLETED_BY]: '#009900', // 中绿
      [RelationType.SUPERSEDES]: '#6600cc', // 深紫
      [RelationType.SUPERSEDED_BY]: '#9933cc', // 中紫
      [RelationType.IMPLEMENTS]: '#cc6600', // 深橙
      [RelationType.IMPLEMENTED_BY]: '#ff9933', // 中橙
      [RelationType.RELATED]: '#333333', // 深灰
    },
    categoryColors: {
      [ArticleCategory.CIVIL]: '#0066cc',
      [ArticleCategory.CRIMINAL]: '#cc0000',
      [ArticleCategory.ADMINISTRATIVE]: '#006600',
      [ArticleCategory.COMMERCIAL]: '#cc6600',
      [ArticleCategory.LABOR]: '#6600cc',
    },
    backgroundColor: '#F0F0F0',
    textColor: '#000000',
    focusColor: '#000000',
  };

  const relationShapes: Record<RelationType, string> = {
    [RelationType.CITES]: 'circle',
    [RelationType.CITED_BY]: 'square',
    [RelationType.CONFLICTS]: 'triangle',
    [RelationType.COMPLETES]: 'diamond',
    [RelationType.COMPLETED_BY]: 'star',
    [RelationType.SUPERSEDES]: 'hexagon',
    [RelationType.SUPERSEDED_BY]: 'pentagon',
    [RelationType.IMPLEMENTS]: 'circle-outline',
    [RelationType.IMPLEMENTED_BY]: 'square-outline',
    [RelationType.RELATED]: 'diamond-outline',
  };

  const categoryShapes: Record<ArticleCategory, string> = {
    [ArticleCategory.CIVIL]: 'circle',
    [ArticleCategory.CRIMINAL]: 'square',
    [ArticleCategory.ADMINISTRATIVE]: 'triangle',
    [ArticleCategory.COMMERCIAL]: 'diamond',
    [ArticleCategory.LABOR]: 'star',
  };

  // 根据色盲类型调整颜色
  let adjustedColors = basePalette.relationColors;
  if (colorBlindType === ColorBlindType.PROTANOPIA) {
    // 红色盲：增强蓝色和绿色，避免红色依赖
    adjustedColors = {
      ...basePalette.relationColors,
      [RelationType.CONFLICTS]: '#0088cc', // 用蓝色替代红色
    };
  } else if (colorBlindType === ColorBlindType.DEUTERANOPIA) {
    // 绿色盲：增强红色和蓝色，避免绿色依赖
    adjustedColors = {
      ...basePalette.relationColors,
      [RelationType.COMPLETES]: '#006699', // 用蓝绿色替代绿色
    };
  } else if (colorBlindType === ColorBlindType.TRITANOPIA) {
    // 蓝黄色盲：增强红色和绿色，避免蓝色依赖
    adjustedColors = {
      ...basePalette.relationColors,
      [RelationType.CITES]: '#cc6600', // 用橙色替代蓝色
    };
  }
  // MONOCHROMACY（全色盲）：保持原色板

  return {
    ...basePalette,
    relationColors: adjustedColors,
    relationShapes,
    categoryShapes,
  };
}

/**
 * 高对比度色板
 */
export function getHighContrastPalette(): ColorPalette {
  return {
    relationColors: {
      [RelationType.CITES]: '#FFFF00', // 黄色
      [RelationType.CITED_BY]: '#FFFF00',
      [RelationType.CONFLICTS]: '#FFFFFF', // 白色
      [RelationType.COMPLETES]: '#00FF00', // 亮绿
      [RelationType.COMPLETED_BY]: '#00FF00',
      [RelationType.SUPERSEDES]: '#00FFFF', // 青色
      [RelationType.SUPERSEDED_BY]: '#00FFFF',
      [RelationType.IMPLEMENTS]: '#FF00FF', // 品红
      [RelationType.IMPLEMENTED_BY]: '#FF00FF',
      [RelationType.RELATED]: '#FFFFFF',
    },
    categoryColors: {
      [ArticleCategory.CIVIL]: '#FFFF00',
      [ArticleCategory.CRIMINAL]: '#FFFFFF',
      [ArticleCategory.ADMINISTRATIVE]: '#00FF00',
      [ArticleCategory.COMMERCIAL]: '#FF00FF',
      [ArticleCategory.LABOR]: '#00FFFF',
    },
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    focusColor: '#FFFF00',
  };
}

/**
 * 根据可访问性模式获取色板
 */
export function getPalette(
  mode: string,
  colorBlindType?: ColorBlindType | null
): ColorPalette | ColorBlindPalette {
  try {
    switch (mode) {
      case 'normal':
        return getNormalPalette();
      case 'colorBlind':
        if (colorBlindType) {
          return getColorBlindPalette(colorBlindType);
        }
        logger.warn('色盲模式需要指定colorBlindType，使用正常模式');
        return getNormalPalette();
      case 'highContrast':
        return getHighContrastPalette();
      default:
        logger.warn(`未知的可访问性模式: ${mode}，使用正常模式`);
        return getNormalPalette();
    }
  } catch (error) {
    logger.error('获取色板失败', { error });
    return getNormalPalette();
  }
}

/**
 * 验证颜色是否满足WCAG AA级对比度（≥4.5:1）
 */
export function validateColorContrast(
  foreground: string,
  background: string,
  threshold: number = 4.5
): boolean {
  const contrast = calculateContrastRatio(foreground, background);
  return contrast >= threshold;
}

/**
 * 计算颜色对比度
 * 基于 WCAG 2.1 标准
 */
function calculateContrastRatio(
  foreground: string,
  background: string
): number {
  const lum1 = getLuminance(foreground);
  const lum2 = getLuminance(background);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 计算颜色亮度
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const { r, g, b } = rgb;

  const srgb = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/**
 * 十六进制颜色转RGB
 */
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
