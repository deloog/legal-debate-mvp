/**
 * 屏幕阅读器工具
 * 提供ARIA标签生成和屏幕阅读器兼容功能
 */

import { logger } from '@/lib/logger';
import { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';

const ANNOUNCE_REGION_ID = 'graph-announce-region';

/**
 * 分类名称映射
 */
const CATEGORY_NAMES: Record<string, string> = {
  CIVIL: '民事',
  CRIMINAL: '刑事',
  ADMINISTRATIVE: '行政',
  COMMERCIAL: '商事',
  LABOR: '劳动',
};

/**
 * 关系类型名称映射
 */
const RELATION_TYPE_NAMES: Record<string, string> = {
  CITES: '引用',
  CITED_BY: '被引用',
  CONFLICTS: '冲突',
  COMPLETES: '补全',
  COMPLETED_BY: '被补全',
  SUPERSEDES: '替代',
  SUPERSEDED_BY: '被替代',
  IMPLEMENTS: '实施',
  IMPLEMENTED_BY: '被实施',
  RELATED: '相关',
};

/**
 * 获取分类名称
 */
function getCategoryName(category: string): string {
  return CATEGORY_NAMES[category] || '未知分类';
}

/**
 * 获取关系类型名称
 */
function getRelationTypeName(relationType: string): string {
  return RELATION_TYPE_NAMES[relationType] || relationType;
}

/**
 * 生成节点ARIA标签
 */
export function generateNodeAriaLabel(node: GraphNode): string {
  try {
    const categoryName = getCategoryName(node.category);
    return `${node.lawName}第${node.articleNumber}条，分类：${categoryName}`;
  } catch (error) {
    logger.error('生成节点ARIA标签失败', { error, nodeId: node.id });
    return '法条节点';
  }
}

/**
 * 生成连线ARIA标签
 */
export function generateLinkAriaLabel(
  link: GraphLink,
  source: GraphNode,
  target: GraphNode
): string {
  try {
    const relationName = getRelationTypeName(link.relationType);
    return `${source.lawName}第${source.articleNumber}条${relationName}${target.lawName}第${target.articleNumber}条，强度：${link.strength}`;
  } catch (error) {
    logger.error('生成连线ARIA标签失败', { error, link });
    return '关系连线';
  }
}

/**
 * 生成图谱ARIA描述
 */
export function generateGraphAriaDescription(nodes: GraphNode[], links: GraphLink[]): string {
  try {
    const nodeCount = nodes.length;
    const linkCount = links.length;

    if (nodeCount === 0 && linkCount === 0) {
      return '空图谱，包含0个法条，0条关系';
    }

    // 统计关系类型
    const relationTypes = new Map<string, number>();
    links.forEach((link) => {
      const count = relationTypes.get(link.relationType) || 0;
      relationTypes.set(link.relationType, count + 1);
    });

    // 构建关系类型描述
    let relationDesc = '';
    if (relationTypes.size > 0) {
      const typeNames = Array.from(relationTypes.entries())
        .map(([type, count]) => `${getRelationTypeName(type)}${count}条`)
        .join('、');
      relationDesc = `，主要关系类型：${typeNames}`;
    }

    return `包含${nodeCount}个法条，${linkCount}条关系${relationDesc}`;
  } catch (error) {
    logger.error('生成图谱ARIA描述失败', { error, nodeCount: nodes.length, linkCount: links.length });
    return '法条关系图谱';
  }
}

/**
 * 初始化宣布区域
 */
function initAnnounceRegion(): HTMLElement | null {
  try {
    let region = document.getElementById(ANNOUNCE_REGION_ID);
    
    if (!region) {
      region = document.createElement('div');
      region.id = ANNOUNCE_REGION_ID;
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      region.style.position = 'absolute';
      region.style.left = '-10000px';
      region.style.width = '1px';
      region.style.height = '1px';
      region.style.overflow = 'hidden';
      document.body.appendChild(region);
    }

    return region;
  } catch (error) {
    logger.error('初始化宣布区域失败', { error });
    return null;
  }
}

/**
 * 宣布消息到屏幕阅读器
 */
function announce(message: string): void {
  try {
    const region = initAnnounceRegion();
    if (!region) {
      return;
    }

    // 先清空，再设置消息
    region.textContent = '';
    // 使用setTimeout确保屏幕阅读器能够检测到变更
    setTimeout(() => {
      region.textContent = message;
    }, 0);
  } catch (error) {
    logger.error('宣布消息失败', { error, message });
  }
}

/**
 * 宣布节点选中
 */
export function announceNodeSelection(node: GraphNode): void {
  try {
    const label = generateNodeAriaLabel(node);
    announce(`${label}，已选中`);
  } catch (error) {
    logger.error('宣布节点选中失败', { error, nodeId: node.id });
  }
}

/**
 * 宣布图谱更新
 */
export function announceGraphUpdate(nodeCount: number, linkCount: number): void {
  try {
    announce(`图谱已更新，包含${nodeCount}个法条，${linkCount}条关系`);
  } catch (error) {
    logger.error('宣布图谱更新失败', { error });
  }
}

/**
 * 宣布节点详情打开
 */
export function announceNodeDetailsOpen(node: GraphNode): void {
  try {
    const label = generateNodeAriaLabel(node);
    announce(`${label}，详情已打开`);
  } catch (error) {
    logger.error('宣布节点详情打开失败', { error, nodeId: node.id });
  }
}

/**
 * 宣布节点详情关闭
 */
export function announceNodeDetailsClose(): void {
  try {
    announce('详情已关闭');
  } catch (error) {
    logger.error('宣布节点详情关闭失败', { error });
  }
}

/**
 * 宣布图谱缩放
 */
export function announceGraphZoom(level: number): void {
  try {
    announce(`缩放级别：${level.toFixed(1)}倍`);
  } catch (error) {
    logger.error('宣布图谱缩放失败', { error, level });
  }
}

/**
 * 获取节点的ARIA属性
 */
export function getNodeAriaProps(node: GraphNode): Record<string, string> {
  return {
    'aria-label': generateNodeAriaLabel(node),
    'role': 'button',
    'tabindex': '0',
  };
}

/**
 * 获取连线的ARIA属性
 */
export function getLinkAriaProps(link: GraphLink, source: GraphNode, target: GraphNode): Record<string, string> {
  return {
    'aria-label': generateLinkAriaLabel(link, source, target),
    'role': 'presentation',
  };
}

/**
 * 获取图谱容器的ARIA属性
 */
export function getGraphContainerAriaProps(nodes: GraphNode[], links: GraphLink[]): Record<string, string> {
  return {
    'role': 'region',
    'aria-label': '法条关系图谱',
    'aria-description': generateGraphAriaDescription(nodes, links),
  };
}
