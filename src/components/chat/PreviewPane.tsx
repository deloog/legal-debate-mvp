'use client';

import { useCallback, useEffect, useState, startTransition } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  XIcon,
  DownloadIcon,
  GitCompareIcon,
  ClockIcon,
  FileTextIcon,
  ListChecksIcon,
  TimerIcon,
} from 'lucide-react';

interface DocVersion {
  id: number;
  content: string;
  createdAt: Date;
}

// 来自案情晶体的必要字段
interface CrystalForPreview {
  case_type?: string | null;
}

type PreviewTab = 'document' | 'statute' | 'filing';

interface PreviewPaneProps {
  content: string;
  versions?: DocVersion[];
  onVersionSelect?: (content: string) => void;
  onClose: () => void;
  userRole?: string;
  crystal?: CrystalForPreview | null;
  hasDocument?: boolean; // 是否已生成文书（控制立案材料标签页出现）
}

export function PreviewPane({
  content,
  versions = [],
  onVersionSelect,
  onClose,
  userRole = 'USER',
  crystal,
  hasDocument = false,
}: PreviewPaneProps) {
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<PreviewTab>('document');

  const isLawyer = userRole === 'LAWYER';

  const handleExportMarkdown = useCallback(() => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `律伴文书_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [content]);

  const handleExportDocx = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/chat/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `律伴文书_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      handleExportMarkdown();
    }
  }, [content, handleExportMarkdown]);

  const compareContent =
    compareVersionId !== null
      ? (versions.find(v => v.id === compareVersionId)?.content ?? '')
      : '';

  const hasVersions = versions.length > 1;

  return (
    <div className='w-full h-full flex flex-col border-l border-gray-200 bg-white'>
      {/* 标题栏 */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0'>
        <h3 className='text-sm font-medium text-gray-900'>文书预览</h3>
        <div className='flex items-center gap-2'>
          {hasVersions && (
            <button
              onClick={() => {
                setCompareMode(o => !o);
                setCompareVersionId(null);
              }}
              className={`text-xs flex items-center gap-1 px-2 py-1 rounded-md border transition-colors ${
                compareMode
                  ? 'bg-violet-50 border-violet-300 text-violet-700'
                  : 'border-gray-200 text-gray-500 hover:text-gray-700'
              }`}
              title='版本对比'
            >
              <GitCompareIcon className='w-3 h-3' />
              对比
            </button>
          )}
          <button
            onClick={handleExportMarkdown}
            className='text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1'
            title='导出 Markdown'
          >
            <DownloadIcon className='w-3.5 h-3.5' />
            MD
          </button>
          <button
            onClick={handleExportDocx}
            className='text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1'
            title='导出 Word'
          >
            <DownloadIcon className='w-3.5 h-3.5' />
            Word
          </button>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600'
          >
            <XIcon className='w-4 h-4' />
          </button>
        </div>
      </div>

      {/* 标签页切换（律师显示工具标签页） */}
      {isLawyer && (
        <div className='flex border-b border-gray-200 shrink-0'>
          <TabButton
            active={activeTab === 'document'}
            onClick={() => setActiveTab('document')}
            icon={<FileTextIcon className='w-3 h-3' />}
            label='文书'
          />
          <TabButton
            active={activeTab === 'statute'}
            onClick={() => setActiveTab('statute')}
            icon={<TimerIcon className='w-3 h-3' />}
            label='时效'
          />
          {hasDocument && (
            <TabButton
              active={activeTab === 'filing'}
              onClick={() => setActiveTab('filing')}
              icon={<ListChecksIcon className='w-3 h-3' />}
              label='立案材料'
            />
          )}
        </div>
      )}

      {/* 版本列表（多版本时显示，仅文书标签页） */}
      {hasVersions && activeTab === 'document' && (
        <div className='flex items-center gap-1.5 px-4 py-2 border-b border-gray-100 overflow-x-auto shrink-0'>
          <ClockIcon className='w-3 h-3 text-gray-400 shrink-0' />
          {versions.map((v, i) => {
            const label = `v${i + 1} ${v.createdAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
            const isCurrent = v.content === content;
            const isCompare = v.id === compareVersionId;
            return (
              <button
                key={v.id}
                onClick={() => {
                  if (compareMode) {
                    setCompareVersionId(isCompare ? null : v.id);
                  } else {
                    onVersionSelect?.(v.content);
                  }
                }}
                className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 transition-colors ${
                  isCompare
                    ? 'bg-violet-100 border-violet-400 text-violet-700'
                    : isCurrent && !compareMode
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* 内容区 */}
      <div className='flex-1 overflow-hidden flex'>
        {/* 时效计算标签页 */}
        {activeTab === 'statute' && (
          <StatuteCalculatorPanel caseType={crystal?.case_type ?? null} />
        )}
        {/* 立案材料标签页 */}
        {activeTab === 'filing' && (
          <FilingMaterialsPanel caseType={crystal?.case_type ?? null} />
        )}
        {/* 文书标签页 */}
        {activeTab === 'document' && compareMode && compareContent ? (
          // 对比模式：左右两列
          <>
            <div className='flex-1 overflow-y-auto border-r border-gray-100'>
              <p className='sticky top-0 bg-blue-50 text-[10px] text-blue-600 px-3 py-1 font-medium z-10'>
                当前版本
              </p>
              <div className='ai-markdown px-4 py-4'>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            </div>
            <div className='flex-1 overflow-y-auto'>
              <p className='sticky top-0 bg-amber-50 text-[10px] text-amber-600 px-3 py-1 font-medium z-10'>
                {compareVersionId !== null
                  ? `v${versions.findIndex(v => v.id === compareVersionId) + 1}`
                  : '选择版本'}
              </p>
              <div className='ai-markdown px-4 py-4'>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {compareContent}
                </ReactMarkdown>
              </div>
            </div>
          </>
        ) : activeTab === 'document' && compareMode ? (
          <div className='flex-1 flex flex-col'>
            <div className='ai-markdown px-5 py-5 overflow-y-auto flex-1'>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
            <div className='border-t border-dashed border-violet-200 py-3 text-center text-xs text-violet-400'>
              请点击上方版本标签选择对比版本
            </div>
          </div>
        ) : activeTab === 'document' && content ? (
          <div className='flex-1 overflow-y-auto'>
            <div className='ai-markdown px-5 py-5'>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          </div>
        ) : activeTab === 'document' ? (
          <div className='flex-1 flex items-center justify-center text-gray-400 text-sm px-6 text-center'>
            <p>
              从对话中标注&ldquo;入文书&rdquo;内容，或 AI
              起草文书后自动出现在此处
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── 标签页按钮 ────────────────────────────────────────────────────────────────
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 transition-colors ${
        active
          ? 'border-slate-900 text-slate-900 font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── 时效计算面板 ──────────────────────────────────────────────────────────────
type StatuteType = 'lawsuit' | 'appeal' | 'execution';

const STATUTE_YEARS: Record<StatuteType, number> = {
  lawsuit: 3, // 民事诉讼时效 3 年（民法典第188条）
  appeal: 15, // 上诉期 15 日（天）
  execution: 2, // 申请执行 2 年
};

const STATUTE_LABELS: Record<StatuteType, string> = {
  lawsuit: '诉讼时效（3年）',
  appeal: '上诉期（15日）',
  execution: '申请执行期（2年）',
};

function StatuteCalculatorPanel({ caseType }: { caseType: string | null }) {
  const [statuteType, setStatuteType] = useState<StatuteType>('lawsuit');
  const [startDate, setStartDate] = useState('');
  const [result, setResult] = useState<{
    deadlineDate: string;
    remainingDays: number;
    isExpired: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCalculate = async () => {
    if (!startDate) {
      setError('请输入起算日期');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/statute/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ statuteType, caseType, startDate }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          data?: {
            deadlineDate: string;
            remainingDays: number;
            isExpired: boolean;
          };
        };
        if (data.data) {
          setResult(data.data);
          return;
        }
      }
      // API 不存在时本地降级计算
      const start = new Date(startDate);
      const deadline = new Date(start);
      if (statuteType === 'appeal') {
        deadline.setDate(deadline.getDate() + 15);
      } else {
        deadline.setFullYear(
          deadline.getFullYear() + STATUTE_YEARS[statuteType]
        );
      }
      const remaining = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
      setResult({
        deadlineDate: deadline.toISOString().slice(0, 10),
        remainingDays: remaining,
        isExpired: remaining < 0,
      });
    } catch {
      setError('计算失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex-1 overflow-y-auto px-5 py-5'>
      <h4 className='text-sm font-medium text-gray-900 mb-4'>诉讼时效计算</h4>
      {caseType && (
        <p className='text-xs text-gray-500 mb-3'>案件类型：{caseType}</p>
      )}
      <div className='space-y-3'>
        <div>
          <label className='text-xs text-gray-600 block mb-1'>时效类型</label>
          <select
            value={statuteType}
            onChange={e => {
              setStatuteType(e.target.value as StatuteType);
              setResult(null);
            }}
            className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400'
          >
            {(Object.entries(STATUTE_LABELS) as [StatuteType, string][]).map(
              ([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              )
            )}
          </select>
        </div>
        <div>
          <label className='text-xs text-gray-600 block mb-1'>起算日期</label>
          <input
            type='date'
            value={startDate}
            onChange={e => {
              setStartDate(e.target.value);
              setResult(null);
            }}
            className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400'
          />
        </div>
        {error && <p className='text-xs text-red-500'>{error}</p>}
        <button
          onClick={handleCalculate}
          disabled={loading}
          className='w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium transition-colors disabled:opacity-50'
        >
          {loading ? '计算中...' : '计算截止日期'}
        </button>
        {result && (
          <div
            className={`rounded-lg p-4 ${result.isExpired ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}
          >
            <p
              className={`text-sm font-semibold ${result.isExpired ? 'text-red-700' : 'text-emerald-700'}`}
            >
              {result.isExpired ? '⚠ 已超过时效' : '✓ 时效内'}
            </p>
            <p className='text-xs text-gray-600 mt-1'>
              截止日期：{result.deadlineDate}
            </p>
            <p className='text-xs text-gray-600'>
              {result.isExpired
                ? `已超期 ${Math.abs(result.remainingDays)} 天`
                : `剩余 ${result.remainingDays} 天`}
            </p>
          </div>
        )}
        <p className='text-[11px] text-gray-400'>
          依据《民法典》第188条（3年诉讼时效）、《民事诉讼法》相关规定。结果仅供参考，请结合具体案情判断。
        </p>
      </div>
    </div>
  );
}

// ── 立案材料面板 ──────────────────────────────────────────────────────────────
interface FilingMaterial {
  id: string;
  name: string;
  required: boolean;
  category: string;
  notes?: string;
  templateUrl?: string;
}

function FilingMaterialsPanel({ caseType }: { caseType: string | null }) {
  const [materials, setMaterials] = useState<FilingMaterial[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [courtLevel, setCourtLevel] = useState<
    'basic' | 'intermediate' | 'high'
  >('basic');

  // 加载立案材料列表（courtLevel 变化时重新拉取）
  useEffect(() => {
    let cancelled = false;
    startTransition(() => setLoading(true));
    const params = new URLSearchParams();
    if (caseType) params.set('caseType', caseType);
    params.set('courtLevel', courtLevel);
    fetch(`/api/v1/filing-materials?${params.toString()}`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then((data: { data?: { materials?: FilingMaterial[] } }) => {
        if (!cancelled) {
          setMaterials(data.data?.materials ?? getDefaultMaterials());
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMaterials(getDefaultMaterials());
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [caseType, courtLevel]);

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const requiredMaterials = materials.filter(m => m.required);
  const optionalMaterials = materials.filter(m => !m.required);
  const progress =
    materials.length > 0
      ? Math.round((checked.size / materials.length) * 100)
      : 0;

  if (loading) {
    return (
      <div className='flex-1 flex items-center justify-center text-gray-400 text-sm'>
        加载中...
      </div>
    );
  }

  return (
    <div className='flex-1 overflow-y-auto px-5 py-5'>
      <div className='flex items-center justify-between mb-3'>
        <h4 className='text-sm font-medium text-gray-900'>立案材料清单</h4>
        <select
          value={courtLevel}
          onChange={e =>
            setCourtLevel(e.target.value as 'basic' | 'intermediate' | 'high')
          }
          className='text-xs border border-gray-200 rounded-md px-2 py-1 outline-none'
        >
          <option value='basic'>基层法院</option>
          <option value='intermediate'>中级法院</option>
          <option value='high'>高级法院</option>
        </select>
      </div>
      {/* 进度条 */}
      <div className='mb-4'>
        <div className='flex justify-between text-xs text-gray-500 mb-1'>
          <span>准备进度</span>
          <span>
            {checked.size}/{materials.length}
          </span>
        </div>
        <div className='h-1.5 bg-gray-100 rounded-full overflow-hidden'>
          <div
            className='h-full bg-slate-900 rounded-full transition-all'
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      {/* 必需材料 */}
      {requiredMaterials.length > 0 && (
        <MaterialGroup
          title='必需材料'
          materials={requiredMaterials}
          checked={checked}
          onToggle={toggleCheck}
        />
      )}
      {/* 可选材料 */}
      {optionalMaterials.length > 0 && (
        <MaterialGroup
          title='补充材料'
          materials={optionalMaterials}
          checked={checked}
          onToggle={toggleCheck}
        />
      )}
    </div>
  );
}

function MaterialGroup({
  title,
  materials,
  checked,
  onToggle,
}: {
  title: string;
  materials: FilingMaterial[];
  checked: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className='mb-4'>
      <p className='text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2'>
        {title}
      </p>
      <div className='space-y-1.5'>
        {materials.map(m => (
          <label
            key={m.id}
            className='flex items-start gap-2.5 cursor-pointer group'
          >
            <input
              type='checkbox'
              checked={checked.has(m.id)}
              onChange={() => onToggle(m.id)}
              className='mt-0.5 rounded border-gray-300 accent-slate-900'
            />
            <span
              className={`text-xs leading-relaxed ${checked.has(m.id) ? 'line-through text-gray-400' : 'text-gray-700'}`}
            >
              {m.name}
              {m.notes && (
                <span className='text-[11px] text-gray-400 ml-1'>
                  （{m.notes}）
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// API 不可用时的降级默认材料
function getDefaultMaterials(): FilingMaterial[] {
  return [
    {
      id: '1',
      name: '起诉状（原件+副本）',
      required: true,
      category: '法律文书',
    },
    {
      id: '2',
      name: '原告身份证明材料',
      required: true,
      category: '主体资格',
      notes: '身份证复印件或营业执照',
    },
    {
      id: '3',
      name: '被告身份/地址证明',
      required: true,
      category: '主体资格',
    },
    { id: '4', name: '主要证据材料及目录', required: true, category: '证据' },
    {
      id: '5',
      name: '授权委托书',
      required: false,
      category: '法律文书',
      notes: '代理人出庭时需要',
    },
    { id: '6', name: '诉讼费缴费凭证', required: false, category: '其他' },
  ];
}
