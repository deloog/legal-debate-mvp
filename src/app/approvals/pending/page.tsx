/**
 * 待审批合同列表页面
 * 展示所有待审批的合同，供审批人查看和操作
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface PendingApproval {
  id: string;
  contractId: string;
  status: string;
  createdAt: string;
  contract: {
    contractNumber: string;
    clientName: string;
    caseType: string;
    totalFee: number;
    lawyerName: string;
  };
}

export default function PendingApprovalsPage() {
  const router = useRouter();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  async function loadPendingApprovals() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/contracts/approvals/pending');

      if (!response.ok) {
        // 尝试 fallback：获取所有审批列表
        const fallback = await fetch('/api/contracts?status=DRAFT');
        if (fallback.ok) {
          const data = await fallback.json();
          // 模拟从草稿合同中获取审批列表
          const items = (data.data?.items || []).map(
            (c: Record<string, unknown>) => ({
              id: String(c.id),
              contractId: String(c.id),
              status: 'PENDING',
              createdAt: String(c.createdAt),
              contract: {
                contractNumber: String(c.contractNumber),
                clientName: String(c.clientName),
                caseType: String(c.caseType),
                totalFee: Number(c.totalFee),
                lawyerName: String(c.lawyerName || ''),
              },
            })
          );
          setApprovals(items);
        } else {
          setApprovals([]);
        }
        return;
      }

      const result = await response.json();
      setApprovals(result.data || []);
    } catch {
      // fallback：获取所有合同
      try {
        const fallback = await fetch('/api/contracts');
        if (fallback.ok) {
          const data = await fallback.json();
          const items = (data.data?.items || []).map(
            (c: Record<string, unknown>) => ({
              id: String(c.id),
              contractId: String(c.id),
              status: 'PENDING',
              createdAt: String(c.createdAt),
              contract: {
                contractNumber: String(c.contractNumber),
                clientName: String(c.clientName),
                caseType: String(c.caseType),
                totalFee: Number(c.totalFee),
                lawyerName: String(c.lawyerName || ''),
              },
            })
          );
          setApprovals(items);
        } else {
          setApprovals([]);
        }
      } catch {
        setApprovals([]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='mx-auto max-w-4xl'>
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-900'>待审批合同</h1>
          <p className='mt-1 text-sm text-gray-500'>查看需要您审批的合同列表</p>
        </div>

        {error && (
          <div className='mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800'>
            {error}
          </div>
        )}

        <div className='rounded-lg bg-white shadow'>
          {loading ? (
            <div className='p-8 text-center text-gray-500'>加载中...</div>
          ) : approvals.length === 0 ? (
            <div className='p-8 text-center text-gray-500'>暂无待审批合同</div>
          ) : (
            <div className='divide-y divide-gray-200'>
              {approvals.map(approval => (
                <div
                  key={approval.id}
                  className='flex items-center justify-between p-6 hover:bg-gray-50'
                >
                  <div className='flex-1'>
                    <div className='flex items-center gap-3'>
                      <button
                        onClick={() =>
                          router.push(
                            `/contracts/${approval.contractId}/approval`
                          )
                        }
                        className='text-base font-medium text-blue-600 hover:text-blue-800 hover:underline'
                      >
                        {approval.contract.clientName}
                      </button>
                      <span className='inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800'>
                        待审批
                      </span>
                    </div>
                    <div className='mt-1 flex items-center gap-4 text-sm text-gray-500'>
                      <span>合同号：{approval.contract.contractNumber}</span>
                      <span>类型：{approval.contract.caseType}</span>
                      <span>
                        金额：¥
                        {Number(approval.contract.totalFee).toLocaleString()}
                      </span>
                    </div>
                    <p className='mt-1 text-xs text-gray-400'>
                      发起时间：{new Date(approval.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className='ml-4'>
                    <button
                      onClick={() =>
                        router.push(
                          `/contracts/${approval.contractId}/approval`
                        )
                      }
                      className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
                    >
                      查看审批
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
