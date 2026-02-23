/**
 * 合同审批页面
 * 展示合同信息、审批流程、提交审批意见
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ApprovalFlow } from '@/components/contract/ApprovalFlow';
import { ArrowLeft, FileText, User, DollarSign, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ApprovalData {
  id: string;
  contractId: string;
  status: string;
  currentStep: number;
  createdBy: string;
  createdAt: string;
  completedAt?: string | null;
  steps: Array<{
    id: string;
    stepNumber: number;
    approverRole: string;
    approverId?: string | null;
    approverName?: string | null;
    status: string;
    decision?: string | null;
    comment?: string | null;
    completedAt?: string | null;
    createdAt: string;
  }>;
  contract: {
    contractNumber: string;
    clientName: string;
    totalFee: string;
    caseType: string;
    caseSummary: string;
    scope: string;
    feeType: string;
  };
}

export default function ContractApprovalPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const contractId = params.id as string;

  const [approval, setApproval] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [approvalDecision, setApprovalDecision] = useState<
    'APPROVE' | 'REJECT' | null
  >(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 获取审批信息
  useEffect(() => {
    fetchApproval();
  }, [contractId]);

  const fetchApproval = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/contracts/${contractId}/approval`);

      if (!response.ok) {
        throw new Error('获取审批信息失败');
      }

      const data = await response.json();
      setApproval(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取审批信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (stepId: string) => {
    setSelectedStepId(stepId);
    setApprovalDecision('APPROVE');
    setShowApprovalDialog(true);
  };

  const handleReject = (stepId: string) => {
    setSelectedStepId(stepId);
    setApprovalDecision('REJECT');
    setShowApprovalDialog(true);
  };

  const submitApproval = async () => {
    if (!selectedStepId || !approvalDecision) return;

    try {
      setSubmitting(true);
      const response = await fetch(
        `/api/contracts/${contractId}/approval/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stepId: selectedStepId,
            decision: approvalDecision,
            comment: approvalComment,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('提交审批失败');
      }

      // 刷新审批信息
      await fetchApproval();

      // 关闭对话框
      setShowApprovalDialog(false);
      setApprovalComment('');
      setSelectedStepId(null);
      setApprovalDecision(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '提交审批失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <div className='text-center'>
          <div className='h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent'></div>
          <p className='mt-2 text-sm text-gray-600'>加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !approval) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <div className='text-center'>
          <p className='text-red-600'>{error || '未找到审批信息'}</p>
          <button
            onClick={() => router.back()}
            className='mt-4 text-blue-600 hover:text-blue-800'
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='mx-auto max-w-5xl px-4 sm:px-6 lg:px-8'>
        {/* 头部 */}
        <div className='mb-6'>
          <button
            onClick={() => router.back()}
            className='flex items-center text-sm text-gray-600 hover:text-gray-900'
          >
            <ArrowLeft className='mr-1 h-4 w-4' />
            返回
          </button>
          <h1 className='mt-4 text-2xl font-bold text-gray-900'>合同审批</h1>
        </div>

        <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          {/* 左侧：合同信息 */}
          <div className='lg:col-span-1'>
            <div className='rounded-lg bg-white p-6 shadow'>
              <h2 className='text-lg font-semibold text-gray-900'>合同信息</h2>

              <div className='mt-4 space-y-4'>
                <div>
                  <div className='flex items-center gap-2 text-sm text-gray-500'>
                    <FileText className='h-4 w-4' />
                    <span>合同编号</span>
                  </div>
                  <p className='mt-1 text-sm font-medium text-gray-900'>
                    {approval.contract.contractNumber}
                  </p>
                </div>

                <div>
                  <div className='flex items-center gap-2 text-sm text-gray-500'>
                    <User className='h-4 w-4' />
                    <span>委托人</span>
                  </div>
                  <p className='mt-1 text-sm font-medium text-gray-900'>
                    {approval.contract.clientName}
                  </p>
                </div>

                <div>
                  <div className='flex items-center gap-2 text-sm text-gray-500'>
                    <DollarSign className='h-4 w-4' />
                    <span>合同金额</span>
                  </div>
                  <p className='mt-1 text-sm font-medium text-gray-900'>
                    ¥{Number(approval.contract.totalFee).toLocaleString()}
                  </p>
                </div>

                <div>
                  <div className='flex items-center gap-2 text-sm text-gray-500'>
                    <Calendar className='h-4 w-4' />
                    <span>案件类型</span>
                  </div>
                  <p className='mt-1 text-sm font-medium text-gray-900'>
                    {approval.contract.caseType}
                  </p>
                </div>

                <div>
                  <p className='text-sm text-gray-500'>案情摘要</p>
                  <p className='mt-1 text-sm text-gray-900'>
                    {approval.contract.caseSummary}
                  </p>
                </div>

                <div>
                  <p className='text-sm text-gray-500'>委托范围</p>
                  <p className='mt-1 text-sm text-gray-900'>
                    {approval.contract.scope}
                  </p>
                </div>

                <div>
                  <p className='text-sm text-gray-500'>收费方式</p>
                  <p className='mt-1 text-sm text-gray-900'>
                    {approval.contract.feeType === 'FIXED'
                      ? '固定收费'
                      : approval.contract.feeType === 'RISK'
                        ? '风险代理'
                        : approval.contract.feeType === 'HOURLY'
                          ? '计时收费'
                          : '混合收费'}
                  </p>
                </div>
              </div>

              <div className='mt-6'>
                <button
                  onClick={() => router.push(`/contracts/${contractId}`)}
                  className='w-full rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200'
                >
                  查看合同详情
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：审批流程 */}
          <div className='lg:col-span-2'>
            <div className='rounded-lg bg-white p-6 shadow'>
              <ApprovalFlow
                approval={{
                  ...approval,
                  status: approval.status as any,
                  createdAt: new Date(approval.createdAt),
                  completedAt: approval.completedAt
                    ? new Date(approval.completedAt)
                    : null,
                  steps: approval.steps.map(step => ({
                    ...step,
                    status: step.status as any,
                    createdAt: new Date(step.createdAt),
                    completedAt: step.completedAt
                      ? new Date(step.completedAt)
                      : null,
                  })),
                }}
                onApprove={handleApprove}
                onReject={handleReject}
                currentUserId={session?.user?.id || ''}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 审批对话框 */}
      {showApprovalDialog && (
        <div className='fixed inset-0 z-50 overflow-y-auto'>
          <div className='flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0'>
            <div
              className='fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity'
              onClick={() => setShowApprovalDialog(false)}
            ></div>

            <div className='inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle'>
              <div className='bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4'>
                <h3 className='text-lg font-medium leading-6 text-gray-900'>
                  {approvalDecision === 'APPROVE' ? '审批通过' : '审批拒绝'}
                </h3>
                <div className='mt-4'>
                  <label className='block text-sm font-medium text-gray-700'>
                    审批意见
                  </label>
                  <textarea
                    value={approvalComment}
                    onChange={e => setApprovalComment(e.target.value)}
                    rows={4}
                    className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                    placeholder={
                      approvalDecision === 'APPROVE'
                        ? '请输入审批意见（可选）'
                        : '请说明拒绝原因'
                    }
                  />
                </div>
              </div>
              <div className='bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6'>
                <button
                  type='button'
                  disabled={submitting}
                  onClick={submitApproval}
                  className={`inline-flex w-full justify-center rounded-md px-4 py-2 text-base font-medium text-white shadow-sm sm:ml-3 sm:w-auto sm:text-sm ${
                    approvalDecision === 'APPROVE'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {submitting ? '提交中...' : '确认'}
                </button>
                <button
                  type='button'
                  disabled={submitting}
                  onClick={() => setShowApprovalDialog(false)}
                  className='mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:mt-0 sm:w-auto sm:text-sm'
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
