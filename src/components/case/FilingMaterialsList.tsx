/**
 * 立案材料清单组件
 * 展示案件立案所需的材料清单
 */
'use client';

import { useState, useEffect } from 'react';
import {
  FilingMaterial,
  FilingMaterialsResult,
} from '@/lib/case/filing-materials-service';

interface FilingMaterialsListProps {
  caseType: string;
  courtLevel?: string;
}

export default function FilingMaterialsList({
  caseType,
  courtLevel = '基层',
}: FilingMaterialsListProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materialsData, setMaterialsData] =
    useState<FilingMaterialsResult | null>(null);
  const [checkedMaterials, setCheckedMaterials] = useState<Set<string>>(
    new Set()
  );

  // 加载材料清单
  useEffect(() => {
    async function loadMaterials() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/filing-materials?caseType=${caseType}&courtLevel=${courtLevel}`
        );
        const result = await response.json();

        if (result.success) {
          setMaterialsData(result.data);
        } else {
          setError(result.error?.message || '加载材料清单失败');
        }
      } catch (err) {
        console.error('加载材料清单失败:', err);
        setError('加载材料清单失败，请重试');
      } finally {
        setLoading(false);
      }
    }

    loadMaterials();
  }, [caseType, courtLevel]);

  // 切换材料勾选状态
  function toggleMaterial(materialId: string) {
    setCheckedMaterials(prev => {
      const newSet = new Set(prev);
      if (newSet.has(materialId)) {
        newSet.delete(materialId);
      } else {
        newSet.add(materialId);
      }
      return newSet;
    });
  }

  // 计算准备进度
  function calculateProgress(): number {
    if (!materialsData) return 0;
    const total = materialsData.materials.length;
    const checked = checkedMaterials.size;
    return total > 0 ? Math.round((checked / total) * 100) : 0;
  }

  // 按类别分组材料
  function groupMaterialsByCategory(materials: FilingMaterial[]) {
    const groups: Record<string, FilingMaterial[]> = {
      identity: [],
      legal: [],
      evidence: [],
      other: [],
    };

    materials.forEach(material => {
      groups[material.category].push(material);
    });

    return groups;
  }

  // 获取类别名称
  function getCategoryName(category: string): string {
    const categoryNames: Record<string, string> = {
      identity: '主体资格材料',
      legal: '法律文书',
      evidence: '证据材料',
      other: '其他材料',
    };
    return categoryNames[category] || category;
  }

  if (loading) {
    return (
      <div className='rounded-lg bg-white p-6 shadow'>
        <div className='text-center py-8'>
          <div className='inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent'></div>
          <p className='mt-4 text-gray-600'>加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='rounded-lg bg-white p-6 shadow'>
        <div className='text-center py-8'>
          <p className='text-red-600'>{error}</p>
        </div>
      </div>
    );
  }

  if (!materialsData) {
    return null;
  }

  const progress = calculateProgress();
  const groupedMaterials = groupMaterialsByCategory(materialsData.materials);

  return (
    <div className='rounded-lg bg-white p-6 shadow'>
      {/* 标题 */}
      <div className='mb-6'>
        <h2 className='text-xl font-semibold text-gray-900'>
          立案材料清单 - {materialsData.caseType}
        </h2>
        <p className='mt-1 text-sm text-gray-500'>
          法院级别：{materialsData.courtLevel}
        </p>
      </div>

      {/* 准备进度 */}
      <div className='mb-6'>
        <div className='flex items-center justify-between mb-2'>
          <span className='text-sm font-medium text-gray-700'>准备进度</span>
          <span className='text-sm font-medium text-gray-900'>
            {checkedMaterials.size}/{materialsData.materials.length} ({progress}
            %)
          </span>
        </div>
        <div className='w-full bg-gray-200 rounded-full h-2.5'>
          <div
            className='bg-blue-600 h-2.5 rounded-full transition-all duration-300'
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* 材料清单 */}
      <div className='space-y-6'>
        {Object.entries(groupedMaterials).map(([category, materials]) => {
          if (materials.length === 0) return null;

          return (
            <div key={category}>
              <h3 className='text-lg font-medium text-gray-900 mb-3'>
                {getCategoryName(category)}
              </h3>
              <div className='space-y-2'>
                {materials.map(material => (
                  <div
                    key={material.id}
                    className='flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors'
                  >
                    <input
                      type='checkbox'
                      checked={checkedMaterials.has(material.id)}
                      onChange={() => toggleMaterial(material.id)}
                      className='mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                    />
                    <div className='flex-1'>
                      <div className='flex items-center gap-2'>
                        <span className='font-medium text-gray-900'>
                          {material.name}
                        </span>
                        {material.required && (
                          <span className='inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800'>
                            必须
                          </span>
                        )}
                        <span className='text-sm text-gray-500'>
                          ({material.copies}份)
                        </span>
                      </div>
                      <p className='mt-1 text-sm text-gray-600'>
                        {material.description}
                      </p>
                      {material.templateUrl && (
                        <a
                          href={material.templateUrl}
                          className='mt-2 inline-flex items-center text-sm text-blue-600 hover:text-blue-700'
                          download
                        >
                          <svg
                            className='mr-1 h-4 w-4'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                            />
                          </svg>
                          下载模板
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 注意事项 */}
      {materialsData.notes.length > 0 && (
        <div className='mt-6 rounded-lg bg-yellow-50 p-4'>
          <h3 className='text-sm font-medium text-yellow-800 mb-2'>注意事项</h3>
          <ul className='space-y-1'>
            {materialsData.notes.map((note, index) => (
              <li
                key={index}
                className='text-sm text-yellow-700 flex items-start'
              >
                <span className='mr-2'>•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
