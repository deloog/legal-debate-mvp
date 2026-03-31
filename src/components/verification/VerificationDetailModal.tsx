'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { AlertCircle, CheckCircle, Lightbulb, Clock } from 'lucide-react';

interface VerificationIssue {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  message: string;
  suggestion?: string;
}

interface VerificationSuggestion {
  id: string;
  type: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  action: string;
  reason: string;
  estimatedImpact: string;
}

interface VerificationData {
  overview: {
    overallScore: number;
    factualAccuracy: number;
    logicalConsistency: number;
    taskCompleteness: number;
    passed: boolean;
    verifiedAt: string;
  };
  issues: {
    factual: VerificationIssue[];
    logical: VerificationIssue[];
    completeness: VerificationIssue[];
    total: number;
  };
  suggestions: VerificationSuggestion[];
  verificationTime: number;
}

export interface VerificationDetailModalProps {
  argumentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function VerificationDetailModal({
  argumentId,
  isOpen,
  onClose,
}: VerificationDetailModalProps) {
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && argumentId) {
      fetchVerificationData();
    }
  }, [isOpen, argumentId]);

  const fetchVerificationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/arguments/${argumentId}/verification`
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '获取验证数据失败');
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <CheckCircle className='w-5 h-5 text-blue-600' />
            论点验证详情
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className='space-y-4'>
            <Skeleton className='h-20 w-full' />
            <Skeleton className='h-32 w-full' />
            <Skeleton className='h-24 w-full' />
          </div>
        )}

        {error && (
          <div className='flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg'>
            <AlertCircle className='w-5 h-5' />
            <p>{error}</p>
          </div>
        )}

        {data && (
          <div className='space-y-6'>
            {/* 验证概览 */}
            <div className='grid grid-cols-2 gap-4'>
              <div
                className={`p-4 rounded-lg border ${getScoreColor(data.overview.overallScore)}`}
              >
                <div className='text-sm text-gray-600 mb-1'>综合评分</div>
                <div className='text-3xl font-bold'>
                  {(data.overview.overallScore * 100).toFixed(0)}分
                </div>
                <div className='text-xs mt-1'>
                  {data.overview.passed ? '✓ 通过验证' : '✗ 未通过验证'}
                </div>
              </div>

              <div className='space-y-2'>
                <div
                  className={`p-2 rounded border text-sm ${getScoreColor(data.overview.factualAccuracy)}`}
                >
                  事实准确性: {(data.overview.factualAccuracy * 100).toFixed(0)}
                  %
                </div>
                <div
                  className={`p-2 rounded border text-sm ${getScoreColor(data.overview.logicalConsistency)}`}
                >
                  逻辑一致性:{' '}
                  {(data.overview.logicalConsistency * 100).toFixed(0)}%
                </div>
                <div
                  className={`p-2 rounded border text-sm ${getScoreColor(data.overview.taskCompleteness)}`}
                >
                  任务完成度:{' '}
                  {(data.overview.taskCompleteness * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* 验证时间 */}
            <div className='flex items-center gap-2 text-sm text-gray-500'>
              <Clock className='w-4 h-4' />
              <span>验证耗时: {data.verificationTime}ms</span>
              <span>•</span>
              <span>
                验证时间:{' '}
                {new Date(data.overview.verifiedAt).toLocaleString('zh-CN')}
              </span>
            </div>

            {/* 问题与建议标签页 */}
            <Tabs defaultValue='issues'>
              <TabsList className='grid w-full grid-cols-2'>
                <TabsTrigger value='issues'>
                  问题发现 ({data.issues.total})
                </TabsTrigger>
                <TabsTrigger value='suggestions'>
                  改进建议 ({data.suggestions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value='issues' className='space-y-4'>
                {data.issues.total === 0 ? (
                  <div className='text-center py-8 text-green-600'>
                    <CheckCircle className='w-12 h-12 mx-auto mb-2' />
                    <p>未发现明显问题</p>
                  </div>
                ) : (
                  <>
                    {data.issues.factual.length > 0 && (
                      <div>
                        <h4 className='font-medium text-red-700 mb-2 flex items-center gap-2'>
                          <AlertCircle className='w-4 h-4' />
                          事实准确性问题 ({data.issues.factual.length})
                        </h4>
                        <div className='space-y-2'>
                          {data.issues.factual.map(issue => (
                            <div
                              key={issue.id}
                              className='p-3 bg-red-50 rounded border border-red-200'
                            >
                              <div className='flex items-start justify-between'>
                                <p className='text-sm text-red-800'>
                                  {issue.message}
                                </p>
                                <Badge
                                  className={getSeverityColor(issue.severity)}
                                >
                                  {issue.severity}
                                </Badge>
                              </div>
                              {issue.suggestion && (
                                <p className='text-xs text-red-600 mt-1'>
                                  建议: {issue.suggestion}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {data.issues.logical.length > 0 && (
                      <div>
                        <h4 className='font-medium text-orange-700 mb-2 flex items-center gap-2'>
                          <AlertCircle className='w-4 h-4' />
                          逻辑一致性问题 ({data.issues.logical.length})
                        </h4>
                        <div className='space-y-2'>
                          {data.issues.logical.map(issue => (
                            <div
                              key={issue.id}
                              className='p-3 bg-orange-50 rounded border border-orange-200'
                            >
                              <div className='flex items-start justify-between'>
                                <p className='text-sm text-orange-800'>
                                  {issue.message}
                                </p>
                                <Badge
                                  className={getSeverityColor(issue.severity)}
                                >
                                  {issue.severity}
                                </Badge>
                              </div>
                              {issue.suggestion && (
                                <p className='text-xs text-orange-600 mt-1'>
                                  建议: {issue.suggestion}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {data.issues.completeness.length > 0 && (
                      <div>
                        <h4 className='font-medium text-yellow-700 mb-2 flex items-center gap-2'>
                          <AlertCircle className='w-4 h-4' />
                          任务完成度问题 ({data.issues.completeness.length})
                        </h4>
                        <div className='space-y-2'>
                          {data.issues.completeness.map(issue => (
                            <div
                              key={issue.id}
                              className='p-3 bg-yellow-50 rounded border border-yellow-200'
                            >
                              <div className='flex items-start justify-between'>
                                <p className='text-sm text-yellow-800'>
                                  {issue.message}
                                </p>
                                <Badge
                                  className={getSeverityColor(issue.severity)}
                                >
                                  {issue.severity}
                                </Badge>
                              </div>
                              {issue.suggestion && (
                                <p className='text-xs text-yellow-600 mt-1'>
                                  建议: {issue.suggestion}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value='suggestions' className='space-y-4'>
                {data.suggestions.length === 0 ? (
                  <div className='text-center py-8 text-gray-500'>
                    <Lightbulb className='w-12 h-12 mx-auto mb-2' />
                    <p>暂无改进建议</p>
                  </div>
                ) : (
                  <div className='space-y-3'>
                    {data.suggestions.map(suggestion => (
                      <div
                        key={suggestion.id}
                        className='p-3 bg-blue-50 rounded border border-blue-200'
                      >
                        <div className='flex items-start justify-between mb-2'>
                          <h5 className='font-medium text-blue-900 text-sm'>
                            {suggestion.action}
                          </h5>
                          <Badge
                            className={getPriorityColor(suggestion.priority)}
                          >
                            {suggestion.priority}
                          </Badge>
                        </div>
                        <p className='text-sm text-blue-800 mb-1'>
                          {suggestion.reason}
                        </p>
                        <p className='text-xs text-blue-600'>
                          预期影响: {suggestion.estimatedImpact}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
