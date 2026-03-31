'use client';

import { useEffect, useState } from 'react';
import {
  FileText,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  DollarSign,
  Calendar,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentUpload } from '@/app/documents/components/document-upload';
import type { UploadedFile } from '@/app/documents/components/file-list';

interface ExtractedParty {
  name?: string;
  role?: string;
  type?: string;
}

interface ExtractedClaim {
  content?: string;
  amount?: number;
  type?: string;
}

interface ExtractedTimeline {
  date?: string;
  event?: string;
  description?: string;
}

interface ExtractedData {
  parties?: ExtractedParty[];
  claims?: ExtractedClaim[];
  timeline?: ExtractedTimeline[];
  totalAmount?: number;
  currency?: string;
  summary?: string;
  disputeFocus?: string[];
}

interface Document {
  id: string;
  filename: string;
  fileSize: number;
  analysisStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  analysisError?: string | null;
  extractedData?: ExtractedData | null;
  createdAt: string;
}

interface DocumentsTabProps {
  caseId: string;
  canManage: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  PROCESSING:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  COMPLETED:
    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待分析',
  PROCESSING: '分析中',
  COMPLETED: '已完成',
  FAILED: '分析失败',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AnalysisResult({ data }: { data: ExtractedData }) {
  return (
    <div className='mt-4 space-y-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/20'>
      <p className='text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400'>
        AI 提取结果
      </p>

      {/* 当事人 */}
      {data.parties && data.parties.length > 0 && (
        <div>
          <div className='mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300'>
            <User className='h-4 w-4' />
            当事人
          </div>
          <div className='flex flex-wrap gap-2'>
            {data.parties.map((p, i) => (
              <span
                key={i}
                className='inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs shadow-sm dark:bg-zinc-900'
              >
                <span className='font-medium'>{p.name ?? '—'}</span>
                {p.role && <span className='text-zinc-400'>（{p.role}）</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 诉求金额 */}
      {(data.totalAmount !== undefined ||
        (data.claims && data.claims.some(c => c.amount))) && (
        <div>
          <div className='mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300'>
            <DollarSign className='h-4 w-4' />
            诉讼请求
          </div>
          <div className='space-y-1'>
            {data.claims?.map((c, i) => (
              <div
                key={i}
                className='flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400'
              >
                <span className='mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400' />
                <span>
                  {c.content}
                  {c.amount !== undefined && (
                    <span className='ml-1 font-semibold text-zinc-900 dark:text-zinc-100'>
                      （{data.currency ?? '¥'}
                      {c.amount.toLocaleString()}）
                    </span>
                  )}
                </span>
              </div>
            ))}
            {data.totalAmount !== undefined && (
              <div className='mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
                合计：{data.currency ?? '¥'}
                {data.totalAmount.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 时间线 */}
      {data.timeline && data.timeline.length > 0 && (
        <div>
          <div className='mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300'>
            <Calendar className='h-4 w-4' />
            关键时间线
          </div>
          <div className='space-y-2'>
            {data.timeline.map((t, i) => (
              <div key={i} className='flex gap-3 text-sm'>
                <span className='shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400 pt-0.5 w-24'>
                  {t.date ?? '—'}
                </span>
                <span className='text-zinc-600 dark:text-zinc-400'>
                  {t.event ?? t.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 争议焦点 */}
      {data.disputeFocus && data.disputeFocus.length > 0 && (
        <div>
          <div className='mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300'>
            <Target className='h-4 w-4' />
            争议焦点
          </div>
          <div className='flex flex-wrap gap-2'>
            {data.disputeFocus.map((f, i) => (
              <span
                key={i}
                className='rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI 摘要 */}
      {data.summary && (
        <div className='rounded-md bg-white/60 p-3 text-sm text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400'>
          {data.summary}
        </div>
      )}
    </div>
  );
}

export function DocumentsTab({ caseId, canManage }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/documents?caseId=${caseId}&pageSize=50`);
      const data = await res.json();
      if (data.success && data.data) {
        setDocuments(data.data.documents);
      } else {
        setError(data.message || '获取文档失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const handleAnalyze = async (id: string) => {
    setAnalyzingId(id);
    try {
      const res = await fetch('/api/v1/documents/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setDocuments(prev =>
          prev.map(d =>
            d.id === id ? { ...d, analysisStatus: 'PROCESSING' } : d
          )
        );
        setTimeout(() => {
          void fetchDocuments();
        }, 4000);
      } else {
        alert(data.message || '分析启动失败');
      }
    } catch {
      alert('网络错误');
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleUploadSuccess = (files: UploadedFile[]) => {
    setShowUpload(false);
    void fetchDocuments();
    if (files.length > 0) {
      // 自动触发分析第一个文件
      setTimeout(() => {
        if (files[0]) void handleAnalyze(files[0].id);
      }, 1000);
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center py-16'>
        <Loader2 className='h-6 w-6 animate-spin text-zinc-400' />
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* 头部操作 */}
      <div className='flex items-center justify-between'>
        <p className='text-sm text-zinc-500 dark:text-zinc-400'>
          上传文件后，AI 将自动提取当事人、诉求金额、关键时间线等信息
        </p>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void fetchDocuments()}
            className='gap-1'
          >
            <RefreshCw className='h-3.5 w-3.5' />
            刷新
          </Button>
          {canManage && (
            <Button
              size='sm'
              onClick={() => setShowUpload(prev => !prev)}
              className='gap-1'
            >
              <Upload className='h-3.5 w-3.5' />
              上传文档
            </Button>
          )}
        </div>
      </div>

      {/* 上传区域 */}
      {showUpload && canManage && (
        <div className='rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950'>
          <DocumentUpload
            caseId={caseId}
            onFilesUploaded={handleUploadSuccess}
          />
        </div>
      )}

      {error && (
        <div className='flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400'>
          <AlertCircle className='h-4 w-4 shrink-0' />
          {error}
        </div>
      )}

      {/* 文档列表 */}
      {documents.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-16 text-zinc-400'>
          <FileText className='mb-3 h-10 w-10' />
          <p className='text-sm'>暂无文档</p>
          {canManage && (
            <Button
              variant='outline'
              size='sm'
              className='mt-3 gap-1'
              onClick={() => setShowUpload(true)}
            >
              <Upload className='h-3.5 w-3.5' />
              上传第一个文档
            </Button>
          )}
        </div>
      ) : (
        <div className='space-y-3'>
          {documents.map(doc => (
            <div
              key={doc.id}
              className='rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
            >
              {/* 文档头部 */}
              <div className='flex items-center gap-3 p-4'>
                <FileText className='h-5 w-5 shrink-0 text-zinc-400' />
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium text-zinc-900 dark:text-zinc-100'>
                    {doc.filename}
                  </p>
                  <p className='text-xs text-zinc-400'>
                    {formatFileSize(doc.fileSize)} ·{' '}
                    {new Date(doc.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[doc.analysisStatus]}`}
                >
                  {doc.analysisStatus === 'PROCESSING' && (
                    <Loader2 className='h-3 w-3 animate-spin' />
                  )}
                  {doc.analysisStatus === 'COMPLETED' && (
                    <CheckCircle2 className='h-3 w-3' />
                  )}
                  {doc.analysisStatus === 'FAILED' && (
                    <AlertCircle className='h-3 w-3' />
                  )}
                  {doc.analysisStatus === 'PENDING' && (
                    <Clock className='h-3 w-3' />
                  )}
                  {STATUS_LABEL[doc.analysisStatus]}
                </span>

                {/* 操作按钮 */}
                <div className='flex shrink-0 items-center gap-1'>
                  {(doc.analysisStatus === 'PENDING' ||
                    doc.analysisStatus === 'FAILED') && (
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => void handleAnalyze(doc.id)}
                      disabled={analyzingId === doc.id}
                      className='gap-1 text-xs'
                    >
                      {analyzingId === doc.id ? (
                        <Loader2 className='h-3 w-3 animate-spin' />
                      ) : (
                        <RefreshCw className='h-3 w-3' />
                      )}
                      分析
                    </Button>
                  )}
                  {doc.analysisStatus === 'COMPLETED' && doc.extractedData && (
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() =>
                        setExpandedId(prev => (prev === doc.id ? null : doc.id))
                      }
                      className='gap-1 text-xs'
                    >
                      {expandedId === doc.id ? (
                        <ChevronUp className='h-3.5 w-3.5' />
                      ) : (
                        <ChevronDown className='h-3.5 w-3.5' />
                      )}
                      {expandedId === doc.id ? '收起' : '查看提取结果'}
                    </Button>
                  )}
                </div>
              </div>

              {/* 分析失败提示 */}
              {doc.analysisStatus === 'FAILED' && doc.analysisError && (
                <div className='border-t border-zinc-100 px-4 pb-3 pt-2 dark:border-zinc-800'>
                  <p className='text-xs text-red-600 dark:text-red-400'>
                    {doc.analysisError}
                  </p>
                </div>
              )}

              {/* 分析结果展开 */}
              {expandedId === doc.id && doc.extractedData && (
                <div className='border-t border-zinc-100 px-4 pb-4 dark:border-zinc-800'>
                  <AnalysisResult data={doc.extractedData} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
