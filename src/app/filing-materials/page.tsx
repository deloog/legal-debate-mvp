'use client';

import { useState } from 'react';
import {
  FolderOpen,
  CheckSquare,
  AlertCircle,
  Printer,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

// ── 类型定义 ────────────────────────────────────────────────
interface FilingMaterial {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  category?: string;
  copies?: number;
  notes?: string;
}

interface FilingMaterialsData {
  caseType: string;
  courtLevel: string;
  materials: FilingMaterial[];
  notes?: string[];
}

// ── 案件类型选项 ────────────────────────────────────────────────
const CASE_TYPES = [
  { value: '民事', label: '民事案件', desc: '合同纠纷、侵权责任等' },
  { value: '刑事', label: '刑事案件', desc: '刑事自诉、申请再审等' },
  { value: '行政', label: '行政案件', desc: '行政诉讼、行政复议等' },
  { value: '商事', label: '商事案件', desc: '公司纠纷、破产清算等' },
  { value: '劳动', label: '劳动仲裁', desc: '劳动合同、工资纠纷等' },
  { value: '知识产权', label: '知识产权', desc: '专利、商标、版权等' },
];

const COURT_LEVELS = [
  { value: '基层', label: '基层人民法院' },
  { value: '中级', label: '中级人民法院' },
  { value: '高级', label: '高级人民法院' },
  { value: '最高', label: '最高人民法院' },
];

// ── 主组件 ────────────────────────────────────────────────
export default function FilingMaterialsPage() {
  const [caseType, setCaseType] = useState('');
  const [courtLevel, setCourtLevel] = useState('基层');
  const [materials, setMaterials] = useState<FilingMaterialsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});

  const fetchMaterials = async () => {
    if (!caseType) {
      setError('请先选择案件类型');
      return;
    }
    setLoading(true);
    setError(null);
    setChecked({});
    try {
      const params = new URLSearchParams({ caseType, courtLevel });
      const res = await fetch(`/api/filing-materials?${params}`);
      const data = await res.json();
      if (data.success) {
        setMaterials(data.data);
        // 默认展开所有分类
        const cats: Record<string, boolean> = {};
        (data.data?.materials ?? []).forEach((m: FilingMaterial) => {
          if (m.category) cats[m.category] = true;
        });
        setExpandedCategories(cats);
      } else {
        setError(data.error?.message || '获取材料清单失败');
      }
    } catch {
      setError('获取失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const toggleCheck = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // 按分类分组
  const grouped: Record<string, FilingMaterial[]> = {};
  const uncategorized: FilingMaterial[] = [];
  (materials?.materials ?? []).forEach(m => {
    if (m.category) {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m);
    } else {
      uncategorized.push(m);
    }
  });

  const totalRequired = (materials?.materials ?? []).filter(
    m => m.required
  ).length;
  const checkedRequired = (materials?.materials ?? []).filter(
    m => m.required && checked[m.id]
  ).length;

  const handlePrint = () => window.print();

  // ── 渲染 ────────────────────────────────────────────────
  return (
    <div className='min-h-screen bg-zinc-50'>
      <header className='border-b border-zinc-200 bg-white px-6 py-4 print:hidden'>
        <div className='mx-auto max-w-4xl flex items-center gap-3'>
          <FolderOpen className='h-6 w-6 text-blue-600' />
          <h1 className='text-xl font-semibold text-zinc-900'>立案材料清单</h1>
        </div>
      </header>

      <main className='mx-auto max-w-4xl px-6 py-6 space-y-5'>
        {/* 选择面板 */}
        <div className='bg-white rounded-xl border border-zinc-200 p-5 print:hidden'>
          <h2 className='text-sm font-semibold text-zinc-700 mb-4'>
            选择案件信息
          </h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
            <div>
              <label className='block text-xs font-medium text-zinc-600 mb-2'>
                案件类型 *
              </label>
              <div className='grid grid-cols-2 gap-2'>
                {CASE_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setCaseType(t.value)}
                    className={`text-left p-2.5 rounded-lg border transition-colors ${caseType === t.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-zinc-200 hover:border-blue-300 text-zinc-700'}`}
                  >
                    <div className='text-sm font-medium'>{t.label}</div>
                    <div className='text-xs text-zinc-400 mt-0.5'>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className='block text-xs font-medium text-zinc-600 mb-2'>
                法院级别
              </label>
              <div className='space-y-2'>
                {COURT_LEVELS.map(l => (
                  <button
                    key={l.value}
                    onClick={() => setCourtLevel(l.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${courtLevel === l.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-zinc-200 hover:border-blue-300 text-zinc-700'}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className='flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm mb-3'>
              <AlertCircle className='h-4 w-4 shrink-0' /> {error}
            </div>
          )}

          <button
            onClick={fetchMaterials}
            disabled={loading || !caseType}
            className='px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {loading ? '查询中...' : '查看材料清单'}
          </button>
        </div>

        {/* 材料清单 */}
        {materials && (
          <>
            {/* 标题和统计 */}
            <div className='flex items-center justify-between print:mb-4'>
              <div>
                <h2 className='text-lg font-semibold text-zinc-900'>
                  {materials.caseType} · {materials.courtLevel}人民法院
                  立案材料清单
                </h2>
                {totalRequired > 0 && (
                  <p className='text-sm text-zinc-500 mt-0.5'>
                    必填材料 {checkedRequired}/{totalRequired} 项已备齐
                  </p>
                )}
              </div>
              <button
                onClick={handlePrint}
                className='flex items-center gap-2 px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 print:hidden'
              >
                <Printer className='h-4 w-4' /> 打印清单
              </button>
            </div>

            {/* 进度条 */}
            {totalRequired > 0 && (
              <div className='bg-white rounded-xl border border-zinc-200 p-4 print:hidden'>
                <div className='flex justify-between text-xs text-zinc-500 mb-1'>
                  <span>备齐进度</span>
                  <span>
                    {Math.round((checkedRequired / totalRequired) * 100)}%
                  </span>
                </div>
                <div className='h-2 bg-zinc-100 rounded-full overflow-hidden'>
                  <div
                    className='h-full bg-blue-500 rounded-full transition-all'
                    style={{
                      width: `${(checkedRequired / totalRequired) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* 分类列表 */}
            <div className='space-y-3'>
              {Object.entries(grouped).map(([cat, items]) => (
                <div
                  key={cat}
                  className='bg-white rounded-xl border border-zinc-200 overflow-hidden'
                >
                  <button
                    onClick={() => toggleCategory(cat)}
                    className='w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-50 print:pointer-events-none'
                  >
                    <span className='font-medium text-zinc-800 text-sm'>
                      {cat}
                    </span>
                    <span className='print:hidden'>
                      {expandedCategories[cat] ? (
                        <ChevronUp className='h-4 w-4 text-zinc-400' />
                      ) : (
                        <ChevronDown className='h-4 w-4 text-zinc-400' />
                      )}
                    </span>
                  </button>
                  {expandedCategories[cat] !== false && (
                    <div className='divide-y divide-zinc-100'>
                      {items.map(m => (
                        <MaterialRow
                          key={m.id}
                          material={m}
                          checked={!!checked[m.id]}
                          onToggle={() => toggleCheck(m.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* 未分类材料 */}
              {uncategorized.length > 0 && (
                <div className='bg-white rounded-xl border border-zinc-200 overflow-hidden'>
                  <div className='px-5 py-3 bg-zinc-50 border-b border-zinc-100'>
                    <span className='font-medium text-zinc-800 text-sm'>
                      其他材料
                    </span>
                  </div>
                  <div className='divide-y divide-zinc-100'>
                    {uncategorized.map(m => (
                      <MaterialRow
                        key={m.id}
                        material={m}
                        checked={!!checked[m.id]}
                        onToggle={() => toggleCheck(m.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 注意事项 */}
            {materials.notes && materials.notes.length > 0 && (
              <div className='bg-amber-50 border border-amber-200 rounded-xl p-4'>
                <div className='flex items-center gap-2 mb-2'>
                  <Info className='h-4 w-4 text-amber-600' />
                  <span className='text-sm font-medium text-amber-800'>
                    注意事项
                  </span>
                </div>
                <ul className='list-disc list-inside space-y-1 text-sm text-amber-700'>
                  {materials.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ── 单行材料组件 ────────────────────────────────────────────────
function MaterialRow({
  material,
  checked,
  onToggle,
}: {
  material: FilingMaterial;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={`flex items-start gap-3 px-5 py-3 cursor-pointer hover:bg-zinc-50 transition-colors print:pointer-events-none ${checked ? 'bg-green-50/50' : ''}`}
    >
      <div className='mt-0.5 print:hidden'>
        <CheckSquare
          className={`h-5 w-5 ${checked ? 'text-green-500' : 'text-zinc-300'}`}
        />
      </div>
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2 flex-wrap'>
          <span
            className={`text-sm font-medium ${checked ? 'text-green-700 line-through' : 'text-zinc-800'}`}
          >
            {material.name}
          </span>
          {material.required && (
            <span className='text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium'>
              必须
            </span>
          )}
          {material.copies && material.copies > 1 && (
            <span className='text-xs text-zinc-400'>×{material.copies} 份</span>
          )}
        </div>
        {material.description && (
          <p className='text-xs text-zinc-500 mt-0.5'>{material.description}</p>
        )}
        {material.notes && (
          <p className='text-xs text-amber-600 mt-0.5 flex items-center gap-1'>
            <Info className='h-3 w-3' /> {material.notes}
          </p>
        )}
      </div>
    </div>
  );
}
