'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  FileText,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Eye,
  Trash2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  User,
  DollarSign,
  Calendar,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DocumentUpload } from './components/document-upload';
import type { UploadedFile } from './components/file-list';

interface Document {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  analysisStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  analysisError?: string | null;
  extractedData?: ExtractedData | null;
  createdAt: string;
  case?: { id: string; title: string } | null;
}

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

interface DocumentsResponse {
  success: boolean;
  data?: {
    documents: Document[];
    total: number;
    page: number;
    pageSize: number;
  };
  message?: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待分析',
  PROCESSING: '分析中',
  COMPLETED: '已完成',
  FAILED: '分析失败',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  PROCESSING:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  COMPLETED:
    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentAdvice(document: Document): string | null {
  if (document.analysisStatus === 'PROCESSING') {
    return '系统正在提取文本并生成结构化分析，通常会在 10-60 秒内完成。';
  }

  if (document.analysisStatus === 'FAILED') {
    if (document.analysisError?.includes('扫描件')) {
      return '建议改传可复制文本的 PDF、Word 或 TXT；扫描件 OCR 将在后续接入。';
    }
    return '建议重新上传一次，或改传 Word / TXT 版本以提高稳定性。';
  }

  if (document.analysisStatus === 'COMPLETED') {
    return '可进入案件查看提取结果，再继续聊天或文书起草。';
  }

  return null;
}

function AnalysisResult({ data }: { data: ExtractedData }) {
  return (
    <div className='mt-4 space-y-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/20'>
      <p className='text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400'>
        案情提取摘要
      </p>

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
          </div>
        </div>
      )}

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

      {data.summary && (
        <div className='rounded-md bg-white/60 p-3 text-sm text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400'>
          {data.summary}
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCaseId, setUploadCaseId] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/v1/documents?${params.toString()}`);
      const data: DocumentsResponse = await res.json();
      if (data.success && data.data) {
        setDocuments(data.data.documents);
      } else {
        setError(data.message || '获取文档列表失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const hasProcessing = documents.some(
      doc =>
        doc.analysisStatus === 'PENDING' || doc.analysisStatus === 'PROCESSING'
    );
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      void fetchDocuments();
    }, 4000);

    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchDocuments();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此文档？此操作不可撤销。')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/documents/${id}`, { method: 'DELETE' });
      if (res.status === 204) {
        setDocuments(prev => prev.filter(d => d.id !== id));
      } else {
        const data = await res.json();
        alert(data.message || '删除失败');
      }
    } catch {
      alert('网络错误');
    } finally {
      setDeletingId(null);
    }
  };

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
        void fetchDocuments();
      } else {
        alert(data.message || '分析启动失败');
      }
    } catch {
      alert('网络错误');
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleUploadSuccess = (_files: UploadedFile[]) => {
    setShowUpload(false);
    setAnalysisNotice(
      '文档已上传，系统正在自动分析。若 PDF 为扫描件，可能需要 OCR 才能提取内容。'
    );
    setTimeout(() => setAnalysisNotice(null), 6000);
    void fetchDocuments();
  };

  const stats = {
    total: documents.length,
    completed: documents.filter(d => d.analysisStatus === 'COMPLETED').length,
    pending: documents.filter(d => d.analysisStatus === 'PENDING').length,
    failed: documents.filter(d => d.analysisStatus === 'FAILED').length,
  };

  const loadDocumentAnalysisResult = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/v1/documents/${id}`);
      const data = await res.json();
      if (!data?.success) return null;
      return (data?.data?.analysisResult?.extractedData ??
        null) as ExtractedData | null;
    } catch {
      return null;
    }
  }, []);

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-7xl items-center justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
              文档管理
            </h1>
            <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
              上传法律文档，AI 自动提取当事人、诉求金额、关键时间线等信息
            </p>
          </div>
          <Button
            onClick={() => setShowUpload(prev => !prev)}
            className='gap-2'
          >
            <Upload className='h-4 w-4' />
            上传文档
          </Button>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-6 py-6 space-y-6'>
        {/* 统计卡片 */}
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
          {[
            {
              label: '全部文档',
              value: stats.total,
              color: 'text-zinc-700 dark:text-zinc-300',
            },
            {
              label: '分析完成',
              value: stats.completed,
              color: 'text-green-600 dark:text-green-400',
            },
            {
              label: '待分析',
              value: stats.pending,
              color: 'text-zinc-500 dark:text-zinc-400',
            },
            {
              label: '分析失败',
              value: stats.failed,
              color: 'text-red-600 dark:text-red-400',
            },
          ].map(s => (
            <div
              key={s.label}
              className='rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950'
            >
              <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                {s.label}
              </p>
              <p className={`mt-1 text-2xl font-semibold ${s.color}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* 上传区域（可折叠） */}
        {showUpload && (
          <div className='rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
            <h2 className='mb-4 text-base font-medium text-zinc-900 dark:text-zinc-50'>
              上传新文档
            </h2>
            <div className='mb-4'>
              <label className='mb-1 block text-sm text-zinc-600 dark:text-zinc-400'>
                关联案件 ID（必填）
              </label>
              <Input
                placeholder='请输入案件 ID'
                value={uploadCaseId}
                onChange={e => setUploadCaseId(e.target.value)}
                className='max-w-sm'
              />
              <p className='mt-1 text-xs text-zinc-400'>
                可在&quot;案件管理&quot;中查看案件 ID
              </p>
              <p className='mt-2 text-xs text-amber-600 dark:text-amber-400'>
                当前最稳支持：文本型 PDF、Word、TXT。扫描件 PDF
                可能无法自动提取。
              </p>
            </div>
            {uploadCaseId ? (
              <DocumentUpload
                caseId={uploadCaseId}
                onFilesUploaded={handleUploadSuccess}
              />
            ) : (
              <div className='rounded-lg border-2 border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-400 dark:border-zinc-700'>
                请先填写案件 ID 后再上传
              </div>
            )}
          </div>
        )}

        {/* 搜索栏 */}
        <form onSubmit={handleSearch} className='flex gap-3'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400' />
            <Input
              placeholder='搜索文件名...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className='pl-9'
            />
          </div>
          <Button type='submit' variant='outline'>
            搜索
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => {
              setSearchQuery('');
              void fetchDocuments();
            }}
          >
            <RefreshCw className='h-4 w-4' />
          </Button>
        </form>

        {/* 文档列表 */}
        {loading ? (
          <div className='flex items-center justify-center py-20'>
            <Loader2 className='h-8 w-8 animate-spin text-zinc-400' />
          </div>
        ) : error ? (
          <div className='flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400'>
            <AlertCircle className='h-5 w-5 shrink-0' />
            <span>{error}</span>
          </div>
        ) : analysisNotice ? (
          <div className='flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'>
            <Loader2 className='h-5 w-5 shrink-0 animate-spin' />
            <span>{analysisNotice}</span>
          </div>
        ) : documents.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-20 text-zinc-400'>
            <FileText className='mb-4 h-12 w-12' />
            <p className='text-sm'>暂无文档</p>
            <Button
              variant='outline'
              className='mt-4 gap-2'
              onClick={() => setShowUpload(true)}
            >
              <Upload className='h-4 w-4' />
              上传第一个文档
            </Button>
          </div>
        ) : (
          <div className='rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden'>
            <table className='w-full text-sm'>
              <thead className='border-b border-zinc-100 dark:border-zinc-800'>
                <tr className='text-left text-xs text-zinc-500 dark:text-zinc-400'>
                  <th className='px-4 py-3 font-medium'>文件名</th>
                  <th className='px-4 py-3 font-medium'>关联案件</th>
                  <th className='px-4 py-3 font-medium'>大小</th>
                  <th className='px-4 py-3 font-medium'>分析状态</th>
                  <th className='px-4 py-3 font-medium'>上传时间</th>
                  <th className='px-4 py-3 font-medium text-right'>操作</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-zinc-100 dark:divide-zinc-800'>
                {documents.map(doc => (
                  <tr
                    key={doc.id}
                    className='hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                  >
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-2'>
                        <FileText className='h-4 w-4 shrink-0 text-zinc-400' />
                        <div className='min-w-0'>
                          <span className='max-w-[200px] truncate font-medium text-zinc-900 dark:text-zinc-100 block'>
                            {doc.filename}
                          </span>
                          {getDocumentAdvice(doc) && (
                            <span className='block mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 max-w-[320px]'>
                              {getDocumentAdvice(doc)}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className='px-4 py-3'>
                      {doc.case ? (
                        <button
                          onClick={() => router.push(`/cases/${doc.case!.id}`)}
                          className='flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400'
                        >
                          <span className='max-w-[120px] truncate'>
                            {doc.case.title}
                          </span>
                          <ChevronRight className='h-3 w-3' />
                        </button>
                      ) : (
                        <span className='text-zinc-400'>—</span>
                      )}
                    </td>
                    <td className='px-4 py-3 text-zinc-500 dark:text-zinc-400'>
                      {formatFileSize(doc.fileSize)}
                    </td>
                    <td className='px-4 py-3'>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[doc.analysisStatus]}`}
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
                    </td>
                    <td className='px-4 py-3 text-zinc-500 dark:text-zinc-400'>
                      {new Date(doc.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center justify-end gap-2'>
                        {(doc.analysisStatus === 'PENDING' ||
                          doc.analysisStatus === 'FAILED') && (
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => handleAnalyze(doc.id)}
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
                        {doc.analysisStatus === 'COMPLETED' && (
                          <>
                            <Button
                              size='sm'
                              variant='ghost'
                              onClick={async () => {
                                if (expandedId === doc.id) {
                                  setExpandedId(null);
                                  return;
                                }

                                if (!doc.extractedData) {
                                  const extractedData =
                                    await loadDocumentAnalysisResult(doc.id);
                                  if (extractedData) {
                                    setDocuments(prev =>
                                      prev.map(item =>
                                        item.id === doc.id
                                          ? { ...item, extractedData }
                                          : item
                                      )
                                    );
                                  }
                                }

                                setExpandedId(doc.id);
                              }}
                              className='gap-1 text-xs'
                            >
                              {expandedId === doc.id ? (
                                <ChevronUp className='h-3.5 w-3.5' />
                              ) : (
                                <ChevronDown className='h-3.5 w-3.5' />
                              )}
                              {expandedId === doc.id ? '收起摘要' : '查看摘要'}
                            </Button>
                            {doc.case && (
                              <Button
                                size='sm'
                                variant='outline'
                                onClick={() =>
                                  router.push(`/cases/${doc.case!.id}`)
                                }
                                className='gap-1 text-xs'
                              >
                                <Eye className='h-3 w-3' />
                                进入案件
                              </Button>
                            )}
                          </>
                        )}
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => handleDelete(doc.id)}
                          disabled={deletingId === doc.id}
                          className='gap-1 text-xs text-red-600 hover:border-red-300 hover:bg-red-50 dark:text-red-400'
                        >
                          {deletingId === doc.id ? (
                            <Loader2 className='h-3 w-3 animate-spin' />
                          ) : (
                            <Trash2 className='h-3 w-3' />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {documents.map(
              doc =>
                expandedId === doc.id &&
                doc.extractedData && (
                  <div
                    key={`${doc.id}-summary`}
                    className='border-t border-zinc-100 px-4 pb-4 dark:border-zinc-800'
                  >
                    <AnalysisResult data={doc.extractedData} />
                    <div className='mt-3 flex gap-2'>
                      {doc.case && (
                        <Button
                          size='sm'
                          onClick={() => router.push(`/cases/${doc.case!.id}`)}
                          className='gap-1'
                        >
                          <ChevronRight className='h-3.5 w-3.5' />
                          去案件页继续办案
                        </Button>
                      )}
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => router.push('/chat')}
                        className='gap-1'
                      >
                        <FileText className='h-3.5 w-3.5' />
                        去聊天继续分析
                      </Button>
                    </div>
                  </div>
                )
            )}
          </div>
        )}
      </main>
    </div>
  );
}
