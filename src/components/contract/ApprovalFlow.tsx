/**
 * 审批流程组件
 * 展示审批流程、当前步骤、审批历史
 */

'use client';

import { ApprovalStatus, StepStatus } from '@prisma/client';
import { CheckCircle, XCircle, Clock, User, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ApprovalStep {
  id: string;
  stepNumber: number;
  approverRole: string;
  approverId?: string | null;
  approverName?: string | null;
  status: StepStatus;
  decision?: string | null;
  comment?: string | null;
  completedAt?: Date | null;
  createdAt: Date;
}

interface ApprovalFlowProps {
  approval: {
    id: string;
    status: ApprovalStatus;
    currentStep: number;
    createdBy: string;
    createdAt: Date;
    completedAt?: Date | null;
    steps: ApprovalStep[];
  };
  onApprove?: (stepId: string) => void;
  onReject?: (stepId: string) => void;
  currentUserId?: string;
}

export function ApprovalFlow({
  approval,
  onApprove,
  onReject,
  currentUserId,
}: ApprovalFlowProps) {
  const getStepStatusIcon = (status: StepStatus) => {
    switch (status) {
      case StepStatus.APPROVED:
        return <CheckCircle className='h-6 w-6 text-green-500' />;
      case StepStatus.REJECTED:
        return <XCircle className='h-6 w-6 text-red-500' />;
      case StepStatus.PENDING:
        return <Clock className='h-6 w-6 text-yellow-500' />;
      case StepStatus.SKIPPED:
        return <div className='h-6 w-6 rounded-full bg-gray-300' />;
      default:
        return <Clock className='h-6 w-6 text-gray-400' />;
    }
  };

  const getStepStatusText = (status: StepStatus) => {
    switch (status) {
      case StepStatus.APPROVED:
        return '已通过';
      case StepStatus.REJECTED:
        return '已拒绝';
      case StepStatus.PENDING:
        return '待审批';
      case StepStatus.SKIPPED:
        return '已跳过';
      default:
        return '未知';
    }
  };

  const getApprovalStatusBadge = (status: ApprovalStatus) => {
    const badges = {
      [ApprovalStatus.PENDING]: (
        <span className='inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800'>
          待审批
        </span>
      ),
      [ApprovalStatus.IN_PROGRESS]: (
        <span className='inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800'>
          审批中
        </span>
      ),
      [ApprovalStatus.APPROVED]: (
        <span className='inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800'>
          已通过
        </span>
      ),
      [ApprovalStatus.REJECTED]: (
        <span className='inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800'>
          已拒绝
        </span>
      ),
      [ApprovalStatus.CANCELLED]: (
        <span className='inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800'>
          已取消
        </span>
      ),
    };
    return badges[status];
  };

  const canApprove = (step: ApprovalStep) => {
    return (
      currentUserId &&
      step.status === StepStatus.PENDING &&
      step.approverId === currentUserId &&
      approval.status === ApprovalStatus.IN_PROGRESS
    );
  };

  return (
    <div className='space-y-6'>
      {/* 审批状态头部 */}
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold text-gray-900'>审批流程</h3>
          <p className='mt-1 text-sm text-gray-500'>
            发起时间：
            {format(new Date(approval.createdAt), 'yyyy-MM-dd HH:mm', {
              locale: zhCN,
            })}
          </p>
        </div>
        {getApprovalStatusBadge(approval.status)}
      </div>

      {/* 审批流程时间线 */}
      <div className='flow-root'>
        <ul className='-mb-8'>
          {approval.steps.map((step, stepIdx) => {
            const isCurrentStep = step.stepNumber === approval.currentStep;
            const isPending = step.status === StepStatus.PENDING;
            const canUserApprove = canApprove(step);

            return (
              <li key={step.id}>
                <div className='relative pb-8'>
                  {/* 连接线 */}
                  {stepIdx !== approval.steps.length - 1 && (
                    <span
                      className='absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200'
                      aria-hidden='true'
                    />
                  )}

                  <div className='relative flex space-x-3'>
                    {/* 步骤图标 */}
                    <div>
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          isCurrentStep && isPending
                            ? 'ring-4 ring-blue-100'
                            : ''
                        }`}
                      >
                        {getStepStatusIcon(step.status)}
                      </span>
                    </div>

                    {/* 步骤内容 */}
                    <div className='flex min-w-0 flex-1 justify-between space-x-4'>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <p className='text-sm font-medium text-gray-900'>
                            第{step.stepNumber}步：{step.approverRole}
                          </p>
                          {isCurrentStep && isPending && (
                            <span className='inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800'>
                              当前步骤
                            </span>
                          )}
                        </div>

                        {/* 审批人信息 */}
                        <div className='mt-1 flex items-center gap-2 text-sm text-gray-500'>
                          <User className='h-4 w-4' />
                          <span>
                            {step.approverName || step.approverId || '待指定'}
                          </span>
                        </div>

                        {/* 审批状态 */}
                        <div className='mt-2'>
                          <span
                            className={`inline-flex items-center text-sm ${
                              step.status === StepStatus.APPROVED
                                ? 'text-green-600'
                                : step.status === StepStatus.REJECTED
                                  ? 'text-red-600'
                                  : step.status === StepStatus.PENDING
                                    ? 'text-yellow-600'
                                    : 'text-gray-500'
                            }`}
                          >
                            {getStepStatusText(step.status)}
                          </span>
                        </div>

                        {/* 审批意见 */}
                        {step.comment && (
                          <div className='mt-2 rounded-md bg-gray-50 p-3'>
                            <div className='flex items-start gap-2'>
                              <MessageSquare className='h-4 w-4 text-gray-400 mt-0.5' />
                              <div className='flex-1'>
                                <p className='text-xs font-medium text-gray-700'>
                                  审批意见：
                                </p>
                                <p className='mt-1 text-sm text-gray-600'>
                                  {step.comment}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 审批操作按钮 */}
                        {canUserApprove && onApprove && onReject && (
                          <div className='mt-3 flex gap-2'>
                            <button
                              onClick={() => onApprove(step.id)}
                              className='inline-flex items-center rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600'
                            >
                              <CheckCircle className='mr-1.5 h-4 w-4' />
                              通过
                            </button>
                            <button
                              onClick={() => onReject(step.id)}
                              className='inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600'
                            >
                              <XCircle className='mr-1.5 h-4 w-4' />
                              拒绝
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 完成时间 */}
                      <div className='whitespace-nowrap text-right text-sm text-gray-500'>
                        {step.completedAt && (
                          <time
                            dateTime={new Date(step.completedAt).toISOString()}
                          >
                            {format(new Date(step.completedAt), 'MM-dd HH:mm', {
                              locale: zhCN,
                            })}
                          </time>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 审批完成信息 */}
      {approval.completedAt && (
        <div
          className={`rounded-lg p-4 ${
            approval.status === ApprovalStatus.APPROVED
              ? 'bg-green-50 border border-green-200'
              : approval.status === ApprovalStatus.REJECTED
                ? 'bg-red-50 border border-red-200'
                : 'bg-gray-50 border border-gray-200'
          }`}
        >
          <div className='flex items-center gap-2'>
            {approval.status === ApprovalStatus.APPROVED ? (
              <CheckCircle className='h-5 w-5 text-green-600' />
            ) : approval.status === ApprovalStatus.REJECTED ? (
              <XCircle className='h-5 w-5 text-red-600' />
            ) : (
              <Clock className='h-5 w-5 text-gray-600' />
            )}
            <div>
              <p
                className={`text-sm font-medium ${
                  approval.status === ApprovalStatus.APPROVED
                    ? 'text-green-800'
                    : approval.status === ApprovalStatus.REJECTED
                      ? 'text-red-800'
                      : 'text-gray-800'
                }`}
              >
                {approval.status === ApprovalStatus.APPROVED
                  ? '审批已通过'
                  : approval.status === ApprovalStatus.REJECTED
                    ? '审批已拒绝'
                    : '审批已结束'}
              </p>
              <p className='mt-1 text-xs text-gray-600'>
                完成时间：
                {format(new Date(approval.completedAt), 'yyyy-MM-dd HH:mm', {
                  locale: zhCN,
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
