'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  ArrowRight,
  Phone,
  Mail,
  Building,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import {
  CONSULTATION_TYPE_LABELS,
  CONSULT_STATUS_LABELS,
  CONSULT_STATUS_COLORS,
  ConsultationType,
  ConsultStatus,
} from '@/types/consultation';

/**
 * 咨询详情数据接口
 */
interface ConsultationDetail {
  id: string;
  consultNumber: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  clientCompany: string | null;
  consultType: ConsultationType;
  consultTime: string;
  caseType: string | null;
  caseSummary: string;
  clientDemand: string | null;
  status: ConsultStatus;
  followUpDate: string | null;
  followUpNotes: string | null;
  aiAssessment: unknown | null;
  winRate: number | null;
  difficulty: string | null;
  riskLevel: string | null;
  suggestedFee: number | null;
  convertedToCaseId: string | null;
  convertedAt: string | null;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  followUps: Array<{
    id: string;
    followUpTime: string;
    followUpType: string;
    content: string;
    result: string | null;
    nextFollowUp: string | null;
    createdBy: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * 咨询详情页面
 */
export default function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [consultation, setConsultation] = useState<ConsultationDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取咨询详情
  useEffect(() => {
    const fetchConsultation = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/consultations/${id}`);
        
        if (!response.ok) {
          throw new Error(`请求失败: ${response.status}`);
        }
        
        const data = await response.json();

        if (data.success && data.data) {
          setConsultation(data.data);
        } else {
          setError(data.error?.message || '获取咨询详情失败');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '网络错误，请重试');
      } finally {
        setLoading(false);
      }
    };

    fetchConsultation();
  }, [id]);

  // 处理转化为案件
  const handleConvert = () => {
    if (!confirm('确定要将此咨询转化为案件吗？')) {
      return;
    }
    router.push(`/cases/create?consultationId=${id}`);
  };

  // 格式化日期
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化日期（仅日期）
  const formatDateOnly = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // 获取难度颜色
  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case 'EASY':
        return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20';
      case 'HARD':
        return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20';
      default:
        return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20';
    }
  };

  // 获取难度标签
  const getDifficultyLabel = (difficulty: string | null) => {
    switch (difficulty) {
      case 'EASY':
        return '简单';
      case 'MEDIUM':
        return '中等';
      case 'HARD':
        return '复杂';
      default:
        return '未评估';
    }
  };

  // 获取风险颜色
  const getRiskColor = (riskLevel: string | null) => {
    switch (riskLevel) {
      case 'LOW':
        return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20';
      case 'HIGH':
        return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20';
      default:
        return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20';
    }
  };

  // 获取风险标签
  const getRiskLabel = (riskLevel: string | null) => {
    switch (riskLevel) {
      case 'LOW':
        return '低风险';
      case 'MEDIUM':
        return '中风险';
      case 'HIGH':
        return '高风险';
      default:
        return '未评估';
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: ConsultStatus) => {
    const colors = CONSULT_STATUS_COLORS[status];
    const colorMap: Record<string, string> = {
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      green:
        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return colorMap[colors] || colorMap.gray;
  };

  // 加载状态
  if (loading) {
    return (
      <div className='min-h-screen bg-zinc-50 dark:bg-black'>
        <div className='mx-auto max-w-5xl px-6 py-8'>
          <div className='animate-pulse space-y-6'>
            <div className='h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800' />
            <div className='grid gap-6 md:grid-cols-2'>
              <div className='h-64 rounded-lg bg-zinc-200 dark:bg-zinc-800' />
              <div className='h-64 rounded-lg bg-zinc-200 dark:bg-zinc-800' />
            </div>
            <div className='h-48 rounded-lg bg-zinc-200 dark:bg-zinc-800' />
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error || !consultation) {
    return (
      <div className='min-h-screen bg-zinc-50 dark:bg-black'>
        <div className='mx-auto max-w-5xl px-6 py-8'>
          <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20'>
            <AlertCircle className='mx-auto h-12 w-12 text-red-500' />
            <h2 className='mt-4 text-lg font-semibold text-red-800 dark:text-red-200'>
              加载失败
            </h2>
            <p className='mt-2 text-sm text-red-600 dark:text-red-300'>
              {error || '咨询记录不存在'}
            </p>
            <Link
              href='/consultations'
              className='mt-4 inline-flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50'
            >
              <ArrowLeft className='h-4 w-4' />
              返回列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-5xl items-center justify-between'>
          <div className='flex items-center gap-4'>
            <Link
              href='/consultations'
              className='flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
            >
              <ArrowLeft className='h-4 w-4' />
              返回列表
            </Link>
            <div>
              <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
                咨询详情 - {consultation.consultNumber}
              </h1>
              <div className='mt-1 flex items-center gap-2'>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${getStatusColor(consultation.status)}`}
                >
                  {CONSULT_STATUS_LABELS[consultation.status]}
                </span>
                <span className='text-sm text-zinc-500 dark:text-zinc-400'>
                  {CONSULTATION_TYPE_LABELS[consultation.consultType]}
                </span>
              </div>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Link
              href={`/consultations/${id}/edit`}
              className='flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            >
              <Edit className='h-4 w-4' />
              编辑
            </Link>
            {consultation.status !== ConsultStatus.CONVERTED && (
              <button
                onClick={handleConvert}
                className='flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700'
              >
                <ArrowRight className='h-4 w-4' />
                转为案件
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-5xl px-6 py-6'>
        <div className='grid gap-6 lg:grid-cols-3'>
          {/* 左侧：基本信息 */}
          <div className='lg:col-span-2 space-y-6'>
            {/* 基本信息卡片 */}
            <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
              <h2 className='mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                基本信息
              </h2>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='flex items-center gap-3'>
                  <FileText className='h-5 w-5 text-zinc-400' />
                  <div>
                    <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                      咨询人
                    </p>
                    <p className='font-medium text-zinc-900 dark:text-zinc-50'>
                      {consultation.clientName}
                    </p>
                  </div>
                </div>
                {consultation.clientPhone && (
                  <div className='flex items-center gap-3'>
                    <Phone className='h-5 w-5 text-zinc-400' />
                    <div>
                      <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                        联系电话
                      </p>
                      <p className='font-medium text-zinc-900 dark:text-zinc-50'>
                        {consultation.clientPhone}
                      </p>
                    </div>
                  </div>
                )}
                {consultation.clientEmail && (
                  <div className='flex items-center gap-3'>
                    <Mail className='h-5 w-5 text-zinc-400' />
                    <div>
                      <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                        电子邮箱
                      </p>
                      <p className='font-medium text-zinc-900 dark:text-zinc-50'>
                        {consultation.clientEmail}
                      </p>
                    </div>
                  </div>
                )}
                {consultation.clientCompany && (
                  <div className='flex items-center gap-3'>
                    <Building className='h-5 w-5 text-zinc-400' />
                    <div>
                      <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                        单位名称
                      </p>
                      <p className='font-medium text-zinc-900 dark:text-zinc-50'>
                        {consultation.clientCompany}
                      </p>
                    </div>
                  </div>
                )}
                <div className='flex items-center gap-3'>
                  <Calendar className='h-5 w-5 text-zinc-400' />
                  <div>
                    <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                      咨询时间
                    </p>
                    <p className='font-medium text-zinc-900 dark:text-zinc-50'>
                      {formatDate(consultation.consultTime)}
                    </p>
                  </div>
                </div>
                {consultation.caseType && (
                  <div className='flex items-center gap-3'>
                    <FileText className='h-5 w-5 text-zinc-400' />
                    <div>
                      <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                        案件类型
                      </p>
                      <p className='font-medium text-zinc-900 dark:text-zinc-50'>
                        {consultation.caseType}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 案情摘要卡片 */}
            <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
              <h2 className='mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                案情摘要
              </h2>
              <p className='whitespace-pre-wrap text-zinc-700 dark:text-zinc-300'>
                {consultation.caseSummary}
              </p>
            </div>

            {/* 客户诉求卡片 */}
            {consultation.clientDemand && (
              <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
                <h2 className='mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                  客户诉求
                </h2>
                <p className='whitespace-pre-wrap text-zinc-700 dark:text-zinc-300'>
                  {consultation.clientDemand}
                </p>
              </div>
            )}

            {/* 跟进记录卡片 */}
            <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                  跟进记录
                </h2>
                <button className='flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40'>
                  添加记录
                </button>
              </div>

              {consultation.followUps.length === 0 ? (
                <div className='rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900'>
                  <Clock className='mx-auto h-12 w-12 text-zinc-400' />
                  <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>
                    暂无跟进记录
                  </p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {consultation.followUps.map((followUp, index) => (
                    <div
                      key={followUp.id}
                      className='relative border-l-2 border-zinc-200 pl-4 dark:border-zinc-700'
                    >
                      <div className='absolute -left-1.5 top-0 h-3 w-3 rounded-full bg-blue-500' />
                      <div className='flex items-start justify-between'>
                        <div>
                          <p className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                            {followUp.followUpType}
                          </p>
                          <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
                            {followUp.content}
                          </p>
                          {followUp.result && (
                            <p className='mt-1 text-sm text-green-600 dark:text-green-400'>
                              结果：{followUp.result}
                            </p>
                          )}
                        </div>
                        <span className='text-xs text-zinc-500 dark:text-zinc-400'>
                          {formatDate(followUp.followUpTime)}
                        </span>
                      </div>
                      {index < consultation.followUps.length - 1 && (
                        <div className='absolute -left-px top-3 h-full w-0.5 bg-zinc-200 dark:bg-zinc-700' />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：AI评估和跟进信息 */}
          <div className='space-y-6'>
            {/* AI案件评估卡片 */}
            <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                  AI案件评估
                </h2>
                <button className='flex items-center gap-1 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'>
                  <RefreshCw className='h-4 w-4' />
                </button>
              </div>

              {consultation.winRate !== null ? (
                <div className='space-y-4'>
                  {/* 胜诉率 */}
                  <div>
                    <div className='mb-2 flex items-center justify-between'>
                      <span className='text-sm text-zinc-600 dark:text-zinc-400'>
                        胜诉率评估
                      </span>
                      <span className='font-semibold text-zinc-900 dark:text-zinc-50'>
                        {Math.round(consultation.winRate * 100)}%
                      </span>
                    </div>
                    <div className='h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700'>
                      <div
                        className='h-full rounded-full bg-blue-500 transition-all'
                        style={{
                          width: `${Math.round(consultation.winRate * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 难度和风险 */}
                  <div className='grid grid-cols-2 gap-4'>
                    <div>
                      <p className='mb-1 text-xs text-zinc-500 dark:text-zinc-400'>
                        案件难度
                      </p>
                      <span
                        className={`inline-block rounded px-2 py-1 text-sm font-medium ${getDifficultyColor(consultation.difficulty)}`}
                      >
                        {getDifficultyLabel(consultation.difficulty)}
                      </span>
                    </div>
                    <div>
                      <p className='mb-1 text-xs text-zinc-500 dark:text-zinc-400'>
                        风险等级
                      </p>
                      <span
                        className={`inline-block rounded px-2 py-1 text-sm font-medium ${getRiskColor(consultation.riskLevel)}`}
                      >
                        {getRiskLabel(consultation.riskLevel)}
                      </span>
                    </div>
                  </div>

                  {/* 建议收费 */}
                  {consultation.suggestedFee && (
                    <div className='flex items-center gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900'>
                      <DollarSign className='h-5 w-5 text-green-500' />
                      <div>
                        <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                          建议收费
                        </p>
                        <p className='font-semibold text-zinc-900 dark:text-zinc-50'>
                          ¥{consultation.suggestedFee.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className='rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900'>
                  <TrendingUp className='mx-auto h-10 w-10 text-zinc-400' />
                  <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>
                    暂无评估数据
                  </p>
                  <button className='mt-3 rounded-md bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40'>
                    立即评估
                  </button>
                </div>
              )}
            </div>

            {/* 跟进提醒卡片 */}
            <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
              <h2 className='mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                跟进提醒
              </h2>
              {consultation.followUpDate ? (
                <div className='flex items-center gap-3'>
                  <Calendar className='h-5 w-5 text-blue-500' />
                  <div>
                    <p className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                      {formatDateOnly(consultation.followUpDate)}
                    </p>
                    {consultation.followUpNotes && (
                      <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
                        {consultation.followUpNotes}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className='text-center text-sm text-zinc-500 dark:text-zinc-400'>
                  未设置跟进日期
                </div>
              )}
            </div>

            {/* 转化信息卡片 */}
            {consultation.convertedToCaseId && (
              <div className='rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20'>
                <div className='flex items-center gap-3'>
                  <CheckCircle className='h-6 w-6 text-green-500' />
                  <div>
                    <p className='font-medium text-green-800 dark:text-green-200'>
                      已转化为案件
                    </p>
                    <p className='mt-1 text-sm text-green-600 dark:text-green-300'>
                      转化时间：{formatDate(consultation.convertedAt)}
                    </p>
                    <Link
                      href={`/cases/${consultation.convertedToCaseId}`}
                      className='mt-2 inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800 dark:text-green-300 dark:hover:text-green-200'
                    >
                      查看案件详情
                      <ArrowRight className='h-4 w-4' />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* 负责律师卡片 */}
            <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
              <h2 className='mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                负责律师
              </h2>
              <div className='flex items-center gap-3'>
                <div className='flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'>
                  {(consultation.user.name ||
                    consultation.user.email)[0].toUpperCase()}
                </div>
                <div>
                  <p className='font-medium text-zinc-900 dark:text-zinc-50'>
                    {consultation.user.name || '未设置姓名'}
                  </p>
                  <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                    {consultation.user.email}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
