/**
 * 证据分类面板组件
 *
 * 功能：
 * - 按案件类型展示证据分类树
 * - 显示分类完成度统计
 * - 展示每个分类下的证据数量
 * - 支持快速筛选未分类证据
 * - 支持展开/收起分类
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EvidenceCategory } from '@/lib/evidence/evidence-category-config';

/**
 * 证据项接口
 */
export interface EvidenceItem {
  id: string;
  name: string;
  categoryCode: string | null;
}

/**
 * 组件属性
 */
export interface EvidenceCategoryPanelProps {
  /**
   * 分类配置
   */
  categories: EvidenceCategory[];

  /**
   * 证据列表
   */
  evidenceList: EvidenceItem[];

  /**
   * 选择分类回调
   */
  onCategorySelect?: (categoryCode: string) => void;

  /**
   * 案件类型
   */
  caseType?: string;
}

/**
 * 证据分类面板组件
 */
export function EvidenceCategoryPanel({
  categories,
  evidenceList,
  onCategorySelect,
  caseType,
}: EvidenceCategoryPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const [showUncategorized, setShowUncategorized] = useState(false);

  /**
   * 统计数据
   */
  const statistics = useMemo(() => {
    const total = evidenceList.length;
    const categorized = evidenceList.filter(e => e.categoryCode).length;
    const uncategorized = total - categorized;
    const completeness = total > 0 ? (categorized / total) * 100 : 0;

    // 统计每个分类的证据数量
    const categoryCount = new Map<string, number>();
    evidenceList.forEach(evidence => {
      if (evidence.categoryCode) {
        categoryCount.set(
          evidence.categoryCode,
          (categoryCount.get(evidence.categoryCode) || 0) + 1
        );
      }
    });

    return {
      total,
      categorized,
      uncategorized,
      completeness,
      categoryCount,
    };
  }, [evidenceList]);

  /**
   * 切换分类展开状态
   */
  const toggleCategory = (categoryCode: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryCode)) {
      newExpanded.delete(categoryCode);
    } else {
      newExpanded.add(categoryCode);
    }
    setExpandedCategories(newExpanded);
  };

  /**
   * 获取分类下的证据数量
   */
  const getCategoryCount = (categoryCode: string): number => {
    return statistics.categoryCount.get(categoryCode) || 0;
  };

  /**
   * 获取分类及其子分类的总证据数量
   */
  const getTotalCategoryCount = (category: EvidenceCategory): number => {
    let count = getCategoryCount(category.code);
    if (category.subCategories) {
      category.subCategories.forEach(sub => {
        count += getTotalCategoryCount(sub);
      });
    }
    return count;
  };

  return (
    <Card className='w-full'>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-lg'>证据分类管理</CardTitle>
          {caseType && (
            <Badge variant='secondary' className='text-sm'>
              {caseType}
            </Badge>
          )}
        </div>

        {/* 统计信息 */}
        <div className='mt-4 grid grid-cols-3 gap-4'>
          <div className='rounded-lg bg-blue-50 p-3'>
            <div className='text-sm text-gray-600'>总证据数</div>
            <div className='text-2xl font-bold text-blue-600'>
              {statistics.total}
            </div>
          </div>
          <div className='rounded-lg bg-green-50 p-3'>
            <div className='text-sm text-gray-600'>已分类</div>
            <div className='text-2xl font-bold text-green-600'>
              {statistics.categorized}
            </div>
          </div>
          <div className='rounded-lg bg-orange-50 p-3'>
            <div className='text-sm text-gray-600'>完成度</div>
            <div className='text-2xl font-bold text-orange-600'>
              {statistics.completeness.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* 快速筛选 */}
        <div className='mt-4 flex gap-2'>
          <Button
            variant={showUncategorized ? 'primary' : 'outline'}
            size='sm'
            onClick={() => setShowUncategorized(!showUncategorized)}
          >
            未分类 ({statistics.uncategorized})
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {categories.length === 0 ? (
          <div className='py-8 text-center text-gray-500'>暂无分类配置</div>
        ) : evidenceList.length === 0 ? (
          <div className='py-8 text-center text-gray-500'>暂无证据</div>
        ) : showUncategorized ? (
          /* 显示未分类证据 */
          <div className='space-y-2'>
            <h4 className='font-medium text-gray-900'>未分类证据</h4>
            {evidenceList
              .filter(e => !e.categoryCode)
              .map(evidence => (
                <div
                  key={evidence.id}
                  className='rounded-lg border border-gray-200 p-3'
                >
                  <div className='text-sm text-gray-700'>{evidence.name}</div>
                </div>
              ))}
          </div>
        ) : (
          /* 显示分类树 */
          <div className='space-y-2'>
            {categories.map(category => (
              <CategoryTreeItem
                key={category.code}
                category={category}
                level={0}
                expanded={expandedCategories.has(category.code)}
                onToggle={() => toggleCategory(category.code)}
                onSelect={onCategorySelect}
                count={getTotalCategoryCount(category)}
                getCategoryCount={getCategoryCount}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 分类树项组件
 */
interface CategoryTreeItemProps {
  category: EvidenceCategory;
  level: number;
  expanded: boolean;
  onToggle: () => void;
  onSelect?: (categoryCode: string) => void;
  count: number;
  getCategoryCount: (code: string) => number;
}

function CategoryTreeItem({
  category,
  level,
  expanded,
  onToggle,
  onSelect,
  count,
  getCategoryCount,
}: CategoryTreeItemProps) {
  const hasSubCategories =
    category.subCategories && category.subCategories.length > 0;
  const indent = level * 20;

  return (
    <div>
      <div
        className='flex items-center gap-2 rounded-lg p-2 hover:bg-gray-50'
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {/* 展开/收起按钮 */}
        {hasSubCategories && (
          <Button
            variant='ghost'
            size='sm'
            onClick={onToggle}
            className='h-6 w-6 p-0'
            aria-label={expanded ? '收起' : '展开'}
          >
            {expanded ? '▲' : '▼'}
          </Button>
        )}

        {/* 分类名称 */}
        <div
          className='flex-1 cursor-pointer'
          onClick={() => onSelect?.(category.code)}
        >
          <div className='flex items-center gap-2'>
            <span className='font-medium text-gray-900'>{category.name}</span>
            {count > 0 && (
              <Badge variant='secondary' className='text-xs'>
                {count}
              </Badge>
            )}
          </div>
          <div className='text-xs text-gray-500'>{category.description}</div>
        </div>
      </div>

      {/* 子分类 */}
      {hasSubCategories && expanded && (
        <div className='mt-1'>
          {category.subCategories!.map(subCategory => (
            <CategoryTreeItem
              key={subCategory.code}
              category={subCategory}
              level={level + 1}
              expanded={false}
              onToggle={() => {}}
              onSelect={onSelect}
              count={getCategoryCount(subCategory.code)}
              getCategoryCount={getCategoryCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}
